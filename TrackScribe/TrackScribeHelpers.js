
var tsDeg2Rad = Math.PI/180.0;
var tsRad2Deg = 180.0/Math.PI;
var tsEarthR = 6378137; // radius of earth in metres

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