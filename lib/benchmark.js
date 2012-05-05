"use strict";

var request = require('request');
var WorkingQueue = require('capisce').WorkingQueue;
var http = require('http');
var os = require('os');

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
	temporalDisrepancy: function (list) {
		var sliceLength = Math.min(list.length / 2, 8);
		return Math.round(100 * this.trimmedMean(list.slice(-sliceLength)) / this.trimmedMean(list.slice(0, sliceLength))) / 100;
	},
	sort: function (list) {
		if (!list.sorted) {
			list.sort(function (a, b) { return (a - b); });
			list.sorted = true;
		}
	},
	median: function (list) {
		this.sort(list);
		if (list.length % 2 == 0) {
			return Math.round((list[list.length / 2 - 1] + list[list.length / 2]) / 2);
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
	trimmedMean: function (list) {
		if (list.length < 4) {
			return this.median(list);
		}
		this.sort(list);
		return this.mean(list.slice(list.length / 4, 3 * list.length / 4 - 1));
	},
	max: function (list) {
		return Math.max.apply(null, list);
	},
	all: function (list) {
		//console.log(list);
		var temporalDisrepancy = this.temporalDisrepancy(list);
		var mean = this.mean(list);
		var max = this.max(list);
		var num = list.length;
		this.sort(list);
		var median = this.median(list);
		var trimmedMean = this.trimmedMean(list);
		var top10 = this.mean(list.slice(0, list.length / 10));
		var bottom10 = this.mean(list.slice(-list.length / 10));
		var result = {
			trimmedMean: trimmedMean
			, median: median
			, temporalDisrepancy: temporalDisrepancy
			, mean: mean
			, max: max
			, num: num
			, top10: top10
			, bottom10: bottom10
		};
		//console.log(result);
		return result;
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
		this.benchmark.pages[pageName].expectedLength[engineName],
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

Benchmark.prototype.doRun = function (simultaneousRequests, callback, over) {
	var context = new BenchmarkContext(this, simultaneousRequests, callback);
	context.run(function (simultaneousRequests, stats) {
		callback(simultaneousRequests, stats);
		over();
	});
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
