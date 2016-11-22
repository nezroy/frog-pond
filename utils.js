exports.wantsJson = function(req) {
	return req.accepts("html") ? false : true;
};

// alliance ID : 1496500070 https://crest-tq.eveonline.com/alliances/1496500070/
// RFF ID : 1495741119
// BFL ID : 384667640
// GFB ID : 98439878
// WFI ID : 98148132
exports.CorpIds = {
	RFF: 1495741119,
	BFL: 384667640,
	GFB: 98439878,
	WFI: 98148132
};

/*
module.exports = {
	wantsJson: wantsJson
};
*/
