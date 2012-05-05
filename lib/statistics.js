"use strict";

var internals = {
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
	}
};

exports.all = function (list) {
	var temporalDisrepancy = internals.temporalDisrepancy(list);
	var mean = internals.mean(list);
	var max = internals.max(list);
	var num = list.length;
	internals.sort(list);
	var median = internals.median(list);
	var trimmedMean = internals.trimmedMean(list);
	var top10 = internals.mean(list.slice(0, list.length / 10));
	var bottom10 = internals.mean(list.slice(-list.length / 10));
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
};

