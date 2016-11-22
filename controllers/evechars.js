var LOG = require("winston"),
	Promise = require("bluebird"),
	evesso = require("../evesso"),
	express = require("express"),
	bodyParser = require("body-parser"),
	EVEChar = require("../models/EVEChar");

var router_api = express.Router();
router_api.use(bodyParser.json());

/**
 * GET /api/books
 *
 * Retrieve a page of books (up to ten at a time).
 */
router_api.get("/", evesso.reqPriv("members_view"), function(req, res, next) {
	var P = EVEChar.list()
		.then(function(entity) {
			res.json(entity);
		});
	if (P) {
		P.catch(function(err) {
			return next(err);
		});
	}
});

router_api.post("/", evesso.reqPriv("members_edit_info"), function(req, res, next) {
	LOG.info("create body:", JSON.stringify(req.body));
	var data = null;
	var i = 0;
	if (req.body.length && req.body.length > 1) {
		// create multiple new chars
		data = [];
		for (i = 0; i < req.body.length; i++) {
			data.push(EVEChar.typify(req.body[i]));
			if (!data[i]) {
				return next(new Error("data validation failed"));
			}
		}

		var Ps = [];
		for (i = 0; i < data.length; i++) {
			Ps[i] = EVEChar.create(data[i].id, data[i]);
		}
		Promise.all(Ps).then(function(responses) {
			res.json(responses);
		}).catch(function(err) {
			LOG.warn("multicreate fail:", err);
			return next(err);
		});
	} else if (!req.body.length || req.body.length === 1) {
		// create just one new char
		data = req.body.length ? EVEChar.typify(req.body[0]) : EVEChar.typify(req.body);
		if (!data) {
			return next(new Error("data validation failed"));
		}
		EVEChar.create(data.id, data).then(function(apiResponse) {
			res.json(apiResponse);
		}).catch(function(err) {
			LOG.warn("create fail:", err);
			return next(err);
		});
	}
});

/**
 * GET /api/books/:id
 *
 * Retrieve a book.
 */
router_api.get("/:id", evesso.reqPriv("members_view"), function(req, res, next) {
	EVEChar.read(req.params.id)
		.then(function(entity) {
			res.json(entity);
		}).catch(function(err) {
			return next(err);
		});
});

/**
 * PUT /api/books/:id
 *
 * Update a book.
 */
router_api.put("/:pilot", function(req, res, next) {
	/*
  getModel().update(req.params.book, req.body, function (err, entity) {
    if (err) {
      return next(err);
    }
    res.json(entity);
  });
  */
});

/**
 * DELETE /api/books/:id
 *
 * Delete a book.
 */
router_api.delete("/:pilot", function(req, res, next) {
	/*
  getModel().delete(req.params.book, function (err) {
    if (err) {
      return next(err);
    }
    res.status(200).send('OK');
  });
  */
});

/**
 * Errors on "/api/books/*" routes.
 */
/*
router.use(function handleRpcError (err, req, res, next) {
  // Format error and forward to generic error handler for logging and
  // responding to the request
  err.response = {
    message: err.message,
    internalCode: err.code
  };
  next(err);
});
*/

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
	router_api: router_api
};
