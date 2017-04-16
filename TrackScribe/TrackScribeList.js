"use strict";

var ts = ts || {};

ts.list = {}

//TODO: auto-route TOROUTE, height lookup?
// TODO: check handling of modify list while waiting height lookup

/**
 * This file contains implementation of the data structures used for TrackScribe.
 * 
 * <p>Top-level data structure is a linked list of nodes.
 * 
 * <p>Each node contains a path, which is an array of LatLng coordinates. 
 * The first node is a HOME node and contains a single point in the path. 
 * In all other nodes, the first point of the node is shared (same LatLng object)
 * with the terminal path point of the previous node.
 * 
 * <p>Each LatLng coordinate may contain a series of child points, which are a series
 * of points generated when doing elevation lookup - these points should be collinear
 * from point to next point in x,y plane (on a mercator projection) but contain
 * different heights.
 * 
 *   
 */


/**
 * Enum-like of possible node types.
 * 
 */
ts.list.nodeTypes = {
    PATH:       {value:-11, name: "Path point"}, // not a real node 'type, used for file reading/writing
    ELEVATION:  {value:-12, name: "Elevation child point"}, // not a real node 'type, used for file reading/writing
    HOME:       {value:  1, name: "Home node", color : ts.colors.homeNode    }, // first node, has a one point path
    MANUAL:     {value: 10, name: "Manual node", color : ts.colors.manualNode    }, // manually draw path
    TOROUTE:    {value: 20, name: "Node to route", color : ts.colors.toRouteNode}, // auto-routed, awaiting route return
    ROUTED:     {value: 21, name: "Routed node", color : ts.colors.routedNode}  // auto-routed, 
};
ts.list.nodeTypesRev = ts.generateReverseDict(ts.list.nodeTypes); // allow reverse lookup of node types

/**
 * ts.list.node is an element of the top-level linked list.
 * 
 * Contains:
 * <ul>
 * <li>references for linked-list implementation</li>
 * <li>type</li>
 * <li>path - array of LatLng coords, implemented as google MVCArray</li>
 * <li>other data - e.g. length</li>
 * <li>overlays and state - for display on map and controlling behaviour</li>
 * </ul>
 *  
 * <p>Note that terminal point in path of one node is used also as first point
 * in path of next node. Also, the path is made up of LatLng coords, but each of
 * these may have a set of children, which are interpolated between two path
 * points and contain different heights.
 * 
 * <p>For all nodes, the path is displayed as a polyline. Terminal point is shown
 * as a marker that can be moved. As terminal point is shared with first point
 * of next node, moving terminus also causes affects next node.  
 *  
 * <p>General behaviour of nodes depending on type:
 * <dl>
 * <dt>MANUAL node</dt>
 * <dd>each point is drawn manually, and path may be editable
 *     editable path drawn with each point as a marker by maps framework
 * </dd>
 *
 * <dl>
 * <dt>TOROUTE node</dt>
 * <dd>routed node which has not yet been properly routed
 *     calls directions service to find route
 * </dd>
 *  
 * <dl>
 * <dt>ROUTED node</dt>
 * <dd>converted from TOROUTE node once directions service returns a routed path
 *     not manually editable
 *     moving markers will cause rerouting of the path, conversion back to TOROUTE 
 * </dd></dl>
 *  
 */
ts.list.node = {
};

/**
 * Initialize a this node with a type.
 * Should be called after creating a new node.
 * Note, after adding to the point list, the first point in path
 * will be the terminus of last node. Any more points to be added to this node
 * should be done after it has been added to the point list.
 * 
 * @param {ts.list.nodeTypes} type type of node to initialize
 */
ts.list.node.initialize  = function (type) {
    ts.assert(this.type === undefined);
    ts.assert(type);
    
    // state
    this.deactivateListeners();
    
    // data
    this.type = type;
    this.path = new google.maps.MVCArray();
    this.addPathListeners();
    this.lengthValid = false;
    
    // for map overlays
    this.marker = null;
    this.polyline = null;
    this.kmMarkers = null;
    
    // for elevation plot
    this.plot_group = null;
    
    // for linked-list
    this.previous = null; // use setPrevious to set correctly
    this.next = null;
    
    //this.owner = null; // single owner for all nodes, see below
};

/**
 * Deactivate path listeners, use when programmatically 
 * manipulating path but want these changes ignored
 * by listeners.
 * 
 * <p>Use care when deactivating listeners - these ensure that any
 * affected path points are properly invalidated/flagged for update, 
 * caller must ensure these issues dealt with if listeners deactivated.
 * 
 */
ts.list.node.deactivateListeners = function() {
    this.listenersActive = false;    
};

/**
 * Reactivate path listeners, use when finished
 * manipulating path. A call to this will immediately
 * call the pathListenerCallback function.
 * 
 */
ts.list.node.activateListeners = function()  {
    this.listenersActive = true;
    this.pathListenerCallbackFunction();
};


/**
 * Signal to node that its path has been edited. This ensures parameters for 
 * node and any affected points are reset and flagged for updating.
 * 
 * <p>Call to update (handled by owning list) will recalculate
 * these parameters.
 * 
 * @param {integer} index index of point in path that was edited or null
 * 
 */
ts.list.node.pathListenerCallbackFunction = function(index) {
    ts.assert(index==null || typeof(index)==='number');
    if (index!=null) ts.assert(this.path.getAt(index).children == null); 
        // this checks that the point at index is already invalid
    
    this.lengthValid = false; // forces all points in node to recalc length
        // propagated downstream by list update
    
    
    if (index>0) {
        // point @ index is altered/new
        // child points for previous point (index - 1) are no longer valid
        var prevLatLng = this.path.getAt(index-1);
        if (prevLatLng.children!=null) {
            prevLatLng.children.length = 0;
            prevLatLng.heightValid = false; // true if heights of this point and to next is valid
        }
    }
    
    if (this.marker) this.marker.setPosition(this.getTerminus());
    
    this.owner.update(); // Note: update will not occur if updates flagged as paused
};

/**
 * Add listeners for a change to the path. 
 * Any edits to the path (manual or programmatic) 
 * will trigger these listeners.
 */
ts.list.node.addPathListeners = function() {
    var that = this;
    
    function pathListenerCallback(index) {
     if (!that.listenersActive) return;
       that.pathListenerCallbackFunction(index);
    }
    
    google.maps.event.addListener(this.path, "dragend", function() {
        // this event is never called
        ts.assert(false, "path dragend event");
    });
    google.maps.event.addListener(this.path, "insert_at", pathListenerCallback);
    google.maps.event.addListener(this.path, "remove_at", pathListenerCallback);
    google.maps.event.addListener(this.path, "set_at", pathListenerCallback);
        
};

/**
 * Add listeners for terminal marker for this node. 
 * 
 */
ts.list.node.addMarkerListeners = function() {
    var that = this;
    google.maps.event.addListener(this.marker, 'dragend', function(mouseEvent) {
        var latLng = mouseEvent.latLng;
        that.updateTerminus(latLng);
        });
};

/**
 * Prepare for deletion. Ensure all contents reset and references nulled.
 * Nulling may be unnecessary but should help prevent memory leaks.
 * 
 */ 
ts.list.node.clear = function() {
    this.type = null;
    this.clearPath();
    this.clearMapOverlays();
    this.previous = this.next = null;
};

/**
 * Empty and invalidate path, including removal of any listeners.
 */ 
ts.list.node.clearPath = function() {
    google.maps.event.clearInstanceListeners(this.path);
    this.path.clear();
    this.path = null;
};

/**
 * Sets previous node reference and also adds terminus of previous node 
 * to be first point of the path of this node.
 * 
 * @param {ts.list.node} prevNode node to use as previous node
 */
ts.list.node.setPrevious = function(prevNode) {
    ts.assert(ts.list.node.isPrototypeOf(prevNode));
    
    this.previous = prevNode;
    this.path.push(prevNode.getTerminus());
};

/**
 * Return origin of this node, i.e. first point in path.
 * 
 * @returns {LatLng} origin point of the node's path
 */
ts.list.node.getOrigin = function() {
    return this.path.getAt(0); 
};

/**
 * Return terminus of this node, i.e. last point in path.
 * 
 * @returns {LatLng} terminal point of the node's path
 */
ts.list.node.getTerminus = function() {
    return this.path.getAt(this.path.getLength()-1); 
};

/**
 * Update terminus location, also change first point of path of
 * next node (if any).
 * 
 * @param {LatLng} latLng location to set terminus to
 */
ts.list.node.updateTerminus = function(latLng) {
    ts.assert(latLng instanceof google.maps.LatLng);

    this.owner.pauseUpdate();
    this.path.setAt(this.path.getLength()-1,latLng);
    this.reroute();
    if (this.next) {
        this.next.path.setAt(0,latLng);
        this.next.reroute();
    }
    this.owner.resumeUpdate();
};

/**
 * Return cumulative length at terminus of this node.
 * 
 * @returns {number} cumulative length at end of this node's path
 */
ts.list.node.getCumulLength = function() {
    ts.assert(this.lengthValid);
    return this.getTerminus().cumulLength;
};


/**
 * Remove any overlays (from map) and invalidate, including removal of any 
 * listeners. This includes all markers and polylines.
 */ 
ts.list.node.clearMapOverlays = function() {
    if (this.marker) {
        google.maps.event.clearInstanceListeners(this.marker);
        this.marker.setMap(null);
    }
    if (this.polyline) {
        google.maps.event.clearInstanceListeners(this.polyline);
        this.polyline.setMap(null);
    }
    this.marker = null;
    this.polyline = null;
    this.clearKmMarkers();
};

/**
 * Remove any km marker overlays (from map) and invalidate, including removal
 * of any listeners.
 */ 
ts.list.node.clearKmMarkers = function() {
    if (this.kmMarkers) {
        for (var i = 0; i < this.kmMarkers.length; i++) {
            this.kmMarkers[i].setMap(null);
            // no listeners for km markers
        }
        this.kmMarkers.length = 0; // clear array of markers
    }
};

/**
 * Append a point to end of path for this node. Should only be called
 * for manual nodes.
 * 
 * @param {LatLng} latLng point to append
 */
ts.list.node.appendPoint = function(latLng) {
    ts.assert(latLng instanceof google.maps.LatLng);
    ts.assert(this.type === ts.list.nodeTypes.MANUAL);

    this.path.push(latLng);
    //if (this.marker) this.marker.setPosition(this.getTerminus());
    // update handled by path listener
};

/**
 * If an autorouted point, reroute this node from first point to 
 * terminus of path using directions service. Call after
 * updating first point or terminus.
 * 
 * <p>Assumes new first point or terminus have already triggered
 * listeners and flagged/invalidated affected node and points.
 * 
 */
ts.list.node.reroute = function() {
    if (this.type===ts.list.nodeTypes.TOROUTE || this.type===ts.list.nodeTypes.ROUTED ) {
        // assume listeners already triggered for affected points,
        // deactivate while preparing temporary path
        this.deactivateListeners(); 
        
        // make a temporary path from first node to terminus
        this.type = ts.list.nodeTypes.TOROUTE;
        var origin = this.path.getAt(0);
        var terminus = this.path.pop();
        this.path.clear();
        this.path.push(origin);
        this.path.push(terminus);
        this.autoRoute();
        this.updateOverlays(); 
        this.activateListeners();
    }
};

/**
 * Call Google directionsService to auto-route path between first and only
 * two points in path. Callback will ensure path and overlays are updated
 * when directionsService returns.
 * 
 */
ts.list.node.autoRoute = function() {
    ts.assert(this.path.length===2); // expect exactly 2 points in path
    var request = {
        origin : this.path.getAt(0),
        destination : this.path.getAt(1),
        provideRouteAlternatives : false,
        travelMode : google.maps.TravelMode.WALKING // TODO: allow changing travel modes
    };
    var that = this;
    ts.main.directionsService.route(request, function(response, status) {
        if (status !== google.maps.DirectionsStatus.OK) {
            ts.error("Direction service failed due to: " + status);
            // TODO: more handling here
        } if (request.destination!==that.path.getAt(1)) {
            ts.warning("Path changed during auto-route request");
            // ignore with warning
        } else {
            that.deactivateListeners(); 
                // listeners unneeded, affected points should already have
                // been flagged/invalidated, and all points to be added are
                // new objects
            var origin = that.path.getAt(0);
            that.path.clear();
            var theRoute = response.routes[0];
            var theRouteLeg = theRoute.legs[0];
            var lastLatLng;
            that.path.push(origin); // add origin, may not equal first step 
                                    // due to 'rounding' to nearest road
            lastLatLng = origin;
            var theSteps = theRouteLeg.steps;
            for (var i = 0; i<theSteps.length; i++) {
                var stepPath = theSteps[i].path;
                for (var j = 0; j<stepPath.length; j++) {
                    var curLatLng = stepPath[j];
                    if (!ts.latLngEquals(lastLatLng,curLatLng)) that.path.push(curLatLng);
                        // only store unique points (i.e. not 'equal' to previous)
                    lastLatLng = curLatLng;
                };
                
            }
            ts.controls.infoCtrl.setHTML (theRoute.warnings+"<BR>"+theRoute.copyrights);
            
            that.type = ts.list.nodeTypes.ROUTED;
            that.updateOverlays(ts.main.map);
            that.activateListeners(); // flags
        };
    });
};


/**
 * Update (or add) overlays (markers & polyline) of this node with a new 
 * appearance. This should only be necessary if a node's type changes.
 * 
 */
ts.list.node.updateOverlays = function() {
    
    var markerOptions = ts.createMarkerOptions(this.getTerminus(), this.type.color);
    var polylineOptions = ts.createPolylineOptions(this.path, this.type.color);
    
    switch (this.type) {
        case ts.list.nodeTypes.HOME:
            markerOptions.icon = ts.createHomeMarkerSymbol(this.type.color);

            polylineOptions = null; // no polyline for home
            break;
        case ts.list.nodeTypes.TOROUTE:
            
            polylineOptions.icons.push(ts.dottedLineIconSequence);
            polylineOptions.strokeOpacity = 0.0;
            polylineOptions.editable = false;
            
            break;
        case ts.list.nodeTypes.ROUTED:
            polylineOptions.strokeOpacity = 1.0;
            polylineOptions.editable = false;
            
            break;
        case ts.list.nodeTypes.MANUAL:
            polylineOptions.strokeOpacity = 1.0;
            polylineOptions.editable = true;
            
            break;
    }
    
    if (this.polyline) {
        this.polyline.setOptions(polylineOptions);
    } else {
        this.polyline = new google.maps.Polyline(polylineOptions);
    }
    if (this.marker) {
        this.marker.setOptions(markerOptions);
    } else {
        this.marker = new google.maps.Marker(markerOptions);
        this.addMarkerListeners();
    }
};

/**
 * Update/recalculate various parameters of this node.
 * 
 * @param {boolean} updateLength If true, will update lengths of this node and its points.
 * @param {boolean} updateHeightExtents If true, will update owner's height extents based on height
 * of node points and their children. 
 * 
 */
ts.list.node.update = function(updateLength, updateHeightExtents) {

    if (!updateLength && !updateHeightExtents) return; // nothing to do
    
    var markerEvery = 1000.0; // metres
    
    var lastPointCumulLength = this.getOrigin().cumulLength;
    if (lastPointCumulLength === undefined) lastPointCumulLength = 0.0;
    var curPointCumulLength = lastPointCumulLength;
        // need to track cur and last point cumul length for km markers
    
    if (updateLength) { 
        this.lengthValid = false;
        this.clearKmMarkers(); // these will need to be recalculated
    }
    
    var lastPointLatLng = null;

    for (var i = 0; i < this.path.getLength(); i++) {
        var curPointLatLng = this.path.getAt(i);
        
        if (updateLength) {
            if (lastPointLatLng) {
                // find length from previous, add to cumul total for path
                curPointCumulLength += ts.computeDistBtw(lastPointLatLng, curPointLatLng);
            }
            curPointLatLng.cumulLength = curPointCumulLength;
            
            var lastFloorKm = Math.floor(lastPointCumulLength/markerEvery);
            var curFloorKm = Math.floor(curPointCumulLength/markerEvery);
            
            // do we need to add a km marker?
            while (lastFloorKm<curFloorKm) {
                // look for all transitions in floor after dividing by markerEvery length e.g. 2>4 km, need markers for 3,4 
                lastFloorKm = lastFloorKm+1;
                
                var kmMarkerLatLng = ts.computeOffset(lastPointLatLng, curPointLatLng, lastFloorKm*markerEvery-lastPointCumulLength);
                var kmMarkerImage = "markers/marker_"+lastFloorKm+".png";
                var kmMarkerOptions = {
                    position : kmMarkerLatLng,
                    map : ts.main.map,
                    icon: kmMarkerImage
                };
                if (!this.kmMarkers) this.kmMarkers = [];
                this.kmMarkers.push(new google.maps.Marker(kmMarkerOptions));
                
            }
        }

        if (updateHeightExtents && curPointLatLng.height != null) {
            this.owner.updateHeightExtents(curPointLatLng.height);
        }

        // update any children of curPoint
        if (curPointLatLng.children) {
            var lastChildLatLng = curPointLatLng;
            var childCumulLength = curPointCumulLength;
            for (var j=0; j<curPointLatLng.children.length;j++) {
                var curChildLatLng = curPointLatLng.children[j];
                if (updateLength) {
                    console.log("was "+childCumulLength);
                    childCumulLength+=ts.computeDistBtw(lastChildLatLng, curChildLatLng);
                    console.log("adding "+ts.computeDistBtw(lastChildLatLng, curChildLatLng));
                    curChildLatLng.cumulLength = childCumulLength; 
                    console.log("now "+childCumulLength);
                    lastChildLatLng = curChildLatLng;
                }
                if (updateHeightExtents && curChildLatLng.height != null) {
                    this.owner.updateHeightExtents(curChildLatLng.height);
                }
            }
        }
        
        // update for next iteration
        lastPointLatLng = curPointLatLng;
        lastPointCumulLength = curPointCumulLength;
    }
    
    this.lengthValid = true;

};

/**
 * This is the list of points for a track. Implemented as a linked-list of
 * nodes, which in turn contain a series of points and possibly child points.
 * 
 */
ts.pointList = {
    head : null,
    tail : null,
    totalLength : 0,
    updateActive : true,
    segmentQueue : [], // for updating heights
};
ts.list.node.owner = ts.pointList; // only one list for so all nodes belong to it

/**
 * Add a node to end of this list.
 * 
 * @param {ts.list.node} node node to add to the list.
 */
ts.pointList.push = function(node) {
    ts.assert(ts.list.node.isPrototypeOf(node));

    if (this.tail !== null) { 
        var oldTail = this.tail;
        oldTail.next = node;
        node.setPrevious(oldTail);
    }
    this.tail = node;
    if (this.head === null) this.head = node;
};

/**
 * Remove all elements from this list.
 */
ts.pointList.clear = function() {
    while (this.head) ts.pointList.deleteLastNode();    
};

/**
 * 
 */
ts.pointList.resetHeightExtents = function() {
    this.minHeight = +Infinity;
    this.maxHeight = -Infinity;
    this.heightsTentative = false;
};

/**
 * Use height parameter to update height extents of this list
 * 
 */
ts.pointList.updateHeightExtents = function(height) {
    if (height != null) { 
        if (height<this.minHeight) this.minHeight = height; 
        if (height>this.maxHeight) this.maxHeight = height;
    } else {
        this.heightsTentative = true;
    }
        
};

ts.pointList.getMaxDist = function() {
    return this.tail ? Math.max(this.tail.getCumulLength(),1000.0) : 0.0;
};

ts.pointList.getExtent = function() {
    //this.head.calculateLength(); // recalc. all lengths, REMOVE to more efficient
    var curNode = this.head;
    var minHeight = +Infinity;
    var maxHeight = -Infinity;
    
    while (curNode!=null) {
        for (var i = 0; i < curNode.path.getLength(); i++) {
            var latLng = curNode.path.getAt(i);
            if (latLng.height<minHeight) minHeight = latLng.height; 
            if (latLng.height>maxHeight) maxHeight = latLng.height;
            if (latLng.children) for (var j = 0; j < latLng.children.length; j++) {
                var childLatLng = latLng.children[j];
                if (childLatLng.height<minHeight) minHeight = childLatLng.height;
                if (childLatLng.height>maxHeight) maxHeight = childLatLng.height;
            }
        }
        curNode = curNode.next;
    }
    var minDist = 0.0;
    var maxDist = this.getMaxDist();
    return {
        minDist : minDist,
        maxDist : maxDist,
        minHeight : minHeight,
        maxHeight : maxHeight
    };
    
};

ts.pointList.isEmpty = function() {
    return this.head==null;    
};

/**
 * Remove last node
 * @param node
 */
ts.pointList.deleteLastNode = function() {
    if (this.tail != null) {
        var oldTail = this.tail;
        var previousNode = oldTail.previous;
        oldTail.clear();
        if (previousNode!=null) {
            previousNode.next = null;
            //previousNode.pathEdited();
        } 
        this.tail = previousNode;
        if (this.tail==null) {
            this.head = null;
        }
    }
    this.resumeUpdate();
};

ts.pointList.addPoint = function(latLng, addType) {
    var type = null;
    var node = null;
    this.pauseUpdate();
    if (this.head == null) { // any points so far?
        // no
        // first node is 'home' node
        type = ts.list.nodeTypes.HOME;
        node = Object.create(ts.list.node);
        node.initialize(type);
        this.push(node);
        node.path.push(latLng);
    } else {
        // yes there are some points
        if (addType==ts.list.nodeTypes.TOROUTE) {
            // are we adding a routed point?
            type = ts.list.nodeTypes.TOROUTE;
            node = Object.create(ts.list.node);
            node.initialize(type);
            this.push(node);
            node.path.push(latLng);
            node.autoRoute();
            
        } else if (addType==ts.list.nodeTypes.PATH && this.tail.type == ts.list.nodeTypes.MANUAL) { 
            // are we adding a new point to path and
            // and last node was a manual node?
            
            // yes, add a new point to that node
            type = ts.list.nodeTypes.PATH;
            this.tail.appendPoint(latLng);
        } else {
            // no, make a new node
            type = ts.list.nodeTypes.MANUAL;
            node = Object.create(ts.list.node);
            node.initialize(type);
            this.push(node);
            node.path.push(latLng);
        }
    }
    
    if (node) {
        node.activateListeners();
        node.updateOverlays();
    }
    this.resumeUpdate();
    return type; // return type, may be 'home'
};

ts.pointList.addManualPoint = function(latLng, forceNewNode) {
    var addType;
    if (forceNewNode) addType = ts.list.nodeTypes.MANUAL;
    else addType = ts.list.nodeTypes.PATH;
    return this.addPoint(latLng,addType);
};


ts.pointList.addRoutedPoint = function(latLng) {
    return this.addPoint(latLng,ts.list.nodeTypes.TOROUTE);
};

/**
 * Stop this list from being updated (recalculated)
 * until resumeUpdate called.
 * 
 */
ts.pointList.pauseUpdate = function() {
    this.updateActive = false;    
};

/**
 * Allow list to be update (recalculated) once again &
 * update immediately.
 * 
 */
ts.pointList.resumeUpdate = function()  {
    this.updateActive = true;
    this.update();
};


/**
 * Update/recalculate length and height extents of this list
 * by calling update of each node.
 * 
 * @param updateHeightExtents
 * If true, will update owner's height extents based on height
 * of node points and their children, otherwise height extent
 * is not updated
 */
ts.pointList.update = function(updateHeightExtents) {
    if (!this.updateActive) return;
    var next;
    var updateLength = false;
    for (ts.list.listIterator.reset();  next = ts.list.listIterator.listNextNode(), !next.done;) {
        var nextNode = next.value;
        if (!nextNode.lengthValid) updateLength = true;
        //if (updateLength) nextNode.lengthValid = false; // propagate invalid length downstream
            // done in update
        nextNode.update(updateLength, updateHeightExtents);
    }
    this.totalLength = 0;
    if (this.tail) this.totalLength = this.tail.getCumulLength();
    ts.controls.distanceCtrl.update(this.totalLength/1000.0);
    ts.dem.updateChart();
};


/**
 * Convert point list to a CSV string
 */

ts.pointList.toCSV = function() {
    var output = "";
    var nodeIndex = 0;
    var pointIndex = 0;
    var childIndex = 0;
    var type;
    output += "index,latitude,longitude,type,distance(m),elevation(m)\n";
    
    ts.list.listIterator.reset();
    var next;
    while (next = ts.list.listIterator.next3d(true), !next.done) {
        var nextPoint = next.value;
        if (ts.list.listIterator.curIterIsChild) {
            type =  ts.list.nodeTypes.ELEVATION;
            childIndex++;
        }
        else {
            if (!ts.list.listIterator.curNodeIsTerminal &&
                 ts.list.listIterator.curPointIsTerminal) continue;
                // don't write terminal points of internal nodes
                // so only write unique points, last point of node x and first point of node x+1 are identical
            if (ts.list.listIterator.curPointIsHead) {
                // first point of new node
                nodeIndex++;
                pointIndex = 0;
                type = ts.list.listIterator.curNode.type; // first point written for a node is given node's type
            } else {
                type =  ts.list.nodeTypes.PATH; // subsequent points in node's path are given PATH type
            }
            pointIndex++;
            childIndex = 0;
        }  
        var indexStr = nodeIndex+">"+pointIndex;
        if (childIndex>0) indexStr+=">"+childIndex;
        
        var height;
        if (nextPoint.height && nextPoint.height==nextPoint.height) height = nextPoint.height.toFixed(1);
        else height = "n/a";

        output += indexStr + "," 
                + nextPoint.lat().toFixed(6) + ","
                + nextPoint.lng().toFixed(6) + ","
                + ts.list.nodeTypesRev[type.value] + ","
                + nextPoint.cumulLength.toFixed(1) + ","
                + height + "\n";
    }
    return output;
};

/**
 * Convert CSV string to point list
 */
ts.pointList.fromCSV = function(csv) {
    this.clear();
    var lines = csv.split("\n");
    var header;
    var latIndex = null, lngIndex = null, typeIndex = null, elevIndex = null;
    for (var i=0;i<lines.length;i++) {
        var line = lines[i].trim();
        if (line.length>0) {
            //console.log(line);
            var tokens = line.split(",");
            if (!header) {
                header = tokens;
                for (var j=0;j<header.length;j++) {
                    var headerToken = header[j].substr(0,3).toLowerCase();
                    if (headerToken=="lat") {
                        latIndex = j;
                    } else if (headerToken=="lng" || headerToken=="lon" ) {
                        lngIndex = j;
                    } else if (headerToken=="typ") {
                        typeIndex = j;
                    } else if (headerToken=="ele" || headerToken=="hei") {
                        elevIndex = j;
                    }
                }
                if (!latIndex) {
                    ts.error("Could not find lat data in input file.");
                }
                if (!lngIndex) {
                    ts.error("Could not find lng data in input file.");
                }
                if (!typeIndex) {
                    ts.warning("Could not find type data in input file.");
                }
                
            } else {
                var lat = parseFloat(tokens[latIndex]);
                var lng = parseFloat(tokens[lngIndex]);
                var latLng = new google.maps.LatLng(lat,lng);
                if (elevIndex) {
                    var elev = parseFloat(tokens[elevIndex]);
                    if (elev==elev) latLng.height = elev;
                }
                var type = null;
                if (typeIndex) {
                    type = tokens[typeIndex];
                    type = ts.list.nodeTypes[type];
                } else {
                    // type = null, if no types given in input file
                    // start with manual, then add remaining as path of a single manual node
                    if (this.isEmpty()) type = ts.list.nodeTypes.MANUAL;
                    else type = ts.list.nodeTypes.PATH;
                }
                console.log("Read "+lat+", "+lng+" type:", type);
                if (this.isEmpty()) {
                    // first point, add as home
                    var node = Object.create(ts.list.node);
                    node.initialize(ts.list.nodeTypes.HOME);
                    this.push(node);
                    node.path.push(latLng);
                    latLng = null; // consume
                    node.updateOverlays(ts.main.map);
                    console.log("adding home node");
                    if (type == ts.list.nodeTypes.MANUAL || type == ts.list.nodeTypes.ROUTED) {
                        // expect first point to be one of these types
                    } else {
                        ts.warning("Expected first point to be manual or router, adding as manual, line: "+line);
                        this.type = ts.list.nodeTypes.MANUAL;
                    }
                }
                if (type == ts.list.nodeTypes.PATH) {
                    // adding a point as path of existing node
                    if (this.tail.type == ts.list.nodeTypes.MANUAL || this.tail.type == ts.list.nodeTypes.ROUTED) {
                        // add to tail node of supported type
                        this.tail.path.push(latLng);
                        latLng = null; // consume
                        console.log("adding point");
                    } else {
                        ts.warning("Trying to add point to unsupported node type, adding as node, line: "+line);
                        this.type = ts.list.nodeTypes.MANUAL;
                    }
                } else if (type == ts.list.nodeTypes.ELEVATION) {
                   var terminus = this.tail.getTerminus();
                   if (terminus.children==null) terminus.children = [];
                   terminus.children.push(latLng);
                   latLng = null; // consume
                   console.log("adding child");
               }
               if (type == ts.list.nodeTypes.MANUAL || type == ts.list.nodeTypes.ROUTED) {
                    // create new node, first using latLng (if not consumed)
                    // as terminus of last node
                    // this will then be set as first point of new node upon
                    // adding to list
                    if (latLng!==null) this.tail.path.push(latLng);
                    var node = Object.create(ts.list.node);
                    node.initialize(type);
                    this.push(node);
                    node.updateOverlays(ts.main.map);
                    console.log("adding node");
                }
            }
        }
    }
    this.update();
};

/**
 * Multi-purpose iterator for iterating through node/point/child lists.
 * 
 * Non-standard but based on ECMAScript 6 iterator protocol.
 * 
 * Provides methods for directly accessing underlying list structure
 * (i.e. nodes, points in nodes, children in points).
 * 
 * Also provides methods for simply iterating over points without
 * being concerned with list structure (next2d, next3d).
 * 
 * Does not support any kind of manipulation of underlying lists while
 * iteration in progress.
 * 
 * ECMAScript 6 iterator protocol: 
 * next() returns { done: false, value: element } or
 *                 { done: true [, value: retVal] }
 */
ts.list.listIterator = {
    theList : ts.pointList, // list being iterated over, currently fixed
    
    // attributes for tracking iteration of nodes (in top-level list)
    curNode : null,
    nextNode : null,
    
    // attributes for tracking iteration of points in current node
    curPoint : null,
    nextPointIndex : 0,
    curPointIsTerminal : false, // true if curPoint is a terminal point in path
    
    // attributes for tracking iteration of children in current point
    curChild : null,
    nextChildIndex : 0,
    
    // attributes that store previous/current 
    prevIterPoint : null,
    curIterPoint : null,
    curIterIsChild : false, // true if current iter point is child 
    
};

/**
 * Reset iterator for iteration from beginning of from specified node.
 */
ts.list.listIterator.reset = function(theNode) {
    ts.assert (theNode==null || ts.list.node.isPrototypeOf(theNode), "expected a ts.list.node");
    this.curNode = null;
    this.prevIterPoint = null;
    this.curIterPoint = null;
    this.curIterIsChild = false; 
    this.resetPointIterator();
    this.resetChildIterator();
    if (theNode==null) this.nextNode = this.theList.head;
    else this.nextNode = theNode; // not exhaustively tested
};

/**
 * Iterator for nodes in list.
 * 
 * Return next node in list as {done : false, value : node}
 * or {done : true} if no more nodes.
 */
ts.list.listIterator.listNextNode = function() {
    this.curNode = null; // invalidate curNode
    this.resetPointIterator(); // invalidate sub-iterator as soon as function called
    if (this.nextNode == null) return { done: true };
    
    this.curNode = this.nextNode;
    //console.log("node" + (this.curNode == this.theList.head ? " head" : ""));
    this.nextNode = this.nextNode.next;
    
    if (this.curNode == this.theList.head) this.curNodeIsHead = true;
    else this.curNodeIsHead = false;
    if (this.nextNode == null) this.curNodeIsTerminal = true;
    else this.curNodeIsTerminal = false;
    
    return { value : this.curNode, done : false};
};


/**
 * Reset sub-iterator for points within a node.
 */
ts.list.listIterator.resetPointIterator = function() {
    this.curPoint = null;
    this.nextPointIndex = 0;
    this.curPointIsTerminal = false;
};


/**
 * Sub-iterator for points in node.
 * 
 * Return next point in current node as {done: false, value : point}
 * or {done : true} if no more points.
 */
ts.list.listIterator.nodeNextPoint = function() {
    this.curPoint = null; // invalidate first
    this.resetChildIterator(); // invalidate sub-iterator as soon as function called
    if (this.nextPointIndex >= this.curNode.path.getLength()) return { done : true };
    
    this.curPoint = this.curNode.path.getAt(this.nextPointIndex);
    //console.log("point" + this.nextPointIndex);
    if (this.nextPointIndex == 0) this.curPointIsHead = true;
    else this.curPointIsHead = false;
    
    this.nextPointIndex += 1;
    
    if (this.nextPointIndex == this.curNode.path.getLength()) this.curPointIsTerminal = true;
    else this.curPointIsTerminal = false;
    return { value : this.curPoint, done : false };
    
};

/**
 * Reset sub-iterator for children within a point.
 */
ts.list.listIterator.resetChildIterator = function() {
    this.curChild = null;
    this.nextChildIndex = 0;
};

/**
 * Sub-(sub-)iterator for children within point,
 * 
 * Return next child of current point as {done: false, value : chi;d}
 * or {done : true} if no more children.
 */

ts.list.listIterator.pointNextChild = function() {
    this.curChild = null; // invalidate first
    if (this.nextPointIndex >= this.curNode.path.getLength()  || // terminal point:
                                                                 //  do not iterate through terminal points children as 
                                                                 //  point is shared with first point of next node,
                                                                 //  and children 'belong' to that first point
        !this.curPoint.children || // no children
        this.nextChildIndex >= this.curPoint.children.length) // end of children list
        return { done : true };
        
    this.curChild = this.curPoint.children[this.nextChildIndex];
    //console.log("child" + this.nextChildIndex);
    this.nextChildIndex += 1;
    return { value : this.curChild, done : false };
};

/**
 * Iterator for 2d points, i.e. points across all nodes.
 * 
 * By default, will only return non-identical consecutive points,
 * i.e. will only return terminal point of one node and not shared 
 * first point of next node.
 * 
 * Default (bracket = not returned):
 * Will return (node_x) point_n-1, point_n, (node_x+1 point0) point1, point2...
 * 
 * @param all
 * If true, will iterate over all points and include all identical 
 * shared points.
 * Will return (node_x) point_n-1, point_n, (node_x+1) point0, point1, point2...
 * 
 * @returns
 * Return next child of current point as {done: false, value : chi;d}
 * or {done : true} if no more children.
 */
ts.list.listIterator.next2d = function(all) {
    this.prevIterPoint = this.curIterPoint;
    while (true) {
        if (this.curNode) { // have a current node
            while (true) {
                var next = this.nodeNextPoint(); // iterate to next point in node
                if (next.done) break; // no more points in this node
                if (all || next.value != this.prevIterPoint) {
                    this.curIterPoint = next.value;
                    return next; // got a non-identical point (to last), return it
                }
            }
        }
        // try next node
        var next = this.listNextNode();
        if (next.done) {
            this.curIterPoint = null;
            return next; // no more nodes, return done signal
        }
        ts.assert(this.curNode, "curNode still invalid"); // unless done, curNode should be set by call to listNextNode()
    }
};

/**
 * Iterator for 3d points, points in path and their children across all
 * nodes.
 * 
 * Will return point, child0... childn, point+1, child0...
 * 
 * By default, will only return non-identical consecutive points,
 * i.e. will only return terminal point of one node and not shared 
 * first point of next node; children are not returned for terminal
 * point but will be returned after iterating over it, although these
 * will 'belong' to the first point (not return during the iteration).
 * 
 * Default (bracket = not returned):
 * Will return (node_x) point_n-1, child0... childn, point_n, 
 * (node_x+1 point0), child0... childn, point1,child0... childn, point2...
 * 
 * @param all
 * If true, will iterate over all points and include all identical 
 * shared points:
 * Will return (node_x) point_n-1, child0... childn, point_n, 
 * (node_x+1) point0, child0... childn, point1,child0... childn, point2...
 * 
 * Return next child of current point as {done: false, value : child}
 * or {done : true} if no more children.
 * @returns
 */
ts.list.listIterator.next3d = function(all) {
    this.prevIterPoint = this.curIterPoint;
    var next;
    while (true) {
        if (this.curPoint) { // have a current point
            next = this.pointNextChild(); // iterate to next child in point
            if (!next.done) {
                this.curIterIsChild = true;
                break; // got a valid child: break & return it
            }
        }
        
        // try next point
        next = this.next2d(true);
        if (next.done) {
            this.curIterPoint = null;
            this.curIterIsChild = false;
            return next; // no more points, return done signal
        }
        if (all || next.value != this.prevIterPoint) {
            this.curIterIsChild = false;
            break; // got a non-identical point (to last), break & return it        
        }
    }
    this.curIterPoint = next.value;
    return next; // got a valid child: return it
};

// test for iterator
/*
function testIterator() {
    ts.list.listIterator.reset();
    var nextNode, nextPoint, nextChild;
    var i;
    console.log("TEST: Full iterate");
    i = 0;
    while (nextNode = ts.list.listIterator.listNextNode(), !nextNode.done) {
        console.log("node "+i);
        i++;
        while (nextPoint = ts.list.listIterator.nodeNextPoint(), !nextPoint.done) {
            console.log(nextPoint.value);
            while (nextChild = ts.list.listIterator.pointNextChild(), !nextChild.done) { 
                console.log(nextChild.value);
            }
        }
    }
    var next;
    ts.list.listIterator.reset();
    console.log("TEST: 2d iterate");
    i = 0;
    while (next = ts.list.listIterator.next2d(), !next.done) {
        console.log(next.value);
        console.log("iteration "+i+" node point "+(ts.list.listIterator.nextPointIndex-1));
        i++;
    }
    
    ts.list.listIterator.reset();
    console.log("TEST: 2d iterate all");
    i = 0;
    while (next = ts.list.listIterator.next2d(true), !next.done) {
        console.log(next.value);
        console.log("iteration "+i+" node point "+(ts.list.listIterator.nextPointIndex-1));
        i++;
    }

    ts.list.listIterator.reset();
    console.log("TEST: 3d iterate");
    i = 0;
    while (next = ts.list.listIterator.next3d(), !next.done) {
        console.log(next.value);
        console.log("iteration "+i+" node point "+(ts.list.listIterator.nextPointIndex-1)+" child "+(ts.list.listIterator.nextChildIndex-1));
        i++;
    }

    ts.list.listIterator.reset();
    console.log("TEST: 3d iterate all");
    i = 0;
    while (next = ts.list.listIterator.next3d(true), !next.done) {
        console.log(next.value);
        console.log("iteration "+i+" node point "+(ts.list.listIterator.nextPointIndex-1)+" child "+(ts.list.listIterator.nextChildIndex-1));
        i++;
    }
}
*/

ts.list.toConsole = function() {
    ts.list.listIterator.reset();
    console.log("Iterating all points...");
    var i = 0;
    var next;
    var nodeIndex = -1;
    while (next = ts.list.listIterator.next3d(true), !next.done) {
        var nextPoint = next.value;
        if (ts.list.listIterator.curPointIsHead) {
            // new node
            nodeIndex+=1;
        }
        console.log("iteration "+i+": node "+nodeIndex+" (type: "+ts.list.nodeTypesRev[ts.list.listIterator.curNode.type.value]+
                    ") point "+ (ts.list.listIterator.nextPointIndex-1)+" child "+(ts.list.listIterator.nextChildIndex-1));
        console.log(nextPoint);
        console.log("lat: "+nextPoint.lat()+", lng: "+nextPoint.lng()+", dist: "+nextPoint.cumulLength+", height: "+nextPoint.height);
        i++;
    }
}

/**
 * Class for iterating through a single node of list.
 * Based on list iterator.
 */
ts.list.nodeIterator = Object.create(ts.list.listIterator);

/**
 * Reset iterator for iteration for single node.
 */
ts.list.nodeIterator.reset = function(theNode) {
    ts.assert (ts.list.node.isPrototypeOf(theNode), "expected a ts.list.node");
    ts.list.listIterator.reset.call(this);
    this.curNode = theNode;
    this.nextNode = null;
};

ts.list.initialize = function () {
};