/* global document: false */
/* global $: false */
/* global EDITTREE: false */
$(document).ready(function() {
	// setup edit tree and add change handler
	$("#edittree").nestable();

	var twiddleIds = function(path, ele) {
		var names = {};
		ele.children("li").each(function(idx, el) {
			var name = $(el).data("item-name");
			if (names.hasOwnProperty(name)) {
				name = name + "_dupfix";
				$(el).data("item-name", name);
			}
			names[name] = true;
			var title = $(el).data("item-title");
			var newid = path + "/" + name;
			$(el).find("> .dd-handle > .title").text(title);
			$(el).data("id", newid);
			if ($(el).children("ol.dd-list").length > 0) {
				$(el).find("> .dd-handle > .url").html("");
				twiddleIds(newid, $(el).children("ol.dd-list"));
			} else {
				if (name === "index") {
					$(el).find("> .dd-handle > .url").html("— " + path + "/");
				} else {
					$(el).find("> .dd-handle > .url").html("— " + newid);
				}
			}
		});
	};

	$("#edittree").on("change", function(ev) {
		twiddleIds(EDITTREE.mount, $("#edittree > ol.dd-list"));
	});
});

$(document).ready(function() {
	var did = 1000;

	var initChildren = function(item, ol) {
		var i, newli, newol;
		if (!item.pages || item.pages.length === 0) {
			return;
		}
		for (i = 0; i < item.pages.length; i++) {
			newli = $("<li class=\"dd-item\"><div class=\"dd-handle\"><span class=\"title\">" + item.pages[i].title + "</span> <span class=\"url\"></span></div><div class=\"dd-content\"><div class=\"dd-attr\"><span class=\"btn glyphicon glyphicon-wrench\" data-toggle=\"modal\" data-target=\"#mod-edit-item\" title=\"Edit Details\"></span><span class=\"btn glyphicon glyphicon-plus\" title=\"Add Child Page\"></span><span class=\"btn glyphicon glyphicon-eye-open\" title=\"Toggle Page Visibility\"></span><span class=\"btn glyphicon glyphicon-remove-circle\" title=\"Remove Page\" data-toggle=\"modal\" data-target=\"#mod-remove\"></span></div></div></li>");
			if (item.pages[i].uuid) {
				newli.data("item-uuid", item.pages[i].uuid);
			}
			newli.data("item-title", item.pages[i].title);
			newli.data("item-name", item.pages[i].name);
			newli.data("item-hidden", item.pages[i].hidden ? true : false);
			if (item.pages[i].hidden) {
				newli.find(".btn.glyphicon-eye-open").removeClass("glyphicon-eye-open").addClass("glyphicon-eye-close");
			}

			if (item.pages[i].pages && item.pages[i].pages.length > 0) {
				newol = $("<ol class=\"dd-list\"></ol>");
				initChildren(item.pages[i], newol);
				newli.append(newol);
			}

			ol.append(newli);
		}
	};
	var initTree = function() {
		if (EDITTREE && EDITTREE.manifest) {
			initChildren(EDITTREE.manifest, $("#edittree > ol.dd-list"));
		}
		$("#edittree").change();
	};
	initTree();

	$("#edittree > .btn-toolbar > .btn-default").click(function(ev) {
		$("#edittree > ol.dd-list").empty();
		initTree();
	});

	$("#edittree > .btn-toolbar > .btn-primary").click(function(ev) {
		$("#mod-save").modal("show");

		$.ajax({
			method: "PUT",
			contentType: "application/json",
			data: JSON.stringify({
				section_title: $("#editsection").data("section-title"),
				tree: $("#edittree").nestable("serialize")
			}),
			processData: false,
			success: function(data, status, jqxhr) {
				$("#mod-save .modal-body p").text("Done!");
				EDITTREE.manifest = data;
				$("#edittree > ol.dd-list").empty();
				initTree();
			},
			error: function(jqxhr, status, error) {
				$("#mod-save .modal-body p").text("Error<br>" + "status<br>" + error);
			},
			complete: function(jqxhr, status) {
				$("#mod-save .btn-primary").removeAttr("disabled");
			}
		});

	});

	// visibility toggle
	$("#edittree").delegate(".dd-attr .glyphicon-eye-open", "click", function(ev) {
		$(this).removeClass("glyphicon-eye-open").addClass("glyphicon-eye-close").closest("li.dd-item").data("item-hidden", true);
	});
	$("#edittree").delegate(".dd-attr .glyphicon-eye-close", "click", function(ev) {
		$(this).removeClass("glyphicon-eye-close").addClass("glyphicon-eye-open").closest("li.dd-item").data("item-hidden", false);
	});
	$("#editsection").delegate(".dd-attr .glyphicon-eye-open", "click", function(ev) {
		$(this).removeClass("glyphicon-eye-open").addClass("glyphicon-eye-close");
		$("#editsection").data("section-hidden", true);
	});
	$("#editsection").delegate(".dd-attr .glyphicon-eye-close", "click", function(ev) {
		$(this).removeClass("glyphicon-eye-close").addClass("glyphicon-eye-open");
		$("#editsection").data("section-hidden", false);
	});

	var addChild = function(ev, ol) {
		var pagename = "i" + did;
		var pagetitle = "Item " + did++;

		var newli = $("<li class=\"dd-item\"><div class=\"dd-handle\"><span class=\"title\">" + pagetitle + "</span> <span class=\"url\"></span></div><div class=\"dd-content\"><div class=\"dd-attr\"><span class=\"btn glyphicon glyphicon-wrench\" data-toggle=\"modal\" data-target=\"#mod-edit-item\" title=\"Edit Details\"></span><span class=\"btn glyphicon glyphicon-plus\" title=\"Add Child Page\"></span><span class=\"btn glyphicon glyphicon-eye-open\" title=\"Toggle Page Visibility\"></span><span class=\"btn glyphicon glyphicon-remove-circle\" title=\"Remove Page\" data-toggle=\"modal\" data-target=\"#mod-remove\"></span></div></div></li>");
		newli.data("item-title", pagetitle);
		newli.data("item-name", pagename);
		newli.data("item-hidden", false);
		ol.append(newli);
		newli.find("[title]").tooltip({
			placement: "auto"
		});

		$("#edittree").change();
	};

	// add child
	$("#edittree").delegate(".dd-attr .glyphicon-plus", "click", function(ev) {
		var li = $(this).closest("li.dd-item");
		if (!li.children("ol.dd-list").length) {
			li.append("<ol class=\"dd-list\"></ol>");
		}
		return addChild(ev, li.children("ol.dd-list"));
	});
	$("#editsection").delegate(".dd-attr .glyphicon-plus", "click", function(ev) {
		return addChild(ev, $("#edittree > ol.dd-list"));
	});

	$("#mod-save").on("show.bs.modal", function(ev) {
		$("#mod-save p").text("Saving...");
		$("#mod-save .btn-primary").attr("disabled", "disabled");
	});
	$("#mod-save .btn-primary").click(function(ev) {
		$("#mod-save").modal("hide");
	});

	$("#mod-remove").on("show.bs.modal", function(ev) {
		var button = $(ev.relatedTarget);
		var item = button.closest(".dd-item");
		$("#mod-remove").find("span.page-title").text(item.data("item-title"));
		$("#mod-remove").find("button.btn-primary").data("remove-me", item);
	});

	$("#mod-edit-item").on("show.bs.modal", function(ev) {
		var item = $(ev.relatedTarget).closest(".dd-item");
		var title = item.data("item-title");
		var name = item.data("item-name");

		$("#mod-edit-item-name").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-item-name").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-item-name").siblings(".help-block").text("");
		$("#mod-edit-item-title").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-item-title").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-item-title").siblings(".help-block").text("");

		$("#mod-edit-item-name").val(name);
		$("#mod-edit-item-title").val(title);
		$("#mod-edit-item").find("button.btn-primary").data("edit-me", item);
	});

	$("#mod-edit-section").on("show.bs.modal", function(ev) {
		var title = $("#editsection").data("section-title");

		$("#mod-edit-section-title").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-section-title").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-section-title").siblings(".help-block").text("");

		$("#mod-edit-section-title").val(title);
		$("#mod-edit-section-vpriv").text(EDITTREE.manifest.view_priv);
		$("#mod-edit-section-epriv").text(EDITTREE.manifest.edit_priv);
		$("#mod-edit-section-tpriv").text(EDITTREE.manifest.tree_priv);
	});

	$("#mod-remove button.btn-primary").click(function(ev) {
		var rm = $(this).data("remove-me");
		if (rm) {
			rm.remove();
		}
		$("#mod-remove").modal("hide");
	});

	$("#mod-edit-item-name").on("change", function(ev) {
		$("#mod-edit-item-name").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-item-name").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-item-name").siblings(".help-block").text("");

		var name = $("#mod-edit-item-name").val();
		var err = false;
		name = name.replace(/[^a-zA-Z0-9_\-]/g, "");
		if (name) {
			name = name.toLowerCase();
			$("#mod-edit-item-name").val(name);
			if (name === "edittree") {
				err = "that is a reserved name";
			} else {
				// check for duplicates            
				$("#mod-edit-item .btn-primary").data("edit-me").siblings(".dd-item").each(function(idx, el) {
					if ($(el).data("item-name") === name) {
						err = "page names must be unique among siblings";
					}
				});
			}
		} else {
			err = "this is a required value";
		}

		if (err) {
			$("#mod-edit-item-name").closest(".form-group").addClass("has-error").addClass("has-feedback");
			$("#mod-edit-item-name").siblings(".form-control-feedback").addClass("glyphicon-warning-sign");
			$("#mod-edit-item-name").siblings(".help-block").text(err);
		} else {
			$("#mod-edit-item-name").closest(".form-group").addClass("has-success").addClass("has-feedback");
			$("#mod-edit-item-name").siblings(".form-control-feedback").addClass("glyphicon-ok");
		}
	});

	$("#mod-edit-item-title").on("change", function(ev) {
		$("#mod-edit-item-title").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-item-title").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-item-title").siblings(".help-block").text("");

		var title = $("#mod-edit-item-title").val();
		var err = false;
		if (!title) {
			err = "this is a required value";
		}

		if (err) {
			$("#mod-edit-item-title").closest(".form-group").addClass("has-error").addClass("has-feedback");
			$("#mod-edit-item-title").siblings(".form-control-feedback").addClass("glyphicon-warning-sign");
			$("#mod-edit-item-title").siblings(".help-block").text(err);
		} else {
			$("#mod-edit-item-title").closest(".form-group").addClass("has-success").addClass("has-feedback");
			$("#mod-edit-item-title").siblings(".form-control-feedback").addClass("glyphicon-ok");
		}
	});

	$("#mod-edit-section-title").on("change", function(ev) {
		$("#mod-edit-section-title").closest(".form-group").removeClass("has-error").removeClass("has-success").removeClass("has-feedback");
		$("#mod-edit-section-title").siblings(".form-control-feedback").removeClass("glyphicon-warning-sign").removeClass("glyphicon-ok");
		$("#mod-edit-section-title").siblings(".help-block").text("");

		var title = $("#mod-edit-section-title").val();
		var err = false;
		if (!title) {
			err = "this is a required value";
		}

		if (err) {
			$("#mod-edit-section-title").closest(".form-group").addClass("has-error").addClass("has-feedback");
			$("#mod-edit-section-title").siblings(".form-control-feedback").addClass("glyphicon-warning-sign");
			$("#mod-edit-section-title").siblings(".help-block").text(err);
		} else {
			$("#mod-edit-section-title").closest(".form-group").addClass("has-success").addClass("has-feedback");
			$("#mod-edit-section-title").siblings(".form-control-feedback").addClass("glyphicon-ok");
		}
	});

	$("#mod-edit-item button.btn-primary").click(function(ev) {
		if ($("#mod-edit-item-name").closest(".form-group").hasClass("has-error") ||
			$("#mod-edit-item-title").closest(".form-group").hasClass("has-error")) {
			// do nothing
		} else if ($("#mod-edit-item-name").closest(".form-group").hasClass("has-success") ||
			$("#mod-edit-item-title").closest(".form-group").hasClass("has-success")) {
			// apply changes
			var name = $("#mod-edit-item-name").val();
			var title = $("#mod-edit-item-title").val();
			var item = $(this).data("edit-me");
			item.data("item-name", name);
			item.data("item-title", title);
			$("#mod-edit-item").modal("hide");
			$("#edittree").change();
		} else {
			// do nothing but close
			$("#mod-edit-item").modal("hide");
		}
	});

	$("#mod-edit-section button.btn-primary").click(function(ev) {
		if ($("#mod-edit-section-title").closest(".form-group").hasClass("has-error")) {
			// do nothing
		} else if ($("#mod-edit-section-title").closest(".form-group").hasClass("has-success")) {
			// apply changes
			var title = $("#mod-edit-section-title").val();
			$("#editsection").data("section-title", title);
			$("#editsection .title").text(title);
			$("#mod-edit-section").modal("hide");
		} else {
			// do nothing but close
			$("#mod-edit-section").modal("hide");
		}
	});

});
