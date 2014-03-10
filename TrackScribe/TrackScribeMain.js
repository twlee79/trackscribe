

// Disable business poits
var tsStyles =[
    {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [
              { visibility: "off" }
        ]
    }
];


var tsMain = {
	mapOptions : {
			center : new google.maps.LatLng(-36.884391,174.749642),
			zoom : 16,
			mapTypeId : google.maps.MapTypeId.ROADMAP,
		    styles: tsStyles 
		},
	map : null,
	directionsService : null,
};

tsMain.initialize = function() {
	this.map = new google.maps.Map(document.getElementById("map-canvas"),
			this.mapOptions);
	this.directionsService = new google.maps.DirectionsService();
};

tsMain.setCursor = function(cursor) {
	this.map.setOptions({draggableCursor:cursor});
};

function tsInitialize() {
	tsMain.initialize();
	tsInitializeList();
	tsInitializeControls();
	tsMain.elevationPlot = Object.create(tsElevationPlot);
	//tsMain.elevationPlot.initialize();
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
    tsMain.elevationSVG.appendChild(shape);
}*/


google.maps.event.addDomListener(window, 'load', tsInitialize);



