/* global window: false */
/* global document: false */
/* global $: false */
/* global SimpleMDE: false */
$(document).ready(function() {
    var mde;
    
    var save = function (editor) {
		$("#mod-save").modal("show");

        $.ajax({
			method: "PUT",
			contentType: "application/json",
			data: JSON.stringify({
				md_data: mde.value()
			}),
			processData: false,
			success: function(data, status, jqxhr) {
				$("#mod-save .modal-body p").text("Done!");
			},
			error: function(jqxhr, status, error) {
				$("#mod-save .modal-body p").text("Error<br>" + "status<br>" + error);
			},
			complete: function(jqxhr, status) {
				$("#mod-save .btn-primary").removeAttr("disabled");
			}
		});
    };    
    
	mde = new SimpleMDE({
		autofocus: true,
		toolbar: [
			"bold", "italic", "heading", "|",
			"quote", "unordered-list", "ordered-list", "|",
			"link", "image", "|",
            "preview", "side-by-side", "fullscreen", "|",
			"guide", "|",
            {
                name: "save",
                action: save,
                className: "glyphicon glyphicon-save-file",
                title: "Save Changes"
            },
            {
                name: "cancel",
                action: function(editor) {
                    window.location.href = window.location.href.replace("?edit_mode=1", "");
                },
                className: "glyphicon glyphicon-ban-circle",
                title: "Leave Edit Mode (UNSAVED CHANGES WILL BE LOST)"
            }
		],
		renderingConfig: {
			singleLineBreaks: false
		}
	});    
    
	$("#mod-save").on("show.bs.modal", function(ev) {
		$("#mod-save p").text("Saving...");
		$("#mod-save .btn-primary").attr("disabled", "disabled");
	});
	$("#mod-save .btn-primary").click(function(ev) {
		$("#mod-save").modal("hide");
	});    
});
