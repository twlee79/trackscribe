"use strict";

var ts = ts || {};

ts.controls = {};

/**
 * ts.htmlElement is a wrapper for an HTML element.
 * 
 * Members:
 * 
 * 	theControl
 * 		HTML element wrapped by this object, may be null if not initialized
 */
ts.htmlElement = {
    theControl: null,
    /**
     * Initializes this ts.htmlElement, setting theControl to id.
     * 
     * Arguments:
     * 
     * 	id : string or object
     * 		can be either a string used to getElementById or an object use to directly set theControl 
     */
    initialize: function (id) {
        if (typeof (id) == "string") {
            this.theControl = document.getElementById(id);
        } else {
            this.theControl = id;
        }
    }
};




/**
 * ts.controlContainer inherits from ts.htmlElement, used to encapsulate a container that
 * is used to house a collection of controls.  
 *
 * Members:
 *
 * 	controls
 * 		array of controls	
 * 	activeControl
 * 		reference to the currently active object, may be null if none active
 */
ts.controlContainer = Object.create(ts.htmlElement);

/**
 * Initializes this ts.controlContainer, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 * 	controlPosition
 * 		GoogleMaps position to this control container to (e.g. google.maps.ControlPosition.RIGHT_TOP)
 */
ts.controlContainer.initialize = function (id, controlPosition) {
    this.controls = [];
    this.activeControl = null;
    this.mapClickListener = null;
    ts.htmlElement.initialize.call(this, id);
    ts.main.map.controls[controlPosition].push(this.theControl);
};

ts.controlContainer.addControl = function (id, Type, allowActivation) {
    var newControl = Type;
    newControl.initialize(id, this, allowActivation);
    this.controls.push(newControl);
    return newControl;
};

ts.controls.drawControls = Object.create(ts.controlContainer);

ts.controls.statusBar = Object.create(ts.controlContainer);

/**
 * tsControl inherits from ts.htmlElement, used to encapsulate a control.
 *
 * Members:
 * 	
 * 	owner
 * 		reference to the ts.controlContainer containing this control
 */
ts.control = Object.create(ts.htmlElement);
ts.control.owner = null;
ts.control.allowActivation = false;

/**
 * Initializes this tsControl, overrides (but calls) function in parent.
 * 
 * Members:
 * 
 *  id
 *  	see parent
 */
ts.control.initialize = function (id, controlContainer, allowActivation) {
    this.owner = controlContainer;
    this.allowActivation = allowActivation;
    ts.htmlElement.initialize.call(this, id);

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
ts.control.installElementListeners = function () {
    var that = this; // for use in closures
    google.maps.event.addDomListener(this.theControl, 'click', function () {
        that.activate();
    });
};
/**
 * Install click listeners for the the map (triggered when this control is active).
 */
ts.control.installMapListeners = function () {
};

/**
 * Change style of the control to active/inactive.
 */
ts.control.setActiveSyle = function (status) {
    if (status == true) { //ON
        this.theControl.className = this.activeClassName;
        if (this.theControl.title)
            ts.controls.tipsCtrl.setHTML(this.theControl.title);
    } else { //OFF
        this.theControl.className = this.origClassName;
        ts.controls.tipsCtrl.setHTML("");
    }
};


/**
 * Activate this control (deactiving others in same container).
 */
ts.control.activate = function () {
    var lastControl = this.owner.activeControl;
    if (lastControl === this)
        return; // unchanged

    if (lastControl !== null) {
        lastControl.setActiveSyle(false);
        lastControl = null;
    }

    this.owner.activeControl = this;

    if (this.owner.mapClickListener !== null) {
        google.maps.event.removeListener(this.owner.mapClickListener);
        this.owner.mapClickListener = null;
    }

    this.installMapListeners();

    this.setActiveSyle(true);
};

ts.controls.dragCtrl = Object.create(ts.control);

ts.controls.dragCtrl.installMapListeners = function () {
    ts.main.setCursor(null); // reset cursor
};

ts.controls.manualPointCtrl = Object.create(ts.control);

ts.controls.manualPointCtrl.installMapListeners = function () {
    var that = this; // for use in closures
    ts.main.setCursor('crosshair');
    this.owner.mapClickListener = google.maps.event.addListener(ts.main.map, 'click', function (mouseEvent) {
        var latLng = mouseEvent.latLng;
        ts.pointList.addManualPoint(latLng, false);
    });
};


ts.controls.manualNodeCtrl = Object.create(ts.control);

ts.controls.manualNodeCtrl.installMapListeners = function () {
    var that = this; // for use in closures
    ts.main.setCursor('crosshair');
    this.owner.mapClickListener = google.maps.event.addListener(ts.main.map, 'click', function (mouseEvent) {

        var latLng = mouseEvent.latLng;
        ts.pointList.addManualPoint(latLng, true);
    });
};

ts.controls.routeCtrl = Object.create(ts.control);

ts.controls.routeCtrl.installMapListeners = function () {
    var that = this; // for use in closures
    ts.main.setCursor('crosshair');
    this.owner.mapClickListener = google.maps.event.addListener(ts.main.map, 'click', function (mouseEvent) {

        var latLng = mouseEvent.latLng;
        ts.pointList.addRoutedPoint(latLng);
    });
};

ts.controls.deleteNodeCtrl = Object.create(ts.control);
// T-ODO add delete selected node (listener)

ts.controls.deleteNodeCtrl.activate = function () {
    ts.main.setCursor('default');
    var lastControl = this.owner.activeControl;
    if (lastControl == this) {
        // sdecond click on delete control = delete last node
        ts.pointList.deleteLastNode();
    }
    ts.control.activate.call(this);
};

ts.controls.heightCtrl = Object.create(ts.control);
ts.controls.heightCtrl.infoWindow = null;

ts.controls.heightCtrl.activate = function () {
    ts.main.setCursor('default');
    var lastControl = this.owner.activeControl;
    if (lastControl == this) {
        // second click on height = lookup all points
        ts.pointList.lookupHeight();
    }
    ts.control.activate.call(this);
};


ts.controls.heightCtrl.installMapListeners = function () {
    var that = this; // for use in closures
    ts.main.setCursor('crosshair');
    this.owner.mapClickListener = google.maps.event.addListener(ts.main.map, 'click', function (mouseEvent) {

        var latLng = mouseEvent.latLng;
        // TODO fix this!
        nzElevationService.getElevationForLocations({locations:[latLng]}, function (lookupResult, lookupStatus) {
            if (lookupStatus === nztwlee.demlookup.ElevationStatus.OK) {
                var resultText = lookupResult[0].elevation.toFixed(1) + " m";
                if (that.infoWindow === null || that.infoWindow.map === null) {
                    // no current window (or has been closed)
                    var infoWindowOptions = {
                        position: latLng,
                    };
                    that.infoWindow = new google.maps.InfoWindow(infoWindowOptions);
                    that.infoWindow.open(ts.main.map);
                    that.infoWindow.setContent(resultText);
                    google.maps.event.addListener(that.infoWindow, 'closeclick', function(event) {
                        // if closed, invalidate reference
                        // Note: if Google Maps API opens a new info window, it will
                        // invalidate this one without calling closeclick
                        // Seems to be possible to detect this with check for map===null above
                        that.infoWindow = null;
                    });
                } else {
                    // reposition existing window
                    that.infoWindow.setContent(resultText);
                    that.infoWindow.setPosition(latLng);
                }
            }
        });
    });
};



ts.controls.statusCtrl = Object.create(ts.control);
ts.controls.statusCtrl.setHTML = function (html) {
    this.theControl.innerHTML = html;
};

ts.controls.distanceCtrl = Object.create(ts.controls.statusCtrl);

ts.controls.distanceCtrl.update = function (distance) {
    this.theControl.innerHTML = distance.toFixed(2) + " km";

};


ts.controls.tipsCtrl = Object.create(ts.controls.statusCtrl);
ts.controls.infoCtrl = Object.create(ts.controls.statusCtrl);

ts.controls.saveToolClick = function () {
    if (ts.pointList.isEmpty()) {
        ts.error("Nothing to save!");
        return;
    }
    var filename = ts.getISODate() + " track.csv";
    ts.downloadCSV(filename, ts.pointList.toCSV());
}

ts.controls.loadToolClick = function () {
    // using HTML5 File API, hidden input="file" element present (inputCSV) 
    if (!ts.pointList.isEmpty()) {
        if (!window.confirm("Loading a track will clear current track?"))
            return;
    }
    document.getElementById('inputCSV').click();
}

ts.controls.loadToolFileSelected = function () {
    var theFile = document.getElementById('inputCSV').files[0];
    var reader = new FileReader();
    reader.onload = function () {
        ts.pointList.fromCSV(reader.result);
    }; // called after reading finished
    reader.readAsText(theFile);
}

ts.controls.initialize = function () {
    ts.controls.drawControls.initialize("toolPalette", google.maps.ControlPosition.RIGHT_TOP);
    ts.controls.drawControls.addControl("dragTool", ts.controls.dragCtrl, true);
    ts.controls.drawControls.addControl("manualPointTool", ts.controls.manualPointCtrl, true);
    ts.controls.drawControls.addControl("manualNodeTool", ts.controls.manualNodeCtrl, true);
    ts.controls.drawControls.addControl("routeTool", ts.controls.routeCtrl, true);
    ts.controls.drawControls.addControl("deleteTool", ts.controls.deleteNodeCtrl, true);
    ts.controls.drawControls.addControl("heightTool", ts.controls.heightCtrl, true);
    document.getElementById("loadToolButton").addEventListener("click", ts.controls.loadToolClick);
    document.getElementById('inputCSV').addEventListener("change", ts.controls.loadToolFileSelected); // called when a file is selected

    document.getElementById("saveToolButton").addEventListener("click", ts.controls.saveToolClick);

    ts.controls.statusBar.initialize("statusBar", google.maps.ControlPosition.BOTTOM);
    ts.controls.drawControls.addControl("distance", ts.controls.distanceCtrl, false);
    ts.controls.drawControls.addControl("tips", ts.controls.tipsCtrl, false);
    ts.controls.drawControls.addControl("info", ts.controls.infoCtrl, false);


    ts.controls.drawControls.controls[1].activate();



}


