var LOG = require("winston"),
	Promise = require("bluebird"),
	dsutil = require("./dsutil"),
	EVEChar = require("./EVEChar");

function Me() {
	this.__sessobjtype = "User";

	this.ID = 0;
	this.loginChar = null;

	this.roles = {};
	this.privs = {};
}

Me.prototype.fromJSON = function(json) {
	this.ID = json.ID;
	this.loginChar = json.loginChar; // should clone
	this.roles = json.roles; // should clone
	this.privs = json.privs; // should clone
    return this;
};

Me.prototype.loginByEVEChar = function(echar) {
	var self = this;
	if (!(echar instanceof EVEChar)) {
		return Promise.reject(new Error("invalid type provided"));
	}
	LOG.debug("login user from EVEChar: " + echar.ID);

	self.loginChar = echar;

	if (echar.inRFF()) {
		LOG.debug("found in RFF, setting sso_rff role");
		self.roles.sso_rff = true;
	} else {
		LOG.debug("not in corp, setting sso_auth role");
		self.roles.sso_auth = true;
	}

	if (echar.isAdmin()) {
		LOG.debug("found in admin, setting admin role");
		self.roles.admin = true;
	}

	return self.loadPrivs();
};

Me.prototype.loadPrivs = function() {
	var self = this;
	var qs = [];
	var roles = [];
	var role;

	//SELECT ID, PrivID FROM role_priv WHERE ID IN(...)
	for (role in self.roles) {
		if (!self.roles.hasOwnProperty(role)) continue;
		qs.push("?");
		roles.push(role);
	}
	if (roles.length < 1) {
		return Promise.resolve(self);
	}
	return Promise.using(dsutil.getConnection(), function(c) {
		return c.queryP("SELECT ID, PrivID FROM role_priv WHERE ID IN(" + qs.join(",") + ")", roles)
			.then(function(args) {
				var result = args[0];
				//var fields = args[1];
				var i;

				for (i = 0; i < result.length; i++) {
					LOG.debug("setting priv: " + result[i].PrivID);
					self.privs[result[i].PrivID] = true;
				}

				return Promise.resolve(self);
			});
	});
};

Me.prototype.hasPriv = function(priv) {
	if (!priv) return false;
	if (priv === "everyone" || this.privs[priv] || this.roles.admin) {
		return true;
	}
	return false;
};

module.exports = Me;
