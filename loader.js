var LOG = require("./log"),
	mysql = require("mysql"),
	extend = require("extend"),
	Promise = require("bluebird"),
	https = require("https"),
	fs = require("fs"),
	path = require("path"),
	xml2js = require("xml2js"),
	crypto = require("crypto"),
	config = require("./config");

var xml = new xml2js.Parser({
	async: true,
	normalizeTags: true
});
xml.parseStringP = Promise.promisify(xml.parseString, {
	context: xml
});
fs.renameP = Promise.promisify(fs.rename);
fs.readFileP = Promise.promisify(fs.readFile);
fs.writeFileP = Promise.promisify(fs.writeFile);

var pool,
	sql_opts,
	timer,
	rl,
	req,
	rff2json;

var dest_tmp = path.join(config.get("TMP_PATH"), "contracts_latest_tmp.xml");
var dest_end = path.join(config.get("TMP_PATH"), "contracts_latest.xml");
var json_tmp = path.join(config.get("TMP_PATH"), "rff_contract_oltp_tmp.json");
var json_end = path.join(config.get("TMP_PATH"), "rff_contract_oltp.json");

var TypeEnum = {
	"Courier": 1,
	"ItemExchange": 2
};
var StatusEnum = {
	"Completed": 1,
	"Deleted": 2,
	"Failed": 3,
	"Rejected": 4,
	"Outstanding": 5,
	"InProgress": 6
};
var AvailEnum = {
	"Private": 1,
	"Public": 2
};

// create local tmp store
LOG.info("checking tmp store");
try {
	fs.mkdirSync(config.get("TMP_PATH"));
} catch (err) {
	if (err.code !== "EEXIST") {
		LOG.error("failed to create tmp store:", JSON.stringify(err, 1));
		process.exit(1);
	}
}

// create SQL connection pool
// assumes DB has already been setup (see schema_*.sql)
LOG.info("init SQL connection pool");
sql_opts = {
	host: config.get("DB_HOST"),
	port: config.get("DB_PORT"),
	user: config.get("DB_USER"),
	password: config.get("DB_PASSWD"),
	database: config.get("DB_NAME")
};
pool = mysql.createPool(extend({
	supportBigNumbers: true,
	connectionLimit: 1
}, sql_opts));
pool.getConnectionP = Promise.promisify(pool.getConnection, {
	context: pool
});

// graceful close
if (process.platform === "win32") {
	rl = require("readline")
		.createInterface({
			input: process.stdin,
			output: process.stdout
		});
	rl.on("SIGINT", function() {
		process.emit("SIGTERM");
	});
}
process.on("SIGTERM", function() {
	LOG.info("shutting down...");
	if (rl) rl.close();
	if (timer) clearTimeout(timer);
	timer = -1;
	if (pool) pool.end();
	if (req) req.abort();
});

// start the handling loop
timer = setTimeout(dostuff, 1);

function dostuff() {
	var xmlstr = null;
	var cachetime = null;
	var rows = null;
	var P;
	if (config.get("latest")) {
		// read XML from latest file, don't contact API server
		LOG.debug("read from latest file");
		P = fs.readFileP(dest_end, "utf8")
			.then(function(dat) {
				if (timer !== -1) {
					xmlstr = dat;
					LOG.debug("read file finished");
				}
			});
	} else {
		// read XML from API server
		LOG.debug("start download");
		P = download()
			.then(function(xmldat) {
				req = null;
				if (timer !== -1) {
					// turn the array into string buffer for XML parsing
					xmlstr = xmldat.join("");

					// move the downloaded file to the latest file
					LOG.debug("download finished, rename");
					return fs.renameP(dest_tmp, dest_end);
				}
			});
	}

	P.then(function() {
			// parse the XML provided by download or file
			if (!xmlstr) throw new Error("no XML to parse");
			if (timer !== -1) {
				LOG.info("parsing XML");
				return xml.parseStringP(xmlstr);
			}
		})
		.then(function(x) {
			// process the parsed XML for validity and times
			var e = x.eveapi;
			var curtime;
			if (timer !== -1) {
				LOG.debug("xml parsed");
				xml.reset();
				if (!e || !e.$ || e.$.version !== "2") {
					throw new Error("unrecognized data source; eveapi version not understood");
				}
				LOG.debug("eveapi version: " + e.$.version);

				LOG.debug("current time: " + e.currenttime[0]);
				LOG.debug("cached until: " + e.cacheduntil[0]);
				curtime = Date.parse(e.currenttime[0] + " UTC");
				cachetime = new Date(e.cacheduntil[0] + " UTC");
				if (Math.abs(curtime - Date.now()) > 3000) {
					LOG.warn("skew detected between data now and system now");
				}

				LOG.debug("results: " + e.result[0].rowset[0].row.length);
				rows = e.result[0].rowset[0].row;

				LOG.debug("get DB connection");
				return pool.getConnectionP();
			}
		})
		.then(function(c) {
			c.queryP = Promise.promisify(c.query, {
				context: c,
				multiArgs: true
			});

			// update DB with some processing info for the front-end to use as desired
			return c.queryP("USE frogpond_oltp")
				.then(function() {
					if (timer === -1) return;
					return c.queryP("UPDATE prog_attr SET AttrVal = '" + Date.now() + "' WHERE ID = 'last_processed'");
				})
				.then(function() {
					if (timer === -1) return;
					return c.queryP("UPDATE prog_attr SET AttrVal = 'parsing rows' WHERE ID = 'process_state'");
				})
				.then(function() {
					if (timer === -1) return;
					return c.queryP("UPDATE prog_attr SET AttrVal = '" + cachetime.getTime() + "' WHERE ID = 'cached_until'");
				})
				.then(function() {
					if (timer === -1) return;
					// clear the buffer we use to track contracts we'll put to JSON; parseRow updates this
					rff2json = {};

					// iterate serially through the rows in the XML result set calling parseRow on each
					return Promise.each(rows, function(item, idx, len) {
						return parseRow(item, c);
					});
				})
				.then(function() {
					if (timer === -1) return;
					return c.queryP("USE frogpond_oltp");
				})
				.then(function() {
					if (timer === -1) return;
					return c.queryP("UPDATE prog_attr SET AttrVal = 'dumping json' WHERE ID = 'process_state'");
				})
				.then(function() {
					if (timer === -1) return;
					LOG.debug("writing JSON file");
					var jsonstr = JSON.stringify({
						CachedUntil: cachetime.getTime(),
						Contracts: rff2json
					}, null, 1);
					return fs.writeFileP(json_tmp, jsonstr);
				})
				.then(function() {
					if (timer === -1) return;
					// move the tmp json file to final
					LOG.debug("JSON write finished, rename");
					return fs.renameP(json_tmp, json_end);
				})
				.then(function() {
					if (timer === -1) return;
					return c.queryP("UPDATE prog_attr SET AttrVal = 'finished' WHERE ID = 'process_state'");
				})
				.finally(function() {
					if (timer === -1) return;
					LOG.debug("release DB connection");
					c.release();
				});
		})
		.then(function() {
			// if all is well, wait until the XML data cache expires
			var snooze = cachetime.getTime() - Date.now();
			if (snooze < 5000) snooze = 5000;
			snooze += 3000;
			if (timer !== -1 && !config.get("latest")) {
				LOG.info("snooze until " + cachetime);
				timer = setTimeout(dostuff, snooze);
			} else if (config.get("latest")) {
				if (pool) pool.end();
				if (rl) rl.close();
			}
		})
		.catch(CleanStopError, function(err) {
			// this error type should only occur when a graceful shutdown has been requested
			req = null;
			if (pool) pool.end();
			if (rl) rl.close();
		})
		.catch(function(err) {
			req = null;
			LOG.error(err);
			if (timer !== -1 && !config.get("latest")) {
				LOG.info("error; retry in 1 minute");
				timer = setTimeout(dostuff, 60 * 1000);
			} else if (config.get("latest")) {
				if (pool) pool.end();
				if (rl) rl.close();
			}
		})
		.done();
}

function download() {
	// download the contract XML data from API into a file and also stick it into a string
	var api_path = "/corp/Contracts.xml.aspx?keyID=" + config.get("API_KEY_ID") + "&vCode=" + config.get("API_V_CODE") + "&corporationID=" + config.get("API_CORP_ID");
	var xml_from_req = [];

	return new Promise(function(resolve, reject) {
		// create a writeable filestream target
		var file = fs.createWriteStream(dest_tmp);

		// create our API request
		req = https.request({
			method: "GET",
			hostname: "api.eveonline.com",
			path: api_path
		});
		LOG.info("create request for: " + api_path);

		// handle completion and error on the file stream; the only "success" condition for this
		// entire workflow is if the file finishes with no rejections prior
		file.on("finish", function() {
			resolve(xml_from_req);
			LOG.debug("file finish");
		});
		file.on("error", function(err) {
			reject(err);
			LOG.debug("file error");
		});

		// handle error/abort on the request object; an abort would only be in the case of 
		// a request for graceful shutdown
		req.on("error", function(err) {
			reject(err);
			file.end();
		});
		req.on("abort", function() {
			reject(new CleanStopError());
			file.end();
		});

		req.on("response", function(resp) {
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

			// pipe the respone read stream to the file write stream; also stick response data into
			// an array that will be turned into an XML buffer later (to avoid having to re-read the file)
			LOG.info("piping to file: " + dest_tmp);
			resp.on("data", function(chunk) {
				xml_from_req.push(chunk);
			});
			resp.pipe(file);
		});
		req.end();
	});
}

function parseRow(r, c) {
	if (timer === -1) {
		return Promise.reject(new CleanStopError());
	}

	// build a contract object from the XML row data
	var con = {};
	var cid = r.$.contractID;
	con.IssuerID = r.$.issuerID;
	con.IssuerCorpID = r.$.issuerCorpID;
	con.AssigneeID = r.$.assigneeID ? r.$.assigneeID : 0;
	con.AcceptorID = r.$.acceptorID ? r.$.acceptorID : 0;
	con.StartStationID = r.$.startStationID;
	con.EndStationID = r.$.endStationID;
	con.TypeEnum = TypeEnum.hasOwnProperty(r.$.type) ? TypeEnum[r.$.type] : 0;
	con.StatusEnum = StatusEnum.hasOwnProperty(r.$.status) ? StatusEnum[r.$.status] : 0;
	con.CorpFlag = r.$.forCorp;
	con.AvailEnum = AvailEnum.hasOwnProperty(r.$.availability) ? AvailEnum[r.$.availability] : 0;
	con.Title = r.$.title;
	con.DateIssued = new Date(Date.parse(r.$.dateIssued + " UTC"));
	con.DateExpired = new Date(Date.parse(r.$.dateExpired + " UTC"));
	con.DateAccepted = r.$.dateAccepted ? new Date(Date.parse(r.$.dateAccepted + " UTC")) : null;
	con.DateCompleted = r.$.dateCompleted ? new Date(Date.parse(r.$.dateCompleted + " UTC")) : null;
	con.NumDays = r.$.numDays;
	con.Reward = r.$.reward;
	con.Collateral = r.$.collateral;
	con.Volume = r.$.volume;
	con.Price = r.$.price;
	con.Buyout = r.$.buyout;
	con.ChangeHash = crypto.createHash("md5").update(JSON.stringify(con)).digest("hex");

	return c.queryP("USE frogpond_olap")
		.then(function() {
			// query if contract is in OLAP
			return c.queryP("SELECT ID, ChangeHash FROM contract WHERE ID = ?", [cid]);
		})
		.then(function(a) {
			// insert or update contract details in OLAP as needed
			var res = a[0];
			if (res.length === 0) {
				LOG.info("OLAP insert data for contract ID: " + cid);
				return c.queryP("INSERT INTO contract SET ID = " + mysql.escape(cid) + ", ?", con);
			} else if (res.length === 1 && res[0].ChangeHash !== con.ChangeHash) {
				LOG.info("OLAP update data for contract ID: " + cid);
				return c.queryP("UPDATE contract SET ? WHERE ID = " + mysql.escape(cid), con);
			} else {
				LOG.debug("OLAP nothing to do for contract ID: " + cid);
			}
		})
		.then(function() {
			// see if contract needs to go into OLTP (courier assigned to RFF or BFL)
			if (con.TypeEnum !== 1) return false;
			if (con.AssigneeID !== "1495741119" && con.AssigneeID !== "384667640") return false;
			return c.queryP("USE frogpond_oltp");
		})
		.then(function(p) {
			if (p === false) return;

			// strip contract things not used in OLTP
			var aid = con.AssigneeID;
			delete con.AssigneeID;
			delete con.TypeEnum;
			delete con.CorpFlag;
			delete con.AvailEnum;
			delete con.Buyout;
			delete con.Price;
			delete con.ChangeHash;
			con.ChangeHash = crypto.createHash("md5").update(JSON.stringify(con)).digest("hex");

			// query if contract is in OLTP
			if (aid === "1495741119") {
				// TODO: check RFF validity
				con.ValidFlag = 1;
				// push not-completed RFF contracts to the JSON buffer
				if (con.StatusEnum != 1) {
					rff2json[cid] = con;
				}
				return c.queryP("SELECT ID, ChangeHash FROM rff_contract WHERE ID = ?", [cid]);
			} else {
				// TODO: check BFL validity
				con.ValidFlag = 1;
				return c.queryP("SELECT ID, ChangeHash FROM bfl_contract WHERE ID = ?", [cid]);
			}
		})
		.then(function(a) {
			// insert or update contract details in OLTP as needed
			if (!a) return;
			var res = a[0],
				fld = a[1];
			var tbl = fld[0].table;

			if (res.length === 0) {
				LOG.info("OLTP insert data for contract ID: " + cid);
				return c.queryP("INSERT INTO " + tbl + " SET ID = " + mysql.escape(cid) + ", ?", con);
			} else if (res.length === 1 && res[0].ChangeHash !== con.ChangeHash) {
				LOG.info("OLTP update data for contract ID: " + cid);
				return c.queryP("UPDATE " + tbl + " SET ? WHERE ID = " + mysql.escape(cid), con);
			} else {
				LOG.debug("OLTP nothing to do for contract ID: " + cid);
			}
		});
}

function CleanStopError() {
	this.message = "clean stop";
	var error = new Error(this.message);
	this.stack = error.stack;
}
CleanStopError.prototype = Object.create(Error.prototype);
CleanStopError.prototype.name = CleanStopError.name;
CleanStopError.prototype.constructor = CleanStopError;
