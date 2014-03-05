var tsLookupStatus = {
	SUCCESS: {value: 0, details: "Success"},
	REQ_ERROR: {value: -1, details: "Request error"}, // xhr error or timeout
	REQ_TIMEOUT: {value: -2, details: "Request time out"},
	DATA_ERROR: {value: -3, details: "Data error"}, // e.g. unknown data format
};

function tsLookupDEM(latLng, callback) {
	// callback:function(tsLookupResult, tsLookupStatus))
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
			for (var i = 0; i < respBuffer.byteLength; i += 12) {
				var q = respView.getInt32(i) * 1.0e-3;
				callback(q,tsLookupStatus.SUCCESS);
				}
			}
		}
	};

	var url = "http://localhost:9080/process_binary";

	xhr.open("POST", url, true);
	var reqBuffer = new ArrayBuffer(2 * 4);
	xhr.responseType = "arraybuffer";
	xhr.timeout = 5000;

	var reqView = new DataView(reqBuffer);
	reqView.setInt32(0, latLng.lat() * 1.0e7);
	reqView.setInt32(4, latLng.lng() * 1.0e7);

	xhr.send(reqBuffer);

}

