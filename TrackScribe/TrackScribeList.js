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

var tsException = {
	INVALIDNODE : new Error("Invalid node")
};


var tsNode = {
	// data
	type : null,
	path : null,
	pathLength : 0,
	cumulLength : 0,
	
	// for overlays
	marker : null,
	polyline : null,
	kmMarkers : null,
	
	// for linked-list
	previous : null, // use setPrevious to set
	next : null,
	owner : null,
};

tsNode.initialize  = function (type, latLng) {
	this.type = type;
	this.path = new google.maps.MVCArray();
	this.path.push(latLng);
};


tsNode.clear = function() {
	// ensure all contents reset for to allow deletion
	this.previous = this.next = null;
	this.path = this.type = null;
	this.clearOverlays();
	this.clearKmMarkers();
	
};

tsNode.calculateLength = function() {
	var prevNodeCumulLength = 0;
	if (this.previous) prevNodeCumulLength = this.previous.cumulLength;
	this.pathLength = 0;
	var lastPointCumulLength = prevNodeCumulLength;
	var markerEvery = 1000.0; // metres
	this.clearKmMarkers();
	if (this.path) {
		for (var i = 1; i < this.path.getLength(); i++) {
			var latLng1 = this.path.getAt(i-1);
			var latLng2 = this.path.getAt(i);
			this.pathLength += tsComputeDistBtw(latLng1, latLng2);
			var curPointCumulLength = this.pathLength + prevNodeCumulLength;
			var lastFloorKm = Math.floor(lastPointCumulLength/markerEvery);
			var curFloorKm = Math.floor(curPointCumulLength/markerEvery);
			
			// do we need to add a km marker?
			while (lastFloorKm<curFloorKm) {
				// look for all transitions in floor after dividing by markerEvery length e.g. 2>4 km, need markers for 3,4 
				lastFloorKm = lastFloorKm+1;
				
				var kmMarkerLatLng = tsComputeOffset(latLng1, latLng2, lastFloorKm*markerEvery-lastPointCumulLength);
				var kmMarkerImage = "markers/marker_"+lastFloorKm+".png";
				var kmMarkerOptions = {
					position : kmMarkerLatLng,
					map : tsMain.map,
					icon: kmMarkerImage,
				};
				if (!this.kmMarkers) this.kmMarkers = [];
				this.kmMarkers.push(new google.maps.Marker(kmMarkerOptions));
				
			}
			lastPointCumulLength = curPointCumulLength;
		}
	}
	this.cumulLength = prevNodeCumulLength + this.pathLength;
	if (this.next) this.next.calculateLength(); // update next length
	else this.owner.calculateLength(); // terminus update length of owning list
};

tsNode.clearKmMarkers = function() {
	if (this.kmMarkers) {
		for (var i = 0; i < this.kmMarkers.length; i++) {
			this.kmMarkers[i].setMap(null);
		}
		this.kmMarkers.length = 0; // clear array
	}
};

/**
 * Sets previous and also adds previous as item 0 in this polyline
 */
tsNode.setPrevious = function(prevNode) {
	this.previous = prevNode;
	this.path.insertAt(0,prevNode.getTerminus());
	this.calculateLength(); //TODO: should this be done here?
};

/**
 * Update terminus location, also change next's (if any) first point
 */
tsNode.updateTerminus = function(latLng) {
	this.path.setAt(this.path.getLength()-1,latLng);
	this.updatePosition();
	if (this.next) {
		this.next.path.setAt(0,latLng);
		this.next.updatePosition(); 
	}
	this.calculateLength();
};

tsNode.updatePosition = function() {
	if (this.type==tsNodeTypes.TOROUTE || this.type==tsNodeTypes.ROUTED ) {
		this.type = tsNodeTypes.TOROUTE;
		this.clearOverlays();
		var origin = this.path.getAt(0);
		var terminus = this.path.pop();
		this.path.clear();
		this.path.push(origin);
		this.path.push(terminus);
		this.autoRoute();
		this.addOverlays();
	}

};


tsNode.getTerminus = function() {
	return this.path.getAt(this.path.getLength()-1); 
};

tsNode.addPoint = function(latLng) {
	if (this.type==tsNodeTypes.DUMMY) throw tsException.INVALIDNODE;
	var newLength= this.path.push(latLng);
	if (this.marker) this.marker.setPosition(this.getTerminus());
	this.calculateLength();
	return newLength; 
};

tsNode.autoRoute = function() {
	// TODO: CHECK if path is valid?
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
		} else {
			that.clearOverlays();
			var origin = that.path.getAt(0);
			that.path.clear();
			var theRoute = response.routes[0];
			var theRouteLeg = theRoute.legs[0];
			if (!theRouteLeg.start_location.equals(origin)) that.path.push(origin); 
				// start_location may not equal origin due to 'rounding' to nearest road
				// add origin if needed
			var theSteps = theRouteLeg.steps;
			for (var i = 0; i<theSteps.length; i++) {
				var stepPath = theSteps[i].path;
				for (var j = 0; j<stepPath.length; j++) {
					
					that.path.push(stepPath[j]);
					
				};
				
			}
			tsInfoCtrl.setHTML (theRoute.warnings+"<BR>"+theRoute.copyrights);
			
			that.type = tsNodeTypes.ROUTED;
			that.addOverlays(theMap);
		};
	});
};

tsNode.clearOverlays = function() {
	 // remove and invalidate any previous overlays
	if (this.marker) this.marker.setMap(null);
	if (this.polyline) this.polyline.setMap(null);
	this.marker = null;
	this.polyline = null;
};

tsNode.addOverlays = function() {
	
	theMap = tsMain.map;
	
	this.clearOverlays();
	
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
		map : theMap,
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
		map : theMap,
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
	if (polylineOptions) {
		this.polyline = new google.maps.Polyline(polylineOptions);
		this.addPolylineListeners();
	}
	if (markerOptions) {
		this.marker = new google.maps.Marker(markerOptions);
		this.addMarkerListeners();
	}
};

tsNode.addPolylineListeners = function() {
	var that = this;
	var pathEdited = function(mouseEvent) {
		that.calculateLength();
	};
	google.maps.event.addListener(this.polyline, "dragend", pathEdited);
    google.maps.event.addListener(this.polyline.getPath(), "insert_at", pathEdited);
    google.maps.event.addListener(this.polyline.getPath(), "remove_at", pathEdited);
    google.maps.event.addListener(this.polyline.getPath(), "set_at", pathEdited);		
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
	pathLength : 0,
};
tsNode.owner = tsPointList; // only one list for so all nodes belong to it

/**
 * Add Node to end of list
 * @param node
 */
tsPointList.push = function(node) {

	if (this.tail != null) { 
		var oldTail = this.tail;
		oldTail.next = node;
		node.setPrevious(oldTail);
	}
	this.tail = node;
	if (this.head == null) this.head = node;
};

tsPointList.clear = function() {
	while (this.head) tsPointList.deleteLastNode();	
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
	var node = this.head;
	this.pathLength = 0;
	while (node!=null) {
		this.pathLength += node.pathLength;
		node = node.next;
	}
	tsDistanceCtrl.update(this.pathLength/1000.0);
	
};


tsPointList.addPoint = function(latLng, addType) {
	var theMap = tsMain.map;
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
	
	if (node) node.addOverlays(theMap);
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
					node.addOverlays(tsMain.map);
				}
	    	}
    	}
    }
};

function tsInitializeList() {
}