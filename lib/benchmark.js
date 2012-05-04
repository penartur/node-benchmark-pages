"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;
var http = require('http');
var config = require('../config');

var currentRequests = 0;

var benchPage = function (url, expectedLength, callback) {
	var start = new Date().getTime(); //todo: use process.hrtime here
	currentRequests++;
	//console.log("Requesting page " + url + "; currently processing " + currentRequests + " requests");
	request(url, function (error, response, body) {
		currentRequests--;
		//console.log("Got response from " + url + "; remaining " + currentRequests + " requests");
		var end = new Date().getTime();
		var total = end - start;
		if (error) {
			//console.log("Got error while trying to connect to " + url);
			callback(error, total);
		} else {
			if (body.length != expectedLength) {
				callback(new Error("Expected " + expectedLength + " bytes, got " + body.length + " bytes"), total);
			} else {
				callback(false, total);
			}
		}
	});
};

var pages = {
	/*"emptyPage": {
	url: "/",
	weight: 1,
	expectedLength: {
	"legacy": 5425,
	"modern": 41
	}
	},*/
	"hook.ws": {
		url: "/memory/platform_qa/hook.ws",
		weight: 3,
		expectedLength: {
			"legacy": 1338,
			"modern": 5047
		}
	},
	"categories": {
		url: "/memory/platform_qa/api.ws?v=2.0&format=jsonp&skipls=0",
		weight: 3,
		expectedLength: {
			"legacy": 2772,
			"modern": 2483
		}
	},
	"laptops": {
		url: "/memory/platform_qa/api.ws?v=2.0&format=jsonp&key=ABA&skipls=0",
		weight: 1,
		expectedLength: {
			"legacy": 21616,
			"modern": 19589
		}
	},
	"search": {
		url: "/memory/platform_qa/api.ws?v=2.0&s=md,lg,ru&format=jsonp&query=acer",
		weight: 1,
		expectedLength: {
			"legacy": 116245,
			"modern": 76467
		}
	}
};

var engines = {
	"legacy": config.LegacySelectorsBase.absolute,
	"modern": config.Server.absolute
};

var statistics = {
	median: function (list) {
		list.sort(function (a, b) { return (a - b); });
		if (list.length % 2 == 0) {
			return Math.round(list[list.length / 2 - 1] + list[list.length / 2]) / 2
		} else {
			return list[(list.length - 1) / 2];
		}
	},
	mean: function (list) {
		var total = 0;
		var num = 0;
		for (var i in list) {
			total += list[i];
			num++;
		}
		return Math.round(total / num);
	},
	max: function (list) {
		return Math.max.apply(null, list);
	},
	all: function (list) {
		var result = {
			median: this.median(list),
			mean: this.mean(list),
			max: this.max(list)
		};
		//console.log(list);
		//console.log(result);
		return result;
	}
};

var displayResponseTimes = function (responseTimes) {
	for (var pageName in pages) {
		var averages = {};
		for (var engineName in engines) {
			averages[engineName] = statistics.all(responseTimes[pageName][engineName]);
		}
		console.log("For page " + pageName);
		console.log(averages);
	}
}

var benchmark = function (simultaneousRequests, done) {

	if (simultaneousRequests > 1024) {
		return;
	}

	console.log("");
	console.log("Measuring average reponse time for " + simultaneousRequests + " simultaneous requests");

	http.globalAgent.maxSockets = simultaneousRequests;

	var responseTimes = {};
	for (var pageName in pages) {
		responseTimes[pageName] = {};
		for (var engineName in engines) {
			responseTimes[pageName][engineName] = [];
		}
	}

	var processor = function (engineName, pageName, over) {
		benchPage(
			engines[engineName] + pages[pageName].url,
			pages[pageName].expectedLength[engineName],
			function (err, total) {
				if (err) {
					console.log(err);
				}
				responseTimes[pageName][engineName].push(total);
				over();
			}
		);
	}

	var iterations = 9;
	var queues = {};
	for (var engineName in engines) {
		var queue = new WorkingQueue(simultaneousRequests);
		queue.hold();
		for (var i = 0; i < iterations * simultaneousRequests; i++) {
			for (var pageName in pages) {
				for (var j = 0; j < pages[pageName].weight; j++) {
					queue.perform(processor, engineName, pageName);
				}
			}
		}
		queues[engineName] = queue;
	}

	var metaProcessor = function (engineName, over) {
		queues[engineName].whenDone(function () {
			over();
		});
		queues[engineName].go();
	}
	var metaQueue = new WorkingQueue(1);
	metaQueue.hold();
	for (var engineName in engines) {
		metaQueue.perform(metaProcessor, engineName);
	}
	metaQueue.whenDone(function () {
		displayResponseTimes(responseTimes);
		done();
	});
	metaQueue.go();
};

function main() {
	benchmark(1, function () {
		benchmark(50, function () { //burning in
			var requests = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024];
			var queue = new WorkingQueue(1);
			queue.hold();
			for (var i in requests) {
				queue.perform(benchmark, requests[i]);
			}
			queue.whenDone(function () {
				console.log("done global");
			});
			queue.go();
		})
	});
}

main();
