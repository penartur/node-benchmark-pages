"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;
var http = require('http');

var dateTimer = require('./timers/datetimer');

var TIMERTYPES = {
	DATETIMER: 'datetimer'
}

var getTimer = function (timerType) {
	switch (timerType) {
		case TIMERTYPES.DATETIMER:
			return dateTimer;
		default:
			throw new Error("Unknown timer type " + timerType);
	}
}

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
			max: this.max(list),
			num: list.length
		};
		//console.log(list);
		//console.log(result);
		return result;
	}
}

var Benchmark = function (engines, pages, options) {
	this.engines = engines;
	this.pages = pages;
	this.options = {
		iterations: 9,
		timerType: TIMERTYPES.DATETIMER
	};
	if (options.iterations !== undefined) {
		this.options.iterations = options.iterations;
	}
	if (options.timerType !== undefined) {
		this.options.timerType = options.timerType;
	}
	this.timers = getTimer(this.options.timerType);

	this.pagesExpectedLength = {};
	for (var pageName in pages) {
		this.pagesExpectedLength[pageName] = {};
	}
}

//Instances of BenchmarkContext are one-time only
var BenchmarkContext = function (benchmark, simultaneousRequests, done) {
	this.benchmark = benchmark;
	this.simultaneousRequests = simultaneousRequests;
	this.done = done;

	this.responseTimes = {};
	for (var pageName in this.benchmark.pages) {
		this.responseTimes[pageName] = {};
		for (var engineName in this.benchmark.engines) {
			this.responseTimes[pageName][engineName] = [];
		}
	}
}

BenchmarkContext.prototype.onDone = function () {
	for (var pageName in this.benchmark.pages) {
		var averages = {};
		for (var engineName in this.benchmark.engines) {
			averages[engineName] = statistics.all(this.responseTimes[pageName][engineName]);
		}
		console.log("For page " + pageName);
		console.log(averages);
	}
	this.done();
}

BenchmarkContext.prototype.requestPage = function (url, expectedLength, callback) {
	var timer = this.benchmark.timers.start();
	request(url, function (error, response, body) {
		var elapsed = timer.elapsed();
		if (error) {
			callback(error, elapsed);
		} else {
			if (body.length != expectedLength) {
				callback(new Error("Expected " + expectedLength + " bytes, got " + body.length + " bytes"), elapsed);
			} else {
				callback(false, elapsed);
			}
		}
	});
};

BenchmarkContext.prototype.runPage = function (engineName, pageName, over) {
	this.requestPage(
		this.benchmark.engines[engineName] + this.benchmark.pages[pageName].url,
		this.benchmark.pages[pageName].expectedLength[engineName],
		(function (err, total) {
			if (err) {
				console.log(err);
			}
			this.responseTimes[pageName][engineName].push(total);
			over();
		}).bind(this)
	);
}

BenchmarkContext.prototype.runEngine = function (engineName, over) {
	var queue = new WorkingQueue(this.simultaneousRequests);
	queue.hold();
	for (var i = 0; i < this.benchmark.options.iterations * this.simultaneousRequests; i++) {
		for (var pageName in this.benchmark.pages) {
			for (var j = 0; j < this.benchmark.pages[pageName].weight; j++) {
				queue.perform(this.runPage.bind(this), engineName, pageName);
			}
		}
	}
	queue.whenDone(over);
	queue.go();
}

BenchmarkContext.prototype.run = function (done) {
	console.log("");
	console.log("Measuring average reponse time for " + this.simultaneousRequests + " simultaneous requests");

	http.globalAgent.maxSockets = this.simultaneousRequests;

	var metaQueue = new WorkingQueue(1);
	metaQueue.hold();
	for (var engineName in this.benchmark.engines) {
		metaQueue.perform(this.runEngine.bind(this), engineName);
	}
	metaQueue.whenDone(this.onDone.bind(this));
	metaQueue.go();
};

Benchmark.prototype.run = function (simultaneousRequests, done) {
	var context = new BenchmarkContext(this, simultaneousRequests, done);
	context.run(done);
}

Benchmark.prototype.runMultiple = function (simultaneousRequestsList, done) {
	var queue = new WorkingQueue(1);
	queue.hold();
	for (var i in simultaneousRequestsList) {
		queue.perform(this.run.bind(this), simultaneousRequestsList[i]);
	}
	queue.whenDone(done);
	queue.go();
}

module.exports = Benchmark;
