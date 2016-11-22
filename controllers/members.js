var LOG = require("winston"),
	// Promise = require("bluebird"),
	express = require("express"),
	evesso = require("../evesso"),
	bodyParser = require("body-parser"),
	Member = require("../models/Member"),
	path = require("path");

var router = express.Router();
var router_api = express.Router();
router_api.use(bodyParser.json());

// HTML routing

// member list/search page
router.get("/", evesso.reqPriv("members_view"), function(req, res, next) {
	res.render("members/list", {
		char_name: req.session.char_data ? req.session.char_data.CharacterName : ""
	});
});

// add new member page
router.get("/new", evesso.reqPriv("members_edit_info"), function(req, res, next) {
	res.render("members/detail", {
		char_name: req.session.char_data ? req.session.char_data.CharacterName : "",
		m: JSON.stringify({
			newflag: true
		})
	});
});

// member detail page
router.get("/:member", evesso.reqPriv("members_view"), function(req, res, next) {
	Member.read(req.params.member)
		.then(function(entity) {
			return res.render("members/detail", {
				char_name: req.session.char_data ? req.session.char_data.CharacterName : "",
				m: JSON.stringify(entity)
			});
		}).catch(function(err) {
			return next(err);
		});
});

/*
// error handling
router.use(function(err, req, res, next) {
	if (err) {
		if (err.code && err.code === 404) {
			return res.render("404");
		} else {
			return res.render("500", {
				err: JSON.stringify(err)
			});
		}
	} else {
		return next();
	}
});
*/

// API routing

// get member list/search
router_api.get("/", evesso.reqPriv("members_view"), function(req, res, next) {
	var P = null;
	if (req.query.CA) {
		P = Member.listByCA(req.query.CA)
			.then(function(entity) {
				res.json(entity);
			});
	} else if (req.query.FA) {
		P = Member.listByFA(req.query.FA)
			.then(function(entity) {
				res.json(entity);
			});
	} else {
		P = Member.list(100, null).then(function(data) {
			res.json(data.list);
		});
	}

	if (P) {
		P.catch(function(err) {
			LOG.warn("list err:", JSON.stringify(err, null, 1));
			return next(err);
		});
	}
});

// create new member
router_api.post("/", evesso.reqPriv("members_edit_info"), function(req, res, next) {
	LOG.info("create body:", JSON.stringify(req.body));
	var data = Member.typify(req.body);
	if (!data) {
		return next(new Error("data validation failed"));
	}
	Member.create(data).then(function(result) {
		res.status(201).set("Location", path.join(req.baseUrl, result.id)).json(result);
	}).catch(function(err) {
		return next(err);
	});
});

router_api.get("/:member", evesso.reqPriv("members_view"), function(req, res, next) {
	Member.read(req.params.member)
		.then(function(entity) {
			res.json(entity);
		}).catch(function(err) {
			return next(err);
		});
});

router_api.put("/:member", evesso.reqPriv("members_edit_info"), function(req, res, next) {
	LOG.info("update body:", JSON.stringify(req.body));
	var data = Member.typify(req.body);
	if (!data) {
		return next(new Error("data validation failed"));
	}
	Member.update(req.params.member, data).then(function(apiResponse) {
		res.json(apiResponse);
	}).catch(function(err) {
		return next(err);
	});
});

/*
// error handling
router_api.use(function(err, req, res, next) {
	if (err) {
		if (err.code) {
			return res.status(err.code).json(err).end();
		} else {
			LOG.warn("API error:", err);
			return res.status(500).json({
				code: 500,
				err: err.toString()
			}).end();
		}
	} else {
		next();
	}
});
*/

module.exports = {
	router: router,
	router_api: router_api
};
