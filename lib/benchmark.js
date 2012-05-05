"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;

var BenchmarkContext = require('./benchmark-context');
var dateTimer = require('./timers/datetimer');
var statisticsDisplay = require('./statistics-display');

var TIMERTYPES = {
	DATETIMER: 'datetimer'
};

var getTimer = function (timerType) {
	switch (timerType) {
	case TIMERTYPES.DATETIMER:
		return dateTimer;
	default:
		throw new Error("Unknown timer type " + timerType);
	}
};

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
};

Benchmark.prototype.fillExpectedLength = function (pageName, engineName, over) {
	var url = this.engines[engineName] + this.pages[pageName].url;
	request(url, function (error, response, body) {
		if (error) {
			throw new Error("An error occured while trying to process " + url + ": " + error);
		} else {
			this.pagesExpectedLength[pageName][engineName] = body.length;
			over();
		}
	}.bind(this));
};

Benchmark.prototype.init = function (done) {
	var pageName,
		queue,
		engineName;
	if (this.pagesExpectedLength) {
		process.nextTick(done);
	} else {
		this.pagesExpectedLength = {};
		for (pageName in this.pages) {
			this.pagesExpectedLength[pageName] = {};
		}
		queue = new WorkingQueue(1);
		queue.whenDone(done);
		for (pageName in this.pages) {
			for (engineName in this.engines) {
				queue.perform(this.fillExpectedLength.bind(this), pageName, engineName);
			}
		}
		queue.go();
	}
};

Benchmark.prototype.doRun = function (simultaneousRequests, callback, over) {
	this.init(function () {
		var context = new BenchmarkContext(this, simultaneousRequests, function (simultaneousRequests, stats) {
			callback(simultaneousRequests, stats);
			over();
		});
		context.run();
	}.bind(this));
};

//callback is function(simultaneousRequests, stats)
Benchmark.prototype.run = function (simultaneousRequests, callback) {
	this.doRun(simultaneousRequests, callback, function () { });
};

//callback is function(simultaneousRequests, stats)
Benchmark.prototype.runMultiple = function (simultaneousRequestsList, callback, done) {
	var i,
		queue = new WorkingQueue(1);
	queue.hold();
	for (i = 0; i < simultaneousRequestsList.length; i++) {
		queue.perform(this.doRun.bind(this), simultaneousRequestsList[i], callback);
	}
	queue.whenDone(done);
	queue.go();
};

Benchmark.statisticsDisplay = statisticsDisplay;

module.exports = Benchmark;
