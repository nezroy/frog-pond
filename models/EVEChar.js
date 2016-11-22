var LOG = require("winston"),
	Promise = require("bluebird"),
	EVECorp = require("./EVECorp"),
	dsutil = require("./dsutil"),
	config = require("../config"),
	crest = require("../crest"),
	utils = require("../utils");

var tok_client = crest.getClient();

function Me(arg1, arg2) {
	this.__sessobjtype = "EVEChar";

	// EVE things
	this.ID = 0;
	this.name = null;
	this.gender = null;
	this.raceID = 0;
	this.bloodLineID = 0;
	this.description = null;
	this.corp = null;
	this.portrait = {
		tiny: null,
		small: null,
		medium: null,
		large: null
	};

	// CREST things
	this.endpoint = null;
	this.endpoints = null;
	this.refreshToken = null;
	this.tokenVer = null;
	this.accessToken = null;
	this.tokenExpires = null;

	// frog things
	this.type = 0;
	this.memberID = 0;

	// DB things
	this.isLoaded = false;

	// set initial values; provided by a CREST object or specified values
	if (typeof arg1 === "object" && arg1 && arg1.id) {
		constrFromCrest.apply(this, [arg1]);
	} else {
		if (typeof arg1 === "number") this.ID = arg1;
		else if (typeof arg1 === "string" && !isNaN(parseInt(arg1, 10))) this.ID = parseInt(arg1, 10);
		if (typeof arg2 === "string") this.name = arg2;
	}
}

Me.prototype.fromJSON = function(json) {
	this.ID = json.ID;
	this.name = json.name;
	this.gender = json.gender;
	this.raceID = json.raceID;
	this.bloodLineID = json.bloodLineID;
	this.description = json.description;
	this.corp = json.corp;
	this.portrait = json.portrait; // should clone
	this.endpoint = json.endpoint;
	this.endpoints = json.endpoints; // should clone
	this.refreshToken = json.refreshToken;
	this.tokenVer = json.tokenVer;
	this.accessToken = json.accessToken;
	this.tokenExpires = json.tokenExpires;
	this.type = json.type;
	this.memberID = json.memberID;
	this.isLoaded = json.isLoaded;
	return this;
};

Me.TypeEnum = {
	NONE: 0,
	RFF_MAIN_CA: 1,
	RFF_PREV_CA: 2,
	RFF_FA: 3,
	MAIN_CHAR: 4,
	OTHER_CHAR: 5,
	BFL_CA: 6,
	BFL_CYNO: 7,
	RFF_NEW_CA_PENDING: 8,
	RFF_NEW_CA_ACCEPTED: 9,
	RFF_NEW_FA_PENDING: 10,
	RFF_NEW_FA_ACCEPTED: 11
};

function constrFromCrest(data) {
	this.ID = data.id;
	this.name = data.name;
	this.gender = data.gender;
	this.raceID = data.race.id;
	this.bloodLineID = data.bloodLine.id;
	this.description = data.description;
	this.corp = new EVECorp(data.corporation);
	this.portrait.tiny = data.portrait["32x32"].href.replace(/^https?:/, "");
	this.portrait.small = data.portrait["64x64"].href.replace(/^https?:/, "");
	this.portrait.medium = data.portrait["128x128"].href.replace(/^https?:/, "");
	this.portrait.large = data.portrait["256x256"].href.replace(/^https?:/, "");

	this.endpoint = data.href;
	this.endpoints = {
		race: (data.race && data.race.href) ? data.race.href : null,
		bloodLine: (data.bloodLine && data.bloodLine.href) ? data.bloodLine.href : null,
		waypoints: (data.waypoints && data.waypoints.href) ? data.waypoints.href : null,
		private: (data.private && data.private.href) ? data.private.href : null,
		channels: (data.channels && data.channels.href) ? data.channels : null,
		accounts: (data.accounts && data.accounts.href) ? data.accounts : null,
		blocked: (data.blocked && data.blocked.href) ? data.blocked.href : null,
		fittings: (data.fittings && data.fittings.href) ? data.fittings.href : null,
		contacts: (data.contacts && data.contacts.href) ? data.contacts.href : null,
		opportunities: (data.opportunities && data.opportunities.href) ? data.opportunities.href : null,
		location: (data.location && data.location.href) ? data.location.href : null,
		mail: (data.mail && data.mail.href) ? data.mail.href : null,
		capsuleer: (data.capsuleer && data.capsuleer.href) ? data.capsuleer.href : null,
		vivox: (data.vivox && data.vivox.href) ? data.vivox.href : null,
		notifications: (data.notifications && data.notifications.href) ? data.notifications.href : null,
		loyaltyPoints: (data.loyaltyPoints && data.loyaltyPoints.href) ? data.loyaltyPoints.href : null,
		deposit: (data.deposit && data.deposit.href) ? data.deposit.href : null
	};
}

Me.prototype.loadFromDB = function(update_if_needed) {
	var self = this;
	if (self.isLoaded && !update_if_needed) {
		return Promise.resolve(self);
	}
	if (self.ID < 1) {
		return Promise.reject(new Error("invalid character ID"));
	}

	// get DB connection
	return Promise.using(dsutil.getConnection(), function(c) {
		// check if this char exists in the DB already
		LOG.debug("testing for EVEChar: " + self.ID);
		return c.queryP("SELECT ID, Name, CorpID, MemberID, TypeEnum, CrestToken, TokenVer FROM evechar WHERE ID = ?", [self.ID])
			.then(function(vals) {
				var result = vals[0];
				//var fields = vals[1];

				LOG.debug("results\n", JSON.stringify(result, null, 1));

				if (result.length > 0) {
					// char exsists, grab data
					self.memberID = result[0].MemberID;
					self.type = result[0].TypeEnum;
					self.refreshToken = result[0].CrestToken;
					self.tokenVer = result[0].TokenVer;

					if (!update_if_needed) {
						self.isLoaded = true;
						return Promise.resolve(self);
					}

					// test my values against DB values; update them if required
					if (self.name != result[0].Name || self.corp.ID != result[0].CorpID) {
						LOG.debug("updating EVEChar: " + self.ID);
						return c.queryP("UPDATE evechar SET Name = ?, CorpID = ?", [self.name, self.corp.ID])
							.then(function(vals) {
								var result = vals[0];
								if (result.affectedRows !== 1) {
									return Promise.reject(new Error("update failed; affected rows not 1"));
								} else {
									self.isLoaded = true;
									return Promise.resolve(self);
								}
							});
					} else {
						self.isLoaded = true;
						return Promise.resolve(self);
					}
				} else {
					// char does not exist in DB
					if (!update_if_needed) {
						return Promise.resolve(self);
					}

					// create entry for my values
					LOG.debug("inserting EVEChar: " + self.ID);
					return c.queryP("INSERT INTO evechar (ID, Name, CorpID) VALUES(?, ?, ?)", [self.ID, self.name, self.corp.ID])
						.then(function(vals) {
							var result = vals[0];
							if (result.affectedRows !== 1) {
								return Promise.reject(new Error("insert failed; affected rows not 1"));
							} else {
								self.isLoaded = true;
								return Promise.resolve(self);
							}
						});
				}
			});
	});
};

Me.prototype.setTokenDB = function(mID, token, ver) {
	var self = this;
	if (!self.isLoaded || self.ID < 1) {
		return Promise.reject(new Error("invalid EVEChar for this operation"));
	}

	// get DB connection
	return Promise.using(dsutil.getConnection(), function(c) {
		// check if this char exists in the DB already
		LOG.debug("testing for EVEChar: " + self.ID);
		return c.queryP("SELECT ID, MemberID FROM evechar WHERE ID = ?", [self.ID])
			.then(function(vals) {
				var result = vals[0];
				//var fields = vals[1];

				LOG.debug("results\n", JSON.stringify(result, null, 1));

				if (result.length > 0) {
					// char exsists, check member ID match
					if (result[0].MemberID && result[0].MemberID != mID) {
						return Promise.reject(new Error("EVEChar has MemberID already and does not match"));
					}

					// update EVEchar with new info
					LOG.debug("update EVEChar with mID, token, ver: " + mID + ", " + token + ", " + ver);
					return c.queryP("UPDATE evechar SET MemberID = ?, CrestToken = ?, TokenVer = ?", [mID, token, ver])
						.then(function(vals) {
							var result = vals[0];
							if (result.affectedRows !== 1) {
								return Promise.reject(new Error("update failed; affected rows not 1"));
							} else {
								self.refreshToken = token;
								self.tokenVer = ver;
								return Promise.resolve(self);
							}
						});
				} else {
					// char does not exist in DB
					return Promise.reject(new Error("update failed; EVEChar not in DB"));
				}
			});
	});
};

Me.prototype.inRedFrog = function() {
	if (!this.corp) return false;
	if (utils.CorpIds.RFF === this.corp.ID ||
		utils.CorpIds.BFL === this.corp.ID ||
		utils.CorpIds.GFB === this.corp.ID ||
		utils.CorpIds.WFI === this.corp.ID) {
		return true;
	}
	return false;
};

Me.prototype.inRFF = function() {
	if (!this.corp) return false;
	if (utils.CorpIds.RFF === this.corp.ID) {
		return true;
	}
	return false;
};

Me.prototype.isAdmin = function() {
	var admins = config.get("SITE_ADMINS");
	if (admins && admins.hasOwnProperty(this.ID + "")) {
		return true;
	}
	return false;
};

Me.prototype.setAccessToken = function(token, expires_in) {
	var exp = new Date();
	exp.setSeconds(exp.getSeconds() + expires_in - 60);
	this.accessToken = token;
	this.tokenExpires = exp.getTime();
};

Me.prototype.hasAccessToken = function() {
	if (this.accessToken && this.tokenExpires > (new Date()).getTime()) {
		return true;
	}
	return false;
};

Me.prototype.getAccessToken = function() {
	var self = this;

	if (this.hasAccessToken()) {
		return Promise.resolve(this.accessToken);
	}
	if (!this.refreshToken) {
		return Promise.resolve(null);
	}

	return tok_client.getOAuthAccessTokenP(this.refreshToken, {
			grant_type: "refresh_token"
		})
		.then(function(args) {
			var access_token = args[0];
			var results = args[2];
			if (!access_token) {
				LOG.warn("failed to acquire access token from refresh token");
				return null;
				// throw new Error("missing access token");
			}

			self.setAccessToken(access_token, results.expires_in);

			return access_token;
		});
};

module.exports = Me;
