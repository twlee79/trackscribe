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

ts.titleString = "TrackScribe v1.0.1 by Tet Woo Lee";

// Disable business pois
ts.mapStyles = [
    {
        featureType: "poi.business",
        elementType: "labels",
        stylers: [
            {visibility: "off"}
        ]
    }
];


ts.main = {
    mapOptions: {
        center: new google.maps.LatLng(-36.8485, 174.7633),
        zoom: 16,
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        styles: ts.mapStyles
    },
    map: null,
    directionsService: null,
};

ts.main.initializeMap = function () {
    this.map = new google.maps.Map(document.getElementById("map-canvas"),
            this.mapOptions);
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (position) {
            ts.main.map.setCenter(new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
        });
    }
    this.directionsService = new google.maps.DirectionsService();
    google.maps.event.addListenerOnce(this.map, 'idle', this.mapReady);
};

ts.main.setCursor = function (cursor) {
    this.map.setOptions({draggableCursor: cursor});
};

ts.main.mapReady = function () {
    ts.dem.initializeChart();
};

ts.main.initialize = function () {
    ts.main.initializeMap();
    ts.list.initialize();
    ts.controls.initialize();
};

google.maps.event.addDomListener(window, 'load', ts.main.initialize);



