"use strict";

//TODO: auto-route TOROUTE, height lookup?
// TODO: check handling of modify list while waiting height lookup

/**
 * This file contains implementation of the data structures used for TrackScribe.
 * 
 * Top-level data structure is a linked list of nodes.
 * 
 * Each node contains a path, which is an array of LatLng coordinates. 
 * The first node is a HOME node and contains a single point in the path. 
 * In all other nodes, the first point of the node is shared (same LatLng object)
 * with the terminal path point of the previous node.
 * 
 * Each LatLng coordinate may contain a series of child points, which are a series
 * of points generated when doing elevation lookup - these points should be collinear
 * from point to next point in x,y plane (on a mercator projection) but contain
 * different heights.
 * 
 *   
 */


/**
 * Enum-link of possible node types.
 * 
 */
var tsNodeTypes = {
	PATH: 		{value:-11, name: "Path point"							}, // not a real node 'type, used for file reading/writing
	HOME: 		{value:  1, name: "Home node", 	 	color : "darkblue"	}, // first node, has a one point path
	MANUAL: 	{value: 10, name: "Manual node", 	color : "skyblue"	}, // manually draw path
	TOROUTE: 	{value: 20, name: "Node to route", 	color : "mediumblue"}, // auto-routed, awaiting route return
	ROUTED: 	{value: 21, name: "Routed node", 	color : "mediumblue"}, // auto-routed, 
};

var tsNodeTypesRev = tsGenerateReverseDict(tsNodeTypes); // allow reverse lookup of node types


/**
 * tsNode is an element of the top-level link list.
 * Contains:
 *  references for linked-list implementation
 * 	type
 *  path - array of LatLng coords, implemented as google MVCArray
 *  other data - e.g. length
 *  overlays and state - for display on map and controlling behaviour
 *  
 * Note that terminal point in path of one node is used also as first point
 * in path of next node.
 * 
 * For all nodes, the path is displayed as a polyline. Terminal point is shown
 * as a marker that can be moved. As terminal point is shared with first point
 * of next node, moving terminus also causes affects node.  
 *  
 * General behaviour of nodes depending on type:
 * 	MANUAL node
 * 		each point is drawn manually, and path may be editable
 * 		editable path drawn with each point as a marker by maps framework
 *
 *  TOROUTE node
 *  	routed node which has not yet been properly routed
 *  	calls directions service to find route
 *  
 *  ROUTED node
 * 		converted from TOROUTE node once directions service returns a routed path
 * 		not manually editable
 * 		moving markers will cause rerouting of the path, conversion back to TOROUTE 
 * 		
 * 
 * 
 * 
 */

var tsNode = {
};

/**
 * Initialize a this node with a type and latLng.
 * Should be called after creating a new node.
 */
tsNode.initialize  = function (type, latLng) {
	tsAssert(this.type === undefined);
	tsAssert(type);
	tsAssert(latLng instanceof google.maps.LatLng);
	
	// state
	this.deactivateListeners();
	
	// data
	this.type = type;
	this.path = new google.maps.MVCArray();
	this.path.push(latLng);
	this.addPathListeners();
	this.cumulLength = null; // number or null, which indicates invalid/need recalculation
	
	// for map overlays
	this.marker = null;
	this.polyline = null;
	this.kmMarkers = null;
	
	// for elevation plot
	this.plot_group = null;
	
	// for linked-list
	this.previous = null; // use setPrevious to set correctly
	this.next = null;
	
	//this.owner = null; // single owner for all nodes, see below
};

/**
 * Deactivate path listeners, use when programmatically 
 * manipulating path but want these changes ignored
 * by listeners.
 * 
 */
tsNode.deactivateListeners = function() {
	this.listenersActive = false;	
};

/**
 * Reactivate path listeners, use when finished
 * manipulating path.
 * 
 */
tsNode.activateListeners = function()  {
	this.listenersActive = true;	
};


/**
 * Prepare for deletion.
 * Ensure all contents reset.
 */ 
tsNode.clear = function() {
	this.type = null;
	this.clearPath();
	this.clearMapOverlays();
	this.previous = this.next = null;
};

/**
 * Empty and invalidate path, including removal of any listeners.
 */ 
tsNode.clearPath = function() {
	google.maps.event.clearInstanceListeners(this.path);
	this.path.clear();
	this.path = null;
};

/**
 * Add listeners for a change to the path. 
 * Any edits to the path (manual or programmatic) 
 * will trigger these listeners
 */
tsNode.addPathListeners = function() {
	var that = this;
	
	function pathListenerCallback(index) {
		if (!that.listenersActive) return;
		that.pathEdited(index);
		that.owner.update();
	}
	
	google.maps.event.addListener(this.path, "dragend", function() {
		// this event is never called
		tsAssert(false, "path dragend event");
	});
    google.maps.event.addListener(this.path, "insert_at", pathListenerCallback);
    google.maps.event.addListener(this.path, "remove_at", pathListenerCallback);
    google.maps.event.addListener(this.path, "set_at", pathListenerCallback);
		
};


/**
 * Signal to node that its path has been edited
 * 
 * @param index
 * index of point in path that was edited or null
 * 
 * Will invalid any parameters of point in path that are
 * affected by this change.
 * Call to update (handled by owning list) will recalculate
 * these parameters.
 * 
 */
tsNode.pathEdited = function(index) {
	this.cumulLength = null; // invalid, forces all points in node to recalc length
		// propagated downstream by list update
	
	// TODO: check a new element is set at index
	
	if (index>0) {
		// point @ index is altered/new
		// child points for previous point (index -1) are no longer valid
		var prevLatLng = this.path.getAt(index-1);
		if (prevLatLng.children!=null) {
			prevLatLng.children.length = 0;
			prevLatLng.heightValid = false; // true if heights of this point and to next is valid
		}
	}
	
	// 	var element = this.path.getAt(index);
	//	element.height = null;
	//	if (element.children!=null) element.children.length = 0;
};

/**
 * Sets previous node reference and also adds terminus of previous node 
 * to be first point of the path of this node.
 */
tsNode.setPrevious = function(prevNode) {
	tsAssert(tsNode.isPrototypeOf(prevNode));
	
	this.owner.pauseUpdate();
	this.previous = prevNode;
	this.path.insertAt(0,prevNode.getTerminus());
	this.pathEdited();
	//this.owner.resumeUpdate();
	//this.owner.update(); //update handled by caller
};

/**
 * Update terminus location, also change first point of path of
 * next node (if any).
 */
tsNode.updateTerminus = function(latLng) {
	tsAssert(latLng instanceof google.maps.LatLng);

	this.owner.pauseUpdate();
	this.path.setAt(this.path.getLength()-1,latLng);
	//this.pathEdited(this.path.getLength()-1);
	this.reroute();
	if (this.next) {
		//this.next.deactivateListeners();
		this.next.path.setAt(0,latLng);
		this.next.pathEdited(0);
		this.next.reroute();
		
	}
	this.owner.resumeUpdate();
};


/**
 * Remove (from map) and invalidate any overlays, including removal of any listeners.
 * This includes all markers and lines.
 */ 
tsNode.clearMapOverlays = function() {
	if (this.marker) {
		google.maps.event.clearInstanceListeners(this.marker);
		this.marker.setMap(null);
	}
	if (this.polyline) {
		google.maps.event.clearInstanceListeners(this.polyline);
		this.polyline.setMap(null);
	}
	this.marker = null;
	this.polyline = null;
	this.clearKmMarkers();
};

/**
 * Remove (from map) and invalidate km marker overlays only,
 * including removal of any listeners.
 */ 
tsNode.clearKmMarkers = function() {
	if (this.kmMarkers) {
		for (var i = 0; i < this.kmMarkers.length; i++) {
			this.kmMarkers[i].setMap(null);
			// no listeners for km markers
		}
		this.kmMarkers.length = 0; // clear array of markers
	}
};


/**
 * If an autorouted point, reroute this node from first point to 
 * terminus of path using directions service. Call after
 * updating first point or terminus.
 * 
 * Always reactivates listeners and signals change to owner.
 * 
 */
tsNode.reroute = function() {
	if (this.type==tsNodeTypes.TOROUTE || this.type==tsNodeTypes.ROUTED ) {
		this.deactivateListeners();
		this.type = tsNodeTypes.TOROUTE;
		var origin = this.path.getAt(0);
		var terminus = this.path.pop();
		this.path.clear();
		this.path.push(origin);
		this.path.push(terminus);
		this.updateOverlays(); 
		this.autoRoute();
		this.activateListeners();
	}
};

/**
 * Return terminus of this node, i.e. last point in path.
 */
tsNode.getTerminus = function() {
	return this.path.getAt(this.path.getLength()-1); 
};

/**
 * Append a point to end of path for this node. Should only be called
 * for manual nodes.
 */
tsNode.appendPoint = function(latLng) {
	tsAssert(latLng instanceof google.maps.LatLng);
	tsAssert(this.type === tsNodeTypes.MANUAL);

	this.path.push(latLng);
	//if (this.marker) this.marker.setPosition(this.getTerminus());
	// update handled by path listener
};

tsNode.autoRoute = function() {
	var request = {
		origin : this.path.getAt(0),
		destination : this.path.getAt(1),
		provideRouteAlternatives : false,
		travelMode : google.maps.TravelMode.WALKING
	};
	var that = this;
	tsMain.directionsService.route(request, function(response, status) {
		if (status != google.maps.DirectionsStatus.OK) {
            tsError("Direction service failed due to: " + status);
            // TODO: more handling here
		} if (request.destination!==that.path.getAt(1)) {
			tsWarning("Path changed during auto-route request");
			// silently ignore
		} else {
			that.deactivateListeners();
			var origin = that.path.getAt(0);
			that.path.clear();
			var theRoute = response.routes[0];
			var theRouteLeg = theRoute.legs[0];
			var lastLatLng;
			that.path.push(origin); // add origin, may not equal origin due to 'rounding' to nearest road
			lastLatLng = origin;
			var theSteps = theRouteLeg.steps;
			for (var i = 0; i<theSteps.length; i++) {
				var stepPath = theSteps[i].path;
				for (var j = 0; j<stepPath.length; j++) {
					var curLatLng = stepPath[j];
					if (!tsLatLngEquals(lastLatLng,curLatLng)) that.path.push(curLatLng);
					// else console.log("skippping",lastLatLng,curLatLng);
						// only store unique points (i.e. not 'equal' to previous)
					lastLatLng = curLatLng;
				};
				
			}
			tsInfoCtrl.setHTML (theRoute.warnings+"<BR>"+theRoute.copyrights);
			
			that.type = tsNodeTypes.ROUTED;
			that.activateListeners();
			that.updateOverlays(tsMain.map);
			that.pathEdited();
			that.owner.resumeUpdate();
		};
	});
};


tsNode.updateOverlays = function() {
	
	
	var arrowSymbol = {
	    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
	    scale : 3,
		strokeOpacity : 1.0,
		strokeWeight : 2.0,
		strokeColor : this.type.color,
		fillColor : this.type.color,
		fillOpacity : 1.0,
	};
	
	var markerOptions = {
		position : this.getTerminus(),
		draggable : true,
		map : tsMain.map,
		zIndex : 100,
	};
	markerOptions.icon = {
		path : tsSquareSVG,
		scale : 6,
		strokeColor : this.type.color,
		strokeOpacity : 1.0,
		strokeWeight : 1.0,
		fillColor : this.type.color,
		fillOpacity : 1.0,
	};
	var polylineOptions	= {
		path : this.path,
		map : tsMain.map,
		strokeColor : this.type.color,
		strokeWeight : 2.0,
		zIndex : 90,
		icons : [ 
		          {	icon : arrowSymbol, offset : '10%'},
		          {	icon : arrowSymbol, offset : '90%'}
		]
	};
	
	
	
	switch (this.type) {
		case tsNodeTypes.HOME:
			markerOptions.icon.path = tsHouseSVG;
			markerOptions.icon.scale = 0.15;

			polylineOptions = null; // no polyline for home
			break;
		case tsNodeTypes.TOROUTE:
			var dottedLineSymbol = {
				path : tsDottedSVG,
				strokeOpacity : 1.0,
				strokeColor : this.type.color,
				scale : 4.0
			};
			
			polylineOptions.icons.push({
				icon : dottedLineSymbol,
				offset : '0',
				repeat : '20px'
			});
			
			polylineOptions.strokeOpacity = 0.0;
			polylineOptions.editable = false;
			
			break;
		case tsNodeTypes.ROUTED:
			polylineOptions.strokeOpacity = 1.0;
			polylineOptions.editable = false;
			
			break;
		case tsNodeTypes.MANUAL:
			polylineOptions.strokeOpacity = 1.0;
			polylineOptions.editable = true;
			
			break;
	}
	if (this.polyline) {
		this.polyline.setOptions(polylineOptions);
	} else {
		this.polyline = new google.maps.Polyline(polylineOptions);
	}
	if (this.marker) {
		this.marker.setOptions(markerOptions);
	} else {
		this.marker = new google.maps.Marker(markerOptions);
		this.addMarkerListeners();
	}
};

tsNode.addMarkerListeners = function() {
	var that = this;
	google.maps.event.addListener(this.marker, 'dragend', function(mouseEvent) {
		var latLng = mouseEvent.latLng;
		that.updateTerminus(latLng);
		});
};



var tsPointList = {
	head : null,
	tail : null,
	totalLength : 0,
	updateActive : true,
};
tsNode.owner = tsPointList; // only one list for so all nodes belong to it

/**
 * Add Node to end of list
 * @param node
 */
tsPointList.push = function(node) {

	if (this.tail !== null) { 
		var oldTail = this.tail;
		oldTail.next = node;
		node.setPrevious(oldTail);
	}
	this.tail = node;
	if (this.head === null) this.head = node;
	//this.update();
	this.resumeUpdate();
};

tsPointList.clear = function() {
	while (this.head) tsPointList.deleteLastNode();	
};

/**
 * 
 */

tsPointList.resetHeightExtents = function() {
	this.minHeight = +Infinity;
	this.maxHeight = -Infinity;
	this.heightsTentative = false;
};

/**
 * Use height parameter to update height extents of this list
 * 
 */
tsPointList.updateHeightExtents = function(height) {
	if (height != null) { 
		if (height<this.minHeight) this.minHeight = height; 
		if (height>this.maxHeight) this.maxHeight = height;
	} else {
		this.heightsTentative = true;
	}
		
};

tsPointList.getMaxDist = function() {
	return this.tail ? Math.max(this.tail.getTerminus().cumulLength,1000.0) : 0.0;
};

tsPointList.getExtent = function() {
	//this.head.calculateLength(); // recalc. all lengths, REMOVE to more efficient
	var curNode = this.head;
	var minHeight = +Infinity;
	var maxHeight = -Infinity;
	
	while (curNode!=null) {
		for (var i = 0; i < curNode.path.getLength(); i++) {
			var latLng = curNode.path.getAt(i);
			if (latLng.height<minHeight) minHeight = latLng.height; 
			if (latLng.height>maxHeight) maxHeight = latLng.height;
			if (latLng.children) for (var j = 0; j < latLng.children.length; j++) {
				var childLatLng = latLng.children[j];
				if (childLatLng.height<minHeight) minHeight = childLatLng.height;
				if (childLatLng.height>maxHeight) maxHeight = childLatLng.height;
			}
		}
		curNode = curNode.next;
	}
	var minDist = 0.0;
	var maxDist = this.tail ? Math.max(this.tail.getTerminus().cumulLength,1000.0) : 1000.0;
	return {
		minDist : minDist,
		maxDist : maxDist,
		minHeight : minHeight,
		maxHeight : maxHeight
	};
	
};

tsPointList.isEmpty = function() {
	return this.head==null;	
};

/**
 * Remove last node
 * @param node
 */
tsPointList.deleteLastNode = function() {
	if (this.tail != null) {
		var oldTail = this.tail;
		var previousNode = oldTail.previous;
		oldTail.clear();
		if (previousNode!=null) {
			previousNode.next = null;
			previousNode.pathEdited();
		} 
		this.tail = previousNode;
		if (this.tail==null) {
			this.head = null;
		}
	}
	this.resumeUpdate();
};

//
//tsPointList.calculateLength = function() {
//	this.totalLength = 0;
//	if (this.tail) this.totalLength = this.tail.cumulLength;
//	tsDistanceCtrl.update(this.totalLength/1000.0);
//	
//};


tsPointList.addPoint = function(latLng, addType) {
	var type = null;
	var node = null;
	if (this.head == null) { // any points so far?
		// no
		// first node is 'home' node
		type = tsNodeTypes.HOME;
		node = Object.create(tsNode);
		node.initialize(type, latLng);
		this.push(node);
	} else {
		// yes there are some points
		if (addType==tsNodeTypes.TOROUTE) {
			// are we adding a routed point?
			type = tsNodeTypes.TOROUTE;
			node = Object.create(tsNode);
			node.initialize(type, latLng);
			this.push(node);
			node.autoRoute();
			
		} else if (addType==tsNodeTypes.PATH && this.tail.type == tsNodeTypes.MANUAL) { 
			// are we adding a new point to path and
			// and last node was a manual node?
			
			// yes, add a new point to that node
			type = tsNodeTypes.PATH;
			this.tail.appendPoint(latLng);
		} else {
			// no, make a new node
			type = tsNodeTypes.MANUAL;
			node = Object.create(tsNode);
			node.initialize(type, latLng);
			this.push(node);
			
		}
	}
	
	if (node) {
		node.activateListeners();
		node.updateOverlays(tsMain.map);
		node.pathEdited();
		node.owner.resumeUpdate();
	}
	return type; // return type, may be 'home'
};

tsPointList.addManualPoint = function(latLng, forceNewNode) {
	var addType;
	if (forceNewNode) addType = tsNodeTypes.MANUAL;
	else addType = tsNodeTypes.PATH;
	return this.addPoint(latLng,addType);
};


tsPointList.addRoutedPoint = function(latLng) {
	return this.addPoint(latLng,tsNodeTypes.TOROUTE);
};

/**
 * Stop this list from being updated (recalculated)
 * until resumeUpdate called.
 * 
 */
tsPointList.pauseUpdate = function() {
	this.updateActive = false;	
};

/**
 * Allow list to be update (recalculated) once again &
 * update immediately.
 * 
 */
tsPointList.resumeUpdate = function()  {
	this.updateActive = true;
	this.update();
};


/**
 * Update/recalculate length and height extents of this list
 * by calling update of each node.
 * 
 * @param updateHeightExtents
 * If true, will update owner's height extents based on height
 * of node points and their children, otherwise height extent
 * is not updated
 */
tsPointList.update = function(updateHeightExtents) {
	if (!this.updateActive) return;
	var next;
	var updateLength = false;
	for (tsListIterator.reset();  next = tsListIterator.listNextNode(), !next.done;) {
		var nextNode = next.value;
		if (nextNode.length == null) updateLength = true;
		nextNode.update(updateLength, updateHeightExtents);
	}
	this.totalLength = 0;
	if (this.tail) this.totalLength = this.tail.cumulLength;
	tsDistanceCtrl.update(this.totalLength/1000.0);
	
};
/**
 * Update/recalculate various parameters of this node.
 * 
 * @param updateLength
 * If true, will update lengths of this node and its points.
 * 
 * @param updateHeightExtents
 * If true, will update owner's height extents based on height
 * of node points and their children. 
 */
tsNode.update = function(updateLength, updateHeightExtents) {

	if (!updateLength && !updateHeightExtents) return; // nothing to do
	
	var markerEvery = 1000.0; // metres
	
	var lastPointCumulLength = 0; // need to track cur and last point cumul length for km markers
	
	if (updateLength) { 
		this.clearKmMarkers(); // these will need to be recalculated
		if (this.previous) lastPointCumulLength = this.previous.cumulLength; // use previous node cumul length as base
	}
	
	var lastPointLatLng = null;
	var curPointCumulLength = lastPointCumulLength;

	for (var i = 0; i < this.path.getLength(); i++) {
		var curPointLatLng = this.path.getAt(i);
		
		if (updateLength) {
			if (lastPointLatLng) {
				// find length from previous, add to cumul total for path
				curPointCumulLength += tsComputeDistBtw(lastPointLatLng, curPointLatLng);
			}
			curPointLatLng.cumulLength = curPointCumulLength;
			
			var lastFloorKm = Math.floor(lastPointCumulLength/markerEvery);
			var curFloorKm = Math.floor(curPointCumulLength/markerEvery);
			
			// do we need to add a km marker?
			while (lastFloorKm<curFloorKm) {
				// look for all transitions in floor after dividing by markerEvery length e.g. 2>4 km, need markers for 3,4 
				lastFloorKm = lastFloorKm+1;
				
				var kmMarkerLatLng = tsComputeOffset(lastPointLatLng, curPointLatLng, lastFloorKm*markerEvery-lastPointCumulLength);
				var kmMarkerImage = "markers/marker_"+lastFloorKm+".png";
				var kmMarkerOptions = {
					position : kmMarkerLatLng,
					map : tsMain.map,
					icon: kmMarkerImage,
				};
				if (!this.kmMarkers) this.kmMarkers = [];
				this.kmMarkers.push(new google.maps.Marker(kmMarkerOptions));
				
			}
		}

		if (updateHeightExtents && curPointLatLng.height != null) {
			this.owner.updateHeightExtents(curPointLatLng.height);
		}

		// update any children of curPoint
		if (curPointLatLng.children) {
			var lastChildLatLng = curPointLatLng;
			var childCumulLength = curPointCumulLength;
			for (var j=0; j<curPointLatLng.children.length;j++) {
				var curChildLatLng = curPointLatLng.children[j];
				if (updateLength) {
					childCumulLength+=tsComputeDistBtw(lastChildLatLng, curChildLatLng);
					curChildLatLng.cumulLength = childCumulLength; 
					lastChildLatLng = curChildLatLng;
				}
				if (updateHeightExtents && curChildLatLng.height != null) {
					this.owner.updateHeightExtents(curChildLatLng.height);
				}
			}
		}
		
		// update for next iteration
		lastPointLatLng = curPointLatLng;
		lastPointCumulLength = curPointCumulLength;
	}
	
	this.cumulLength = curPointCumulLength; // node stores cumul length of last point

};

tsPointList.lookupHeight = function() {
	
	var curNode = this.head;
	var latLngs = [];
	var that = this;
	if (this.pendingDEMLookup) return;
	console.trace();
	
	// generate an array of points to lookup from whole list
	var next;
	for (tsListIterator.reset();  next = tsListIterator.next2d(), !next.done;) {
		var curLatLng = tsListIterator.curIterPoint;
		var lastLatLng = tsListIterator.prevIterPoint;
		if (lastLatLng && (lastLatLng.height == null || curLatLng == null)) {
			// if either end of this pair of latLngs has no height
			// then need to lookup
			latLngs.push(lastLatLng);
			latLngs.push(curLatLng);
			//console.log(i,lastLatLng.lat(),lastLatLng.lng(),latLng.lat(),latLng.lng());
		}
	}
	if (latLngs.length==0) return; 
	this.pendingDEMLookup = true;
	tsLookupDEM(null,latLngs, function(lookupResult, lookupStatus) {
		if (lookupStatus==tsLookupStatus.SUCCESS) {
			var query_i;
			var queryLatLng;
			query_i = 0;
			for (var result_i=0; result_i< lookupResult.length; result_i++) {
				var resultLatLng = lookupResult[result_i]; // result is an array of latLngs decorated with index and height
				console.log(result_i,resultLatLng.lat(),resultLatLng.lng(),resultLatLng.height,resultLatLng.index)
				if (resultLatLng.index==0) {
					// first point in returned DEM lookup = start point
					queryLatLng = latLngs[query_i];
					if (!tsLatLngEquals(queryLatLng,resultLatLng)) {
						//console.log(queryLatLng.lat(),queryLatLng.lng());
						//console.log(resultLatLng.lat(),resultLatLng.lng());
						tsError("Query/response latlng do not match");
					}
					tsAssert (queryLatLng.height == null || queryLatLng.height == resultLatLng.height);
					queryLatLng.height = resultLatLng.height;
					tsAssert(!queryLatLng.children || queryLatLng.children.length==0);
					console.log("start");
				}
				else if (resultLatLng.index<0) {
					// last point in returned DEM lookup = end point
					query_i++; 
					queryLatLng = latLngs[query_i];
					tsAssert (queryLatLng.height == null || queryLatLng.height == resultLatLng.height); 
					queryLatLng.height = resultLatLng.height; 
					query_i++; 
					console.log("End");
					continue;
				} else {
					// interpolated point in DEM lookup
					if (queryLatLng.children == null) queryLatLng.children = [];
					queryLatLng.children.push(resultLatLng);
				}
				
			}
			that.update();
		} else {
			tsWarning(lookupStatus.details);
		}
		that.pendingDEMLookup = false;
	});
};



/**
 * Convert point list to a CSV string
 */
tsPointList.toCSV = function() {
	var output = "";
	
	var curNode = this.head;
	var cumulDist = 0; // cumulative distance of whole track
	var index = 0; // cumulative index of written points
	var lastLatLng = null;
	var type = null;
	var latLng;
	
	output += "#,latitude,longitude,type,dist\n";
	
	while (curNode!=null) {
		if (curNode.path) {
			for (var i = 0; i < curNode.path.getLength(); i++) {
				latLng = curNode.path.getAt(i);
				if (!latLng.equals(lastLatLng)) { // only write unique points, last point of node x and first point of node x+1 are identical
					if (!type) type = curNode.type; // first point written for a node is given node's type
					else type =  tsNodeTypes.PATH; // subsequent points in node's path are given PATH type
					if (lastLatLng) cumulDist += tsComputeDistBtw(lastLatLng, latLng); // calc cumul dist to output
					output += index + "," 
					        + latLng.lat().toFixed(6) + ","
					        + latLng.lng().toFixed(6) + ","
					        + tsNodeTypesRev[type.value] +","
					        + cumulDist.toFixed(1) + "\n";
					index += 1;
				}
				lastLatLng = latLng;
			}
		}
		type = null; // invalidate so loop is aware that next point is first in new node
		curNode = curNode.next;
	}
	return output;
};

/**
 * Convert CSV string to point list
 */
tsPointList.fromCSV = function(csv) {
	this.clear();
	var lines = csv.split("\n");
	var header;
	var latIndex = null, lngIndex = null, typeIndex = null;
    for (var i=0;i<lines.length;i++) {
    	var line = lines[i].trim();
    	if (line.length>0) {
	    	//console.log(line);
	    	var tokens = line.split(",");
	    	if (!header) {
	    		header = tokens;
	    		for (var j=0;j<header.length;j++) {
	    			var headerToken = header[j].substr(0,3).toLowerCase();
	    			if (headerToken=="lat") {
	    				latIndex = j;
	    			} else if (headerToken=="lng" || headerToken=="lon" ) {
	    				lngIndex = j;
	    			} else if (headerToken=="typ") {
	    				typeIndex = j;
	    			}
	    		}
	    		if (!latIndex) {
	    			tsError("Could not find lat data in input file.");
	    		}
	    		if (!lngIndex) {
	    			tsError("Could not find lng data in input file.");
	    		}
	    		if (!typeIndex) {
	    			tsWarning("Could not find type data in input file.");
	    		}
	    		
	    	} else {
	    		var lat = parseFloat(tokens[latIndex]);
	    		var lng = parseFloat(tokens[lngIndex]);
	    		var latLng = new google.maps.LatLng(lat,lng);
	    		var type = null;
	    		if (typeIndex) {
	    			type = tokens[typeIndex];
	    			type = tsNodeTypes[type];
	    		} else {
	    			// type = null, if no types given in input file
	    			// start with home, then add remaining as path of a single manual node
	    			if (this.isEmpty()) type = tsNodeTypes.HOME;
	    			else if (this.tail.type == tsNodeTypes.HOME) type = tsNodeTypes.MANUAL;
	    			else type = tsNodeTypes.PATH;
	    		}
	    		if (this.isEmpty()) {
	    			if (type != tsNodeTypes.HOME) tsWarning("First point is not HOME type, defaulting to HOME, line: "+line);
	    			type = tsNodeTypes.HOME;
	    		} else {
    				if (type == tsNodeTypes.PATH) {
    					// adding a point as path of existing node
    					if (this.tail.type == tsNodeTypes.MANUAL || this.tail.type == tsNodeTypes.ROUTED) {
    						// expect a supported tail node to add to
    						this.tail.addPoint(latLng);
    						latLng = null; // invalidate if already added
    					} else {
    						tsWarning("Trying to add point to unsupported node type, adding as node, line: "+line);
    						this.type = tsNodeTypes.MANUAL;
    					}
    				} else if (type == tsNodeTypes.MANUAL || type == tsNodeTypes.ROUTED) {
    				} else {
    					tsWarning("Unknown point type, defaulting to MANUAL:, line: "+line);
    					type = tsNodeTypes.MANUAL;
    				}
	    		}
				if (latLng) {
					// adding a new node
		    		var node = Object.create(tsNode);
					node.initialize(type, latLng);
					this.push(node);
					node.updateOverlays(tsMain.map);
				}
	    	}
    	}
    }
};

/**
 * Multi-purpose iterator for iterating through node/point/child lists.
 * 
 * Non-standard but based on ECMAScript 6 iterator protocol.
 * 
 * Provides methods for directly accessing underlying list structure
 * (i.e. nodes, points in nodes, children in points).
 * 
 * Also provides methods for simply iterating over points without
 * being concerned with list structure (next2d, next3d).
 * 
 * Does not support any kind of manipulation of underlying lists while
 * iteration in progress.
 * 
 * ECMAScript 6 iterator protocol: 
 * next() returns { done: false, value: element } or
 *  			   { done: true [, value: retVal] }
 */
var tsListIterator = {
	theList : tsPointList, // list being iterated over, currently fixed
	
	// attributes for tracking iteration of nodes (in top-level list)
	curNode : null,
	nextNode : null,
	
	// attributes for tracking iteration of points in current node
	curPoint : null,
	nextPointIndex : 0,
	curPointIsTerminal : false, // true if curPoint is a terminal point in path
	
	// attributes for tracking iteration of children in current point
	curChild : null,
	nextChildIndex : 0,
	
	// attributes that store previous/current 
	prevIterPoint : null,
	curIterPoint : null,
	curIterIsChild : false, // true if current iter point is child 
	
};

/**
 * Reset iterator for iteration from beginning.
 */
tsListIterator.reset = function(theNode) {
	this.curNode = null;
	this.prevIterPoint = null;
	this.curIterPoint = null;
	this.curIterIsChild = false; 
	this.resetPointIterator();
	this.resetChildIterator();
	this.nextNode = this.theList.head;
};


/**
 * Iterator for nodes in list.
 * 
 * Return next node in list as {done : false, value : node}
 * or {done : true} if no more nodes.
 */
tsListIterator.listNextNode = function() {
	this.curNode = null; // invalidate curNode
	this.resetPointIterator(); // invalidate sub-iterator as soon as function called
	if (this.nextNode == null) return { done: true };
	
	this.curNode = this.nextNode;
	//console.log("node" + (this.curNode == this.theList.head ? " head" : ""));
	this.nextNode = this.nextNode.next;
	return { value : this.curNode, done : false};
};


/**
 * Reset sub-iterator for points within a node.
 */
tsListIterator.resetPointIterator = function() {
	this.curPoint = null;
	this.nextPointIndex = 0;
	this.curPointIsTerminal = false;
};


/**
 * Sub-iterator for points in node.
 * 
 * Return next point in current node as {done: false, value : point}
 * or {done : true} if no more points.
 */
tsListIterator.nodeNextPoint = function() {
	this.curPoint = null; // invalidate first
	this.resetChildIterator(); // invalidate sub-iterator as soon as function called
	if (this.nextPointIndex >= this.curNode.path.getLength()) return { done : true };
	
	this.curPoint = this.curNode.path.getAt(this.nextPointIndex);
	//console.log("point" + this.nextPointIndex);
	this.nextPointIndex += 1;
	if (this.nextPointIndex == this.curNode.path.getLength()) this.curPointIsTerminal = true;
	else this.curPointIsTerminal = false;
	return { value : this.curPoint, done : false };
	
};

/**
 * Reset sub-iterator for children within a point.
 */
tsListIterator.resetChildIterator = function() {
	this.curChild = null;
	this.nextChildIndex = 0;
};

/**
 * Sub-(sub-)iterator for children within point,
 * 
 * Return next child of current point as {done: false, value : chi;d}
 * or {done : true} if no more children.
 */

tsListIterator.pointNextChild = function() {
	this.curChild = null; // invalidate first
	if (this.nextPointIndex >= this.curNode.path.getLength()  || // terminal point:
																 //  do not iterate through terminal points children as 
																 //  point is shared with first point of next node,
																 //  and children 'belong' to that first point
		!this.curPoint.children || // no children
		this.nextChildIndex >= this.curPoint.children.length) // end of children list
		return { done : true };
		
	this.curChild = this.curPoint.children[this.nextChildIndex];
	//console.log("child" + this.nextChildIndex);
	this.nextChildIndex += 1;
	return { value : this.curChild, done : false };
};

/**
 * Iterator for 2d points, i.e. points across all nodes.
 * 
 * By default, will only return non-identical consecutive points,
 * i.e. will only return terminal point of one node and not shared 
 * first point of next node.
 * 
 * Default (bracket = not returned):
 * Will return (node_x) point_n-1, point_n, (node_x+1 point0) point1, point2...
 * 
 * @param all
 * If true, will iterate over all points and include all identical 
 * shared points.
 * Will return (node_x) point_n-1, point_n, (node_x+1) point0, point1, point2...
 * 
 * @returns
 * Return next child of current point as {done: false, value : chi;d}
 * or {done : true} if no more children.
 */
tsListIterator.next2d = function(all) {
	this.prevIterPoint = this.curIterPoint;
	while (true) {
		if (this.curNode) { // have a current node
			while (true) {
				var next = this.nodeNextPoint(); // iterate to next point in node
				if (next.done) break; // no more points in this node
				if (all || next.value != this.prevIterPoint) {
					this.curIterPoint = next.value;
					return next; // got a non-identical point (to last), return it
				}
			}
		}
		// try next node
		var next = this.listNextNode();
		if (next.done) {
			this.curIterPoint = null;
			return next; // no more nodes, return done signal
		}
		tsAssert(this.curNode, "curNode still invalid"); // unless done, curNode should be set by call to listNextNode()
	}
};

/**
 * Iterator for 3d points, points in path and their children across all
 * nodes.
 * 
 * Will return point, child0... childn, point+1, child0...
 * 
 * By default, will only return non-identical consecutive points,
 * i.e. will only return terminal point of one node and not shared 
 * first point of next node; children are not returned for terminal
 * point but will be returned after iterating over it, although these
 * will 'belong' to the first point (not return during the iteration).
 * 
 * Default (bracket = not returned):
 * Will return (node_x) point_n-1, child0... childn, point_n, 
 * (node_x+1 point0), child0... childn, point1,child0... childn, point2...
 * 
 * @param all
 * If true, will iterate over all points and include all identical 
 * shared points:
 * Will return (node_x) point_n-1, child0... childn, point_n, 
 * (node_x+1) point0, child0... childn, point1,child0... childn, point2...
 * 
 * Return next child of current point as {done: false, value : chi;d}
 * or {done : true} if no more children.
 * @returns
 */
tsListIterator.next3d = function(all) {
	this.prevIterPoint = this.curIterPoint;
	var next;
	while (true) {
		if (this.curPoint) { // have a current point
			next = this.pointNextChild(); // iterate to next child in point
			if (!next.done) {
				this.curIterIsChild = true;
				break; // got a valid child: break & return it
			}
		}
		
		// try next point
		next = this.next2d(true);
		if (next.done) {
			this.curIterPoint = null;
			this.curIterIsChild = false;
			return next; // no more points, return done signal
		}
		if (all || next.value != this.prevIterPoint) {
			this.curIterIsChild = false;
			break; // got a non-identical point (to last), break & return it		
		}
	}
	this.curIterPoint = next.value;
	return next; // got a valid child: return it
};

// test for iterator
/*
function testIterator() {
	tsListIterator.reset();
	var nextNode, nextPoint, nextChild;
	var i;
	console.log("TEST: Full iterate");
	i = 0;
	while (nextNode = tsListIterator.listNextNode(), !nextNode.done) {
		console.log("node "+i);
		i++;
		while (nextPoint = tsListIterator.nodeNextPoint(), !nextPoint.done) {
			console.log(nextPoint.value);
			while (nextChild = tsListIterator.pointNextChild(), !nextChild.done) { 
				console.log(nextChild.value);
			}
		}
	}
	var next;
	tsListIterator.reset();
	console.log("TEST: 2d iterate");
	i = 0;
	while (next = tsListIterator.next2d(), !next.done) {
		console.log(next.value);
		console.log("iteration "+i+" node point "+(tsListIterator.nextPointIndex-1));
		i++;
	}
	
	tsListIterator.reset();
	console.log("TEST: 2d iterate all");
	i = 0;
	while (next = tsListIterator.next2d(true), !next.done) {
		console.log(next.value);
		console.log("iteration "+i+" node point "+(tsListIterator.nextPointIndex-1));
		i++;
	}

	tsListIterator.reset();
	console.log("TEST: 3d iterate");
	i = 0;
	while (next = tsListIterator.next3d(), !next.done) {
		console.log(next.value);
		console.log("iteration "+i+" node point "+(tsListIterator.nextPointIndex-1)+" child "+(tsListIterator.nextChildIndex-1));
		i++;
	}

	tsListIterator.reset();
	console.log("TEST: 3d iterate all");
	i = 0;
	while (next = tsListIterator.next3d(true), !next.done) {
		console.log(next.value);
		console.log("iteration "+i+" node point "+(tsListIterator.nextPointIndex-1)+" child "+(tsListIterator.nextChildIndex-1));
		i++;
	}
}
*/

/**
 * Class for iterating through a single node of list.
 * Based on list iterator.
 */
var tsNodeIterator = Object.create(tsListIterator);

/**
 * Reset iterator for iteration for single node.
 */
tsNodeIterator.reset = function(theNode) {
	tsAssert (tsNode.isPrototypeOf(theNode), "expected a tsNode");
	tsListIterator.reset.call(this);
	this.curNode = theNode;
	this.nextNode = null;
};

function tsInitializeList() {
}