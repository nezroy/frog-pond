var express = require("express"),
	LOG = require("winston"),
	evesso = require("../evesso"),
	//members = require("./members"),
	//evechars = require("./evechars"),
	profile = require("./profile"),
	cms = require("./cms"),
	debug = require("./debug");

var router = express.Router();

// setup routers for models
// router.use("/members", members.router);
// router.use("/api/members", members.router_api);
// router.use("/api/evechars", evechars.router_api);

cms.addToRouter("/faq", "faq", router);
cms.addToRouter("/recruitguide", "recruitguide", router);
cms.addToRouter("/rffmanual", "rffmanual", router);
cms.addToRouter("/rffmgrman", "rffmgrman", router);

router.use("/debug", debug);

router.use("/profile", profile.router);

// caching handlers for char and corp data


// normal boring routes
router.get("/", function(req, res) {
	res.render("index", {
		title: "Trip Calculator"
	});
});

router.get("/pilot_profile", evesso.reqPriv("rff_members_edit_own"), function(req, res) {
	res.render("content", {
		title: "Pilot Profile"
	});
	/*var sess = req.session;
	if (!sess.access_token) {
		return res.status(500).render("500", {
			err: "no access token"
		}).end();
	}
	var client = evesso.createClient({
		access_token: sess.access_token
	});
	var crest = client.getCrestClient();
	crest.getUserInfo(null, function(err, results) {
		LOG.info(err);
		LOG.info(results);
		res.status(200).json(results).end();
	});
    */
});

module.exports = router;
