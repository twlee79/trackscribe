

TSControl = function() {
};

TSControl.prototype.initialize  = function (id) {
	if (typeof (id) == "string") {
		this.theControl = document.getElementById(id);
	} else {
		this.theControl = id;
	}
	
	// store orig styles for turning them off
	this.origFontWeight = this.theControl.style.fontWeight;
	this.origColor = this.theControl.style.color;
	this.origBackgroundColor = this.theControl.style.backgroundColor;
	this.origBackgroundImage= this.theControl.style.backgroundImage;
	
	tsMain.map.controls[google.maps.ControlPosition.BOTTOM_LEFT].push(this.theControl);
	
	// install listeners
	var that = this; // for use in closures
	google.maps.event.addDomListener(this.theControl, 'click', function() {
		that.activate();
	});
};

TSControl.prototype.setActiveSyle = function(status) {
	if (status == true) { //ON
		this.theControl.style.fontWeight = "bold";
		this.theControl.style.color = "rgb(255, 0, 0)";
		this.theControl.style.backgroundColor = "lightgray";
		this.theControl.style.backgroundImage = "-webkit-linear-gradient(top, white, lightgray)";
	} else { //OFF
		this.theControl.style.fontWeight = this.origFontWeight;
		this.theControl.style.color = this.origColor;
		this.theControl.style.backgroundColor = this.origBackgroundColor;
		this.theControl.style.backgroundImage = this.origBackgroundImage; 
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
ManualControl.prototype.handleClick = function() {
	alert("Manual!");
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
	this.dragControl = new DragControl("dragTool");
	this.manualControl = new ManualControl("manualTool");
	this.routeControl = new RouteControl("routeTool");
	this.dragControl.activate();
};
