/* global jQuery: false */
"use strict";

var RFF = RFF || {};

(function($) {
	var ME = RFF,
		/* private functions */
		_EVECharValidate2,
		/*
		_UpdatePrice, // updates the price displayed and fields allowed
		_PrevStep, // go to previous step of contract tutorial
		_NextStep, // go to next step of contract tutorial
		_CopyClick, // click handler for copy icon for corp/price info
		_KMapDone, // callback for the EVEoj.map load promise (done)
		_KMapFail, // callback for the EVEoj.map load promise (fail)
		_SourceDone, // callback for the EVEoj.SDD load promise (done)
		_SourceFail, // callback for the EVEoj.SDD load promise (fail)
        */
		_Ready // the initial stuff to run once DOM is ready
	;

	ME.EVECharList = [];

	ME.corpInfo = {
		"rff": {
			"name": "Red Frog Freight",
			"id": 1495741119
		},
		"bff": {
			"name": "Blue Frog Freight",
			"id": 98003832
		},
		"bfl": {
			"name": "Black Frog Logistics",
			"id": 384667640
		}
	};

	ME.AutoCompleteChar = function(request, response) {
		var matcher = new RegExp("^" + $.ui.autocomplete.escapeRegex(request.term), "i"),
			matches = [],
			i;

		for (i = 0; i < ME.EVECharList.length; i++) {
			if (matcher.test(ME.EVECharList[i].Name)) matches.push(ME.EVECharList[i].Name);
		}
		response(matches);
	};

	ME.EVECharValidate = function(ev, ui) {
		$(ev.target).siblings("button").attr("disabled", "disabled");
		$(ev.target).data("newID", null);
		$(ev.target).data("setID", null);
		$(ev.target).data("Name", null);

		var newChar = null;
		if (ev && ui) {
			if (ev.type === "autocompletechange") {
				newChar = $(ev.target).val();
			} else if (ev.type === "autocompleteselect") {
				newChar = ui.item.value;
			} else {
				return;
			}
		}

		if (!newChar) {
			$(ev.target).siblings("span").text("");
			return;
		}

		var found = false;
		for (var i = 0; i < ME.EVECharList.length; i++) {
			if (newChar === ME.EVECharList[i].Name) {
				found = true;
				$(ev.target).data("setID", ME.EVECharList[i].id);
				$(ev.target).data("Name", ME.EVECharList[i].Name);
				break;
			}
		}

		if (!found) {
			// check EVE api
			$(ev.target).attr("disabled", "disabled");
			$(ev.target).siblings("span").text(" ... asking CCP ...");
			$.ajax({
				type: "GET",
				url: "https://api.eveonline.com/eve/CharacterID.xml.aspx?names=" + encodeURI(newChar),
				dataType: "xml",
				success: function(xml) {
					var found = 0;
					var name = null;
					$(xml).find("row").first().each(function() {
						name = $(this).attr("name");
						found = $(this).attr("characterID");
					});
					_EVECharValidate2(ev, found, name);
				},
				error: function(xhr, status, err) {
					$(ev.target).siblings("span").text(" fail: " + err);
					$(ev.target).removeAttr("disabled");
				}
			});
		} else {
			_EVECharValidate2(ev, found, null);
		}
	};

	_EVECharValidate2 = function(ev, found, name) {
		if (found && found !== "0") {
			if (name) {
				$(ev.target).val(name);
				$(ev.target).data("Name", name);
			}
			if (found !== true) {
				$(ev.target).data("newID", found);
			}
			$(ev.target).siblings("span").text(" OK");
			$(ev.target).siblings("button").removeAttr("disabled");
		} else {
			$(ev.target).siblings("span").text(" invalid character");
		}
		$(ev.target).removeAttr("disabled");
		if (ME.RefocusFlag) {
			ME.RefocusFlag = false;
			$(ev.target).focus();
		}
	};

	ME.GetEVEChar = function(idname) {
		var id = parseInt(idname.replace("#", ""), 10);
		for (var i = 0; i < ME.EVECharList.length; i++) {
			if (ME.EVECharList[i].id == id) {
				return ME.EVECharList[i];
			}
		}
		return {
			id: id,
			Name: "EVEChar#" + id,
			fake: true
		};
	};

	_Ready = function() {
		$("#leftmenu__inner").perfectScrollbar();
		$("[title]").tooltip({
			placement: "auto"
		});
		//$("#shortfaq").show();
		/*
		$("#shortfaq").show().accordion({
			"header": "h4",
			"active": false,
			"collapsible": true
		});
        */
		$("#leftmenu__burger").click(function(ev) {
            $("#leftmenu").toggleClass("open");
            $(".navbar-fixed-top h1").toggleClass("open");
            $("#leftmenu__burger").toggleClass("open");
            $("#leftmenu__burger span.glyphicon").toggleClass("glyphicon-menu-hamburger").toggleClass("glyphicon-remove-circle");
			//window.alert("click");
		});
	};

	$(_Ready);

})(jQuery);
