
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

function tsComputeOffset(latLng1, latLng2, distance) {
	// return a LatLng which is distance away from latLng1 in the heading of latLng1 -> latLng2
    var heading = google.maps.geometry.spherical.computeHeading(latLng1, latLng2);
    return google.maps.geometry.spherical.computeOffset(latLng1, distance, heading);

}

// convert SVG polygons to path with http://readysetraphael.com/
// ensure centred around origin
var tsHouseSVG = 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z';
var tsDottedSVG = 'M 0,-1 0,1';
var tsSquareSVG = 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z';
