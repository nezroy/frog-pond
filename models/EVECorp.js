var LOG = require("winston"),
	Promise = require("bluebird"),
	dsutil = require("./dsutil");

function Me(arg1, arg2) {
    this.__sessobjtype = "EVECorp";
    
	// EVE things
	this.ID = 0;
	this.name = null;
	this.isNPC = false;
	this.logo = {
		tiny: null,
		small: null,
		medium: null,
		large: null
	};

	// CREST things
	this.endpoint = null;
	this.endpoints = null;

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
	this.isNPC = json.isNPC;
	this.logo = json.logo; // should clone
	this.endpoint = json.endpoint;
	this.endpoints = json.endpoints; // should clone
	this.isLoaded = json.isLoaded;
    return this;
};

function constrFromCrest(data) {
	this.ID = data.id;
	this.name = data.name;
	this.isNPC = data.isNPC;
	this.logo.tiny = data.logo["32x32"].href.replace(/^https?:/, "");
	this.logo.small = data.logo["64x64"].href.replace(/^https?:/, "");
	this.logo.medium = data.logo["128x128"].href.replace(/^https?:/, "");
	this.logo.large = data.logo["256x256"].href.replace(/^https?:/, "");

	this.endpoint = data.href;
}

Me.prototype.loadFromDB = function(update_if_needed) {
	var self = this;
	if (self.isLoaded && !update_if_needed) {
		return Promise.resolve(self);
	}
	if (self.ID < 1) {
		return Promise.reject(new Error("invalid corp ID"));
	}

	// get DB connection
	return Promise.using(dsutil.getConnection(), function(c) {
		// check if this corp exists in the DB already
		LOG.debug("testing for EVECorp: " + self.ID);
		return c.queryP("SELECT ID, Name, NpcFlag FROM evecorp WHERE ID = ?", [self.ID])
			.then(function(vals) {
				var result = vals[0];
				//var fields = vals[1];

				LOG.debug("results\n", JSON.stringify(result, null, 1));

				if (result.length > 0) {
					// corp exsists, grab data
					//self.memberID = result[0].MemberID;
					//self.type = result[0].TypeEnum;

					if (!update_if_needed) {
						self.isLoaded = true;
						return Promise.resolve(self);
					}

					// test my values against DB values; update them if required
					/*if (self.name != result[0].Name || self.corp.ID != result[0].CorpID) {
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
					} else {*/
					self.isLoaded = true;
					return Promise.resolve(self);
					//}
				} else {
					// corp does not exist in DB
					if (!update_if_needed) {
						return Promise.resolve(self);
					}

					// create entry for my values
					LOG.debug("inserting EVECorp: " + self.ID);
					return c.queryP("INSERT INTO evecorp (ID, Name, NpcFlag) VALUES(?, ?, ?)", [self.ID, self.name, self.isNPC ? 1 : 0])
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

module.exports = Me;
