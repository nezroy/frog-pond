/*var LOG = require("winston"),
	Promise = require("bluebird"),
	dsutil = require("./dsutil"),
	EVEChar = require("./EVEChar");*/

function Me() {
	this.ID = -1;
	this.loginChar = false;

	this.roles = {};
	this.privs = {
		everyone: true
	};
}

Me.prototype.hasPriv = function(priv) {
	if (!priv) return false;
	if (priv === "everyone" || this.privs[priv]) {
		return true;
	}
	return false;
};

module.exports = Me;
