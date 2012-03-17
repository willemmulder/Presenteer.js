// Presenteer class
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
	/*
		elements = [];
		elements[] = { 
			onBeforeEnterFromPrev : function() {},
			onAfterEnterFromPrev : function() {},
			
			onBeforeLeaveToNext : function() {},
			onAfterLeaveToNext : function() {},
			
			onBeforeEnterFromNext : function() {},
			onAfterEnterFromNext : function() {},
			
			onBeforeLeaveToPrev : function() {},
			onAfterLeaveToPrev : function() {},
			
			onBeforeEnter : function() {},
			onBeforeLeave : function() {},
			onAfterEnter : function() {},
			onAfterLeave : function() {}
			
			element : "#hallo" // Can be element or element-selector
		}
	*/
	var currentIndex = -1;
	
	/*
	* Options
	*/
	// Loop over given options and set a default if an option is not specified
	var optionDefaults = { 
		showOriginalMargins : false, 
		showCustomMargin : false, 
		customMarginWidth : 20,
		centerHorizontally : true,
		centerVertically : true
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
	*/
	function show(elm) {
		var e = $(elm.element);
		resetTransformations();
		// Calculate base-position (i.e. with zoomFactor 1).
		// Webkit&Opera differ from Firefox. 
		// Webkit&Opera return e.offset() *after* applying the zoom on the element (i.e. larger offset when larger zoomFactor)
		// Firefox always returns the same original e.offset(), regardless of the zoomFactor
		if ($.browser.webkit || $.browser.opera) {
			var baseLeft = ((e.offset().left  - canvas.offset().left) / canvasZoomFactor);
			var baseTop = ((e.offset().top  - canvas.offset().top) / canvasZoomFactor);
		} else {
			var baseLeft = e.offset().left  - canvas.offset().left;
			var baseTop = e.offset().top  - canvas.offset().top;
		}
		// If we need to take into account the margins, subtract the margin from the left and top
		
		// Zoom so that the element fits best on screen
		var canvasWidth = canvas.outerWidth(options.showOriginalMargins);
		var canvasHeight = canvas.outerHeight(options.showOriginalMargins);
		var viewportWidth = canvas.parent().outerWidth();
		var viewportHeight = canvas.parent().outerHeight();
		var proportionalWidth = e.outerWidth(options.showOriginalMargins) / viewportWidth; // e.g. 200/1000 = 0.2
		var proportionalHeight = e.outerHeight(options.showOriginalMargins) / viewportHeight;
		var scaleFactor = Math.max(proportionalWidth, proportionalHeight);
		canvasZoomFactor = (1 / scaleFactor); // e.g. zoom to (1 / (0.2)) = 5
		// Move element. Always move the element to the center of the screen
		var newLeft = (baseLeft * canvasZoomFactor * -1);
		var newTop = (baseTop * canvasZoomFactor * -1);
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
			newTop = (viewportHeight - (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
		}
		if (options.centerHorizontally && (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)  < viewportWidth) {
			newLeft = (viewportWidth - (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
		}
		
		copyElementTransforms(e, newLeft, newTop);
		move(newLeft, newTop);
		zoom(canvasZoomFactor);
	}
	
	function setTransformOrigin(elm, left, top) {
	    $(elm).css("-webkit-transform-origin",left+" "+top); 
	    $(elm).css("-moz-transform-origin",left+" "+top);
	    $(elm).css("-o-transform-origin",left+" "+top);
	    $(elm).css("-ms-transform-origin",left+" "+top);
	    $(elm).css("transform-origin",left+" "+top);
	}
	
	function resetTransformations() {
		$(canvas).get(0).style.MozTransform = "";
		$(canvas).get(0).style.WebkitTransform = "";
		$(canvas).get(0).style.OTransform = "";
	}
	
	function zoom(zoomLevel) {
		$(canvas).get(0).style.MozTransform += 'scale('+zoomLevel+')';
		$(canvas).get(0).style.WebkitTransform += 'scale('+zoomLevel+')';
		$(canvas).get(0).style.OTransform += 'scale('+zoomLevel+')';
	}
	
	function move(left, top) {
		$(canvas).get(0).style.MozTransform += 'translate('+left+'px,'+top+'px)';
		$(canvas).get(0).style.WebkitTransform += ' translate('+left+'px,'+top+'px)';
		$(canvas).get(0).style.OTransform += 'translate('+left+','+top+')';
	}
	
	// TODO: get element transform-origin. Make presenteer translates and scales work with that (or any) transform-origin. Then extra-apply element-transforms.
	function copyElementTransforms(elm, elementTransformOriginLeft, elementTransformOriginTop) {
		// Copy the transforms of the elm (for now only rotate) to the canvas
		if (getStyle($(elm).get(0),"-moz-transform") != "none") {
			$(canvas).css("-moz-transform", getStyle($(elm).get(0),"-moz-transform"));		
		}
		if (getStyle($(elm).get(0),"-webkit-transform") != "none") {
		    setTransformOrigin($(canvas).find(".presentationextratransforms"),elementTransformOriginLeft,elementTransformOriginTop);
			$(canvas).find(".presentationextratransforms").css("-webkit-transform", getStyle($(elm).get(0),"-webkit-transform"));	
		} else {
    		$(canvas).find(".presentationextratransforms").css("-webkit-transform","");
		}
	}
    
    function getStyle(el, styleProp) {
        if (el.currentStyle) {
            // look for IE
            return(el.currentStyle[styleProp]);
        } else if (window.getComputedStyle) {
            // all other browsers
            return(document.defaultView.getComputedStyle(el,null).getPropertyValue(styleProp));
        } else {
            // fall back to inline style
            return(el.style[styleProp]);
        }
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
		totalHeight += $(elm).outerHeight(includeMargin) - $(elm).innerHeight();
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
			var currentIndex = 0;
			this.showCurrent();
		},
		show : function(index) {
			var currentIndex = index;
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
		},
		previous : function() {
			this.prev();
		},
		showCurrent : function() {
			if (typeof(elements[currentIndex].onBeforeEnter) == "function") {
				elements[currentIndex].onBeforeEnter();
			}
			show(elements[currentIndex]);
			if (typeof(elements[currentIndex].onAfterEnter) == "function") {
				elements[currentIndex].onAfterEnter();
			}
		},
		getCanvas : function() {
			return $(canvas);
		}
	};
}
