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
		callback(null,tsLookupStatus.REQ_TIMEOUT);
	};

	xhr.onerror = function(e) {
		callback(null,tsLookupStatus.REQ_ERROR);
	};

	xhr.onload = function() {
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
			            parsedData.push({latLng : latLng, q : q, index : index});
					}
					callback(parsedData,tsLookupStatus.SUCCESS);
					
				} else {
					var q = respView.getInt32(i) * 1.0e-3;
					callback(q,tsLookupStatus.SUCCESS);
				}
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
};

tsElevationPlot.initialize = function(x,y) {
	  var r = Raphael("elevationPlot",2000,100);
	  var chart = r.linechart(
	    0, 0,      // top left anchor
	    2000, 100,    // bottom right anchor
	    [
	      x,
	    ], 
	    [
	      y,
	    ], 
	    {
	       nostroke: false,   // lines between points are drawn
	       axis: "0 0 1 1",   // draw axes on the left and bottom
	       symbol: "circle",    // use a filled circle as the point symbol
	       smooth: false,      // curve the lines to smooth turns on the chart
	       dash: "-",         // draw the lines dashed
	       colors: [
	         "#555599"        // the line is blue
	       ]
	     });
  
};

