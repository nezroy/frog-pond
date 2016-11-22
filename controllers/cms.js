var // express = require("express"),
	fs = require("fs"),
	path = require("path"),
	Promise = require("bluebird"),
	config = require("../config"),
	//utils = require("../utils"),
	evesso = require("../evesso"),
	marked = require("marked"),
	bodyParser = require("body-parser"),
	uuid = require("node-uuid"),
	LOG = require("winston");

fs.readFileP = Promise.promisify(fs.readFile);
fs.writeFileP = Promise.promisify(fs.writeFile);
//var markedP = Promise.promisify(marked);

var BASE = config.get("CMS_CONTENT_BASE");
var MDR = new marked.Renderer();
MDR.table = function(header, body) {
	return "<table class=\"table\">\n" + "<thead>\n" + header + "</thead>\n" + "<tbody>\n" + body + "</tbody>\n" + "</table>\n";
};

marked.setOptions({
	smartypants: true,
	smartLists: true,
	renderer: MDR
});
/*
var MD = new Remarkable("full");
MD.renderer.rules.table_open = function() {
  return "<table class=\"table\">\n";
};
MD.renderer.rules.dl_open = function() {
  return "<dl class=\"dl-horizontal\">\n";
};
*/

function Me(dir, mount) {
	this.manifest = null;
	this.section_menu = null;
	this.mount = mount;
	this.dir = dir;
}

Me.addToRouter = function(mount, basedir, router) {
	var d = path.join(BASE, basedir, "/");
	//if (mount.endsWith("/"))
	LOG.debug("stat check on: " + d);
	try {
		var stat = fs.statSync(d);
		if (!stat || !stat.isDirectory()) {
			throw new Error("ENOENT");
		}
	} catch (err) {
		if (err.message.startsWith("ENOENT")) {
			LOG.warn("cms path is not a directory: " + d);
			return false;
		}
		throw err;
	}
	var root = fs.readdirSync(d);
	if (!root) {
		LOG.warn("cannot access cms path: " + d);
		return false;
	}
	try {
		fs.accessSync(path.join(d, "manifest.json"), fs.W_OK + fs.R_OK);
	} catch (err) {
		if (err.message.startsWith("ENOENT")) {
			LOG.warn("cannot access manifest for cms path: " + path.join(d, "manifest.json"));
			return false;
		}
		throw err;
	}

	var r = new Me(d, mount);
	router.get(mount + "/*", function(req, res) {
		LOG.debug("in cms get");
		return cms_get.apply(r, [req, res]);
	});
	router.put(mount + "/*", bodyParser.json(), function(req, res) {
		LOG.debug("in cms put");
		return cms_put.apply(r, [req, res]);
	});
	router.get(mount, function(req, res) {
		LOG.debug("in edittree get");
		return edittree_get.apply(r, [req, res]);
	});
	router.put(mount, bodyParser.json(), function(req, res) {
		LOG.debug("in edittree put");
		return edittree_put.apply(r, [req, res]);
	});

	r.updateRoutes()
		.caught(function(err) {
			LOG.warn("failed to update CMS routes\n", err);
		});

	return true;
};

function edittree_get(req, res) {
	var usr = evesso.curUser(req, res);
	if (req.query.edit_mode && this.manifest && usr.hasPriv(this.manifest.tree_priv)) {
		return res.status(200).render("cms_edittree", {
			title: this.manifest.section_title,
			mount: this.mount,
			manifest: this.manifest ? JSON.stringify(this.manifest) : "null"
		});
	} else {
		return res.status(404).render("404");
	}
}

function update_uuid(data) {
	var i;
	if (!data) {
		return;
	}

	if (data.hasOwnProperty("itemTitle")) {
		data.title = data.itemTitle;
		delete data.itemTitle;
	}
	if (data.hasOwnProperty("itemName")) {
		data.name = data.itemName;
		delete data.itemName;
	}
	if (data.hasOwnProperty("itemHidden")) {
		data.hidden = data.itemHidden ? true : false;
		delete data.itemHidden;
	} else {
		data.hidden = false;
	}
	if (data.hasOwnProperty("itemUuid")) {
		data.uuid = data.itemUuid;
		delete data.itemUuid;
	}
	if (!data.hasOwnProperty("section_title")) {
		if (!data.hasOwnProperty("uuid")) {
			data.uuid = uuid.v4();
		}
	} else {
		delete data.hidden;
	}

	if (data.hasOwnProperty("id")) {
		delete data.id;
	}

	if (data.children) {
		for (i = 0; i < data.children.length; i++) {
			update_uuid(data.children[i]);
		}
		data.pages = data.children;
		delete data.children;
	}
}

function edittree_put(req, res) {
	var self = this;
	var usr = evesso.curUser(req, res);
	if (this.manifest && usr.hasPriv(this.manifest.tree_priv)) {
		if (!req.body || !req.body.section_title) {
			return res.status(400).json();
		}

		this.manifest.section_title = req.body.section_title;
		this.manifest.children = req.body.tree;
		update_uuid(this.manifest);

		var m = path.join(this.dir, "manifest.json");
		return fs.writeFileP(m, JSON.stringify(this.manifest, null, 1))
			.then(function() {
				//self.manifest = JSON.parse(data);
				self.section_menu = create_menu.apply(self);
				LOG.debug("manifest updated: " + m);
				res.status(200).json(self.manifest);
			})
			.caught(function(err) {
				res.status(400).json({
					err: err
				});
			});

		//LOG.debug("updated manifest JSON\n", JSON.stringify(this.manifest, null, 1));

		//return res.status(200).json(this.manifest);
		/*return res.status(200).render("cms_edittree", {
			title: self.manifest.section_title
		});*/
	} else {
		return res.status(404).render("404");
	}
}

function render_cms_page(req, res, page, usr, edit_mode) {
	var self = this;
	var p = path.join(this.dir, page.uuid + ".html");
	var locals = {
		mount: this.mount,
		pgpath: req.path,
		title: this.manifest.section_title + " - " + page.title,
		section_menu: this.section_menu,
		edit_mode: edit_mode,
		page_content: "",
		show_edit_menu: usr.hasPriv(this.manifest.edit_priv),
		show_tree_menu: usr.hasPriv(this.manifest.tree_priv)
	};
	fs.readFileP(p)
		.then(function(data) {
			LOG.debug("got html content");
			locals.page_content = data;
			res.status(200).render("cms", locals);
		})
		.caught(function(err) {
			LOG.debug("no html");
			if (err.message.startsWith("ENOENT")) {
				p = path.join(self.dir, page.uuid + ".md");
				fs.readFileP(p, {
						encoding: "utf-8"
					})
					.then(function(data) {
						if (edit_mode) {
							locals.page_content = data;
							res.status(200).render("cms_editpage", locals);
						} else {
							locals.page_content = marked(data);
							res.status(200).render("cms", locals);
						}
					})
					.caught(function(err) {
						LOG.debug("no markdown");
						if (err.message.startsWith("ENOENT")) {
							if (edit_mode) {
								res.status(200).render("cms_editpage", locals);
							} else {
								res.status(200).render("cms", locals);
							}
						} else {
							LOG.warn(err);
							res.status(500).render("500");
						}
					});
			} else {
				LOG.warn(err);
				res.status(500).render("500");
			}
		});
}

function cms_get(req, res) {
	var self = this;
	var i, j;
	var usr = evesso.curUser(req, res);

	LOG.debug("handle path: " + req.path);

	if (!this.manifest || !usr || !usr.hasPriv(this.manifest.view_priv)) {
		return res.status(404).render("404");
	}

	var paths = req.path.split("/");
	var page = false;
	var cont = false;
	var edit_mode = false;
	var nestref = self.manifest;
	if (!paths[0]) {
		paths.shift();
	}
	if ("/" + paths[0] === this.mount) {
		paths.shift();
	}
	if (!paths[paths.length - 1]) {
		paths[paths.length - 1] = "index";
	}

	if (req.query.edit_mode) {
		if (!usr.hasPriv(this.manifest.edit_priv)) {
			return res.status(404).render("404");
		} else {
			edit_mode = true;
		}
	}

	LOG.debug("checking for: " + paths.join("|"));
	for (i = 0; i < paths.length; i++) {
		if (!nestref.hasOwnProperty("pages")) {
			break;
		}
		cont = false;
		for (j = 0; j < nestref.pages.length; j++) {
			if (nestref.pages[j].name === paths[i]) {
				if (nestref.pages[j].pages && nestref.pages[j].pages.length > 0) {
					// this is a dir
					nestref = nestref.pages[j];
					cont = true;
					break;
				} else if (i === (paths.length - 1)) {
					page = nestref.pages[j];
					break;
				}
			}
		}
		if (!cont) {
			break;
		}
	}

	if (page && !page.hidden && page.uuid) {
		return render_cms_page.apply(self, [req, res, page, usr, edit_mode]);
	} else {
		return res.status(404).render("404");
	}
}

function cms_put(req, res) {
	var self = this;
	var i, j;
	var usr = evesso.curUser(req, res);

	LOG.debug("handle path: " + req.path);

	if (!this.manifest || !usr || !usr.hasPriv(this.manifest.edit_priv)) {
		return res.status(404).render("404");
	}

	var paths = req.path.split("/");
	var page = false;
	var cont = false;
	var edit_mode = false;
	var nestref = self.manifest;
	if (!paths[0]) {
		paths.shift();
	}
	if ("/" + paths[0] === this.mount) {
		paths.shift();
	}
	if (!paths[paths.length - 1]) {
		paths[paths.length - 1] = "index";
	}

	if (req.query.edit_mode) {
		if (!usr.hasPriv(this.manifest.edit_priv)) {
			return res.status(404).render("404");
		} else {
			edit_mode = true;
		}
	}

	LOG.debug("checking for: " + paths.join("|"));
	for (i = 0; i < paths.length; i++) {
		if (!nestref.hasOwnProperty("pages")) {
			break;
		}
		cont = false;
		for (j = 0; j < nestref.pages.length; j++) {
			if (nestref.pages[j].name === paths[i]) {
				if (nestref.pages[j].pages && nestref.pages[j].pages.length > 0) {
					// this is a dir
					nestref = nestref.pages[j];
					cont = true;
					break;
				} else if (i === (paths.length - 1)) {
					page = nestref.pages[j];
					break;
				}
			}
		}
		if (!cont) {
			break;
		}
	}

	if (page && page.uuid) {
		if (!req.body.hasOwnProperty("md_data")) {
			return res.status(400).json();
		}

		var p = path.join(this.dir, page.uuid + ".md");
		return fs.writeFileP(p, req.body.md_data)
			.then(function() {
				//self.manifest = JSON.parse(data);
				//self.section_menu = create_menu.apply(self);
				LOG.debug("page markdown updated: " + p);
				res.status(204).json();
			})
			.caught(function(err) {
				res.status(400).json({
					err: err
				});
			});
		//return render_cms_page.apply(self, [req, res, page, usr, edit_mode]);
	} else {
		return res.status(404).render("404");
	}
}

function create_menu() {
	var menu = [];
	if (!this.manifest.pages || this.manifest.pages.length < 1) {
		return false;
	}

	if (this.manifest.pages.length === 1 && (!this.manifest.pages[0].pages || this.manifest.pages[0].pages.length <= 1)) {
		return false;
	}

	menu.push("<ul class=\"nav nav-pills\" id=\"subnav\">");
	create_menu_r(this.mount, menu, this.manifest, true);
	menu.push("</ul>");

	return menu.join("\n");
}

function create_menu_r(path, menu, item, first) {
	var i = 0;
	if (!item || !item.pages || item.pages.length < 1) {
		return;
	}
	for (i = 0; i < item.pages.length; i++) {
		if (item.pages[i].hidden) {
			continue;
		}
		if (item.pages[i].pages && item.pages[i].pages.length > 0) {
			if (first) {
				menu.push("<li class=\"dropdown\"><a class=\"dropdown-toggle\" href=\"#\" data-toggle=\"dropdown\" role=\"button\" aria-haspop=\"true\" aria-expanded=\"false\" data-submenu=\"\">" + item.pages[i].title + " <span class=\"caret\"></span></a>");
			} else {
				menu.push("<li class=\"dropdown-submenu\"><a href=\"#\">" + item.pages[i].title + "</a>");
			}
			menu.push("<ul class=\"dropdown-menu\">");
			create_menu_r(path + "/" + item.pages[i].name, menu, item.pages[i]);
			menu.push("</ul></li>");
		} else {
			if (item.pages[i].name === "index") {
				menu.push("<li><a href=\"" + path + "/\">" + item.pages[i].title + "</a></li>");
			} else {
				menu.push("<li><a href=\"" + path + "/" + item.pages[i].name + "\">" + item.pages[i].title + "</a></li>");
			}
		}
	}

}

Me.prototype.updateRoutes = function() {
	var self = this;
	var m = path.join(this.dir, "manifest.json");
	return fs.readFileP(m, {
			encoding: "utf-8"
		})
		.then(function(data) {
			self.manifest = JSON.parse(data);
			self.section_menu = create_menu.apply(self);
			LOG.debug("manifest loaded: " + m);
		});
};

module.exports = Me;
