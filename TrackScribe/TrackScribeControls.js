
/**
 * tsElement is a wrapper for an HTML element.
 * 
 * Members:
 * 
 * 	theControl
 * 		HTML element wrapped by this object, may be null if not initialized
 */
var tsElement = {
	theControl : null,
	
	/**
	 * Initializes this tsElement, setting theControl to id.
	 * 
	 * Arguments:
	 * 
	 * 	id : string or object
	 * 		can be either a string used to getElementById or an object use to directly set theControl 
	 */
	initialize: function(id) {
		if (typeof (id) == "string") {
			this.theControl = document.getElementById(id);
		} else {
			this.theControl = id;
		}
	}
};




/**
 * tsControlContainer inherits from tsElement, used to encapsulate a container that
 * is used to house a collection of controls.  
 *
 * Members:
 *
 * 	controls
 * 		array of controls	
 * 	activeControl
 * 		reference to the currently active object, may be null if none active
 */
var tsControlContainer = Object.create(tsElement);

/**
 * Initializes this tsControlContainer, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 * 	controlPosition
 * 		GoogleMaps position to this control container to (e.g. google.maps.ControlPosition.RIGHT_TOP)
 */
tsControlContainer.initialize  = function (id, controlPosition) {
	this.controls = [];
	this.activeControl = null;
	this.mapClickListener = null;
	tsElement.initialize.call(this,id);
	tsMain.map.controls[controlPosition].push(this.theControl);
};

tsControlContainer.addControl = function (id, Type, allowActivation) {
	newControl = Type;
	newControl.initialize(id, this, allowActivation);
	this.controls.push(newControl);
	return newControl;
};

var tsDrawControls = Object.create(tsControlContainer);

var tsStatusBar = Object.create(tsControlContainer);

/**
 * tsControl inherits from tsElement, used to encapsulate a control.
 *
 * Members:
 * 	
 * 	owner
 * 		reference to the tsControlContainer containing this control
 */
var tsControl = Object.create(tsElement);
tsControl.owner = null;
tsControl.allowActivation = false;

/**
 * Initializes this tsControl, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 */
tsControl.initialize  = function (id, controlContainer, allowActivation) {
	this.owner = controlContainer;
	this.allowActivation = allowActivation; 
	tsElement.initialize.call(this,id);
	
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
tsControl.installElementListeners = function() {
	var that = this; // for use in closures
	google.maps.event.addDomListener(this.theControl, 'click', function() {
		that.activate();
	});
};
/**
 * Install click listeners for the the map (triggered when this control is active).
 */
tsControl.installMapListeners = function() {
};

/**
 * Change style of the control to active/inactive.
 */
tsControl.setActiveSyle = function(status) {
	if (status == true) { //ON
		this.theControl.className = this.activeClassName;
		if (this.theControl.title)
			tsTipsCtrl.setHTML(this.theControl.title); 
	} else { //OFF
		this.theControl.className = this.origClassName; 
		tsTipsCtrl.setHTML("");
	}
};


/**
 * Activate this control (deactiving others in same container).
 */
tsControl.activate = function() {
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

var tsDragCtrl = Object.create(tsControl);

tsDragCtrl.installMapListeners = function() {
	tsMain.setCursor(null); // reset cursor
};

var tsManualPointCtrl = Object.create(tsControl);

tsManualPointCtrl.installMapListeners = function() {
	var that = this; // for use in closures
	tsMain.setCursor('crosshair');
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		var latLng = mouseEvent.latLng;
		tsPointList.addManualPoint(latLng, false);
	});
};


var tsManualNodeCtrl = Object.create(tsControl);

tsManualNodeCtrl.installMapListeners = function() {
	var that = this; // for use in closures
	tsMain.setCursor('crosshair');
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		
		var latLng = mouseEvent.latLng;
		tsPointList.addManualPoint(latLng, true);
	});
};

var tsRouteCtrl = Object.create(tsControl);

tsRouteCtrl.installMapListeners = function() {
	var that = this; // for use in closures
	tsMain.setCursor('crosshair');
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		
		var latLng = mouseEvent.latLng;
		tsPointList.addRoutedPoint(latLng);
	});
};

var tsDeleteNodeCtrl = Object.create(tsControl);
// TODO add delete selected node (listener)

tsDeleteNodeCtrl.activate = function() {
	tsMain.setCursor('default'); 
	lastControl = this.owner.activeControl;
	if (lastControl==this) {
		// sdecond click on delete control = delete last node
		tsPointList.deleteLastNode();
	}
	tsControl.activate.call(this);
};

var tsHeightCtrl = Object.create(tsControl);
tsHeightCtrl.infoWindow = null;

tsHeightCtrl.activate = function() {
	tsMain.setCursor('default'); 
	lastControl = this.owner.activeControl;
	if (lastControl==this) {
		// second click on height = lookup all points
		tsPointList.lookupHeight();
	}
	tsControl.activate.call(this);
};


tsHeightCtrl.installMapListeners = function() {
	var that = this; // for use in closures
	tsMain.setCursor('crosshair');
	this.owner.mapClickListener = google.maps.event.addListener(tsMain.map, 'click', function(mouseEvent) {
		
		var latLng = mouseEvent.latLng;
		tsLookupDEM(latLng, null, function(lookupResult, lookupStatus) {
			if (lookupStatus==tsLookupStatus.SUCCESS) {
				var resultText = lookupResult.toFixed(1) + " m";
				if (that.infoWindow == null) {
					var infoWindowOptions = {
						position : latLng,
					};
					that.infoWindow = new google.maps.InfoWindow(infoWindowOptions);
					that.infoWindow.open(tsMain.map);
					that.infoWindow.setContent(resultText);
				} else {
					that.infoWindow.setContent(resultText);
					that.infoWindow.setPosition(latLng);
				}
			}
		});
	});
};



var tsStatusCtrl = Object.create(tsControl);
tsStatusCtrl.setHTML = function(html) {
	this.theControl.innerHTML = html;
}; 

var tsDistanceCtrl = Object.create(tsStatusCtrl);

tsDistanceCtrl.update = function(distance) {
	this.theControl.innerHTML = distance.toFixed(2) + " km";
	
};


var tsTipsCtrl = Object.create(tsStatusCtrl);
var tsInfoCtrl = Object.create(tsStatusCtrl);

function tsSaveToolClick() {
	if (tsPointList.isEmpty()) {
		tsError("Nothing to save!");
		return;
	}
	var filename = tsGetISODate() + " track.csv";
	tsDownloadCSV(filename,tsPointList.toCSV());
}

function tsLoadToolClick() {
	// using HTML5 File API, hidden input="file" element present (inputCSV) 
	if (!tsPointList.isEmpty()) {
		if (!window.confirm("Loading a track will clear current track?")) return;
	}
	document.getElementById('inputCSV').click();
}

function tsLoadToolFileSelected() {
	var theFile = document.getElementById('inputCSV').files[0];
	var reader = new FileReader();
	reader.onload = function() { tsPointList.fromCSV(reader.result);}; // called after reading finished
	reader.readAsText(theFile);
}

function tsInitializeControls() {
	tsDrawControls.initialize("toolPalette",google.maps.ControlPosition.RIGHT_TOP);
	tsDrawControls.addControl("dragTool",tsDragCtrl, true);
	tsDrawControls.addControl("manualPointTool",tsManualPointCtrl, true);
	tsDrawControls.addControl("manualNodeTool",tsManualNodeCtrl, true);
	tsDrawControls.addControl("routeTool",tsRouteCtrl, true);
	tsDrawControls.addControl("deleteTool",tsDeleteNodeCtrl, true);
	tsDrawControls.addControl("heightTool",tsHeightCtrl, true);
	document.getElementById("loadToolButton").addEventListener("click", tsLoadToolClick);
	document.getElementById('inputCSV').addEventListener("change",tsLoadToolFileSelected); // called when a file is selected
	
	document.getElementById("saveToolButton").addEventListener("click", tsSaveToolClick);
	
	tsStatusBar.initialize("statusBar",google.maps.ControlPosition.BOTTOM);
	tsDrawControls.addControl("distance",tsDistanceCtrl, false);
	tsDrawControls.addControl("tips",tsTipsCtrl, false);
	tsDrawControls.addControl("info",tsInfoCtrl, false);
	
	
	tsDrawControls.controls[1].activate();
	
	

}


