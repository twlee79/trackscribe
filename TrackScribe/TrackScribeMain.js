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
	ts.main.elevationPlot = Object.create(tsElevationPlot);
	//ts.main.elevationPlot.initialize([0,100,230],[10,15,4]);
	
};

ts.main.initialize = function() {
	ts.main.initializeMap();
	ts.list.initialize();
	ts.controls.initialize();
}

/*
function testSVG(svg) {
	//this.elevationSVG = document.getElementById("elevation-svg");
	testSVG() ;
	var r = Raphael("elevation");
	//tsSVG() ;
	return;
	
	var svgns = "http://www.w3.org/2000/svg";
	var shape = document.createElementNS(svgns, "polygon");
    shape.setAttributeNS(null, "points", "5,5 45,45 5,45 45,5");
    shape.setAttributeNS(null, "fill", "none");
    shape.setAttributeNS(null, "stroke", "black");	
    ts.main.elevationSVG.appendChild(shape);
}*/


google.maps.event.addDomListener(window, 'load', ts.main.initialize);



