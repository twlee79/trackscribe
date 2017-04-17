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

// convert SVG polygons to path with http://readysetraphael.com/
// ensure centred around origin
ts.svg = {};
ts.svg.house = 'M 0,-70.866 -70.866,0 -42.52,0 -42.52,70.866 42.52,70.866 42.52,0 70.866,0 42.518,-28.349 42.52,-56.693 28.347,-56.692 28.348,-42.519 z';
ts.svg.dotted = 'M 0,-1 0,1';
ts.svg.square = 'M 1.1,1.1 1.1,-1 -1,-1 -1,1.1 z';

ts.colors = {};
ts.colors.homeNode = "darkblue";
ts.colors.manualNode = "skyblue";
ts.colors.toRouteNode = "mediumblue";
ts.colors.routedNode = "mediumblue";

ts.createMarkerOptions = function(position, color) { 
    var markerSymbol = {
        path : ts.svg.square,
        scale : 6,
        strokeColor : color,
        fillColor : color,
        strokeOpacity : 1.0,
        strokeWeight : 1.0,
        fillOpacity : 1.0
    };
    
    return {
        map : ts.main.map,
        position : position,
        draggable : true,
        zIndex : 100,
        icon : markerSymbol
    };
};

ts.createHomeMarkerSymbol = function(color) { return {
        path : ts.svg.house,
        scale : 0.15,
        strokeColor : color,
        fillColor : color,
        strokeOpacity : 1.0,
        strokeWeight : 1.0,
        fillOpacity : 1.0
    };
};

ts.createPolylineOptions = function(path, color) { 
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
        map : ts.main.map,
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

ts.dottedLineSymbol = {
    path : ts.svg.dotted,
    strokeOpacity : 1.0,
    scale : 4.0
};

 ts.dottedLineIconSequence = {
    icon : ts.dottedLineSymbol,
    offset : '0',
    repeat : '20px'
};
    
