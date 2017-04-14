"use strict";

var ts = ts || {};

// Disable business pois
ts.mapStyles =[
    {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [
              { visibility: "off" }
        ]
    }
];


ts.main = {
	mapOptions : {
			center : new google.maps.LatLng(-36.884391,174.749642),
			zoom : 16,
			mapTypeId : google.maps.MapTypeId.ROADMAP,
		    styles: ts.mapStyles 
		},
	map : null,
	directionsService : null,
};

ts.main.initializeMap = function() {
	this.map = new google.maps.Map(document.getElementById("map-canvas"),
			this.mapOptions);
	this.directionsService = new google.maps.DirectionsService();
	google.maps.event.addListenerOnce(this.map, 'idle', this.mapReady );
};

ts.main.setCursor = function(cursor) {
	this.map.setOptions({draggableCursor:cursor});
};

ts.main.mapReady = function() {
        ts.dem.initializeChart();
};

ts.main.initialize = function() {
	ts.main.initializeMap();
	ts.list.initialize();
	ts.controls.initialize();
};

google.maps.event.addDomListener(window, 'load', ts.main.initialize);



