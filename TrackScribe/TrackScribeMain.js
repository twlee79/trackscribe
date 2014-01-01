

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
	tsDrawControls.initialize("toolPalette",google.maps.ControlPosition.RIGHT_TOP);
	tsDrawControls.addControl("dragTool",TSControl, true);
	tsDrawControls.addControl("manualPointTool",ManualPointControl, true);
	tsDrawControls.addControl("manualNodeTool",ManualNodeControl, true);
	tsDrawControls.addControl("routeTool",TSControl, true);
	
	tsStatusBar.initialize("statusBar",google.maps.ControlPosition.BOTTOM);
	tsDistanceCtrl = tsDrawControls.addControl("distance",TSControl, false);
	tsInfoCtrl = tsDrawControls.addControl("info",TSControl, false);
	
	tsDrawControls.controls[0].activate();

}


var tsMain = new TSMain();
var tsDrawControls = new TSControlContainer();
var tsStatusBar = new TSStatusBar();
var tsDistanceCtrl = null;
var tsInfoCtrl = null;

google.maps.event.addDomListener(window, 'load', initialize);



