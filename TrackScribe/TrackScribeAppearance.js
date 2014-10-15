


// convert SVG polygons to path with http://readysetraphael.com/
// ensure centred around origin
var tsHouseSVG = 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z';
var tsDottedSVG = 'M 0,-1 0,1';
var tsSquareSVG = 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z';


var tsHomeNodeColor = "darkblue";
var tsManualNodeColor = "skyblue";
var tsToRouteNodeColor = "mediumblue";
var tsRoutedNodeColor = "mediumblue";

tsCreateMarkerOptions = function(position, color) { 
    var markerSymbol = {
        path : tsSquareSVG,
        scale : 6,
        strokeColor : color,
        fillColor : color,
        strokeOpacity : 1.0,
        strokeWeight : 1.0,
        fillOpacity : 1.0
    };
    
    return {
        map : tsMain.map,
        position : position,
        draggable : true,
        zIndex : 100,
        icon : markerSymbol
    };
};

tsCreateHomeMarkerSymbol = function(color) { return {
        path : tsHouseSVG,
        scale : 0.15,
        strokeColor : color,
        fillColor : color,
        strokeOpacity : 1.0,
        strokeWeight : 1.0,
        fillOpacity : 1.0
    };
};

tsCreatePolylineOptions = function(path, color) { 
    var arrowSymbol = {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale : 3,
        strokeColor : color,
        fillColor : color,
        strokeOpacity : 1.0,
        strokeWeight : 2.0,
        fillOpacity : 1.0
    };
    
    return {
        map : tsMain.map,
        path : path,
        strokeColor : color,
        strokeWeight : 2.0,
        strokeOpacity : 1.0,
        zIndex : 90,
        icons : [ 
                  {    icon : arrowSymbol, offset : '10%'},
                  {    icon : arrowSymbol, offset : '90%'}
        ]
    };
};

var tsDottedLineSymbol = {
    path : tsDottedSVG,
    strokeOpacity : 1.0,
    scale : 4.0
};

var tsDottedLineIconSequence = {
    icon : tsDottedLineSymbol,
    offset : '0',
    repeat : '20px'
};
    
