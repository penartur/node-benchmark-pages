module.exports = {
	paths: [ "./**/*.js" ],
	linter: "jslint",
	linterOptions: {
		maxlen: 120,
		node: true,
		devel: true,
		forin: true,
		plusplus: true
	},
	excludes: ["node_modules"]
};
