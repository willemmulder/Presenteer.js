/**
* Presenteer class
* @author Willem Mulder
*
* Note: don't use element-rotates of 90 or 270 degrees in combination with element-translates. 
* A bug in the Sylvester matrix libs will set the horizontal translation to 0 when you do this
*/
function Presenteer(canvas, elements, options) {
	/*
	* Initialize
	*/
	var canvas = $(canvas);
	if (canvas.size() == 0) {
		return false;
	}
	// Set transform-origin to top-left
	setTransformOrigin(canvas, 0, 0);
	var canvasZoomFactor = 1;
	var originalElements = elements;
	var elements = []; // Array of elements to show, in order
	$.each(originalElements, function(index,element) {
		if (element.nodeType == 1) { 
			// Element is a raw HTML element. We build our 'own' element which references the raw HTML element
			elements.push({ "element" : $(element) });
		} else if (typeof(element) == "string") {
			// Element is a selector. We build our 'own' element, referencing the selected element
			elements.push({ "element" : $(element) });
		} else { 
			// We assume that element is an object that is already in 'our' style (see below)
			elements.push(element);
		}
	});
	var currentIndex = -1;
	
	/*
	* Options
	*/
	// Loop over given options and set a default if an option is not specified
	var optionDefaults = { 
		showOriginalMargins : false, 
		//showCustomMargin : false, 
		//customMarginWidth : 20,
		centerHorizontally : true,
		centerVertically : true,
		followElementTransforms: true,
		// Callbacks
		onBeforeEnter : function(elm) {},
		onAfterEnter : function(elm) {},
		onBeforeLeave : function(elm) {},
		onAfterLeave : function(elm) {}
	};
	if (typeof(options) != "object") {
		options = {};
	}
	for (index in optionDefaults) {
		// If an option is not given in the constructor, set the default value
		if (typeof(options[index]) == "undefined") {
			options[index] = optionDefaults[index];
		}
	}
	
	/*
	* Main function to show an element
	* Second version: takes into account element transforms
	*/
	function show(elm) {
		var e = $(elm.element);
		
		// Temporarily disable transitions while we change things around
		var transitionsBackup = getTransitions(canvas);
		setTransitions(canvas,{});
		var transitionsElmBackup = getTransitions(e);
		setTransitions(e,{});
		
		// Reset canvas transformations
		var transformationBackup = getTransformation(canvas);
		setTransformation(canvas, "none");
		
		// Reset element's transformations to ensure we can calculate the transform-origin correctly
		// We assume the origin is at the center of the element, and for that, we need a left, top and a height and width. 
		// However, those values are only reliable for non-transformed elements.
		// That is, for transformed elements, position().left and position().top will return their actual transformed state,
		// but .width() and .height() will return the original *non-transformed* width and height, making it impossible to calculate a transformed transform-origin.
		var elementTransformationBackup = getTransformation(e);
		setTransformation(e, "none");
		
		canvasZoomFactor = 1;
		var baseLeft = e.offset().left  - canvas.offset().left;
		var baseTop = e.offset().top  - canvas.offset().top;
		
		// Calculate new zoom
		var canvasWidth = canvas.outerWidth(options.showOriginalMargins);
		var canvasHeight = canvas.outerHeight(options.showOriginalMargins);
		var viewportWidth = canvas.parent().outerWidth();
		var viewportHeight = canvas.parent().outerHeight();
		var proportionalWidth = e.outerWidth(options.showOriginalMargins) / viewportWidth; // e.g. 200/1000 = 0.2
		var proportionalHeight = e.outerHeight(options.showOriginalMargins) / viewportHeight;
		var scaleFactor = Math.max(proportionalWidth, proportionalHeight);
		canvasZoomFactor = (1 / scaleFactor); // e.g. zoom to (1 / (0.2)) = 5
		// Move element. At first, always move the element to top-left of the canvas
		var newLeft = ((baseLeft - (e.outerWidth(options.showOriginalMargins) * (canvasZoomFactor-1) / 2)) * -1);
		var newTop = ((baseTop - (e.outerHeight(options.showOriginalMargins) * (canvasZoomFactor-1) / 2)) * -1);
		if (proportionalWidth > proportionalHeight) {
			// Element will take full Width, leaving space at top and bottom
			if (options.centerVertically) {
				var openSpace = viewportHeight - (e.outerHeight(options.showOriginalMargins)*canvasZoomFactor);
				newTop += (openSpace / 2);
			}
		} else {
			// Element will take full Height, leaving space left and right
			if (options.centerHorizontally) {
				var openSpace = viewportWidth - (e.outerWidth(options.showOriginalMargins)*canvasZoomFactor);
				newLeft += (openSpace / 2);
			}
		}
		// If canvas is smaller than its container, then center the canvas in its parent
		if (options.centerVertically && (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor) < viewportHeight) {
			// This does not work on Webkit for some reason. $(canvas).outerHeight() seems to always return 0
			if (!$.browser.webkit) {
				newTop = (viewportHeight - (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
			}
		}
		if (options.centerHorizontally && (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)  < viewportWidth) {
			newLeft = (viewportWidth - (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
		}
		
		// Calculate new transform Origin
		var transformOriginLeft = (baseLeft * 1 + (e.outerWidth() / 2)) + "px";
		var transformOriginTop = (baseTop * 1 + (e.outerHeight() / 2)) + "px";
		
		// Set transformations back to how they were
		setTransformation(canvas, transformationBackup);
		setTransformation(e, elementTransformationBackup);

		// Do a setTimeOut to prevent Webkit from tripping up and starting all transitions from xy 0px,0px
		setTimeout(function() {
			// Enable transitions again
			setTransitions(canvas, transitionsBackup);
			setTransitions(e, transitionsElmBackup);
			// Set canvas transformations to correct values
			setTransformOrigin(canvas, transformOriginLeft, transformOriginTop);
			var inverseMatrix = (options.followElementTransforms ? processElementTransforms(e) : "");
			var transform =  ' translate('+newLeft+'px,'+newTop+'px)  scale('+canvasZoomFactor+') ' + inverseMatrix;
			setTransformation(canvas,transform);
		}, 1);
	}
	
	/*
	* Main function to show an element
	*/
	function show2(elm) {
		var e = $(elm.element);
		
		// Temporarily disable transitions while we change things around
		var transitionsBackup = getTransitions(canvas);
		setTransitions(canvas,{});
		var transitionElmBackup = getTransitions(e);
		setTransitions(e,{});
		
		// Reset canvas transformations.
		var canvasTransformationBackup = getTransformation(canvas);
		setTransformation(canvas, "none");
		
		// Reset element's transformations. This eases calculations.
		var elementTransformationBackup = getTransformation(e);
		setTransformation(e, "none");
		
		var baseLeft = e.offset().left  - canvas.offset().left;
		var baseTop = e.offset().top  - canvas.offset().top;
		//console.log("left " + baseLeft);
		//console.log("top " + baseTop);

		// Calculate new transform Origin
		var transformOriginLeft = (baseLeft * 1 + (e.outerWidth() / 2)) + "px";
		var transformOriginTop = (baseTop * 1 + (e.outerHeight() / 2)) + "px";
		
		// Set element transformation back to the original state
		setTransformation(e, elementTransformationBackup);
		setTransformation(canvas, canvasTransformationBackup);

		// Set transitions to how they were
		setTransitions(canvas, transitionsBackup);
		setTransitions(elm, transitionsBackup);
		
		// Set canvas transformations to correct values
		setTransformOrigin(canvas, transformOriginLeft, transformOriginTop);
		var inverseM = processElementTransforms(e);
		console.log(inverseM);
		var transform = " translate(" + (baseLeft*-1) + "px," + (baseTop*-1) + "px) " + inverseM;
		setTransformation(canvas,transform);
	}
	
	var prefixes = { moz : "-moz-", webkit : "-webkit-", o : "-o-", ms : "-ms-", all : "" };
	
	function getTransitions(e) {
		var ret = {};
		var elm = $(e);
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var p = ret[prefixID] = {};
			p["transition-delay"] = elm.css(prefix + "transition-delay");
			p["transition-duration"] = elm.css(prefix + "transition-duration");
			p["transition-property"] = elm.css(prefix + "transition-property");
			p["transition-timing-function"] = elm.css(prefix + "transition-timing-function");
		}
		return ret;
	}
	
	function setTransitions(e, transitions) {
		var elm = $(e);
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var transitionElms = transitions[prefixID] || {};
			elm.css(prefix+"transition-delay", transitionElms["transition-delay"] || "none");
			elm.css(prefix+"transition-duration", transitionElms["transition-duration"] || "none");
			elm.css(prefix+"transition-property", transitionElms["transition-property"] || "none");
			elm.css(prefix+"transition-timing-function", transitionElms["transition-timing-function"] || "none");
		}
	}
	
	function setTransformOrigin(elm, left, top) {
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			$(elm).css(prefix+"transform-origin",left+" "+top); 
		}
	}
	
	function getTransformation(elm) {
		return $(elm).get(0).style.MozTransform || $(elm).get(0).style.WebkitTransform || $(elm).get(0).style.OTransform || "";
	}
	
	function setTransformation(elm, transform) {
		$(elm).css("-moz-transform", transform);
		$(elm).css("-webkit-transform", transform);
		$(elm).css("-o-transform", transform);
	}
	
	function addTransformation(elm, transform) {
		$(elm).get(0).style.MozTransform += transform;
		$(elm).get(0).style.WebkitTransform += transform;
		$(elm).get(0).style.OTransform += transform;
	}
	
	function processElementTransforms(elm) {
		// Copy the inverse of the element transforms to the canvas
		if ($(elm).css("-moz-transform") != "none" && $(elm).css("-moz-transform") != null) {
			var matrix = $(elm).css("-moz-transform");
		} else if ($(elm).css("-webkit-transform") != "none" && $(elm).css("-webkit-transform") != null) {
			var matrix = $(elm).css("-webkit-transform");
		}  else if ($(elm).css("-o-transform") != "none" && $(elm).css("-o-transform") != null) {
			var matrix = $(elm).css("-o-transform");
		}
		if (matrix != null && matrix != "") {
			// Calculate the inverse
			// Or work with the raw elements via matrix.substr(7, matrix.length - 8).split(', ');
			var sylvesterMatrixString = matrix.replace(/matrix\((.+)\, (.+)\, (.+)\, (.+)\, (.+?)p?x?\, (.+?)p?x?\)/, "\$M([[$1,$3,$5],[$2,$4,$6],[0,0,1]])");
			var sylvesterMatrix = eval(sylvesterMatrixString);
			console.log(sylvesterMatrix.inspect());
			var inverseMatrix = sylvesterMatrix.inverse();
			// .e(row,column), 1-based
			var inverseMatrixString = "";
			if (inverseMatrix != null) {
				inverseMatrixString = "matrix(" 
					+ Math.round(inverseMatrix.e(1,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,2)*100000000)/100000000 + ", "
					+ Math.round(inverseMatrix.e(2,2)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,3)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,3)*100000000)/100000000 + ""
				+ ")";
			}
			console.log(inverseMatrix.inspect());
			// Return inverse
			return inverseMatrixString;
		}
		return "";
	}
		
	/*
	* Helper functions to calculate the outerScrollHeight/Width of elements
	*/
	function outerScrollHeight(elm, includeMargin) {
		// When an element's content does not generate a vertical scrollbar, then its scrollHeight property is equal to its clientHeight property.
        // https://developer.mozilla.org/en/DOM/element.scrollHeight
		if ($.browser.mozilla || $.browser.opera) {
			var heightWithoutScrollbars = $(elm).get(0).scrollHeight;
			var originalOverflowStyle = $(elm).get(0).style.overflow;
			$(elm).get(0).style.overflow = "scroll";
		}
		var totalHeight = $(elm).get(0).scrollHeight; // Includes padding.
		if ($.browser.mozilla || $.browser.opera) {
			if (heightWithoutScrollbars > totalHeight) {
				// Then the added scrollbars have caused the element to be smaller, which we will have to ignore
				totalHeight = heightWithoutScrollbars;
			}
			$(elm).get(0).style.overflow = originalOverflowStyle;
		}
		totalHeight = totalHeight + ($(elm).outerHeight(includeMargin) - $(elm).innerHeight());
		return totalHeight;
	}
	
	function outerScrollWidth(elm, includeMargin) {
		// When an element's content does not generate a horizontal scrollbar, then its scrollWidth property is equal to its clientWidth property.
        // https://developer.mozilla.org/en/DOM/element.scrollWidth
		if ($.browser.mozilla || $.browser.opera) {
			var widthWithoutScrollbars = $(elm).get(0).scrollWidth;
			var originalOverflowStyle = $(elm).get(0).style.overflow;
			$(elm).get(0).style.overflow = "scroll";
		}
		var totalWidth = $(elm).get(0).scrollWidth; // Includes padding
		if ($.browser.mozilla || $.browser.opera) {
			if (widthWithoutScrollbars > totalWidth) {
				// Then the added scrollbars have caused the element to be smaller, which we will have to ignore
				totalWidth = widthWithoutScrollbars;
			}
			$(elm).get(0).style.overflow = originalOverflowStyle;
		}
		totalWidth += $(elm).outerWidth(includeMargin) - $(elm).innerWidth();
		return totalWidth;
	}
	
	/*
	* The facade for the 'outer world' to work with
	*/
	return {
		start : function() {
			currentIndex = 0;
			this.showCurrent();
		},
		restart : function() {
			currentIndex = 0;
			this.showCurrent();
		},
		show : function(index) {
			currentIndex = index;
			this.showCurrent();
		},
		next : function() {
			var prevIndex = currentIndex;
			currentIndex++;
			if (currentIndex > elements.length-1) {
				currentIndex = 0;
			}
			if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeaveToNext) == "function") {
				elements[prevIndex].onBeforeLeaveToNext();
			}
			if (typeof(elements[currentIndex].onBeforeEnterFromPrev) == "function") {
				elements[currentIndex].onBeforeEnterFromPrev();
			}
			if (typeof(elements[prevIndex].onBeforeLeave) == "function") {
				elements[prevIndex].onBeforeLeave();
			}
			options.onBeforeLeave(elements[prevIndex]);
			this.showCurrent();
			if (elements[prevIndex] && typeof(elements[prevIndex].onAfterLeaveToNext) == "function") {
				elements[prevIndex].onAfterLeaveToNext();
			}
			if (typeof(elements[currentIndex].onAfterEnterFromPrev) == "function") {
				elements[currentIndex].onAfterEnterFromPrev();
			}
			if (typeof(elements[prevIndex].onAfterLeave) == "function") {
				elements[prevIndex].onAfterLeave();
			}
			options.onBeforeLeave(elements[prevIndex]);
		},
		prev : function() {
			var prevIndex = currentIndex;
			currentIndex--;
			if (currentIndex < 0) {
				currentIndex = elements.length-1;
			}
			if (typeof(elements[prevIndex].onBeforeLeaveToPrev) == "function") {
				elements[prevIndex].onBeforeLeaveToPrev();
			}
			if (typeof(elements[currentIndex].onBeforeEnterFromNext) == "function") {
				elements[currentIndex].onBeforeEnterFromNext();
			}
			if (typeof(elements[prevIndex].onBeforeLeave) == "function") {
				elements[prevIndex].onBeforeLeave();
			}
			options.onBeforeLeave(elements[prevIndex]);
			this.showCurrent();
			if (typeof(elements[prevIndex].onAfterLeaveToPrev) == "function") {
				elements[prevIndex].onAfterLeaveToPrev();
			}
			if (typeof(elements[currentIndex].onAfterEnterFromNext) == "function") {
				elements[currentIndex].onAfterEnterFromNext();
			}
			if (typeof(elements[prevIndex].onAfterLeave) == "function") {
				elements[prevIndex].onAfterLeave();
			}
			options.onAfterLeave(elements[prevIndex]);
		},
		previous : function() {
			this.prev();
		},
		showCurrent : function() {
			if (typeof(elements[currentIndex].onBeforeEnter) == "function") {
				elements[currentIndex].onBeforeEnter();
			}
			options.onBeforeEnter(elements[currentIndex]);
			show(elements[currentIndex]);
			if (typeof(elements[currentIndex].onAfterEnter) == "function") {
				elements[currentIndex].onAfterEnter();
			}
			options.onAfterEnter(elements[currentIndex]);
		},
		getCanvas : function() {
			return $(canvas);
		}
	};
}
