var LOG = require("winston"),
	config = require("./config"),
	express = require("express"),
	Promise = require("bluebird"),
	EVEChar = require("./models/EVEChar"),
	EVECorp = require("./models/EVECorp"),
	User = require("./models/User"),
	Member = require("./models/Member"),
	AnonUser = require("./models/AnonUser"),
	utils = require("./utils"),
    crest = require("./crest"),
	crypto = require("crypto");

var router = express.Router();

var sso_client = crest.getClient(config.get("SSOAPP_CLIENT_ID"), config.get("SSOAPP_SECRET_KEY"));

// figure out where to put this later
var privs = {
	tokens_edit_own: "Manage own CREST tokens",
	contracts_view_own: "View own contract status",
	contracts_view_corp: "View corp contract status",
	trip_calc_edit: "Edit the trip calculator page's content",
	rff_menu_view: "Show RFF section of menu",
	rff_dash_view: "View the RFF pilot dashboard",
	rff_mgrdash_view: "View the RFF manager's dashboard",
	rff_manual_view: "View the RFF manual link",
	rff_faq_edit: "Edit the RFF FAQ page's content",
	rff_ncf_view_valid: "View valid contracts on the RFF NCF page",
	rff_ncf_view_invalid: "View invalid contracts on the RFF NCF page",
	rff_ncf_reject: "Reject contracts on the RFF NCF page",
	rff_ncf_edit: "Edit the RFF NCF page's content",
	rff_members_view: "View the RFF member page",
	rff_members_edit_own: "Edit things about own user only (CA swap, FA add, API keys, etc.)",
	rff_members_edit_info: "Edit basic RFF member info of all members",
	rff_members_edit_roles: "Edit RFF member roles of all members"
};
var priv_funcs = {
	unknown: function(req, res, next) {
		if (utils.wantsJson(req)) {
			return res.status(403).json({
				code: 403,
				err: "UNKPRIV"
			});
		} else {
			return res.redirect(303, "/login?err=UNKPRIV");
		}
	}
};

function reqPriv(priv) {
	if (!privs.hasOwnProperty(priv)) {
		LOG.warn("unrecognized priv specified: " + priv);
		priv = "unknown";
	}

	if (!priv_funcs.hasOwnProperty(priv)) {
		priv_funcs[priv] = function(req, res, next) {
			var usr = curUser(req, res);
			var sess = req.session;
			var json = utils.wantsJson(req);

			if (usr.hasPriv(priv)) {
				return next();
			}

			sess.looking_for = req.originalUrl || req.url;
			sess.save();

			if (!json) {
				return res.redirect(303, "/login/evesso");
			} else {
				return res.status(403).json({
					code: 403,
					err: "REQAUTH"
				});
			}
		};
	}
	return priv_funcs[priv];
}

/*
function checkTokens(req, res) {
	var sess = req.session;

	// check for a logged-in session
	if (!isSessionSSO(sess)) {
		return Promise.resolve(false);
	}
	//if (!sess.access_token) {
	// not logged-in
	// sess.looking_for = req.originalUrl || req.url;
	// sess.save();
	//	return Promise.resolve(false);
	//}

	// check if the current access token is still valid; refresh it if needed
	if (sess.access_expires > (new Date()).getTime()) {
		// logged-in, tokens OK
		return Promise.resolve(true);
	} else {
		// logged-in but access token needs refresh
		if (!sess.refresh_token) {
			return Promise.reject(new Error("NOREF"));
		}
		var client = createClient({
			refresh_token: sess.refresh_token
		});
		client.getAccessTokenP = Promise.promisify(client.getAccessToken, {
			multiArgs: true,
			context: client
		});
		return client.getAccessTokenP()
			.then(function(args) {
				var access_token = args[0];
				var refresh_token = args[1];
				var results = args[2];
				//err, access_token, refresh_token, results) {
				if (!access_token || !refresh_token || !results) {
					LOG.warn("failed token refresh");
					return Promise.reject(new Error("OAUTH"));
				}

				sess.access_token = access_token;
				var exp = new Date();
				exp.setSeconds(exp.getSeconds() + results.expires_in - 60);
				sess.access_expires = exp.getTime();
				sess.user_expires = 0; // force a refresh of the user/member data too
				sess.save();
				LOG.info("token expires: ", exp);

				return Promise.resolve(true);
			});
	}
}
*/

function sessReviver(key, val) {
	if (val && val.hasOwnProperty("__sessobjtype")) {
		if (val.__sessobjtype === "EVECorp") {
			return (new EVECorp()).fromJSON(val);
		} else if (val.__sessobjtype === "EVEChar") {
			return (new EVEChar()).fromJSON(val);
		} else if (val.__sessobjtype === "User") {
			return (new User()).fromJSON(val);
		} else if (val.__sessobjtype === "Member") {
			return (new Member()).fromJSON(val);
		} else {
			return val;
		}
	} else {
		return val;
	}
}

function loadUserData(sess) {
	if (sess.user_data && sess.user_expires > (new Date()).getTime()) {
		// I have valid user data that hasn't expired yet; use it
		LOG.debug("recover user from session cache");
		return Promise.resolve(JSON.parse(sess.user_data, sessReviver));
	}

	var echar = JSON.parse(sess.echar, sessReviver);
	var mbr = new Member();
	return mbr.loginByEVEChar(echar) // attempt to load a member from login EVEChar
		.then(function(mbr) {
			if (!mbr) {
				// if we couldn't load a member, attempt to load a generic user from login EVEChar
				var usr = new User();
				return usr.loginByEVEChar(echar);
			} else {
				return mbr;
			}
		})
		.then(function(usr) {
			var exp = new Date();
			exp.setSeconds(exp.getSeconds() + 120); // set 2 minute expiration on user data
			sess.user_data = JSON.stringify(usr);
			sess.user_expires = exp.getTime();
			return usr;
		});
}

/*
function checkUserData(req, res) {
	var sess = req.session;
	var login_char;

	if (sess.user_data && sess.user_expires > (new Date()).getTime()) {
		// I have valid user data that hasn't expired yet; nothing to do
		return Promise.resolve(sess.user_data);
	}

	// get a CREST client to use
	var crest = createClient({
		access_token: sess.access_token
	}).getCrestClient();
	crest.makeCrestAuthCallP = Promise.promisify(crest.makeCrestAuthCall, {
		context: crest
	});

	// decode the auth token
	return crest.makeCrestAuthCallP({
			path: "/decode/"
		})
		.then(function(data) {
			// fetch character data from CREST based on decoded token info
			data = JSON.parse(data);
			if (!data || !data.character || !data.character.href) {
				LOG.warn("invalid decode response\n", JSON.stringify(data));
				return Promise.reject(new Error("invalid decode response"));
			}

			return crest.makeCrestAuthCallP({
				path: data.character.href
			});
		})
		.then(function(data) {
			// create EVEChar from CREST character info
			var echar = null;

			data = JSON.parse(data);
			if (!data || !data.id) {
				LOG.warn("invalid character response\n", JSON.stringify(data));
				return Promise.reject(new Error("invalid character response"));
			}

			echar = new EVEChar(data);
			return echar.loadFromDB(true); // load char from DB; update (or create) if needed
		})
		.then(function(echar) {
			// create user object from EVEChar
			// assert echar && echar.isLoaded
			if (!echar || !echar.isLoaded) {
				return Promise.reject(new Error("invalid EVEChar state"));
			}
			login_char = echar;
			var mbr = new Member();
			return mbr.loginByEVEChar(login_char); // attempt to load a member from login EVEChar
		})
		.then(function(mbr) {
			if (!mbr) {
				// if we couldn't load a member, attempt to load a generic user from login EVEChar
				var usr = new User();
				return usr.loginByEVEChar(login_char);
			} else {
				return Promise.resolve(mbr);
			}
		})
		.then(function(usr) {
			var exp = new Date();
			exp.setSeconds(exp.getSeconds() + 1200); // set 20 minute expiration on user data
			sess.user_data = usr.toSession();
			sess.user_expires = exp.getTime();
			//sess.user_expires = 0; // force refresh every time in dev
			//return Promise.resolve(true);
			res.locals.auth_usr = usr;
			return Promise.resolve(sess.user_data);
		});

	/*
	return crest.makeCrestAuthCallP({
			path: "/decode/"
		})
		.then(function(data) {
            data = JSON.parse(data);
            
		});

	crest.makeCrestAuthCall({
		path: "/characters/92828857/"
	}, function(err, data) {
		if (err) {
			LOG.error("error");
			LOG.error(err);
		} else {
			LOG.info("endpoints");
			data = JSON.parse(data);
			LOG.info(JSON.stringify(data, null, 1));
		}
	});
    */

//return Promise.resolve(false);


// figure out which built-in roles this user should have
//var roles = {};

// check for hard-coded admin role
/*
	var admins = config.get("SITE_ADMINS");
	if (admins && (!admins[charData.CharacterID] || admins[charData.CharacterID] === charData.CharacterOwnerHash)) {
		// this is an admin
		roles.admin = true;
	}
    */

/*
	// check for two possible sso roles (auth'd or ally)
	else {
		// check against users in datastore
		// if not found, set basic eveanon level so we don't look again
		sess.auth_data = {
			privs: ["none"]
		};
	}
	sess.save();

	if (!sess.auth_data || (opts.privs && opts.privs !== "none" && sess.auth_data.privs.indexOf(opts.privs) < 0)) {
		if (opts.output === "render") {
			return res.status(404).render("404");
		} else {
			return res.status(404).json({}).end();
		}

}*/

router.get("/logout", function(req, res) {
	var sess = req.session;
	clearSession(sess);
	res.redirect(303, "/");
});

router.get("/login", function(req, res) {
	var err = req.query.err;
	var errstr = "";
	if (err === "LOGOUT") {
		errstr = "You have been logged out.";
	} else if (err === "OAUTH") {
		errstr = "A problem occurred trying to get the OAuth2 access token from EVE SSO. Please try again.";
	} else if (err === "REQAUTH") {
		errstr = "You must log in to access that resource.";
	} else if (err === "NOTOK") {
		errstr = "No access token found in your session. Please login again.";
	} else if (err === "NOSESS") {
		errstr = "No session found. Authenticated features require you to accept our cookies. They're chocolate chip.";
	} else if (err === "NOREF") {
		errstr = "No valid refresh token exists in your current session. Please login again.";
	} else if (err === "CHARDATA") {
		errstr = "Could not parse the Character Data returned from EVE SSO.";
	} else if (err === "NOPE") {
		errstr = "You are not authorized to access that resource.";
	} else if (err === "UNKPRIV") {
		errstr = "An unknown privilege was specified for that resource.";
	}

	res.render("login", {
		errstr: errstr
	});
});

router.get("/login/evesso", function(req, res) {
	var sess = req.session;
	sess.cb_state = crypto.randomBytes(10).toString("hex");
	clearSession(sess, true);

	var auth = sso_client.getAuthorizeUrl();
	auth += "&response_type=code&redirect_uri=" + config.get("SSOAPP_CALLBACK") + "&state=" + sess.cb_state;
	LOG.debug("oauth url: " + auth);

	res.redirect(302, auth);
});

function loadCharFromToken(access_token) {
	if (!access_token) return;

	// decode the auth token via CREST
	return crest.get(access_token, "/decode/")
		.then(function(data) {
			// fetch character data from CREST based on decoded token info
			data = JSON.parse(data);
			if (!data || !data.character || !data.character.href) {
				LOG.warn("invalid decode response\n", JSON.stringify(data));
				throw new Error("invalid decode response");
			}

			return crest.get(access_token, data.character.href);
		})
		.then(function(data) {
			// create EVEChar from CREST character info
			var echar = null;

			data = JSON.parse(data);
			if (!data || !data.id) {
				LOG.warn("invalid character response\n", JSON.stringify(data));
				throw new Error("invalid character response");
			}

			echar = new EVEChar(data);
			return echar.loadFromDB(true); // load char from DB; update (or create) if needed
		})
		.then(function(echar) {
			// create user object from EVEChar
			// assert echar && echar.isLoaded
			if (!echar || !echar.isLoaded) {
				throw new Error("invalid EVEChar state");
			}
			return echar;
		});
}

router.get("/login/callback",
	function(req, res) {
		var sess = req.session;
		clearSession(sess, true);
		var cb_code = req.query.code;
		var cb_state = req.query.state;
		var access_token = null;
		var results = null;

		if (!cb_state || cb_state != sess.cb_state) {
			LOG.warn("OAuth callback state did not match our session state");
			return res.redirect(303, "/login?err=OAUTH");
		}

		sso_client.getOAuthAccessTokenP(cb_code, {
				grant_type: "authorization_code"
			})
			.then(function(args) {
				access_token = args[0];
				results = args[2];
				if (!access_token) {
					throw new Error("missing access token");
				}
				return access_token;
			})
			.then(loadCharFromToken)
			.then(function(echar) {
				// now logged-in with EVESSO
				sess.echar = JSON.stringify(echar);
				var redir_to = "/";
				if (sess.looking_for) {
					// go to wherever we were trying to go
					redir_to = sess.looking_for;
					sess.looking_for = null;
				}
				sess.save();
				res.redirect(303, redir_to);
			})
			.catch(function(err) {
				LOG.warn("failed to load char from token\n", err);
				res.redirect(303, "/login?err=CHARDATA");
			});
	}
);

function isSessionSSO(sess) {
	if (!sess || !sess.echar) {
		return false;
	}

	return true;
}

function clearSession(sess, keep_redir) {
	if (!sess) return;

	sess.user_data = null;
	sess.user_expires = null;
	sess.echar = null;
	if (!keep_redir) {
		sess.looking_for = null;
		sess.cb_state = null;
	}
	sess.save();
}

function middleware(req, res, next) {
	var sess = req.session;
	res.locals.auth_usr = null;

	// don't mess with any of our own flows
	if (req.path.startsWith("/logout") || req.path.startsWith("/login/")) {
		return next();
	}

	// if not a logged-in session, go with anon user data
	if (!isSessionSSO(sess)) {
		res.locals.auth_usr = new AnonUser();
		return next();
	}

	return loadUserData(sess)
		.then(function(usr) {
			res.locals.auth_usr = usr;
			return next();
		})
		.caught(function(err) {
			var json = utils.wantsJson(req);
			clearSession();
			res.locals.auth_usr = new AnonUser();
			if (err.message === "NOTOK" || err.message === "NOSESS" || err.message === "NOREF" || err.message === "OAUTH") {
				if (!json) {
					return res.redirect(303, "/login?err=" + err.message);
				} else {
					return res.status(400).json({
						code: 400,
						err: err.message
					});
				}
			} else {
				LOG.warn("evesso middlware error", err);
				if (!json) {
					return res.status(500).render("500", {
						err: err
					});
				} else {
					return res.status(500).json({
						code: 500,
						err: err
					});
				}
			}
		});
}

function curUser(req, res) {
	return res.locals.auth_usr;
}

function forceUserUpdateOnReload(req, res) {
	var sess = req.session;
	sess.user_expires = 0;
	sess.save();
}

module.exports = {
	middleware: middleware,
	router: router,
	reqPriv: reqPriv,
	loadCharFromToken: loadCharFromToken,
	curUser: curUser,
	forceUserUpdateOnReload: forceUserUpdateOnReload
};
