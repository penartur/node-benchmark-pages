"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;
var http = require('http');
var os = require('os');

var statistics = require('./statistics');

//Instances of BenchmarkContext are one-time only
var BenchmarkContext = function (benchmark, simultaneousRequests, done) {
	var pageName,
		engineName;

	this.benchmark = benchmark;
	this.simultaneousRequests = simultaneousRequests;
	this.done = done;

	if (typeof simultaneousRequests !== "number") {
		throw new Error("simultaneousRequests must be an integer; " + (typeof simultaneousRequests) + " passed");
	}
	if (simultaneousRequests < 1) {
		throw new Error("simultaneousRequests must be at least 1; " + simultaneousRequests + " passed");
	}

	this.responseTimes = {};
	for (pageName in this.benchmark.pages) {
		this.responseTimes[pageName] = {};
		for (engineName in this.benchmark.engines) {
			this.responseTimes[pageName][engineName] = [];
		}
	}

	this.totals = {};
};

BenchmarkContext.prototype.onDone = function () {
	var pageName,
		engineName,
		perPage = {};
	for (pageName in this.benchmark.pages) {
		perPage[pageName] = {};
		for (engineName in this.benchmark.engines) {
			perPage[pageName][engineName] = statistics.all(this.responseTimes[pageName][engineName]);
		}
	}
	this.done(this.simultaneousRequests, {
		perPage: perPage,
		totals: this.totals
	});
};

BenchmarkContext.prototype.requestPage = function (url, expectedLength, callback) {
	var timer = this.benchmark.timers.start();
	request(url, function (error, response, body) {
		var elapsed = timer.elapsed();
		if (error) {
			callback(new Error("An error occured while trying to process " + url + ": " + error), elapsed);
		} else {
			if (body.length !== expectedLength) {
				callback(new Error(
					"Response from " + url + " length is " + body.length + ";"
						+ " first response length was " + expectedLength
				), elapsed);
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
		function (err, total) {
			if (err) {
				console.log(err);
			} else {
				this.responseTimes[pageName][engineName].push(total);
			}
			over();
		}.bind(this)
	);
};

BenchmarkContext.prototype.runEngine = function (engineName, over) {
	var i,
		pageName,
		j,
		timer,
		tasks = 0,
		queue = new WorkingQueue(this.simultaneousRequests);
	queue.hold();
	for (i = 0; i < this.benchmark.options.iterations * this.simultaneousRequests; i++) {
		for (pageName in this.benchmark.pages) {
			for (j = 0; j < this.benchmark.pages[pageName].weight; j++) {
				queue.perform(this.runPage.bind(this), engineName, pageName);
				tasks++;
			}
		}
	}
	timer = this.benchmark.timers.start();
	queue.whenDone(function () {
		var timeout;
		this.totals[engineName] = {
			time: timer.elapsed(),
			tasks: tasks
		};

		timeout = 0;
		if (os.platform() === 'win32') {
			timeout = this.simultaneousRequests * 2000; //to workaround ENOBUFS
		}
		setTimeout(over, timeout);
	}.bind(this));
	queue.go();
};

BenchmarkContext.prototype.run = function () {
	var metaQueue,
		engineName;

	//TODO: replace this global state changing with something else
	http.globalAgent.maxSockets = this.simultaneousRequests;
	metaQueue = new WorkingQueue(1);
	metaQueue.hold();
	for (engineName in this.benchmark.engines) {
		metaQueue.perform(this.runEngine.bind(this), engineName);
	}
	metaQueue.whenDone(this.onDone.bind(this));
	metaQueue.go();
};

module.exports = BenchmarkContext;
