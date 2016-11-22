var LOG = require("./log"),
	path = require("path"),
	http = require("http"),
	//mysql = require("mysql"),
	dsutil = require("./models/dsutil"),
	express = require("express"),
	session = require("express-session"),
	sqlStore = require("express-mysql-session")(session),
	memStore = require("connect-memcached")(session),
	rtime = require("response-time"),
	evesso = require("./evesso"),
	controllers = require("./controllers"),
	fs = require("fs"),
	extend = require("extend"),
	utils = require("./utils"),
	config = require("./config");

var app = express(),
	server = null,
	//pool,
	sess_store,
	sql_opts,
	sess_type = "MEM";

app.set("port", config.get("PORT"));
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "pug");
app.set("trust proxy", "loopback, linklocal, uniquelocal");
app.locals.pretty = true;
app.locals.cf_url = config.get("CF_URL");

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
LOG.info("init SQL connection pool");
sql_opts = {
	host: config.get("DB_HOST"),
	port: config.get("DB_PORT"),
	user: config.get("DB_USER"),
	password: config.get("DB_PASSWD"),
	database: config.get("DB_OLTP")
};
dsutil.createPool(extend({
	supportBigNumbers: true,
	connectionLimit: 5
}, sql_opts));

// setup session handling with mysql storage
LOG.info("setup session store");
if (sess_type === "SQL") {
	sess_store = new sqlStore(sql_opts);
} else if (sess_type === "MEM") {
	sess_store = new memStore({
		hosts: ["localhost:11211"],
		secret: "IAmMeatPopsicle"
	});
}
app.use(session({
	secret: "IAmMeatPopsicle",
	resave: false,
	saveUninitialized: true,
	cookie: {
		path: "/",
		httpOnly: true,
		secure: false,
		maxAge: null
	},
	store: sess_store
}));

// track request processing times
app.use(rtime(function(req, res, time) {
	LOG.info("spent %dms processing %s", Math.round(time), req.originalUrl);
}));

// use evesso MW for session & user validation
app.use(evesso.middleware);

// use evesso router for login flow
app.use(evesso.router);

// load our controller routes
app.use(controllers);

// error handling
app.use(function(err, req, res, next) {
	LOG.error("application error\n", err);
	if (res.headersSent) {
		return next(err);
	}

	if (utils.wantsJson(req)) {
		return res.status(500).json({
			code: 500,
			err: err
		}).end();

	} else {
		return res.status(500).res.render("500", {
			err: err
		}).end();
	}
});

// 404 for anything else
app.use(function(req, res, next) {
	return res.status(404).render("404");
});

// graceful shutdown on sigint
process.on("SIGINT", function() {
	LOG.info("server shutdown...");
	server.close(function() {
		LOG.info("clean up session store");
		if (sess_type === "SQL") {
			sess_store.closeStore();
		}
		LOG.info("close SQL pool");
		dsutil.endPool(function() {
			LOG.info("goodbye!");
			process.exit(0);
		});
	});
});

// start the server and get busy!
server = http.createServer(app).listen(app.get("port"), function() {
	LOG.info("express start on port %d", server.address().port);
});
