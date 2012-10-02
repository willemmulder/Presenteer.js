var full = false;

function minimise() {
	$(".presentationcontainer").css("padding", "200px");
	$(".presentationviewport").css("box-shadow", "0px 0px 5px #333");
	fitPresentation();
	full = false;
}

function maximise() {
	$(".presentationcontainer").css("padding", "0px");
	$(".presentationviewport").css("box-shadow", "none");
	fitPresentation();
	full = true;
}

function runhtmlandcode() {
	$(".livecodingarea .result .html").html($(".livecodingarea .input .html").val());
	$(".codeoutput *").off();
	example.run();
}

function runcode() {
	$(".codeoutput *").off();
	example.run();
}

function showeditor(code,html) {
	if(code) {
		example.setCode(code);
	} else {
		example.setCode("");
	}
	if (html) {
		$(".livecodingarea .input .html").val(html);
	} else {
		$(".livecodingarea .input .html").val("");
	}
	$(".livecodingarea").fadeIn();
}

function hideeditor() {
	$(".livecodingarea").fadeOut();
}

function fitPresentation() {
	$(".presentationcontainer").scaleToFit({zoomFromCenter:true});
	$(".presentationviewport").scaleToFit({zoomFromCenter:true});
}

function show(index) {
	// flip to front
	$(".presentationviewport").flip(false, true).done(function() {;
		presentation.show(index);
	});
}

function overview() {
	// Set proper flipside HTML
	var html = "<div class='overview'>";
	var current = presentation.getCurrentIndex();
	$(".presentationcanvas > div").each(function(index,elm) {
		html += "<div class='overviewelement " + (index==current ? "active" : "") + "' onclick='show(" +  index + ");'><h2>" + (index+1) + ". " + ($(elm).data("description") || $(elm).data("presenteerid") || $(elm).attr("id") || "") + "</h2></div>";
	});
	html += "</div>";
	$(".presentationviewport").flipsideContent(html);
	$(".presentationviewport").flip();
}

$(function() {

	window.presentation = $(".presentationcanvas").presenteer(".presentationcanvas > div",
		{
			cacheLocations: true,
			onAfterEnter: function(elm) {
				$(".progressbarindicator").html(presentation.getCurrentIndex()+1).width(1200*(presentation.getCurrentIndex()+1)/presentation.getTotal());
				$(".progressnumber").html((presentation.getCurrentIndex()+1) + "/" + presentation.getTotal());
			}
		}
	);
	
	presentation.start();
	$(".bottom").mousedown(function(e) {
		if (e.which == 1) {
			// left mouse click
			presentation.next();
		} else {
			presentation.prev();
		}
		e.preventDefault();
		e.stopPropagation();
	});
	$(".bottom").on("contextmenu", function(e) {
		return false;
	});

	fitPresentation();
	$(window).resize(function() {
		fitPresentation();
	});
	
	$(document).keyup(function(e) {
		if (e.which == 40 || e.which == 38) {
			presentation.show("overview");
		} else if (e.which == 39) {
			presentation.next();
		} else if (e.which == 37) {
			presentation.prev();
		} else if (e.which == 16) {
			if(full) {
				minimise();
			} else {
				maximise();
			}
			e.preventDefault();
			e.stopPropagation();
		}
	});
	
});