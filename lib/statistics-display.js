"use strict";

exports.showCliTable = function (simultaneousRequests, stats) {
	var table,
		engineName,
		pageName,
		entry,
		Table = require('cli-table');

	console.log("Statistics for " + simultaneousRequests + " simultaneous requests");
	for (engineName in stats.totals) {
		console.log(
			"Processing " + engineName + " took " + stats.totals[engineName].time +
				" (" + (stats.totals[engineName].time / stats.totals[engineName].tasks) + " per request)"
		);
	}
	for (pageName in stats.perPage) {
		console.log(pageName);
		table = new Table({
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
		for (engineName in stats.perPage[pageName]) {
			entry = stats.perPage[pageName][engineName];
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
};
