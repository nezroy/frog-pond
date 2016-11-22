var express = require("express");
	//LOG = require("winston");

var router = express.Router();

// normal boring routes
router.get("/", function(req, res) {
	res.render("debug", {
		curenv: process.env,
		cdatastr: JSON.stringify(req.session.char_data, null, 1),
		char_data: req.session.char_data,
		char_name: req.session && req.session.char_data ? req.session.char_data.CharacterName : "",
		auth_level: req.session.auth_level,
		sess_dump: JSON.stringify(req.session, null, 1),
		token_expires: new Date(req.session.token_expires),
		reqhdr_dump: JSON.stringify(req.headers, null, 1),
        req_ip: req.ip,
        req_ips: JSON.stringify(req.ips, null, 1)
	});
});

router.get("/forceexpire", function(req, res) {
    var sess = req.session;
    if (sess) {
        sess.user_expires = 0;
        sess.access_expires = 0;
        sess.save();
    }
    
    return res.status(200).end();    
});

module.exports = router;
