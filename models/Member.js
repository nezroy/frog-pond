var LOG = require("winston"),
	Promise = require("bluebird"),
	crypto = require("crypto"),
	dsutil = require("./dsutil"),
	EVEChar = require("./EVEChar");

function Me() {
    this.__sessobjtype = "Member";
    
	this.ID = 0;
	this.applicationNo = null;
	this.status = 0;
	this.role = 0;
	this.notes = null;
	this.canStack = false;
	this.inRFF = false;
	this.inBFL = false;
	this.loginChar = null;

	this.isLoaded = false;

	this.roles = {};
	this.privs = {};
	this.tokens = [];
}

Me.prototype.fromJSON = function(json) {
	this.ID = json.ID;
	this.applicationNo = json.applicationNo;
	this.status = json.status;
	this.role = json.role;
	this.notes = json.notes;
	this.canStack = json.canStack;
	this.inRFF = json.inRFF;
	this.inBFL = json.inBFL;
	this.loginChar = json.loginChar; // should clone
	this.isLoaded = json.isLoaded;
	this.roles = json.roles; // should clone
	this.privs = json.privs; // should clone
    this.tokens = json.tokens; // should clone
    return this;
};

Me.RoleEnum = {
	NONE: 0,
	PILOT: 1,
	JCM: 2,
	CM: 3,
	SCM: 4,
	DIR: 5,
	CEO: 6
};

Me.StatusEnum = {
	NONE: 0,
	ACTIVE: 1,
	INACTIVE: 2,
	THIEF: 3,
	BANNED: 4,
	EMERITUS: 5
};

function initFromRFFChar(echar) {
	var self = this;
	LOG.debug("initialize member from EVEChar: " + echar.ID);

	return Promise.using(dsutil.getConnectionXact(), function(c) {
			var mid = crypto.randomBytes(5).toString("hex");
			LOG.debug("insert member details");
			return c.queryP("INSERT INTO member (ID, StatusEnum, RoleEnum, RFFFlag) VALUES(?, ?, ?, ?)", [mid, 1, 1, 1])
				.then(function(vals) {
					var result = vals[0];
					if (result.affectedRows !== 1) {
						return Promise.reject(new Error("member insert failed; affected rows not 1"));
					}
				})
				.then(function() {
					LOG.debug("update character details");
					return c.queryP("UPDATE evechar SET MemberID = ?, TypeEnum = 1 WHERE ID = ?", [mid, echar.ID]);
				})
				.then(function(vals) {
					var result = vals[0];
					if (result.affectedRows !== 1) {
						return Promise.reject(new Error("EVEchar update failed; affected rows not 1"));
					}
					echar.memberID = mid;
					echar.type = 1;
				})
				.then(function() {
					LOG.debug("insert roles");
					return c.queryP("INSERT INTO member_role (ID, RoleID) VALUES(?, ?)", [mid, "rff_member"]);
				})
				.then(function(vals) {
					var result = vals[0];
					if (result.affectedRows !== 1) {
						return Promise.reject(new Error("role insert failed; affected rows not 1"));
					}

					// should check for and copy/update applicant data at this point
					return c.commitP();
				});
		})
		.then(function() {
			LOG.debug("committed changes");
			return self.loginByEVEChar(echar, true);
		});
}

Me.prototype.loginByEVEChar = function(echar, bypass_new) {
	var self = this;
	if (!(echar instanceof EVEChar)) {
		return Promise.reject(new Error("invalid type provided"));
	}

	if (!echar.memberID) {
		// if this char has no memberID and not in RFF, nothing to do
		if (!echar.inRFF() || bypass_new) {
			return Promise.resolve(null);
		}

		// RFF char, but no memberID? must be new
		return initFromRFFChar.apply(this, [echar]);
	}

	LOG.debug("login member from EVEChar: " + echar.ID);

	return Promise.using(dsutil.getConnection(), function(c) {
		// check if the char is associated with an active member
		return c.queryP("SELECT ID, ApplicationNo, StatusEnum, RoleEnum, Notes, StackFlag, RFFFlag, BFLFlag FROM member WHERE ID = ? AND StatusEnum = 1 AND RoleEnum > 0", [echar.memberID])
			.then(function(vals) {
				var result = vals[0];
				//var fields = vals[1];        

				LOG.debug("results\n", JSON.stringify(result, null, 1));

				if (result.length < 1) {
					// no active member associated with this char
					return Promise.resolve(null);
				} else {
					// set data
					self.ID = result[0].ID;
					self.applicationNo = result[0].ApplicationNo;
					self.status = result[0].StatusEnum;
					self.role = result[0].RoleEnum;
					self.notes = result[0].Notes;
					self.canStack = result[0].StackFlag ? true : false;
					self.inRFF = result[0].RFFFlag ? true : false;
					self.inBFL = result[0].BFLFlag ? true : false;
					self.loginChar = echar;

					// set static roles
					if (self.inRFF) {
						LOG.debug("member in RFF; setting sso_rff and rff_member roles");
						self.roles.sso_rff = true;
						self.roles.rff_member = true;
					}
					if (self.inBFL) {
						LOG.debug("member in BFL; setting sso_bfl and bfl_member roles");
						self.roles.sso_bfl = true;
						self.roles.bfl_member = true;
					}
					if (echar.isAdmin()) {
						LOG.debug("found in admin, setting admin role");
						self.roles.admin = true;
						// self.privs.admin = true;
					}

					// get DB roles
					return c.queryP("SELECT RoleID FROM member_role WHERE ID = ?", [self.ID]);
				}
			})
			.then(function(vals) {
				if (!vals) return Promise.resolve(null);
				var result = vals[0];
				//var fields = vals[1];
				var i;

				for (i = 0; i < result.length; i++) {
					LOG.debug("setting role: " + result[i].RoleID);
					self.roles[result[i].RoleID] = true;
				}

				// get associated chars & tokens
                return c.queryP("SELECT ID, Name, TypeEnum, CrestToken, TokenVer FROM evechar WHERE MemberID = ? AND CrestToken IS NOT NULL", [self.ID]);
			})
			.then(function(vals) {
				if (!vals) return Promise.resolve(null);
				var result = vals[0];
				//var fields = vals[1];
				var i;
                var ec;

				for (i = 0; i < result.length; i++) {
					LOG.debug("adding evechar with token: " + result[i].ID);
                    ec = new EVEChar();
                    ec.ID = result[i].ID;
                    ec.name = result[i].Name;
                    ec.type = result[i].TypeEnum;
                    ec.refreshToken = result[i].CrestToken;
                    ec.tokenVer = result[i].TokenVer;                    
                    self.tokens.push(ec);
				}

				return Promise.resolve(self);
			});
	}).then(function(is_member) {
		if (!is_member) return Promise.resolve(null);
		return self.loadPrivs();
	});
};

Me.prototype.loadPrivs = function() {
	var self = this;
	var qs = [];
	var roles = [];
	var role;

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

Me.prototype.profileStatus = function() {
	var stat = "Unknown";
	if (this.status == 1) stat = "Active";
	else if (this.status == 2) stat = "Inactive";
	else if (this.status == 3) stat = "Thief";
	else if (this.status == 4) stat = "Banned";
	else if (this.status == 5) stat = "Emeritus";
	return stat;
};

Me.prototype.profileRole = function() {
	var stat = "Unknown";
	if (this.role == 1) stat = "Pilot";
	else if (this.role == 2) stat = "Junior Contract Manager";
	else if (this.role == 3) stat = "Contract Manager";
	else if (this.role == 4) stat = "Senior Contract Manager";
	else if (this.role == 5) stat = "Director";
	else if (this.role == 6) stat = "CEO";
	return stat;
};

module.exports = Me;
