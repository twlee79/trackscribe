

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

function tsInitialize() {
	tsMain.initialize();
	tsInitializeList();
	tsInitializeControls();
}


google.maps.event.addDomListener(window, 'load', tsInitialize);



