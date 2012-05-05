"use strict";

var internals = {
	temporalDisrepancy: function (list) {
		var sliceLength = Math.min(list.length / 2, 8),
			computed = this.trimmedMean(list.slice(-sliceLength)) / this.trimmedMean(list.slice(0, sliceLength));
		return Math.round(100 * computed) / 100; //rounding to the percents
	},
	sort: function (list) {
		if (!list.sorted) {
			list.sort(function (a, b) { return (a - b); });
			list.sorted = true;
		}
	},
	median: function (list) {
		this.sort(list);
		if (list.length % 2 === 0) {
			return Math.round((list[list.length / 2 - 1] + list[list.length / 2]) / 2);
		} else {
			return list[(list.length - 1) / 2];
		}
	},
	mean: function (list) {
		var i,
			total = 0;
		for (i = 0; i < list.length; i++) {
			total += list[i];
		}
		return Math.round(total / list.length);
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
	}
};

exports.all = function (list) {
	var temporalDisrepancy,
		mean,
		max,
		num,
		median,
		trimmedMean,
		top10,
		bottom10,
		result;

	temporalDisrepancy = internals.temporalDisrepancy(list);
	mean = internals.mean(list);
	max = internals.max(list);
	num = list.length;
	internals.sort(list);
	median = internals.median(list);
	trimmedMean = internals.trimmedMean(list);
	top10 = internals.mean(list.slice(0, list.length / 10));
	bottom10 = internals.mean(list.slice(-list.length / 10));
	result = {
		trimmedMean: trimmedMean,
		median: median,
		temporalDisrepancy: temporalDisrepancy,
		mean: mean,
		max: max,
		num: num,
		top10: top10,
		bottom10: bottom10
	};
	//console.log(result);
	return result;
};

