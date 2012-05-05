"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;

var BenchmarkContext = require('./benchmark-context');
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
}

Benchmark.prototype.fillExpectedLength = function (pageName, engineName, over) {
	var url = this.engines[engineName] + this.pages[pageName].url;
	request(url, (function (error, response, body) {
		if (error) {
			throw new Error("An error occured while trying to process " + url + ": " + error);
		} else {
			this.pagesExpectedLength[pageName][engineName] = body.length;
			over();
		}
	}).bind(this));
}

Benchmark.prototype.init = function (done) {
	if (this.pagesExpectedLength) {
		process.nextTick(done);
	} else {
		this.pagesExpectedLength = {};
		for (var pageName in this.pages) {
			this.pagesExpectedLength[pageName] = {};
		}
		var queue = new WorkingQueue(1);
		queue.whenDone(done);
		for (var pageName in this.pages) {
			for (var engineName in this.engines) {
				queue.perform(this.fillExpectedLength.bind(this), pageName, engineName);
			}
		}
		queue.go();
	}
}

Benchmark.prototype.doRun = function (simultaneousRequests, callback, over) {
	this.init((function () {
		var context = new BenchmarkContext(this, simultaneousRequests, callback);
		context.run(function (simultaneousRequests, stats) {
			callback(simultaneousRequests, stats);
			over();
		})
	}).bind(this));
}

//callback is function(simultaneousRequests, stats)
Benchmark.prototype.run = function (simultaneousRequests, callback) {
	this.doRun(simultaneousRequests, callback, function () { });
}

//callback is function(simultaneousRequests, stats)
Benchmark.prototype.runMultiple = function (simultaneousRequestsList, callback, done) {
	var queue = new WorkingQueue(1);
	queue.hold();
	for (var i in simultaneousRequestsList) {
		queue.perform(this.doRun.bind(this), simultaneousRequestsList[i], callback);
	}
	queue.whenDone(done);
	queue.go();
}

Benchmark.prototype.showStats = function (simultaneousRequests, stats) {
	var Table = require('cli-table');
	console.log("Statistics for " + simultaneousRequests + " simultaneous requests");
	for (var engineName in stats.totals) {
		console.log("Processing " + engineName + " took " + stats.totals[engineName].time + " (" + (stats.totals[engineName].time / stats.totals[engineName].tasks) + " per request)");
	}
	for (var pageName in stats.perPage) {
		console.log(pageName);
		var table = new Table({
			head: [
				'Engine',
				'Trimmed mean',
				'Median',
				'Temporal disrepancy',
				'Mean',
				'Top 10%',
				'Bottom 10%',
				'Max',
				'Sample size'
			],
			colWidths: [
				15,
				14,
				8,
				21,
				8,
				9,
				12,
				8,
				13
			],
			colAligns: [
				'left',
				'right',
				'right',
				'right',
				'right',
				'right',
				'right',
				'right',
				'right'
			]
		});
		for (var engineName in stats.perPage[pageName]) {
			var entry = stats.perPage[pageName][engineName];
			table.push([
				engineName,
				entry.trimmedMean,
				entry.median,
				entry.temporalDisrepancy,
				entry.mean,
				entry.top10,
				entry.bottom10,
				entry.max,
				entry.num
			]);
		}
		console.log(table.toString());
		console.log();
	}
}

module.exports = Benchmark;
