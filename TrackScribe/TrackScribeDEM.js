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

ts.pointList.processSegmentQueue = function() {
    if (this.pendingDEMLookup) return;
        // currently awaiting a dem lookup to return
        // don't send another lookup, upon return will lookup next segment in queue
        // TODO: timeount this?
    var that = this;
    if (this.segmentQueue.length>0) {
        var segment = this.segmentQueue.pop();
        this.pendingDEMLookup = true;
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
                                ts.assert (curLatLng.height == null || curLatLng.height == resultLatLng.height);
                                curLatLng.height = results[0].elevation;
                                console.log("Found start of path");
                                break;
                            }
                    }
                    if (curLatLng==null) throw new Error("Could not find start of segment in point list - point list must have changed");
                    var children = [];
                    for (var result_i=1; result_i< results.length; result_i++) {
                        var result = results[result_i];
                        var resultLatLng = result.location;
                        resultLatLng.height = result.elevation;
                        console.log(result_i,resultLatLng.lat(),resultLatLng.lng(),resultLatLng.height,result.pathIndex);

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
                        }
                        console.log(children);
                    }
                } catch(e) {
                    console.log(e.message);
                }
                that.update();
            } else {
                ts.warning(lookupStatus.details);
            }
            that.pendingDEMLookup = false;
            that.lookupNextSegmentHeight(); // lookup height of next segment in queue
        });
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
    // TODO: If path too long and naive interpolation is performed, does nztwlee dem return original points?
};

ts.dem.initializeChart = function() {
  google.charts.load('current', {packages: ['corechart']});
  google.charts.setOnLoadCallback(ts.dem.prepareChart);    
}

ts.dem.prepareChart = function() {
    ts.dem.data = new google.visualization.DataTable();
    ts.dem.data.addColumn('number', 'distance');
    ts.dem.data.addColumn('number', 'elevation');

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
                }
        };

    ts.dem.chart = new google.visualization.LineChart(document.getElementById('elevationPlot'));

    ts.dem.drawChart();
}

ts.dem.updateChart = function() {
    var curRows = ts.dem.data.getNumberOfRows();
    var next;
    var i = 0;
    var newData = null;
    
    // TODO: add interpolated
    // TODO: add grade (inst/averaged over 100 m?)
    for (ts.list.listIterator.reset();  next = ts.list.listIterator.next3d(), !next.done;) {
        //console.log(next.value);
        var dist = next.value.cumulLength/1000.0; // convert to km
        var height = next.value.height;
        if (height==null) height = 0/0;
        console.log(dist);
        console.log(height);
        if (i<curRows) {
            ts.dem.data.setCell(i,0,dist);
            ts.dem.data.setCell(i,1,height);
        } else {
            if (newData===null) newData = [];
            newData.push([dist,height]);
        }
        i++;
    } 
    if (newData!==null) ts.dem.data.addRows(newData);
    if (i<curRows) ts.dem.data.removeRows(i,curRows-i);
    for (i=0;i<ts.dem.data.getNumberOfRows();i++) {
        console.log(ts.dem.data.getValue(i,0)+", "+ts.dem.data.getValue(i,1))
    }
    ts.dem.chartOptions.hAxis.maxValue = dist;
    ts.dem.drawChart();
}

ts.dem.drawChart = function() {
    ts.dem.chart.draw(ts.dem.data, ts.dem.chartOptions);

}

var tsElevationPlot = {
	offset : [0,0],
	scale : [0.2,1],
	ticks : [200,5],
	units : [1000,5],
	unitNames : ['km','m'],
	x : [],
	y : [],
	axis_x : {},
	axis_y : {},
	svg : null,
	graph : null,
	
};

tsElevationPlot.getFixedAxisScale = function(min_value, max_value, tick_spacing, num_minor_ticks) {
	console.assert(max_value>min_value);
	
	var max_tick_val = Math.ceil(max_value/tick_spacing) * tick_spacing;
	var min_tick_val = Math.floor(min_value/tick_spacing) * tick_spacing;
	var num_ticks = Math.floor((max_tick_val-min_tick_val)/tick_spacing + 1);
	return {'min' : min_tick_val,
			'max' : max_tick_val,
			'major': tick_spacing,
			'minor': tick_spacing/num_minor_ticks,
			'num_major': num_ticks,
			'num_minor': num_minor_ticks
			};
};


tsElevationPlot.getIdealAxisScale = function(min_value, max_value) {
	console.assert(max_value>=min_value);
	if (max_value==min_value) max_value+=1; // cheat to force algorithm to work when min==max
	// TODO: fix algorithm to ensure it always returns an axis
	
	var tick_relspacings = [1,2,5];
	var num_minor_ticks = [5,2,5];
	var min_numticks = 3;
	var max_numticks = 6;

	var val_range = max_value - min_value;
	var val_range_logmag = Math.floor(Math.log(val_range)/Math.LN10);
	for (var tick_logmag = val_range_logmag-1; tick_logmag<=val_range_logmag; tick_logmag++) {
		var tick_mag = Math.pow(10,tick_logmag);
		for (var i=0; i<tick_relspacings.length;i++) {
			var tick_relspacing = tick_relspacings[i];
			var tick_spacing = tick_relspacing*tick_mag;
			var max_tick_val = Math.ceil(max_value/tick_spacing) * tick_spacing;
			var min_tick_val = Math.floor(min_value/tick_spacing) * tick_spacing;
		    var num_ticks = Math.floor((max_tick_val-min_tick_val)/tick_spacing + 1);
		    if (num_ticks>=min_numticks && num_ticks<=max_numticks) 
		    	return {'min' : min_tick_val,
	    				'max' : max_tick_val,
		    			'major': tick_spacing,
		    			'minor': tick_spacing/num_minor_ticks[i],
						'num_major': num_ticks,
						'num_minor': num_minor_ticks[i]
		    			};
	    }
	}
};

tsElevationPlot.x2p = function(x) {
	return this.offset[0] + x*this.scale[0];
};

tsElevationPlot.y2q = function(y) {
	return this.offset[1] - y*this.scale[1];
};

tsElevationPlot.fit = function() {
	// fit graph to containing svg element by translating, scaling
	var bbox = this.svg.bbox();
	var viewbox = this.svg.viewbox();
	var transform = this.graph.transform();
	this.graph.translate(transform.x-bbox.x,transform.y-bbox.y);
	
	this.svg.width(ts.multiplyCSSLength(this.svg.width(),bbox.width/viewbox.width,100));
	this.svg.height(ts.multiplyCSSLength(this.svg.height(),bbox.height/viewbox.height,100));
	var bbox = this.svg.bbox();
	var viewbox = this.svg.viewbox();

};

tsElevationPlot.updateXAxis = function() {
	
};

tsElevationPlot.updateYAxis = function() {
	
};
var axis_stroke = 1;
var majortick_stroke = 1;
var minortick_stroke = 0.75;
var majortick_size = 5; // in svg units
var minortick_size = 3;
var ticklabelx_adj = [-1,10];
var ticklabely_adj = [-2,-2];
var font_family = 'Helvetica';
var font_size = 12;
var symbol_size = 10;
var line_stroke = 1;

tsElevationPlot.update = function() {
	if (this.svg == undefined) {
		this.svg = SVG('elevationPlot').size('100%', '100%');
		this.graph = this.svg.group();
	}
	
	var extent = ts.pointList.getExtent();
	var min_y = extent.minHeight;
	var max_y = extent.maxHeight;
	if (!isFinite(min_y) || !isFinite(max_y)) {
		// may occur if no heights defined
		min_y = 0;
		max_y = 100;
	}
	var min_x = extent.minDist;
	var max_x = extent.maxDist;
	
	/*
	 * Terminology:
	 * x, y refer to coordinates on plotting scale
	 * p, q refer to coordinates on the svg scale 
	 */
	
	var x, y; // reusable variables for holding temporary coordinates
	var p, q;
	var i;
	var text,group;
	var lastp, lastq;
	
	// axes
	//if (this.axis_x.xvg_group)
	this.axis_x.scale = this.getFixedAxisScale(min_x,max_x,1000,10);
	this.axis_y.scale = this.getIdealAxisScale(min_y,max_y);

	this.scale[1] = 70.0/(this.axis_y.scale.max - this.axis_y.scale.min);
	
	var min_p = this.x2p(this.axis_x.scale.min);
	var min_q = this.y2q(this.axis_y.scale.min);
	var max_p = this.x2p(this.axis_x.scale.max);
	var max_q = this.y2q(this.axis_y.scale.max);
	
	// draw x-axis
	
	if (this.axis_x.svg_group) this.axis_x.svg_group.clear();
	else this.axis_x.svg_group = this.graph.group();
	
	group = this.axis_x.svg_group;
	group.line(min_p-majortick_stroke,min_q,max_p+majortick_stroke,min_q).stroke({ width: axis_stroke });
	
	var text = group.text(function(obj) {
		  obj.tspan("");
		});
	text.build(true);
	text.font({
		  family:   font_family,
		  size:     font_size,
		  anchor:   'middle'
		});
		
	for (x=this.axis_x.scale.min; x<=this.axis_x.scale.max; x+=this.axis_x.scale.major) {
		p = this.x2p(x);
		group.line(p, min_q, p, min_q+majortick_size).stroke({ width: majortick_stroke });
		text.tspan(x)
			.x(p + ticklabelx_adj[0])
			.y(min_q + majortick_size + ticklabelx_adj[1]);
		if (x<this.axis_x.scale.max)
			for (i=1; i<this.axis_x.scale.num_minor; i++) {
				p = this.x2p(x + i*this.axis_x.scale.minor);
				group.line(p, min_q, p, min_q+minortick_size).stroke({ width: minortick_stroke});
			}
	}
	text.build(false);
	
	// draw y-axis
	if (this.axis_y.svg_group) this.axis_y.svg_group.clear();
	else this.axis_y.svg_group = this.graph.group();
	
	group = this.axis_y.svg_group;
	group.line(min_p,min_q-majortick_stroke,min_p,max_q+majortick_stroke).stroke({ width: axis_stroke });
	var text = group.text(function(obj) {
		  obj.tspan("");
		});
	text.build(true);
	text.font({
		  family:   font_family,
		  size:     font_size,
		  anchor:   'end'
		});
	
	for (y=this.axis_y.scale.min; y<=this.axis_y.scale.max; y+=this.axis_y.scale.major) {
		q = this.y2q(y);
		group.line(min_p, q, min_p-majortick_size, q).stroke({ width: majortick_stroke });
		text.tspan(y)
			.x(min_p - majortick_size + ticklabely_adj[0])
			.y(q + font_size/2 + ticklabely_adj[1]);
		if (y<this.axis_y.scale.max)
			for (i=1; i<this.axis_y.scale.num_minor; i++) {
				q = this.y2q(y + i*this.axis_y.scale.minor);
				group.line(min_p, q, min_p-minortick_size, q).stroke({ width: minortick_stroke });
			}
	}
	
	// draw lines and points
	
	// svg elements that 'belong' to data are assigned to
	// plot_elements groups that are attributes of nodes
	// and these groups are then assigned to the plot_elements
	// group of the elevation plot object
	
	if (this.plot_elements==null) this.plot_elements = this.graph.group();
	
	var next;
	for (ts.list.listIterator.reset();  next = ts.list.listIterator.listNextNode(), !next.done;) {
		this.plotNode(next.value);

	}

	this.fit();
};



tsElevationPlot.plotNode = function(curNode) {
	var color = curNode.type.color;
	var nodegroup = curNode.plot_group;
	if (nodegroup==null) {
		nodegroup = this.plot_elements.group();
		curNode.plot_group = nodegroup;
	} else {
		nodegroup.clear();
	}
	var next,p,q;
	for (ts.list.nodeIterator.reset(curNode);  next = ts.list.nodeIterator.next3d(), !next.done;) {
		var curLatLng = ts.list.nodeIterator.curIterPoint;
		if (!curLatLng.height) continue;
		if (!ts.list.nodeIterator.curIterIsChild) {
			// plot points for 2d points (i.e. non-children)
			
			if (!ts.list.nodeIterator.curPointIsTerminal) {
				// for all intermediate points,
				// plot circles similar to maps display
				// TODO: trigger these on/off depending on editable status?
				if (curNode.type===ts.list.nodeTypes.MANUAL) {
					p = this.x2p(curLatLng.cumulLength);
					q = this.y2q(curLatLng.height);
					nodegroup.circle(symbol_size)
							 .cx(p)
							 .cy(q)
							 .fill({color: 'white'})
							 .stroke({color: color});
				}
			} 
			else {
				// terminal point: draw marker
				switch (curNode.type) {
					case ts.list.nodeTypes.HOME:
						// do not draw home node
						break;
					case ts.list.nodeTypes.MANUAL:
					case ts.list.nodeTypes.TOROUTE:
					case ts.list.nodeTypes.ROUTED:
						p = this.x2p(curLatLng.cumulLength);
						q = this.y2q(curLatLng.height);
						nodegroup.rect(symbol_size,symbol_size)
								 .cx(p)
								 .cy(q)
								 .fill({color: color});
						break;
				}
			}
		}
			
		// draw line if lastLatLng is valid
		var lastLatLng = ts.list.nodeIterator.prevIterPoint;
		if (lastLatLng && lastLatLng.height) {
			nodegroup.line(this.x2p(lastLatLng.cumulLength), this.y2q(lastLatLng.height),
						   this.x2p(curLatLng.cumulLength), this.y2q(curLatLng.height))
					  .stroke({width: line_stroke,
					           color: color});
		}
	}
}


