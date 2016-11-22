/* global EVEoj: false */
/* global window: false */
/* global document: false */
/* global jQuery: false */
var RFFTC = RFFTC || {};

(function($) {
	var ME = RFFTC,
		_src = null,
		_map = null,
		_CSysList = [],
		_curStep = 1,

		/* private functions */
		_AutoComplete, // provides custom jquery.ui.AutoCompletion list
		_UpdatePrice, // updates the price displayed and fields allowed
		_PrevStep, // go to previous step of contract tutorial
		_NextStep, // go to next step of contract tutorial
		_CopyClick, // click handler for copy icon for corp/price info
		_KMapDone, // callback for the EVEoj.map load promise (done)
		_KMapFail, // callback for the EVEoj.map load promise (fail)
		_SourceDone, // callback for the EVEoj.SDD load promise (done)
		_SourceFail, // callback for the EVEoj.SDD load promise (fail)
		_Ready // the initial stuff to run once DOM is ready
	;

	ME.corpInfo = {
		rff: {
			name: "Red Frog Freight",
			id: 1495741119
		},
		bfl: {
			name: "Black Frog Logistics",
			id: 384667640
		}
	};

	_AutoComplete = function(q, synccb, asynccb) {
		var matcher = new RegExp("^" + q, "i"),
			matches = [],
			i;

		for (i = 0; i < _CSysList.length; i++) {
			if (matcher.test(_CSysList[i].value)) matches.push(_CSysList[i]);
		}
		synccb(matches);
	};

	_UpdatePrice = function() {
		var fromName,
			fromSys,
			toName,
			toSys,
			invalid,
			svc,
			length,
			route,
			nullflag,
			timeS,
			timeF,
			jump_s,
			collat,
			collattxt,
			maxsize,
			corp,
			corp_id,
			rush,
			exptime,
			comptime,
			price,
			multi;

		// reset the current display
		$("#outerr").html("");
		$("#price").data("val", -1);
		$("#price, .reward").text("--");
		$("#length").text("--");
		$(".maxsize").text("--");
		$("#corpclick").data("igb-corpid", -1);
		$("#corpclick").text("--");
		$(".comptime").text("--");
		$(".exptime").text("--");
		$(".collat").text("--");
		$(".shipto").text("--");

		fromName = $("#pickup").typeahead("val");
		toName = $("#dropoff").typeahead("val");

		// validate we have good start and end systems
		fromSys = _map.GetSystem({
			name: fromName
		});
		toSys = _map.GetSystem({
			name: toName
		});

		// NPC systems must have a station to be valid
		if (fromSys && fromSys.factionID !== null && fromSys.stationCount < 1) fromSys = null;
		if (toSys && toSys.factionID !== null && toSys.stationCount < 1) toSys = null;

		if (fromSys === null || toSys === null) {
			invalid = [];
			if (fromName === "" || toName === "") return;
			if (fromSys === null) invalid.push("pickup system");
			if (toSys === null) invalid.push("dropoff system");
			$("#outerr").html("<div class=\"ui-widget\"><div class=\"ui-state-highlight ui-corner-all\"><p><span class=\"ui-icon ui-icon-info\"></span>Invalid " + invalid.join(" and ") + ". Check the spelling of your system name. NPC systems without a station are not allowed.");

			// reset collat and size to default, unset state
			$("#size").prop("disabled", true).html("<option value=\"0\" selected>set route</option>");
			$("div.rush").css("visibility", "hidden");

			return;
		}

		// set service type based on route/collateral
		svc = "rff";
		if (!fromSys.contiguous || !toSys.contiguous) svc = "bfl";
		collat = $("#collat").val();
		if (collat > 1) svc = "bfl";

		// figure out number of jumps/LY for this route based on service type
		length = -1;
		route = "--";
		nullflag = false;
		if (svc == "rff") {
			if (fromSys.ID == toSys.ID) {
				length = 1;
			} else {
				timeS = (new Date()).getTime();
				route = _map.Route(fromSys.ID, toSys.ID, [], true, false);
				timeF = (new Date()).getTime();
				length = route.length;
			}
			if (length < 1) {
				$("#outerr").html("<div class=\"ui-widget\"><div class=\"ui-state-highlight ui-corner-all\"><p><span class=\"ui-icon ui-icon-info\"></span>Invalid route calculation. That's odd. Try refreshing the page?");
				return;
			}
			jump_s = "";
			if (length > 1) jump_s = "s";
			route = length + " jump" + jump_s;
		} else if (svc == "bfl") {
			if (fromSys.ID == toSys.ID) {
				length = 0;
			} else {
				length = _map.JumpDist(fromSys.ID, toSys.ID).toFixed(2);
			}
			route = length + " LY";
			if (fromSys.sec < 0.1 || toSys.sec < 0.1) nullflag = true;
		}

		collattxt = collat + "B ISK";

		// figure out correct corp details
		corp = ME.corpInfo[svc].name;
		corp_id = ME.corpInfo[svc].id;
		rush = false;
		exptime = "--";
		comptime = "--";
        maxsize = 0;
		if (svc == "rff") {
			maxsize = 845000;
			$("#rush").removeAttr("disabled");
			rush = $("#rush").is(":checked");
			comptime = "1";
			if (rush) exptime = "1 Day";
			else exptime = "3 Days";
		} else if (svc == "bfl") {
			maxsize = 320000;
			$("#rush").removeAttr("checked").attr("disabled", "disabled");
			if (nullflag) comptime = "7";
			else comptime = "3";
			exptime = "7 Days";
		}

		// calculate the price
		price = -1;
		if (svc == "rff") {
			if (!rush) {
				price = 3500000 + (length * 1500000);
			} else {
				price = 10000000 + (length * 5000000);
			}
		} else if (svc == "bfl") {
			// null sec = 140m base
			// low sec = 40m base
			// distance charge: +50m per 10 LY
			// collat charge: 10m per 1B up to 5B, 50m per 2.5B after 5B
			multi = Math.ceil(length / 10);
			if (nullflag) {
				price = 140000000;
			} else {
				price = 40000000;
			}
			price += multi * 50000000;
			if (collat < 6) {
				price += (collat * 10000000);
			} else {
                price += 50000000 + (((collat - 5) / 2.5) * 50000000);
			}
		}

		$(".shipto").text(toName);
		$("#price").data("val", price);
		$("#price, .rewardx").text(EVEoj.Utils.FormatNum(price, 0) + " ISK");
		$(".reward").text(price);
		$("#length").text(route);
		$(".maxsize").text(EVEoj.Utils.FormatNum(maxsize, 0) + " m³");
		$("#corpclick").data("igb-corpid", corp_id);
		$("#corpclick, .corpname").text(corp);
		$(".comptime").text(comptime);
		$(".exptime").text(exptime);
		$(".collat").text(collattxt);
	};

	_PrevStep = function(ev) {
		_curStep--;
		$(".nextstep").prop("disabled", false);
		if (_curStep < 1) _curStep = 1;
		$(".step1, .step2, .step3, .step4").hide();
		$(".step" + _curStep).show();
		$(".stepnav .stepnum").text(_curStep);
		if (_curStep == 1) $(".prevstep").prop("disabled", true);
	};
	_NextStep = function(ev) {
		_curStep++;
		$(".prevstep").prop("disabled", false);
		if (_curStep > 4) _curStep = 4;
		$(".step1, .step2, .step3, .step4").hide();
		$(".step" + _curStep).show();
		$(".stepnav .stepnum").text(_curStep);
		if (_curStep == 4) $(".nextstep").prop("disabled", true);
	};

	_CopyClick = function(ev) {
		var s,
			r;

		if ($(ev.target).hasClass("copyprice")) {
			if (window.getSelection) {
				s = window.getSelection();
				r = document.createRange();
				$("#price").text($("#price").data("val"));
				r.selectNodeContents($("#price").get(0));
				s.removeAllRanges();
				s.addRange(r);
			}
		} else if ($(ev.target).hasClass("copycorp")) {
			if (window.getSelection) {
				s = window.getSelection();
				r = document.createRange();
				r.selectNodeContents($("#corpclick").get(0));
				s.removeAllRanges();
				s.addRange(r);
			}
		}
	};

	_KMapDone = function(arg) {
		_CSysList = [];
		var sys_iter,
			sys,
			//sec,
			map = arg.map;

		sys_iter = map.GetSystems();
		while (sys_iter.HasNext()) {
			sys = sys_iter.Next();
            if (!sys.contiguous || sys.stationCount < 1) continue; // high-sec stations only
			_CSysList.push({
				value: sys.name,
				sec: "high"
			});
            
			/*
            if (sys.factionID !== null && sys.stationCount < 1) continue; // NPC space with no stations
			sec = "high";
			if (sys.sec >= 0.5 && !sys.contiguous) sec = "isle";
			if (sys.sec < 0.5) sec = "low";
			if (sys.sec < 0.1) sec = "null";
			_CSysList.push({
				value: sys.name,
				sec: sec
			});
            */
		}
		_CSysList.sort(function(a, b) {
			return a.value.localeCompare(b.value);
		});
		$(".sysbox input").typeahead({
			hint: false,
			minLength: 1
		}, {
			name: "sys",
			source: _AutoComplete,
			display: "value",
			templates: {
				suggestion: function(data) {
					return "<div>" + data.value + "<span class=\"seclbl\">" + data.sec + "</span></div>";
				}
			}
		}).bind("typeahead:select", function(ev, sug) {
			_UpdatePrice();
		}).bind("typeahead:autocomplete", function(ev, sug) {
			_UpdatePrice();
		}).bind("typeahead:change", function(ev) {
			var i = 0;
			var val = $(ev.target).typeahead("val").toLowerCase();
			var ttinput = $(ev.target).data("ttTypeahead").input;
			for (i = 0; i < _CSysList.length; i++) {
				if (_CSysList[i].value.toLowerCase() === val) {
					ttinput.setQuery(_CSysList[i].value, true);
					break;
				}
			}
			_UpdatePrice();
		});
		$("#size, #collat").change(_UpdatePrice);
		$("input[name='rush']").change(_UpdatePrice);

		$("#calcload").hide();

		// TODO: parse GET args

		$("#calculator").show();
		$("#pickup").focus();
		_UpdatePrice();
	};
	_KMapFail = function(arg) {
		$("#calcload").html("<div class=\"ui-widget\"><div class=\"ui-state-error ui-corner-all\"><p><span class=\"ui-icon ui-icon-info\"></span>Error loading data: " + arg.status + " - " + arg.error + "</p></div></div>");
	};

	_SourceDone = function(arg) {
		var src = arg.source;
		_map = EVEoj.map.Create(src, "K");
		_map.Load().then(_KMapDone, _KMapFail);
	};
	_SourceFail = function(arg) {
		$("#calcload").html("<div class=\"ui-widget\"><div class=\"ui-state-error ui-corner-all\"><p><span class=\"ui-icon ui-icon-info\"></span>Error loading data: " + arg.status + " - " + arg.error + "</p></div></div>");
	};

	_Ready = function() {
		// create courier accordion-ize
		// $('.courier-help').show().accordion({ 'header': 'h2', 'active': false, 'collapsible': true });

		// click handlers for copy icons
		$(".copyprice, .copycorp").click(_CopyClick);

		// buttons for create contract tutorial (default at step 1 with correct state)
		_curStep = 1;
		$(".prevstep").prop("disabled", true);
		$(".nextstep").prop("disabled", false);
		$(".prevstep").click(_PrevStep);
		$(".nextstep").click(_NextStep);

		// get the EVEoj SDD source we need
		_src = EVEoj.SDD.Create("json", {
			path: "//cf.eve-oj.com/sdd/201605310"
		});
		_src.LoadMeta().then(_SourceDone, _SourceFail);
	};

	$(_Ready);

})(jQuery);
