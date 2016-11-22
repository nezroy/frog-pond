var nconf = module.exports = require("nconf"),
	path = require("path");

var conf_file = "config.json";

nconf.argv().env(["PORT"]).file({
	file: path.join(__dirname, conf_file)
}).defaults({
	PORT: 8080,
    DB_HOST: "localhost",
	DB_PORT: 3306,
	COOKIE_SECURE: true
});

// Check for required settings
checkReq(["DB_HOST", "DB_OLTP", "DB_OLAP", "DB_USER", "DB_PASSWD"]);

function checkReq(settings) {
	var i;
	for (i = 0; i < settings.length; i++) {
		if (!nconf.get(settings[i])) {
			throw new Error("required config [" + settings[i] + "] is missing");
		}
	}
}
