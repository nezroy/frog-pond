var logger = require("winston");

logger.remove(logger.transports.Console);
logger.add(logger.transports.Console, {
	colorize: true,
	timestamp: function() {
		var date = new Date();
		return date.toISOString();
	},
	level: "debug"
});

module.exports = logger;
