

TSMain = function () {
	this.mapOptions = {
			center : new google.maps.LatLng(-36.884391,174.749642),
			zoom : 16,
			mapTypeId : google.maps.MapTypeId.ROADMAP
		};
	this.map = null;
	this.pointList = new TSList();
};

TSMain.prototype.initialize = function() {
	this.map = new google.maps.Map(document.getElementById("map-canvas"),
			this.mapOptions);
};

function initialize() {
	tsMain.initialize();
	tsControls.initialize();
}


var tsMain = new TSMain();
var tsControls = new TSControls();

google.maps.event.addDomListener(window, 'load', initialize);
