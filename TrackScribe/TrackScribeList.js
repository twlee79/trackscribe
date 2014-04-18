"use strict";

/**
 * Data stored in a linked list.
 * Each item in list is a node.
 * Node contains a path, which is an array of LatLng coords.
 * Path shown as a polyline, with last point (terminus) a marker.
 * 
 * 
 */

var tsNodeTypes = {
	HOME: {value: 1, name: "Home node", color : "darkblue"},
	MANUAL: {value: 10, name: "Manual node", color : "skyblue"},
	PATH: {value: 11, name: "Path point"},
	TOROUTE: {value: 20, name: "Node to route", color : "mediumblue"},
	ROUTED: {value: 21, name: "Routed node", color : "mediumblue"},
};

var tsNodeTypesRev = tsGenerateReverseDict(tsNodeTypes);


var tsNode = {
	owner : null,
};

tsNode.initialize  = function (type, latLng) {
	// data
	this.type = type;
	this.path = new google.maps.MVCArray();
	this.path.push(latLng);
	this.cumulLength = 0;
	
	// state
	this.editing = false; // do not update while true
	this.startEditing();
	
	// for overlays
	this.marker = null;
	this.polyline = null;
	this.kmMarkers = null;
	
	// for linked-list
	this.previous = null; // use setPrevious to set correctly
	this.next = null;
	//this.owner = null;
};


tsNode.clear = function() {
	// ensure all contents reset for to allow deletion
	this.editing = true;
	this.type = null;
	this.clearPath();
	this.clearOverlays();
	this.previous = this.next = this.owner = null;
};

tsNode.clearPath = function() {
	// remove and invalidate path, incl. removal of any listeners
	google.maps.event.clearInstanceListeners(this.path);
	this.path.clear();
	this.path = null;
};

tsNode.clearOverlays = function() {
	// remove and invalidate any previous marker, polyline
	// or km marker overlays
	// incl. removal of any listeners
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

tsNode.clearKmMarkers = function() {
	// remove and invalidate any previous km marker overlays
	if (this.kmMarkers) {
		for (var i = 0; i < this.kmMarkers.length; i++) {
			this.kmMarkers[i].setMap(null);
			// no listeners for km markers
		}
		this.kmMarkers.length = 0; // clear array
	}
};

/**
 * Call to prevent updating of this node (until stopEditing called).
 */
tsNode.startEditing = function() {
	this.editing = true;
};

/**
 * Call to allow updating of this node once again.
 */
tsNode.stopEditing = function() {
	this.editing = false;
};

/**
 * Update/recalculate various parameters of this node.
 * Will automatically update downstream nodes if required.
 */
tsNode.update = function() {
	if (!this.editing) {
		this.calculateLength();
		tsMain.elevationPlot.update();
		console.log("updating");
	}
};

tsNode.calculateLength = function() {
	// Remember: Node has path of points, and each point may have an array of interpolated points
	
	var markerEvery = 1000.0; // metres
	this.clearKmMarkers();

	var prevNodeCumulLength = 0;
	if (this.previous) prevNodeCumulLength = this.previous.cumulLength;
	
	var lastPointCumulLength = prevNodeCumulLength; // used for calc's involving km markers 

	var lastPointLatLng = null;
	for (var i = 0; i < this.path.getLength(); i++) {

		var curPointLatLng = this.path.getAt(i);
		var curPointCumulLength = lastPointCumulLength;
		if (lastPointLatLng) {
			// find length from previous, add to cumul total for path
			curPointCumulLength += tsComputeDistBtw(lastPointLatLng, curPointLatLng);
		}
		curPointLatLng.cumulLength = curPointCumulLength;  

		if (curPointLatLng.children) {
			// if have children, calc cumul length for each child
			var lastChildLatLng = curPointLatLng;
			var childCumulLength = curPointCumulLength;  // used for tracking length of interpolated children within a path point
			for (var j=0; j<curPointLatLng.children.length;j++) {
				var curChildLatLng = curPointLatLng.children[j];
				childCumulLength+=tsComputeDistBtw(lastChildLatLng, curChildLatLng);
				curChildLatLng.cumulLength = childCumulLength; 
				lastChildLatLng = curChildLatLng;
			}
		}

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
			
			// TODO: do we need km marker height?
			
		}
		
		// update for next iteration
		lastPointLatLng = curPointLatLng;
		lastPointCumulLength = curPointCumulLength;
	}
	this.cumulLength = curPointCumulLength; // node stores cumul length of last point
	if (this.next) this.next.calculateLength(); // update next length
	else this.owner.calculateLength(); // terminus: update length of owning list
};

/**
 * Sets previous and also adds previous as item 0 in this polyline
 */
tsNode.setPrevious = function(prevNode) {
	this.startEditing();
	this.previous = prevNode;
	this.path.insertAt(0,prevNode.getTerminus());
	this.stopEditing();
};

/**
 * Update terminus location, also change next's (if any) first point
 */
tsNode.updateTerminus = function(latLng) {
	this.startEditing();
	this.path.setAt(this.path.getLength()-1,latLng);
	this.updatePosition();
	if (this.next) {
		this.next.startEditing();
		this.next.path.setAt(0,latLng);
		this.next.updatePosition(); 
		this.next.stopEditing();
		// update from this (below) propagates to this.next
	}
	this.stopEditing();
	this.update();
};

tsNode.updatePosition = function() {
	if (this.type==tsNodeTypes.TOROUTE || this.type==tsNodeTypes.ROUTED ) {
		this.startEditing();
		this.type = tsNodeTypes.TOROUTE;
		var origin = this.path.getAt(0);
		var terminus = this.path.pop();
		this.path.clear();
		this.path.push(origin);
		this.path.push(terminus);
		this.updateOverlays(); 
		this.autoRoute();
		this.stopEditing();
		
	}

};


tsNode.getTerminus = function() {
	return this.path.getAt(this.path.getLength()-1); 
};

tsNode.addPoint = function(latLng) {
	if (this.type==tsNodeTypes.DUMMY) tsError("Invalid node");
	var newLength = this.path.push(latLng);
	if (this.marker) this.marker.setPosition(this.getTerminus());
	return newLength;
	// update handle by path listener
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
            tsWarning("Direction service failed due to: " + status);
            // TODO: more handling here
		} if (request.destination!==that.path.getAt(1)) {
			tsWarning("Path changed during auto-route request");
		} else {
			that.startEditing();
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
			that.stopEditing();
			that.updateOverlays(tsMain.map);
			that.update();
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
		this.addPolylineListeners();
	}
	if (this.marker) {
		this.marker.setOptions(markerOptions);
	} else {
		this.marker = new google.maps.Marker(markerOptions);
		this.addMarkerListeners();
	}
};

tsNode.addPolylineListeners = function() {
	var that = this;
	var pathEdited = function() {
		that.update();
	};
	
	/*
	google.maps.event.addListener(this.polyline, "dragend", function() {
		console.log("path dragend");
		pathEdited();
	});*/
    google.maps.event.addListener(this.path, "insert_at", function(index) {
    	console.log("path insert", index);
		pathEdited();
	});
    google.maps.event.addListener(this.path, "remove_at", function(index, element) {
    	console.log("path remove", index);
    	console.log(that.path.getAt(index));
		pathEdited();
	});
    google.maps.event.addListener(this.path, "set_at", function(index, element) {
    	console.log("path set", index);
    	console.log(that.path.getAt(index));
    	if (index>0) {
    		var prevLatLng = that.path.getAt(index-1); 
    		prevLatLng.height = null;
    		if (prevLatLng.children) prevLatLng.children.length = 0;
    	}
		pathEdited();
	});
		
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
};

tsPointList.clear = function() {
	while (this.head) tsPointList.deleteLastNode();	
};

tsPointList.getExtent = function() {
	this.head.calculateLength(); // recalc. all lengths, REMOVE to more efficient
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
			previousNode.calculateLength();
		} 
		this.tail = previousNode;
		if (this.tail==null) {
			this.head = null;
		}
	}
};

tsPointList.calculateLength = function() {
	this.totalLength = 0;
	if (this.tail) this.totalLength = this.tail.cumulLength;
	tsDistanceCtrl.update(this.totalLength/1000.0);
	
};


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
			this.tail.addPoint(latLng);
		} else {
			// no, make a new node
			type = tsNodeTypes.MANUAL;
			node = Object.create(tsNode);
			node.initialize(type, latLng);
			this.push(node);
			
		}
	}
	
	if (node) {
		node.stopEditing();
		node.updateOverlays(tsMain.map);
		node.update();
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

tsPointList.update = function() {
	if (this.head) this.head.update(); // quick fix // TODO: proper update
}

tsPointList.lookupHeight = function() {
	
	var curNode = this.head;
	var latLngs = [];
	var that = this;
	if (this.pendingDEMLookup) return;
	console.trace();
	
	// generate an array of points to lookup from whole list 
	while (curNode!=null) {
		var lastLatLng = null;
		var latLng;
		for (var i = 0; i < curNode.path.getLength(); i++) {
			latLng = curNode.path.getAt(i);
			if (lastLatLng && (lastLatLng.height == null || latLng.height == null)) {
				// if either end of this pair of latLngs has no height
				// then need to lookup
				latLngs.push(lastLatLng);
				latLngs.push(latLng);
				//console.log(i,lastLatLng.lat(),lastLatLng.lng(),latLng.lat(),latLng.lng());
			}
			lastLatLng = latLng;
			
		}
		curNode = curNode.next;
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
					console.assert (queryLatLng.height == null || queryLatLng.height == resultLatLng.height);
					queryLatLng.height = resultLatLng.height;
					console.assert(!queryLatLng.children || queryLatLng.children.length==0);
					console.log("start");
				}
				else if (resultLatLng.index<0) {
					// last point in returned DEM lookup = end point
					query_i++; 
					queryLatLng = latLngs[query_i];
					console.assert (queryLatLng.height == null || queryLatLng.height == resultLatLng.height); 
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

function tsInitializeList() {
}