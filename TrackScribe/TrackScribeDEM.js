/*
 * Copyright (C) 2013-2017 Tet Woo Lee
 * 
 * This file is part of TrackScribe.
 * 
 * TrackScribe is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * TrackScribe is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 * 
 * For a copy of the GNU General Public License is provided, please
 * see the LICENSE file or <http://www.gnu.org/licenses/>.
 */

"use strict";

var ts = ts || {};

ts.dem = {
    segmentQueue : [], // queue for updating heights
    pendingDEMLookup : false,
    data : null, // chart data
    chart : null, // chart
    chartOptions : null, // chart options
};

ts.dem.lookupMissingHeights = function() {
    
    // Lookup height for whole path where elevation information is lacking
    // As only looking up for certain parts of path, look for continuous segments
    // that are lacking elevation information, and store these in a queue
    // then send request to server to look these up one by one
    
    // As elevation requests are asynchronous, need to be careful of the following:
    // Path changed prior to lookup returning:
    //      Need to check if next point in pointList still == next point in
    //      DEM path, if so, use interpolated points as children, otherwise
    //      discard interpolated points
    //      BUT NO ACCESS TO NEXT PATH POINT FROM A POINT!!!!
    //      Store copy of node for refinding first point, then iterate through it
    // Queue being added to before lookup returns
    //      Only send one request and wait for it to reutn before sending next
    //      TODO: Check no active request before sending new one
    
    // go through list, find continuous segments with no elevation
    var segment;
    
    var next;
    for (ts.list.listIterator.reset();  next = ts.list.listIterator.next2d(), !next.done;) {
        var curLatLng = ts.list.listIterator.curIterPoint;
        var lastLatLng = ts.list.listIterator.prevIterPoint;
        if (lastLatLng && (lastLatLng.height == null || curLatLng.height == null)) {
            // if either end of this pair of latLngs has no height
            // then need to lookup
            if (segment===null) {
                // create a new segment
                segment = { latLngs : [], firstNode : ts.list.listIterator.curNode};
                this.segmentQueue.unshift(segment);
                segment.latLngs.push(lastLatLng);
            }
            segment.latLngs.push(curLatLng);
        } else {
            // reached a portion of path with elevation set
            if (segment!==null) segment = null;
                // prepare for next segment
        }
    }
    
    this.processSegmentQueue();
};

ts.dem.processSegmentQueue = function() {
    if (this.pendingDEMLookup) return;
        // currently awaiting a dem lookup to return
        // don't send another lookup, upon return will lookup next segment in queue
        // TODO: timeout this?
    var that = this;
    if (this.segmentQueue.length>0) {
        var segment = this.segmentQueue.pop();
        this.pendingDEMLookup = true;
        ts.controls.infoCtrl.updateElevationStatus("Elevation lookup in progress...");
        ts.dem.getElevationAlongPath(segment.latLngs, function(results, status) {
            if (status==nztwlee.demlookup.ElevationStatus.OK) {
                var next;
                var curLatLng;
                try {
                    for (ts.list.listIterator.reset(segment.firstNode); 
                        next = ts.list.listIterator.next2d(), !next.done;) {
                            // reset iterator to first node in segment, then iterate until finding starting point
                            var latLng = ts.list.listIterator.curIterPoint;
                            if (ts.latLngEquals(latLng, results[0].location)) {
                                curLatLng = latLng;
                                ts.assert (curLatLng.height == null || Math.abs(curLatLng.height - results[0].elevation)<0.1);
                                curLatLng.height = results[0].elevation;
                                //console.log("Found start of path");
                                break;
                            }
                    }
                    if (curLatLng==null) throw new Error("Could not find start of segment in point list - point list must have changed");
                    var children = [];
                    for (var result_i=1; result_i< results.length; result_i++) {
                        var result = results[result_i];
                        var resultLatLng = result.location;
                        resultLatLng.height = result.elevation;
                        //console.log(result_i,resultLatLng.lat(),resultLatLng.lng(),resultLatLng.height,result.pathIndex);

                        if (result.pathIndex==null) {
                            // invalid index = interpolated point
                            children.push(resultLatLng); // add to list of children
                        } else {
                            next = ts.list.listIterator.next2d();
                            curLatLng = ts.list.listIterator.curIterPoint;
                            if (next.done || !ts.latLngEquals(curLatLng,resultLatLng)) {
                                // did not match expected next path point
                                throw new Error("Could continue tracting segment in point list - point list must have changed");
                                break;
                            }
                            ts.assert (curLatLng.height == null || curLatLng.height == resultLatLng.height);
                            curLatLng.height = resultLatLng.height;
                            ts.list.listIterator.prevIterPoint.children = children;
                            ts.list.listIterator.curNode.lengthValid = false; // force node to update children's cumulLengths
                            children = [];
                            
                        }
                        //console.log(children);
                    }
                } catch(e) {
                    console.log(e.message);
                }
                ts.pointList.update();
            } else {
                ts.controls.infoCtrl.updateElevationStatus("Elevation lookup error:"+lookupStaatus.details);
                ts.warning(lookupStatus.details);
            }
            that.pendingDEMLookup = false;
            ts.controls.infoCtrl.updateElevationStatus("");
            ts.controls.infoCtrl.updateElevationInfo("Elevation source: Interpolated NZ TopoMaps from NZLookDEMUp Google AppEngine Server");
            that.processSegmentQueue(); // lookup height of next segment in queue
        });
    };
};

ts.dem.callbackWrapper = function (callback) {
    return function(results, status) {
        if (status==nztwlee.demlookup.ElevationStatus.OK) {
            callback(results);
        } else {
            ts.warning(lookupStatus.details);
        }
    };
};


ts.dem.getElevationAlongPath = function(latLngs, callback) {
        // LocationElevationRequest contains {locations[]: LatLng}
    // callback(results, status) where results is [] of ElevationResults and status is status
    // how to return extended error information?
    var request = {path: latLngs};
    nztwlee.demlookup.ElevationService.prototype.getElevationAlongPath(request,callback);
    
    // TODO: Use either Google elevation API or this function. 
    // Method: do a path lookup with a fixed step size, and location lookup, then intermingle the points to
    // give original path plus interpolated points
};

ts.dem.getElevationAtLocation = function(latLng, callback) {
    var request = {locations: [latLng]};
    nztwlee.demlookup.ElevationService.prototype.getElevationForLocations(
            request, ts.dem.callbackWrapper(callback));
};

ts.dem.initializeChart = function() {
  google.charts.load('current', {packages: ['corechart']});
  google.charts.setOnLoadCallback(ts.dem.prepareChart);    
}

ts.dem.prepareChart = function() {
    ts.dem.data = new google.visualization.DataTable();
    ts.dem.data.addColumn('number', 'distance');
    ts.dem.data.addColumn({type:'number', label:'elevation'});
    //ts.dem.data.addColumn({type:'number', label:'grade'});
    ts.dem.data.addColumn({type:'string', label:'tooltip', role:'tooltip'});
        
    ts.dem.mformatter3d = new google.visualization.NumberFormat(
        { fractionDigits: 3, suffix: ' m'});
    ts.dem.mformatter1d = new google.visualization.NumberFormat(
        { fractionDigits: 1, suffix: ' m'});

    // TODO: width per-distance
    ts.dem.chartOptions = {
        fontSize : 13, // set so as to prevent scaling with size
        //chartArea:{left:100, top:'5%', width:2000, height:'50%',bottom:'35%'}, // with h axis title
        //hAxis: {
        //    title: 'distance/km'
        //},
        hAxis : { minValue : 0},
        chartArea:{left:100, top:'5%', width:'100%', height:'50%',bottom:'20%'},
        width:'100%',
        height:'100%',
                vAxis: {
                title: 'elevation/m'
                },
        view: {columns: [0, 1]}
        };

    ts.dem.chart = new google.visualization.LineChart(document.getElementById('elevationPlot'));

    ts.dem.drawChart();
}

ts.dem.updateChart = function() {
    var curRows = ts.dem.data.getNumberOfRows();
    var next;
    var i = 0;

    var lastHeight = null;
    var lastPointDist = 0;
    var interpolateDist = 0;
    
    var newData = null;
    
    // TODO: add grade (inst/averaged over 100 m?)
    for (ts.list.listIterator.reset();  next = ts.list.listIterator.next3d(), !next.done;) {
        var nextPointDist = next.value.cumulLength/1000.0; // convert to m
        var nextPointHeight = next.value.height;
        if (nextPointHeight==null) nextPointHeight = 0/0;
        if (nextPointHeight==nextPointHeight) {
            var done = false;
            var graphPointDist;
            var graphPointHeight;
            var grade = (nextPointHeight-lastHeight)/(nextPointDist-lastPointDist);
            while (!done) {
                if (interpolateDist>=nextPointDist) {
                    graphPointDist = nextPointDist;
                    graphPointHeight = nextPointHeight;
                    done = true;
                } else {
                    graphPointDist = interpolateDist;
                    graphPointHeight = lastHeight + (interpolateDist-lastPointDist)*grade
                }
                var tooltip = graphPointDist.toFixed(3)+"m\nelevation: "+graphPointHeight.toFixed(1)+" m\ngrade: "+(grade/10.0).toFixed(2)+" cm/m";
                if (i<curRows) {
                    ts.dem.data.setCell(i,0,graphPointDist);
                    ts.dem.data.setCell(i,1,graphPointHeight);
                    ts.dem.data.setCell(i,2,tooltip)
                } else {
                    if (newData===null) newData = [];
                    newData.push([graphPointDist,graphPointHeight,tooltip]);
                }
                i++;
                interpolateDist+=0.01;
            }
        }
        lastHeight = nextPointHeight;
        lastPointDist = nextPointDist;
    } 
    if (newData!==null) ts.dem.data.addRows(newData);
    if (i<curRows) ts.dem.data.removeRows(i,curRows-i);
    /*
    for (i=0;i<ts.dem.data.getNumberOfRows();i++) {
        console.log(ts.dem.data.getValue(i,0)+", "+ts.dem.data.getValue(i,1))
    }*/
    ts.dem.chartOptions.hAxis.maxValue = lastPointDist;
    ts.dem.mformatter3d.format(ts.dem.data, 0);  
    ts.dem.mformatter1d.format(ts.dem.data, 1);  
    ts.dem.drawChart();
}

ts.dem.drawChart = function() {
    ts.dem.chart.draw(ts.dem.data, ts.dem.chartOptions);

}

