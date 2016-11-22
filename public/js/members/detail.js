/* global jQuery: false */
/* global window: false */
"use strict";

var RFF = RFF || {};
RFF.MembersDetail = {};

(function($) {
	var ME = RFF.MembersDetail,
		//_LangList = [],

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
		var newli = null;
		var evechar = null;
		if ($("li.AddEVEChar").length) {
			$.getJSON("/api/evechars", function(data, status, xhr) {
				RFF.EVECharList = data;
				$("li.AddEVEChar input").autocomplete({
					"source": RFF.AutoCompleteChar,
					"delay": 0,
					"minLength": 2,
					"autoFocus": true,
					"change": RFF.EVECharValidate,
					"select": RFF.EVECharValidate
				});
				$("li.AddEVEChar input").keydown(function(ev) {
					if (ev.which === 13) {
						ev.preventDefault();
						ev.stopPropagation();
						$(ev.target).trigger("blur");
						ME.RefocusFlag = true;
						if ($(ev.target).siblings("button").attr("disabled") !== "disabled") {
							$(ev.target).siblings("button").trigger("click");
							$(ev.target).focus();
						}
					}
				});

				$("li.AddEVEChar button").click(function(ev) {
					var newli = $("<li class=\"EVEChar\"><span>" + $(ev.target).siblings("input").data("Name") + "</span> <button>x</button></li>");
					newli.data("newID", $(ev.target).siblings("input").data("newID"));
					newli.data("setID", $(ev.target).siblings("input").data("setID"));
					newli.data("Name", $(ev.target).siblings("input").data("Name"));

					$(ev.target).attr("disabled", "disabled");
					$(ev.target).siblings("input").data("newID", null);
					$(ev.target).siblings("input").data("setID", null);
					$(ev.target).siblings("input").data("Name", null);
					$(ev.target).siblings("input").val("");
					$(ev.target).siblings("span").text("");

					if ($(ev.target).closest("ul").attr("id") === "ContractAlt") {
						// singleton, hide add dialog
						$(ev.target).closest("li.AddEVEChar").hide();
					}

					$(ev.target).closest("li.AddEVEChar").before(newli);
				});

				$("li.AddEVEChar button").closest("ul").on("click", "li.EVEChar button", function(ev) {
					//window.alert($(ev.target).closest("ul").attr("id"));
					if ($(ev.target).closest("ul").attr("id") === "ContractAlt") {
						// singleton, show add dialog
						$(ev.target).closest("ul").children("li.AddEVEChar").show();
					}
					$(ev.target).closest("li.EVEChar").detach();
				});

				$("li.AddEVEChar input").removeAttr("disabled");

				if ($("#addsavembr").length && RFF.CurMember) {
					if (RFF.CurMember.newflag) {
						$("#addsavembr").text("Create");
					}
					if (RFF.CurMember.ContractAlt) {
						evechar = RFF.GetEVEChar(RFF.CurMember.ContractAlt.name);
						newli = $("<li class=\"EVEChar\"><span>" + evechar.Name + "</span> <button>x</button></li>");
						newli.data("setID", evechar.id);
						$("#ContractAlt li.AddEVEChar").hide();
						$("#ContractAlt li.AddEVEChar").before(newli);
					}
					if (RFF.CurMember.ApplicationNo) {
						$("#ApplicationNo").val(RFF.CurMember.ApplicationNo);
					}
					if (RFF.CurMember.CorpStatus) {
						$("#CorpStatus").val(RFF.CurMember.CorpStatus);
					}
					if (RFF.CurMember.CorpRole) {
						$("#CorpRole").val(RFF.CurMember.CorpRole);
					}
					if (RFF.CurMember.Notes) {
						$("#Notes").val(RFF.CurMember.Notes);
					}

					if (RFF.CurMember.Languages) {
						for (i = 0; i < RFF.CurMember.Languages.length; i++) {
							newli = $("<li class=\"SimpleText\"><span>" + RFF.CurMember.Languages[i] + "</span> <button>x</button></li>");
							$("#Languages li.AddSimpleText").before(newli);
						}
					}
					if (RFF.CurMember.FreighterAlts) {
						for (i = 0; i < RFF.CurMember.FreighterAlts.length; i++) {
							evechar = RFF.GetEVEChar(RFF.CurMember.FreighterAlts[i].name);
							newli = $("<li class=\"EVEChar\"><span>" + evechar.Name + "</span> <button>x</button></li>");
							newli.data("setID", evechar.id);
							$("#FreighterAlts li.AddEVEChar").before(newli);
						}
					}
					if (RFF.CurMember.PreviousContractAlts) {
						for (i = 0; i < RFF.CurMember.PreviousContractAlts.length; i++) {
							evechar = RFF.GetEVEChar(RFF.CurMember.PreviousContractAlts[i].name);
							newli = $("<li class=\"EVEChar\"><span>" + evechar.Name + "</span> <button>x</button></li>");
							newli.data("setID", evechar.id);
							$("#PreviousContractAlts li.AddEVEChar").before(newli);
						}
					}
					if (RFF.CurMember.OtherCharacters) {
						for (i = 0; i < RFF.CurMember.OtherCharacters.length; i++) {
							evechar = RFF.GetEVEChar(RFF.CurMember.OtherCharacters[i].name);
							newli = $("<li class=\"EVEChar\"><span>" + evechar.Name + "</span> <button>x</button></li>");
							newli.data("setID", evechar.id);
							$("#OtherCharacters li.AddEVEChar").before(newli);
						}
					}
					if (RFF.CurMember.Emails) {
						for (i = 0; i < RFF.CurMember.Emails.length; i++) {
							newli = $("<li class=\"SimpleText\"><span>" + RFF.CurMember.Emails[i] + "</span> <button>x</button></li>");
							$("#Emails li.AddSimpleText").before(newli);
						}
					}
					if (RFF.CurMember.PhoneNumbers) {
						for (i = 0; i < RFF.CurMember.PhoneNumbers.length; i++) {
							newli = $("<li class=\"SimpleText\"><span>" + RFF.CurMember.PhoneNumbers[i] + "</span> <button>x</button></li>");
							$("#PhoneNumbers li.AddSimpleText").before(newli);
						}
					}
				}

				$("#addsavembr").click(function(ev) {
					if (RFF.CurMember.newflag) {
						$("#addsavembr").attr("disabled", "disabled").siblings("span").text(" ... creating ...");
					} else {
						$("#addsavembr").attr("disabled", "disabled").siblings("span").text(" ... saving ...");
					}

					var newchars = [];
					var setID = null;
					var newID = null;
					var Name = null;
					var idname = null;
					var update = {
						id: RFF.CurMember.id,
						ApplicationNo: $("#ApplicationNo").val() ? $("#ApplicationNo").val() : null,
						CorpStatus: $("#CorpStatus").val() ? $("#CorpStatus").val() : null,
						CorpRole: $("#CorpRole").val() ? $("#CorpRole").val() : null,
						Notes: $("#Notes").val() ? $("#Notes").val() : null
					};

					if ($("#ContractAlt li.EVEChar").length > 0) {
						setID = $("#ContractAlt li.EVEChar").first().data("setID");
						newID = $("#ContractAlt li.EVEChar").first().data("newID");
						Name = $("#ContractAlt li.EVEChar").first().data("Name");
						idname = "";
						if (setID) {
							idname = setID + "#";
						} else {
							idname = newID + "#";
							newchars.push({
								id: newID,
								Name: Name,
								Corp: null,
								Notes: null
							});
						}
						update.ContractAlt = {
							name: idname,
							kind: "EVEChar"
						};
					} else {
						update.ContractAlt = null;
					}

					if ($("#FreighterAlts li.EVEChar").length > 0) {
						update.FreighterAlts = [];
						$("#FreighterAlts li.EVEChar").each(function(idx) {
							setID = $(this).data("setID");
							newID = $(this).data("newID");
							Name = $(this).data("Name");
							idname = "";
							if (setID) {
								idname = setID + "#";
							} else {
								idname = newID + "#";
								newchars.push({
									id: newID,
									Name: Name,
									Corp: null,
									Notes: null
								});
							}
							update.FreighterAlts.push({
								name: idname,
								kind: "EVEChar"
							});

						});
					} else {
						update.FreighterAlts = null;
					}

					if ($("#PreviousContractAlts li.EVEChar").length > 0) {
						update.PreviousContractAlts = [];
						$("#PreviousContractAlts li.EVEChar").each(function(idx) {
							setID = $(this).data("setID");
							newID = $(this).data("newID");
							Name = $(this).data("Name");
							idname = "";
							if (setID) {
								idname = setID + "#";
							} else {
								idname = newID + "#";
								newchars.push({
									id: newID,
									Name: Name,
									Corp: null,
									Notes: null
								});
							}
							update.PreviousContractAlts.push({
								name: idname,
								kind: "EVEChar"
							});

						});
					} else {
						update.PreviousContractAlts = null;
					}

					if ($("#OtherCharacters li.EVEChar").length > 0) {
						update.OtherCharacters = [];
						$("#OtherCharacters li.EVEChar").each(function(idx) {
							setID = $(this).data("setID");
							newID = $(this).data("newID");
							Name = $(this).data("Name");
							idname = "";
							if (setID) {
								idname = setID + "#";
							} else {
								idname = newID + "#";
								newchars.push({
									id: newID,
									Name: Name,
									Corp: null,
									Notes: null
								});
							}
							update.OtherCharacters.push({
								name: idname,
								kind: "EVEChar"
							});

						});
					} else {
						update.OtherCharacters = null;
					}

					if ($("#Languages li.SimpleText").length > 0) {
						update.Languages = [];
						$("#Languages li.SimpleText").each(function(idx) {
							update.Languages.push($(this).children("span").text());
						});
					} else {
						update.Languages = null;
					}

					if ($("#Emails li.SimpleText").length > 0) {
						update.Emails = [];
						$("#Emails li.SimpleText").each(function(idx) {
							update.Emails.push($(this).children("span").text());
						});
					} else {
						update.Emails = null;
					}

					if ($("#PhoneNumbers li.SimpleText").length > 0) {
						update.PhoneNumbers = [];
						$("#PhoneNumbers li.SimpleText").each(function(idx) {
							update.PhoneNumbers.push($(this).children("span").text());
						});
					} else {
						update.PhoneNumbers = null;
					}

					var newchars2 = [];
					var newcharsidx = {};
					for (i = 0; i < newchars.length; i++) {
						if (newcharsidx[newchars[i].id]) {
							continue;
						}
						newcharsidx[newchars[i].id] = true;
						newchars2.push(newchars[i]);
					}

					if (RFF.CurMember.newflag) {
						$.ajax({
							type: "POST",
							contentType: "application/json",
							url: "/api/members",
							data: JSON.stringify(update),
							dataType: "json",
							success: function(data) {
                                var newUri = "/members/" + data.id;
								if (newchars2.length) {
									$.ajax({
										type: "POST",
										contentType: "application/json",
										url: "/api/evechars",
										data: JSON.stringify(newchars2),
										dataType: "json",
										success: function(data) {
											$("#addsavembr").siblings("span").text(" OK, reloading");
											window.location.pathname = newUri;
                                            //window.location.reload();
										},
										error: function(xhr, status, err) {
											$("#addsavembr").siblings("span").text(" newchars fail: " + err);
                                            window.location.pathname = newUri;
											//$("#addsavembr").removeAttr("disabled");
										}
									});
								} else {
									$("#addsavembr").siblings("span").text(" OK, reloading");
									window.location.pathname = newUri;
                                    //window.location.reload();
								}
							},
							error: function(xhr, status, err) {
								$("#addsavembr").siblings("span").text(" fail: " + err);
								$("#addsavembr").removeAttr("disabled");
							}
						});
					} else {
						$.ajax({
							type: "PUT",
							contentType: "application/json",
							url: "/api/members/" + update.id,
							data: JSON.stringify(update),
							dataType: "json",
							success: function(data) {
								if (newchars2.length) {
									$.ajax({
										type: "POST",
										contentType: "application/json",
										url: "/api/evechars",
										data: JSON.stringify(newchars2),
										dataType: "json",
										success: function(data) {
											$("#addsavembr").siblings("span").text(" OK, reloading");
											window.location.reload();
										},
										error: function(xhr, status, err) {
											$("#addsavembr").siblings("span").text(" newchars fail: " + err);
											$("#addsavembr").removeAttr("disabled");
										}
									});
								} else {
									$("#addsavembr").siblings("span").text(" OK, reloading");
									window.location.reload();

								}
							},
							error: function(xhr, status, err) {
								$("#addsavembr").siblings("span").text(" fail: " + err);
								$("#addsavembr").removeAttr("disabled");
							}
						});
					}
				});
				$("#addsavembr").removeAttr("disabled");

			});
		}

		if ($("li.AddSimpleText").length) {
			$("li.AddSimpleText input").keydown(function(ev) {
				if (ev.which === 13) {
					ev.preventDefault();
					ev.stopPropagation();
					if ($(ev.target).siblings("button").attr("disabled") !== "disabled") {
						$(ev.target).trigger("blur");
						$(ev.target).siblings("button").trigger("click");
						$(ev.target).focus();
					}
				}
			});

			$("li.AddSimpleText button").click(function(ev) {
				var val = String($(ev.target).siblings("input").val()).trim();
				if (val.length > 0) {
					var newli = $("<li class=\"SimpleText\"><span>" + $(ev.target).siblings("input").val() + "</span> <button>x</button></li>");
					newli.data("val", $(ev.target).siblings("input").val());
					$(ev.target).closest("li.AddSimpleText").before(newli);
				}

				$(ev.target).siblings("input").val("");
			});

			$("li.AddSimpleText button").closest("ul").on("click", "li.SimpleText button", function(ev) {
				$(ev.target).closest("li.SimpleText").detach();
			});

			$("li.AddSimpleText input").removeAttr("disabled");
			$("li.AddSimpleText button").removeAttr("disabled");
		}

        /*
		if ($("li.AddLanguage").length) {
			$.getJSON("/langs.json", function(data, status, xhr) {
				_LangList = data;
				$("li.AddLanguage input").autocomplete({
					"source": _LangList,
					"delay": 0,
					"minLength": 0,
					"autoFocus": true
				});

				$("li.AddLanguage input").keydown(function(ev) {
					if (ev.which === 13) {
						ev.preventDefault();
						ev.stopPropagation();
						if ($(ev.target).siblings("button").attr("disabled") !== "disabled") {
							$(ev.target).trigger("blur");
							$(ev.target).siblings("button").trigger("click");
							$(ev.target).focus();
						}
					}
				});

				$("li.AddLanguage button").click(function(ev) {
					var val = String($(ev.target).siblings("input").val()).trim();
					if (val.length > 0) {
						var newli = $("<li class=\"Language\"><span>" + $(ev.target).siblings("input").val() + "</span> <button>x</button></li>");
						newli.data("val", $(ev.target).siblings("input").val());
						$(ev.target).closest("ul").prepend(newli);
					}

					$(ev.target).siblings("input").val("");
				});

				$("li.AddLanguage button").closest("ul").on("click", "li.Language button", function(ev) {
					$(ev.target).closest("li.Language").detach();
				});

				$("li.AddLanguage input").removeAttr("disabled");
				$("li.AddLanguage button").removeAttr("disabled");
			});
		}
        */
	};

	$(_Ready);

})(jQuery);
