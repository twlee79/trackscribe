"use strict";

var ts = ts || {};

ts.const = {}

ts.debug = true;
ts.const.deg2Rad = Math.PI/180.0;
ts.const.rad2Deg = 180.0/Math.PI;
ts.const.earthR = 6378137; // radius of earth in metres

ts.debugInfo = function(msg) {
	// silently log msg to console
	msg = "Info: "+msg;
	console.log(msg);
};

ts.warning = function(msg) {
	msg = "Warning! "+msg;
	if (ts.debug) window.alert(msg);
	console.log(msg);
};

ts.error = function(msg) {
	msg = "ERROR! "+msg;
	window.alert(msg);
	console.log(msg);
	throw Error(msg);
};

ts.assert = function(condition, msg) {
        if (msg==null) msg = "(no message)";
	if (ts.debug && !condition) {
            window.alert("Assertion failed: "+msg);
            console.assert(condition,msg);
            console.trace();
        }
}

/**
 * Multiply a CSS length string by a factor, enforcing min or max if specified.
 * @param length CSS length containing a float value and a unit
 * @param factor Number to muliply by (float)
 * @param min minimum returned result, null to ignore
 * @param max maximum return result, null to ignore
 * @returns CSS length multipled by factor with same unit as initial length.
 */
ts.multiplyCSSLength = function(length,factor,min,max) {
	var parsedLength = /([+\-\.0-9]+)(.*)/.exec(length);
	if (!parsedLength) throw TypeError("Invalid CSS length "+length);
	var value = parseFloat(parsedLength[1]);
	value*=factor;
	if (min && value<min) value = min;
	if (max && value>max) value = max;
	return value + parsedLength[2];
};


ts.computeDistBtw = function(latLng1, latLng2) {
	//return google.maps.geometry.spherical.computeDistanceBetween(latLng1,latLng2);
	// convert to radians
	var lat1 = latLng1.lat() * ts.const.deg2Rad;
	var lng1 = latLng1.lng() * ts.const.deg2Rad;
	var lat2 = latLng2.lat() * ts.const.deg2Rad;
	var lng2 = latLng2.lng() * ts.const.deg2Rad;
	
	var dLat = lat2 - lat1;
	var dLng = lng2 - lng1;
	var sin_dLat = Math.sin(dLat/2.0);
	var sin_dLng = Math.sin(dLng/2.0);
	var a = (sin_dLat*sin_dLat) + (sin_dLng*sin_dLng*Math.cos(lat1)*Math.cos(lat2));
	var d = ts.const.earthR * (2 * Math.atan2(Math.sqrt(a),Math.sqrt(1.0-a)));
	return d;
};

ts.computeOffset = function(latLng1, latLng2, distance) {
	// return a LatLng which is distance away from latLng1 in the heading of latLng1 -> latLng2
    var heading = google.maps.geometry.spherical.computeHeading(latLng1, latLng2);
    return google.maps.geometry.spherical.computeOffset(latLng1, distance, heading);

};

ts.generateReverseDict = function(theEnum) {
	// generate a reverse lookup of value to key from an enum object containing attributes with values
	var ret = {};
	for (var key in theEnum) {
		var value = theEnum[key].value;
		ret[value] = key;
	};
	return ret;
};

ts.downloadCSV = function(filename, csv) {
	// download string csv using Data URI
	var dl = document.createElement('A');
    dl.setAttribute('HREF', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    dl.setAttribute('DOWNLOAD', filename);
    dl.click();
};

ts.padTime = function(number) {
	var absNum = Math.abs(number);
    var floorNum = Math.floor(absNum);
    
    return (floorNum < 10 ? '0' : '') + floorNum;
	
};


ts.getISODate = function() {
    var localTime = new Date();
    

    return localTime.getFullYear() 
        + '-' + ts.padTime(localTime.getMonth()+1)
        + '-' + ts.padTime(localTime.getDate());

};

ts.getISODate = function() {
    var localTime = new Date();
    
    function padTime(number) {
    	var absNum = Math.abs(number);
        var floorNum = Math.floor(absNum);
        
        return (floorNum < 10 ? '0' : '') + floorNum;
    	
    }
    
    var tzOffset = localTime.getTimezoneOffset();
    var tzSign = tzOffset < 0 ? '+' : '-'; // offset sign is opposite what should be printed
    return localTime.getFullYear() 
        + '-' + ts.padTime(localTime.getMonth()+1)
        + '-' + ts.padTime(localTime.getDate())
        + 'T' + ts.padTime(localTime.getHours())
        + ':' + ts.padTime(localTime.getMinutes()) 
        + ':' + ts.padTime(localTime.getSeconds()) 
        + tzSign + ts.padTime(tzOffset / 60) + ts.padTime(tzOffset % 60);

};

/**
 * Compares two latLng's for equality with a precision of 1e-6 (~0.11m)
 * @param latLng1
 * @param latLng2
 */
ts.latLngEquals = function(latLng1, latLng2) {
    return Math.abs(latLng1.lat()-latLng2.lat())<1e-6 &&
               Math.abs(latLng1.lng()-latLng2.lng())<1e-6;
};



