
/**
 * TSElement is a wrapper for an HTML element.
 * 
 * Members:
 * 
 * 	theControl
 * 		HTML element wrapped by this object, may be null if not initialized
 */
TSElement = function() {
	this.theControl = null;
};

/**
 * Initializes this TSElement, setting theControl to id.
 * 
 * Arguments:
 * 
 * 	id : string or object
 * 		can be either a string used to getElementById or an object use to directly set theControl 
 */
TSElement.prototype.initialize  = function (id) {
	if (typeof (id) == "string") {
		this.theControl = document.getElementById(id);
	} else {
		this.theControl = id;
	}
};

/**
 * TSControlContainer inherits from TSElement, used to encapsulate a container that
 * is used to house a collection of controls.  
 *
 * Members:
 *
 * 	controls
 * 		array of controls	
 * 	activeControl
 * 		reference to the currently active object, may be null if none active
 */
TSControlContainer = function() {
	this.controls = [];
	this.activeControl = null;
	this.mapClickListener = null;
}

TSControlContainer.prototype = new TSElement();
TSControlContainer.prototype.constructor = TSControlContainer;

/**
 * Initializes this TSControlContainer, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 * 	controlPosition
 * 		GoogleMaps position to this control container to (e.g. google.maps.ControlPosition.RIGHT_TOP)
 */
TSControlContainer.prototype.initialize  = function (id, controlPosition) {
	TSElement.prototype.initialize.call(this,id);
	tsMain.map.controls[controlPosition].push(this.theControl);
};

TSControlContainer.prototype.addControl = function (id, Type, allowActivation) {
	newControl = new Type();
	newControl.initialize(id, this, allowActivation);
	this.controls.push(newControl);
	return newControl;
};


TSStatusBar = function() {
	this.distanceBox = null;
	this.infoBox = null;
};

TSStatusBar.prototype = new TSControlContainer();
TSStatusBar.prototype.constructor = TSStatusBar;


/**
 * TSControl inherits from TSElement, used to encapsulate a control.
 *
 * Members:
 * 	
 * 	owner
 * 		reference to the TSControlContainer containing this control
 */
TSControl = function() {
	this.owner = null;
	this.allowActivation = false;
};

TSControl.prototype = new TSElement();
TSControl.prototype.constructor = TSControl;


/**
 * Initializes this TSControl, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 */
TSControl.prototype.initialize  = function (id, controlContainer, allowActivation) {
	this.owner = controlContainer;
	this.allowActivation = allowActivation; 
	TSElement.prototype.initialize.call(this,id);
	
	// for changing appearance
	this.origClassName = this.theControl.className; // store orig className
	this.activeClassName = document.getElementById("dummyActiveElement").className;
	
	// install listeners
	if (this.allowActivation)
		this.installElementListeners();
};

/**
 * Install click listeners for the control element itself (i.e. when clicking on the control)
 */
TSControl.prototype.installElementListeners = function() {
	var that = this; // for use in closures
	google.maps.event.addDomListener(this.theControl, 'click', function() {
		that.activate();
	});
};
/**
 * Install click listeners for the the map (triggered when this control is active).
 */
TSControl.prototype.installMapListeners = function() {
};

/**
 * Change style of the control to active/inactive.
 */
TSControl.prototype.setActiveSyle = function(status) {
	if (status == true) { //ON
		this.theControl.className = this.activeClassName;
		if (this.theControl.title)
			tsInfoCtrl.theControl.innerHTML = this.theControl.title; 
	} else { //OFF
		this.theControl.className = this.origClassName; 
		tsInfoCtrl.theControl.innerHTML = "";
	}
};


/**
 * Activate this control (deactiving others in same container).
 */
TSControl.prototype.activate = function() {
	lastControl = this.owner.activeControl;
	if (lastControl==this) return; // unchanged
	
	if (lastControl!=null) {
		lastControl.setActiveSyle(false);
		lastControl = null;
	}
	
	this.owner.activeControl = this;
	
	if (this.owner.mapClickListener != null) {
		google.maps.event.removeListener(this.owner.mapClickListener);
		this.owner.mapClickListener = null;
	}

	this.installMapListeners();
	
	this.setActiveSyle(true);
};



ManualPointControl = function() {
};

ManualPointControl.prototype = new TSControl();
ManualPointControl.prototype.constructor = ManualPointControl ;


ManualPointControl.prototype.installMapListeners = function() {
	var that = this; // for use in closures
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		var latLng = mouseEvent.latLng;
		tsMain.pointList.addManualPoint(latLng, false);
	});
};


ManualNodeControl = function() {
};

ManualNodeControl.prototype = new TSControl();
ManualNodeControl.prototype.constructor = ManualNodeControl;


ManualNodeControl.prototype.installMapListeners = function() {
	var that = this; // for use in closures
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		
		var latLng = mouseEvent.latLng;
		tsMain.pointList.addManualPoint(latLng, true);
	});
};


