/* global jQuery: false */
"use strict";

var RFF = RFF || {};
RFF.MembersList = {};

(function($) {
	var //ME = RFF.MemberList,

	/* private functions */
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

	_Ready = function() {
		var i = 0;
		var newt = null;
		var evechar = null;
		$.getJSON("/api/evechars", function(data, status, xhr) {
			RFF.EVECharList = data;

			$.getJSON("/api/members", function(data, status, xhr) {                
				for (i = 0; i < data.length; i++) {
					evechar = RFF.GetEVEChar(data[i].ContractAlt.name);
					newt = $("<tr><td><a href=\"/members/" + data[i].id + "\">detail</a></td><td>" + data[i].ApplicationNo + "</td><td>" + evechar.Name + "</td><td>" + data[i].CorpRole + "</td><td>" + data[i].CorpStatus + "</td><td>" + (data[i].FreighterAlts ? data[i].FreighterAlts.length : 0) + "</td></tr>");
                    $("#mlist tbody").append(newt);
				}
                $("#tload").hide();
			});
		});
	};

	$(_Ready);

})(jQuery);
