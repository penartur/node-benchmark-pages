"use strict";

exports.start = function () {
	var start = new Date().getTime();
	return {
		elapsed: function () {
			return new Date().getTime() - start;
		}
	};
};
