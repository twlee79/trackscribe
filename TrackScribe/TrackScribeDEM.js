"use strict";

var tsLookupStatus = {
	SUCCESS: {value: 0, details: "Success"},
	REQ_ERROR: {value: -1, details: "Request error"}, // xhr error or timeout
	REQ_TIMEOUT: {value: -2, details: "Request time out"},
	DATA_ERROR: {value: -3, details: "Data error"}, // e.g. unknown data format
};

function tsLookupDEM(latLng, latLngs, callback) {
	// latLng = single latLng, latLngs = array
	// latLng used if not null, else latLngs used
	// callback:function(tsLookupResult, tsLookupStatus))
	var pathLookup;
	
	if (latLng === null) pathLookup = true;
	else pathLookup = false;
	
	var xhr = new XMLHttpRequest();
	
	xhr.ontimeout = function () {
		//console.log("timeout");
		callback(null,tsLookupStatus.REQ_TIMEOUT);
	};

	xhr.onerror = function(e) {
		//console.log("error");
		callback(null,tsLookupStatus.REQ_ERROR);
	};

	xhr.onload = function() {
		//console.log("onload");
		//console.log(xhr.readyState);
		//console.log(xhr.status);
		if (xhr.readyState === 4) { // DONE
			if (xhr.status === 200) { // SUCCESS
				var respBuffer = xhr.response;
				if (!respBuffer) {
					callback(null,tsLookupStatus.DATA_ERROR);
				}
				var respView = new DataView(respBuffer);
				if (pathLookup) {
					var parsedData = [];
					for (var i = 0; i < respBuffer.byteLength; i += 16) {
			            var lat = respView.getInt32(i)*1.0e-7;
			            var lng = respView.getInt32(i+4)*1.0e-7;
			            var q = respView.getInt32(i+8)*1.0e-3;
			            var index = respView.getInt32(i+12);
			            var latLng = new google.maps.LatLng(lat,lng);
			            latLng.height = q;
			            latLng.index = index;
			            //console.log(i,lat,lng,q,index);
			            parsedData.push(latLng);
					}
					callback(parsedData,tsLookupStatus.SUCCESS);
					
				} else {
					var q = respView.getInt32(0) * 1.0e-3;
					callback(q,tsLookupStatus.SUCCESS);
				}
			} else {
				callback(null,tsLookupStatus.REQ_ERROR);
			}
		}
	};

	var url = "http://localhost:9080/process_binary";

	xhr.open("POST", url, true);
	xhr.responseType = "arraybuffer";
	xhr.timeout = 5000;
	
	var reqBuffer; 
	
	if (pathLookup) {
		var numPoints = latLngs.length; 
		
		reqBuffer = new ArrayBuffer(numPoints * 8);
		var reqView = new DataView(reqBuffer);
		for (var i=0; i< numPoints; i++) {
			reqView.setInt32(i*8, latLngs[i].lat() * 1.0e7);
			reqView.setInt32(i*8 + 4, latLngs[i].lng() * 1.0e7);
			//console.log(i,latLngs[i].lat(),latLngs[i].lng());
		}
	} else {
		reqBuffer = new ArrayBuffer(8);
		var reqView = new DataView(reqBuffer);
		reqView.setInt32(0, latLng.lat() * 1.0e7);
		reqView.setInt32(4, latLng.lng() * 1.0e7);
	}

	xhr.send(reqBuffer);

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
	points : {},
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
	
	this.svg.width(tsMultiplyCSSLength(this.svg.width(),bbox.width/viewbox.width,100));
	this.svg.height(tsMultiplyCSSLength(this.svg.height(),bbox.height/viewbox.height,100));
	var bbox = this.svg.bbox();
	var viewbox = this.svg.viewbox();

};

tsElevationPlot.updateXAxis = function() {
	
};

tsElevationPlot.updateYAxis = function() {
	
};

tsElevationPlot.update = function() {
	if (this.svg == undefined) {
		this.svg = SVG('elevationPlot').size('100%', '100%');
		this.graph = this.svg.group();
	}
	
	var extent = tsPointList.getExtent();
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
	
	// draw line
	if (this.svg_lines) this.svg_lines.clear();
	else this.svg_lines = this.graph.group();
	
	group = this.svg_lines = this.graph.group();
	
	var curNode = tsPointList.head;
	while (curNode!=null) {
		//color = curNode.type.color;
		color = "red"
		var lastLatLng = null;
		var latLng;
		
		for (var i = 0; i < curNode.path.getLength(); i++) {
			latLng = curNode.path.getAt(i);
			var numChildren = 0;
			if (i<curNode.path.getLength()-1 && latLng.children) // non-terminal and have children
				numChildren = latLng.children.length;
					// note: terminal points shared with first point of next node
					// do not draw lines for terminal points chilldren
			for (var j=-1; j<numChildren;j++) {
				var curLatLng;
				if (j<0) curLatLng = latLng;
				else curLatLng = latLng.children[j];
				
				if (curLatLng.height == null) {
					lastLatLng = null;
					continue;
				}
				if (lastLatLng) {
					// if get here both last and cur latLng height is defined 
					group.line(this.x2p(lastLatLng.cumulLength), this.y2q(lastLatLng.height),
							   this.x2p(curLatLng.cumulLength), this.y2q(curLatLng.height))
						 .stroke({width: line_stroke,
							 	  color: color});
				}
				lastLatLng = curLatLng;
			}
			
		}
		curNode = curNode.next;
	}
	var next;
	for (tsListIterator.reset();  next = tsListIterator.next3d(), !next.done;) {
		color = tsListIterator.curNode.type.color;
		var lastLatLng = tsListIterator.prevIterPoint;
		var curLatLng = tsListIterator.curIterPoint;

		if (lastLatLng && lastLatLng.height && curLatLng.height) {
			group.line(this.x2p(lastLatLng.cumulLength), this.y2q(lastLatLng.height),
					   this.x2p(curLatLng.cumulLength), this.y2q(curLatLng.height))
				 .stroke({width: line_stroke,
					 	  color: color});
		}
	}
	/*
	lastp = null;
	for (i=0;i<this.x_values.length;i++) {
		x = this.x_values[i];
		y = this.y_values[i];
		p = this.x2p(x);
		q = this.y2q(y);
		if (lastp!==null) {
			group.line(lastp,lastq,p,q).stroke({ width: 1 });
		}
		lastp = p;
		lastq = q;
	}*/

	// draw points
	if (this.svg_points) this.svg_points.clear();
	else this.svg_points = this.graph.group();
	
	group = this.svg_points = this.graph.group();

	
	/*
	while (curNode!=null) {
		for (var i = 0; i < curNode.path.getLength(); i++) {
			var latLng = curNode.path.getAt(i);
			if (latLng.children) for (var j = 0; j < latLng.children.length; j++) {
			}
		}
		curNode = curNode.next;
	}
	*/
	
	var text = group.text(function(obj) {
		  obj.tspan("");
		});
	text.build(true);
	text.font({
		  family:   font_family,
		  size:     font_size,
		  anchor:   'middle'
		});
		
	

	var curNode = tsPointList.head;
	var color;
	var latLng;
	while (curNode!=null) {
		//color = curNode.type.color;
		color = "red";
		/*{
			q = this.y2q(this.axis_y.scale.min);
			text.tspan("?")
				.x(p)
				.y(q);
			
		}*/
		switch (curNode.type) {
			case tsNodeTypes.HOME:
				// do not draw home node
				break;
			case tsNodeTypes.MANUAL:
				for (var i = 0; i < curNode.path.getLength()-1; i++) {
					// for all intermediate points
					latLng = curNode.path.getAt(i);
					y = latLng.height;
					if (y != null) {
						x = latLng.cumulLength;
						p = this.x2p(x);
						q = this.y2q(y);
						group.circle(symbol_size)
							 .cx(p)
							 .cy(q)
							 .fill({color: 'white'})
							 .stroke({color: color});
					}
					
				}
				// no break: continue to next block for drawing terminus
			case tsNodeTypes.TOROUTE:
			case tsNodeTypes.ROUTED:
				latLng = curNode.getTerminus();
				y = latLng.height;
				if (y != null) {
					x = latLng.cumulLength;
					p = this.x2p(x);
					q = this.y2q(y);
					//group.circle(symbol_size)
					group.rect(symbol_size,symbol_size)
						 .cx(p)
						 .cy(q)
						 .fill({color: color});
				}
				break;
		}
		curNode = curNode.next;
	}

	
	
	var latLng;
	for (tsListIterator.reset();  next = tsListIterator.next2d(), !next.done;) {
		var curNode = tsListIterator.curNode;
		var color = curNode.type.color;
		var latLng = next.value;
		/*{
			q = this.y2q(this.axis_y.scale.min);
			text.tspan("?")
				.x(p)
				.y(q);
			
		}*/
		switch (curNode.type) {
			case tsNodeTypes.HOME:
				// do not draw home node
				break;
			case tsNodeTypes.MANUAL:
				if (!tsListIterator.curPointIsTerminal) {
					// for all intermediate points
					y = latLng.height;
					if (y != null) {
						x = latLng.cumulLength;
						p = this.x2p(x);
						q = this.y2q(y);
						group.circle(symbol_size)
							 .cx(p)
							 .cy(q)
							 .fill({color: 'white'})
							 .stroke({color: color});
					}
					
				}
				// no break: continue to next block for drawing terminus
			case tsNodeTypes.TOROUTE:
			case tsNodeTypes.ROUTED:
				if (tsListIterator.curPointIsTerminal) {
	
					//latLng = curNode.getTerminus();
					y = latLng.height;
					if (y != null) {
						x = latLng.cumulLength;
						p = this.x2p(x);
						q = this.y2q(y);
						//group.circle(symbol_size)
						group.rect(symbol_size,symbol_size)
							 .cx(p)
							 .cy(q)
							 .fill({color: color});
					}
					break;
				}
		}
		curNode = curNode.next;
	}
	
	
	text.build(false);



	this.fit();
};

