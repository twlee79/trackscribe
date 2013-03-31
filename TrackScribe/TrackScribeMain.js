
 

function initialize() {
	var mapOptions = {
		center : new google.maps.LatLng(-34.397, 150.644),
		zoom : 8,
		mapTypeId : google.maps.MapTypeId.ROADMAP
	};
	var map = new google.maps.Map(document.getElementById("map-canvas"),
			mapOptions);

	google.maps.event.addListener(map, 'click', function(mouseEvent) {
		var latLng = mouseEvent.latLng;
		var tsPoint = new TSPoint(TsPointTypes.NORMAL,latLng);
		pointList.append(tsPoint);
		tsPoint.addOverlays(map);
		
	});


}
google.maps.event.addDomListener(window, 'load', initialize);


var TsPointTypes = {
		INVALID : {value: 0, name: "Invalid"}, 
		NORMAL: {value: 1, name: "Normal"} 
};


TSPoint = function (type, latLng) {
	
	// data
	this.type = type;
	this.latLng = latLng;
	
	// for overlays
	this.marker = null;
	this.polyline = null;
	
	// for linked=list
	this.previous = null;
	this.next = null;
};


TSPoint.prototype.hasPrevious = function() {
	return (this.previous != null && this.previous.latLng!=null); 
};

TSPoint.prototype.addOverlays = function(map) {
	this.marker = new google.maps.Marker({
		position : this.latLng,
		icon : {
			path : google.maps.SymbolPath.CIRCLE,
			scale : 5
		},
		//draggable : true,
		map : map
	});
	if (this.hasPrevious()) {
		this.polyline = new google.maps.Polyline({
			path : [this.previous.latLng, this.latLng],
			strokeColor : "#FF0000",
			strokeOpacity : 1.0,
			strokeWeight : 2,
			map : map
		});
	}
};



TSPointList = function () {
	var sentinel = new TSPoint(TsPointTypes.INVALID,null);
	this.head = sentinel;
	this.tail = sentinel;
};

TSPointList.prototype.append = function(node) {
	var oldTail = this.tail;
	oldTail.next = node;
	node.previous = oldTail;
	this.tail = node;
	
};

var pointList = new TSPointList();