var LOG = require("winston"),
	config = require("./config"),
	Promise = require("bluebird"),
	//utils = require("./utils"),
	https = require("https"),
	url = require("url"),
	Oauth = require("oauth").OAuth2,
	//crypto = require("crypto"),
	pkginfo = require(__dirname + "/package.json");

var HOSTS = {
	crest: "crest-tq.eveonline.com",
	imgsrv: "imageserver.eveonline.com",
	login: "https://login.eveonline.com/"
}; // prod
/*
var HOSTS = {
	crest: "crest-sisi.testeveonline.com",
	imgsrv: "imageserver.testeveonline.com",
	login: "https://sisilogin.testeveonline.com/"
}; // dev
*/

function getClient(id, key) {
	if (!id) id = config.get("PONDAPP_CLIENT_ID");
	if (!key) key = config.get("PONDAPP_SECRET_KEY");
	var client = new Oauth(
		id,
		key,
		HOSTS.login,
		"oauth/authorize",
		"oauth/token"
	);
	client.useAuthorizationHeaderforGET(true);
	client.getOAuthAccessTokenP = Promise.promisify(client.getOAuthAccessToken, {
		context: client,
		multiArgs: true
	});
	return client;
}

function get(token, path) {
	if (!token || !path) {
		return Promise.reject(new Error("invalid args"));
	}

	var opts = {
		hostname: HOSTS.crest,
		protocol: "https:",
		method: "GET",
		headers: {
			"User-Agent": "RFF Frog Pond app v" + pkginfo.version,
			Authorization: "Bearer " + token
		},
		path: url.parse(path).path
	};
	LOG.info(opts);

	// create our API request    
	var req = https.request(opts);

	return new Promise(function(resolve, reject) {
		// handle error/abort on the request object; an abort would only be in the case of 
		// a request for graceful shutdown
		req.on("error", function(err) {
			return reject(err);
		});
		req.on("abort", function() {
			return reject(new Error("request aborted"));
		});

		req.on("response", function(resp) {
			var data = [];
			// handle response data from the request
			LOG.info("resp status: " + resp.statusCode);
			if (resp.statusCode !== 200) {
				return reject(new Error("failed response: " + resp.statusCode));
			}

			// handle error/abort on the response object
			resp.on("error", function(err) {
				reject(err);
			});
			resp.on("aborted", function() {
				reject(new Error("response aborted"));
			});

			// get data flow to array then resolve with this data
			resp.on("data", function(chunk) {
				data.push(chunk);
			});
			resp.on("end", function() {
				return resolve(data.join(""));
			});
		});
		req.end();
	});
}

module.exports = {
	getClient: getClient,
    get: get
};
