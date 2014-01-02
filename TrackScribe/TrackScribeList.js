/**
 * Data stored in a linked list.
 * Each item in list is a node.
 * Node contains a path, which is an array of LatLng coords.
 * Path shown as a polyline, with last point (terminus) a marker.
 * 
 * 
 */

var tsNodeTypes = {
		HOME: {value: 1, name: "Home node"},
		MANUAL: {value: 2, name: "Manual node"},
		ROUTED: {value: 3, name: "Routed node"},
		PATH: {value: 4, name: "Path point"}
};

var tsError = {
		INVALIDNODE : new Error("Invalid node")
};


var tsNode = {
	// data
	type : null,
	path : null,
	totalLength : 0,
	
	// for overlays
	marker : null,
	polyline : null,
	
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

tsNode.calculateLength = function() {
	this.totalLength = 0;
	if (this.path) {
		for (var i = 1; i < this.path.getLength(); i++) {
			this.totalLength += tsComputeDistBtw(
					this.path.getAt(i-1), this.path.getAt(i));
		}
	}
	this.owner.calculateLength(); // update length of owning list
};

/**
 * Sets previous and also adds previous as item 0 in this polyline
 */
tsNode.setPrevious = function(prevNode) {
	this.previous = prevNode;
	this.path.insertAt(0,prevNode.getTerminus());
	this.calculateLength();
};

/**
 * Update terminus location, also change next's (if any) first point
 */
tsNode.updateTerminus = function(latLng) {
	this.path.setAt(this.path.getLength()-1,latLng);
	if (this.next) this.next.path.setAt(0,latLng);
	this.calculateLength();
};


tsNode.getTerminus = function() {
	return this.path.getAt(this.path.getLength()-1); 
};

tsNode.addPoint = function(latLng) {
	if (this.type==tsNodeTypes.DUMMY) throw tsError.INVALIDNODE;
	var newLength= this.path.push(latLng);
	if (this.marker) this.marker.setPosition(this.getTerminus());
	this.calculateLength();
	return newLength; 
};


tsNode.addOverlays = function() {
	
	theMap = tsMain.map;
	
	 // remove and invalid any previous overlays
	if (this.marker) marker.setMap(null);
	if (this.polyline) marker.setMap(null);
	this.marker = null;
	this.polyline = null;
	
	var arrowSymbol = {
	    path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW
	};
	
	var markerOptions = {
		position : this.getTerminus(),
		draggable : true,
		map : theMap,
		zIndex : 100,
	};
	var polylineOptions = {
		path : this.path,
		strokeColor : "skyblue",
		strokeOpacity : 1.0,
		strokeWeight : 2,
		map : theMap,
		editable : true,
		zIndex : 90,
		icons : [ 
		          {	icon : arrowSymbol, offset : '10%'},
		          {	icon : arrowSymbol, offset : '90%'}
		]
	};
	
	
	
	switch (this.type) {
		case tsNodeTypes.HOME:
			markerOptions.icon = {
				// convert SVG polygons to path with http://readysetraphael.com/
				// ensure centred around origin
					path : 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z',
					scale : 0.15,
					fillColor : "darkblue",
					fillOpacity : 1.0,
					strokeColor : "darkblue",
					strokeOpacity : 1.0,
					strokeWeight : 1.0,
				};
			polylineOptions = null; // no polyline for home
			break;
		case tsNodeTypes.MANUAL:
			markerOptions.icon = {
					path : 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z',
					scale : 6,
					fillColor : "skyblue",
					fillOpacity : 1.0,
					strokeColor : "skyblue",
					strokeOpacity : 1.0,
					strokeWeight : 1.0,
				};
			break;
	}
	if (polylineOptions) {
		this.polyline = new google.maps.Polyline(polylineOptions);
		var that = this;
		var pathEdited = function(mouseEvent) {
			that.calculateLength();
		};
		google.maps.event.addListener(this.polyline, "dragend", pathEdited);
        google.maps.event.addListener(this.polyline.getPath(), "insert_at", pathEdited);
        google.maps.event.addListener(this.polyline.getPath(), "remove_at", pathEdited);
        google.maps.event.addListener(this.polyline.getPath(), "set_at", pathEdited);		
	}
	if (markerOptions) {
		this.marker = new google.maps.Marker(markerOptions);
		var that = this;
		google.maps.event.addListener(this.marker, 'dragend', function(mouseEvent) {
			var latLng = mouseEvent.latLng;
			that.updateTerminus(latLng);
			});
	}
};



var tsPointList = {
	head : null,
	tail : null,
	totalLength : 0,
};
tsNode.owner = tsPointList; // only one list for so all nodes belong to it 

tsPointList.calculateLength = function() {
	var node = this.head;
	this.totalLength = 0;
	while (node!=null) {
		this.totalLength += node.totalLength;
		node = node.next;
	}
	tsDistanceCtrl.update(this.totalLength/1000.0);
	
};


tsPointList.addManualPoint = function(latLng, forceNewNode) {
	var theMap = tsMain.map;
	var type = null;
	var node = null;
	if (this.head == null) { // any points so far?
		// no
		// first node is 'home' node
		type = tsNodeTypes.HOME;
		node = Object.create(tsNode);
		node.initialize(type, latLng);
		this.head = node;
		this.tail = node;
	} else {
		// yes there are some points
		if (!forceNewNode && this.tail.type == tsNodeTypes.MANUAL) { // was last node a manual node?
			// add a new point to that node
			type = tsNodeTypes.PATH;
			this.tail.addPoint(latLng);
		} else {
			// no, make a new node
			type = tsNodeTypes.MANUAL;
			node = Object.create(tsNode);
			node.initialize(type, latLng);
			var oldTail = this.tail;
			oldTail.next = node;
			node.setPrevious(oldTail);
			this.tail = node;
			
		}
	}
	
	if (node) node.addOverlays(theMap);
	return type; // return type, may be 'home'

};


function tsInitializeList() {
}