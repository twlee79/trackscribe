
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
	window.alert(msg);
	console.log(msg);
};

function tsError(msg) {
	msg = "ERROR! "+msg;
	window.alert(msg);
	console.log(msg);
};



function tsComputeDistBtw(latLng1, latLng2) {
	//return google.maps.geometry.spherical.computeDistanceBetween(latLng1,latLng2);
	// convert to radians
	lat1 = latLng1.lat() * tsDeg2Rad;
	lng1 = latLng1.lng() * tsDeg2Rad;
	lat2 = latLng2.lat() * tsDeg2Rad;
	lng2 = latLng2.lng() * tsDeg2Rad;
	
	dLat = lat2 - lat1;
	dLng = lng2 - lng1;
	sin_dLat = Math.sin(dLat/2.0);
	sin_dLng = Math.sin(dLng/2.0);
	a = (sin_dLat*sin_dLat) + (sin_dLng*sin_dLng*Math.cos(lat1)*Math.cos(lat2));
	d = tsEarthR * (2 * Math.atan2(Math.sqrt(a),Math.sqrt(1.0-a)));
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



// convert SVG polygons to path with http://readysetraphael.com/
// ensure centred around origin
var tsHouseSVG = 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z';
var tsDottedSVG = 'M 0,-1 0,1';
var tsSquareSVG = 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z';
