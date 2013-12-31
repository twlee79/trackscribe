
var TSEditModes = {
		DRAG : { value: 0, name: ""},
		ADD_MANUALNODE : { value: 1, name: "Click to add a new point"},
		ADD_MANUALPOINT : { value: 2, name: "Click to add a new auto-route point"},
		ADD_ROUTENODE : { value: 3, name: "Click to add a new step"}
};


TSControl = function() {
};

TSControl.prototype.initialize  = function (id) {
	if (typeof (id) == "string") {
		this.theControl = document.getElementById(id);
	} else {
		this.theControl = id;
	}
	
	// for changing appearance
	this.origClassName = this.theControl.className; // store orig className
	this.activeClassName = document.getElementById("dummyActiveElement").className;
	
	tsMain.map.controls[google.maps.ControlPosition.RIGHT_TOP].push(this.theControl);
	
	// install listeners
	var that = this; // for use in closures
	google.maps.event.addDomListener(this.theControl, 'click', function() {
		that.activate();
	});
};

TSControl.prototype.setActiveSyle = function(status) {
	if (status == true) { //ON
		this.theControl.className = this.activeClassName;
	} else { //OFF
		this.theControl.className = this.origClassName; 
	}
};

TSControl.prototype.activate = function() {
	if (tsControls.activeTool==this) return; // unchanged
	
	if (tsControls.activeTool!=null) {
		tsControls.activeTool.setActiveSyle(false);
		tsControls.activeTool = null;
	}
	if (tsControls.clickListener != null) {
		google.maps.event.removeListener(tsControls.clickListener);
		tsControls.clickListener = null;
		
	}
	tsControls.activeTool = this;
	
	tsControls.activeTool.setActiveSyle(true);
	tsControls.clickListener = google.maps.event.addListener(tsMain.map, 'click', tsControls.activeTool.handleClick);
};


DragControl = function(id){this.initialize(id);};
DragControl.prototype = new TSControl();
DragControl.prototype.handleClick = function() {
	alert("Drag!");
};


ManualControl = function(id){this.initialize(id);};
ManualControl.prototype = new TSControl();
ManualControl.prototype.handleClick = function(mouseEvent) {
	var latLng = mouseEvent.latLng;
	var typeAdded = tsMain.pointList.addNode(latLng,that.map);
		
	if (typeAdded == TSNodeTypes.HOME) {
		// first node added
	} else {
		// already have home, switch to add point mode.
		that.setMode(TSEditModes.ADD_MANUALPOINT);
	}

	// todo: check if appropriate to add point?
	this.clickListener = google.maps.event.addListener(this.map, 'click', function(mouseEvent) {
		var latLng = mouseEvent.latLng;
		that.pointList.addPoint(latLng);
	});

};

RouteControl = function(id){this.initialize(id);};
RouteControl.prototype = new TSControl();
RouteControl.prototype.handleClick = function() {
	alert("Route!");
};



TSControls = function () {
	this.activeTool = null;
	this.clickListener = null;
};

TSControls.prototype.initialize = function() {
	this.dragControl = new DragControl("toolPalette");
	//this.manualControl = new ManualControl("manualTool");
	//this.routeControl = new RouteControl("routeTool");
	this.dragControl.activate();
};
