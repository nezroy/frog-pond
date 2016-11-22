var LOG = require("winston"),
	// Promise = require("bluebird"),
	express = require("express"),
	crest = require("../crest"),
	evesso = require("../evesso"),
	crypto = require("crypto"),
	EVEChar = require("../models/EVEChar"),
	Member = require("../models/Member"),
	config = require("../config");
//bodyParser = require("body-parser");
//Member = require("../models/Member");
//path = require("path");

var router = express.Router();
//var router_api = express.Router();
//router_api.use(bodyParser.json());

var pond_client = crest.getClient();

// HTML routing

// profile page
router.get("/", evesso.reqPriv("tokens_edit_own"), function(req, res, next) {
	return res.render("profile/index", {
		m: res.locals.auth_usr
	});
});

// token manage page
router.get("/tokens", evesso.reqPriv("tokens_edit_own"), function(req, res, next) {
	LOG.debug("list tokens");
	res.render("profile/tokens", {});
});

// token add
var token_ver = 1; // if below scopes change, ver should be incremented
var token_scope = "characterContactsRead characterContactsWrite characterContractsRead characterNavigationWrite corporationContactsRead corporationMembersRead publicData remoteClientUI";
router.get("/tokens/add", evesso.reqPriv("tokens_edit_own"), function(req, res, next) {
	LOG.debug("add new token");
	var sess = req.session;
	sess.tokcb_state = crypto.randomBytes(10).toString("hex");
	sess.save();

	var auth = pond_client.getAuthorizeUrl();
	auth += "&response_type=code&scope=" + token_scope + "&redirect_uri=" + config.get("PONDAPP_CALLBACK") + "&state=" + sess.tokcb_state;
	LOG.debug("oauth url: " + auth);

	res.redirect(302, auth);
});

router.get("/tokens/callback", evesso.reqPriv("tokens_edit_own"), function(req, res, next) {
	var sess = req.session;
	var cb_code = req.query.code;
	var cb_state = req.query.state;
	var access_token = null;
	var refresh_token = null;
	var results = null;
	var usr = evesso.curUser(req, res);

	if (!cb_state || cb_state != sess.tokcb_state) {
		LOG.warn("OAuth callback state did not match our session state");
		return res.redirect(303, "/profile/tokens?err=OAUTH");
	}

	pond_client.getOAuthAccessTokenP(cb_code, {
			grant_type: "authorization_code"
		})
		.then(function(args) {
			access_token = args[0];
			refresh_token = args[1];
			results = args[2];
			if (!access_token || !refresh_token) {
				throw new Error("missing tokens");
			}
			return access_token;
		})
		.then(evesso.loadCharFromToken)
		.then(function(echar) {
			// now have a valid EVEChar in DB decoded from the token
			if (!(usr instanceof Member)) {
				throw new Error("only members can add tokens");
			}

			// save refresh token to DB
			return echar.setTokenDB(usr.ID, refresh_token, token_ver);
		})
		.then(function(echar) {
			// save access token info to the char
			// echar.setAccessToken(access_token, results.expires_in);

			// force user to update on next reload to pickup new token/char mapping
			evesso.forceUserUpdateOnReload();

			// all done, go back to token listing
			res.redirect(303, "/profile/tokens");
		})
		.catch(function(err) {
			LOG.warn("failed to add new char token\n", err);
			res.redirect(303, "/profile/tokens?err=CHARDATA");
		});
});

router.get(["/token/:charid/crest/", "/token/:charid/crest/*"], evesso.reqPriv("tokens_edit_own"), function(req, res, next) {
	var sess = req.session;
	var charid = req.params.charid;
	var func = req.path.replace(new RegExp(".*/crest/"), "");
	func = "/" + func;
	LOG.debug("process crest req for id: " + charid + "; func: " + func);

	if (!sess["echar_" + charid]) {
		LOG.warn("echar details not found in session");
		return res.status(500).render("500", {
			err: "echar details not found in session"
		});
	}

	var echar = (new EVEChar()).fromSession(sess["echar_" + charid]);
	crest.get(echar.accessToken, func)
		.then(function(data) {
			data = JSON.parse(data);
			return res.status(200).render("500", {
				err: JSON.stringify(data, null, 1)
			});
		})
		.caught(function(err) {
			LOG.error("crest err\n", err);
			return res.status(500).render("500", {
				err: err.message
			});
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

module.exports = {
	router: router
};
