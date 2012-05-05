"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;
var http = require('http');
var os = require('os');

var statistics = require('./statistics');

//Instances of BenchmarkContext are one-time only
var BenchmarkContext = function (benchmark, simultaneousRequests, done) {
	this.benchmark = benchmark;
	this.simultaneousRequests = simultaneousRequests;
	this.done = done;

	if (!(simultaneousRequests >= 1)) {
		throw new Error("simultaneousRequests must be at least 1; " + simultaneousRequests + " passed");
	}

	this.responseTimes = {};
	for (var pageName in this.benchmark.pages) {
		this.responseTimes[pageName] = {};
		for (var engineName in this.benchmark.engines) {
			this.responseTimes[pageName][engineName] = [];
		}
	}

	this.totals = {};
}

BenchmarkContext.prototype.onDone = function () {
	var perPage = {};
	for (var pageName in this.benchmark.pages) {
		perPage[pageName] = {};
		for (var engineName in this.benchmark.engines) {
			perPage[pageName][engineName] = statistics.all(this.responseTimes[pageName][engineName]);
		}
	}
	this.done(this.simultaneousRequests, {
		perPage: perPage,
		totals: this.totals
	});
}

BenchmarkContext.prototype.requestPage = function (url, expectedLength, callback) {
	var timer = this.benchmark.timers.start();
	request(url, function (error, response, body) {
		var elapsed = timer.elapsed();
		if (error) {
			callback(new Error("An error occured while trying to process " + url + ": " + error), elapsed);
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
		this.benchmark.pagesExpectedLength[pageName][engineName],
		(function (err, total) {
			if (err) {
				console.log(err);
			} else {
				this.responseTimes[pageName][engineName].push(total);
			}
			over();
		}).bind(this)
	);
}

BenchmarkContext.prototype.runEngine = function (engineName, over) {
	var tasks = 0;
	//console.log("runEngine");
	var queue = new WorkingQueue(this.simultaneousRequests);
	queue.hold();
	for (var i = 0; i < this.benchmark.options.iterations * this.simultaneousRequests; i++) {
		for (var pageName in this.benchmark.pages) {
			for (var j = 0; j < this.benchmark.pages[pageName].weight; j++) {
				queue.perform(this.runPage.bind(this), engineName, pageName);
				tasks++;
			}
		}
	}
	var timer = this.benchmark.timers.start();
	queue.whenDone((function () {
		this.totals[engineName] = {
			time: timer.elapsed(),
			tasks: tasks
		};
		var timeout = 0;
		if (os.platform() == 'win32') {
			timeout = this.simultaneousRequests * 2000; //to workaround ENOBUFS
		}
		//console.log("done, waiting " + timeout + "ms");
		setTimeout(over, timeout);
	}).bind(this));
	queue.go();
}

BenchmarkContext.prototype.run = function () {

	http.globalAgent.maxSockets = this.simultaneousRequests; //TODO: replace this global state changing with something else
	var metaQueue = new WorkingQueue(1);
	metaQueue.hold();
	for (var engineName in this.benchmark.engines) {
		metaQueue.perform(this.runEngine.bind(this), engineName);
	}
	metaQueue.whenDone(this.onDone.bind(this));
	metaQueue.go();
};

module.exports = BenchmarkContext;
