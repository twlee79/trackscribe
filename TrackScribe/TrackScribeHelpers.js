"use strict";

var tsDebug = true;
var tsDeg2Rad = Math.PI/180.0;
var tsRad2Deg = 180.0/Math.PI;
var tsEarthR = 6378137; // radius of earth in metres

function tsDebugInfo(msg) {
	// silently log msg to console
	msg = "Info: "+msg;
	console.log(msg);
};

function tsWarning(msg) {
	msg = "Warning! "+msg;
	if (tsDebug) window.alert(msg);
	console.log(msg);
};

function tsError(msg) {
	msg = "ERROR! "+msg;
	window.alert(msg);
	console.log(msg);
	throw Error(msg);
};

function tsAssert(condition, msg) {
	if (tsDebug && !condition) window.alert("Assertion failed: "+msg);
	console.assert(condition,msg);
}

/**
 * Multiply a CSS length string by a factor, enforcing min or max if specified.
 * @param length CSS length containing a float value and a unit
 * @param factor Number to muliply by (float)
 * @param min minimum returned result, null to ignore
 * @param max maximum return result, null to ignore
 * @returns CSS length multipled by factor with same unit as initial length.
 */
function tsMultiplyCSSLength(length,factor,min,max) {
	var parsedLength = /([+\-\.0-9]+)(.*)/.exec(length);
	if (!parsedLength) throw TypeError("Invalid CSS length "+length);
	var value = parseFloat(parsedLength[1]);
	value*=factor;
	if (min && value<min) value = min;
	if (max && value>max) value = max;
	return value + parsedLength[2];
};


function tsComputeDistBtw(latLng1, latLng2) {
	//return google.maps.geometry.spherical.computeDistanceBetween(latLng1,latLng2);
	// convert to radians
	var lat1 = latLng1.lat() * tsDeg2Rad;
	var lng1 = latLng1.lng() * tsDeg2Rad;
	var lat2 = latLng2.lat() * tsDeg2Rad;
	var lng2 = latLng2.lng() * tsDeg2Rad;
	
	var dLat = lat2 - lat1;
	var dLng = lng2 - lng1;
	var sin_dLat = Math.sin(dLat/2.0);
	var sin_dLng = Math.sin(dLng/2.0);
	var a = (sin_dLat*sin_dLat) + (sin_dLng*sin_dLng*Math.cos(lat1)*Math.cos(lat2));
	var d = tsEarthR * (2 * Math.atan2(Math.sqrt(a),Math.sqrt(1.0-a)));
	return d;
};

function tsComputeOffset(latLng1, latLng2, distance) {
	// return a LatLng which is distance away from latLng1 in the heading of latLng1 -> latLng2
    var heading = google.maps.geometry.spherical.computeHeading(latLng1, latLng2);
    return google.maps.geometry.spherical.computeOffset(latLng1, distance, heading);

}

function tsGenerateReverseDict(theEnum) {
	// generate a reverse lookup of value to key from an enum object containing attributes with values
	var ret = {};
	for (var key in theEnum) {
		var value = theEnum[key].value;
		ret[value] = key;
	};
	return ret;
}

function tsDownloadCSV(filename, csv) {
	// download string csv using Data URI
	var dl = document.createElement('A');
    dl.setAttribute('HREF', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    dl.setAttribute('DOWNLOAD', filename);
    dl.click();
}

function tsPadTime(number) {
	var absNum = Math.abs(number);
    var floorNum = Math.floor(absNum);
    
    return (floorNum < 10 ? '0' : '') + floorNum;
	
}


function tsGetISODate() {
    var localTime = new Date();
    

    return localTime.getFullYear() 
        + '-' + tsPadTime(localTime.getMonth()+1)
        + '-' + tsPadTime(localTime.getDate());

}

function tsGetISOTime() {
    var localTime = new Date();
    
    function tsPadTime(number) {
    	var absNum = Math.abs(number);
        var floorNum = Math.floor(absNum);
        
        return (floorNum < 10 ? '0' : '') + floorNum;
    	
    }
    
    var tzOffset = localTime.getTimezoneOffset();
    var tzSign = tzOffset < 0 ? '+' : '-'; // offset sign is opposite what should be printed
    return localTime.getFullYear() 
        + '-' + tsPadTime(localTime.getMonth()+1)
        + '-' + tsPadTime(localTime.getDate())
        + 'T' + tsPadTime(localTime.getHours())
        + ':' + tsPadTime(localTime.getMinutes()) 
        + ':' + tsPadTime(localTime.getSeconds()) 
        + tzSign + tsPadTime(tzOffset / 60) + tsPadTime(tzOffset % 60);

}

/**
 * Compares two latLng's for equality with a precision of 1e-6 (~0.11m)
 * @param latLng1
 * @param latLng2
 */
function tsLatLngEquals(latLng1, latLng2) {
	return Math.abs(latLng1.lat()-latLng2.lat())<1e-6 &&
		   Math.abs(latLng1.lng()-latLng2.lng())<1e-6;
}



// convert SVG polygons to path with http://readysetraphael.com/
// ensure centred around origin
var tsHouseSVG = 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z';
var tsDottedSVG = 'M 0,-1 0,1';
var tsSquareSVG = 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z';
