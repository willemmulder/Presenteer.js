/**
* Presenteer class
* @author Willem Mulder
*
* Note: don't use element-rotates of 90 or 270 degrees in combination with element-translates. 
* A bug in the Sylvester matrix libs will set the horizontal translation to 0 when you do this
*/
(function() {

	// Helper functions are down below

	//----------------------
	// Main Presenteer constructor function
	//----------------------
	window.Presenteer = function(canvas, elementsArgument, options) {
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
		var elements = getElements(elementsArgument);
		var currentIndex = -1;
		var prevIndex = -1;
		var fullScreenSupport = document.documentElement.requestFullScreen || document.documentElement.mozRequestFullScreen || document.documentElement.webkitRequestFullScreen || document.documentElement.oRequestFullScreen;
		var isFullScreen = false;
		var realign = function() { setTimeout(function() { show(elements[currentIndex]); }, 10); }
		document.addEventListener("mozfullscreenchange", function() { if (typeof(mozFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
		document.addEventListener("webkitfullscreenchange", function() { if (typeof(webkitFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
		document.addEventListener("ofullscreenchange", function() { if (typeof(oFullScreenElement) == "undefined") { isFullScreen = false; }; realign(); });
		$(document).on("keyup", function(event) {
			// On an escape, leave fullScreen
			if (event.which == "27") {
				cancelFullScreen();
				realign();
			}
		});
		var fullScreenElement;
		var fullScreenBackupStyling;
		var cachedPositions = {};
		
		/*
		* Options
		*/
		// Loop over given options and set a default if an option is not specified
		var optionDefaults = { 
			cachePositions : true,
			showOriginalMargins : false, 
			//showCustomMargin : false, 
			//customMarginWidth : 20,
			centerHorizontally : true,
			centerVertically : true,
			followElementTransforms: true,
			transition: {
				"transition-delay" : "0s",
				"transition-duration" : "0.5s",
				"transition-property" : "all",
				"transition-timing-function" : "ease"
			},
			useExistingTransitionIfAvailable: true, // Will not work for Opera and IE
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
		
		// If cacheLocations is set to true, we calculate the position of every slide only once and then cache it
		// This prevents flicker, makes for a smoother animation and saves CPU
		if (options.cachePositions) {
			cachePositions();
		}

		function cachePositions() {
			// Disable all transformations on all elements with a special class
			disableAllTransitions();
			disableAllTransformations();
			for(i in elements) {
				var element = elements[i].element;
				var position = calculatePosition(element,canvas);
				cachedPositions[i] = position;
				$(element).data("cachedPosition", position);
			}
			undoDisableAllTransformations();
			undoDisableAllTransitions();
		}

		function getElements(elementsArgument) {
			if (typeof elementsArgument == "string") {
				elementsArgument = $(elementsArgument);
			}
			var elements = []; // Array of elements to show, in order
			$.each(elementsArgument, function(index,element) {
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
			return elements;
		}
		
		/*
		* Main function to show an element
		* Takes into account element transforms
		*/
		function show(elm) {
			var e = $(elm.element);
			
			if (!options.cachePositions) {
				// Temporarily disable transitions while we change things around
				// Opera and IE9 cannot get transitions properties via Javascript, See http://my.opera.com/community/forums/topic.dml?id=1145422
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
				var position = calculatePosition(e,canvas);
			} else {
				var position = e.data("cachedPosition");
			}
			
			var baseLeft = position.left;
			var baseTop = position.top;
			
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
				if (!$.browser.webkit && !$.browser.opera) {
					newTop = (viewportHeight - (outerScrollHeight(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
				}
			}
			if (options.centerHorizontally && (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)  < viewportWidth) {
				// This does not work on Webkit for some reason. $(canvas).outerWidth() seems to always return 0
				if (!$.browser.webkit && !$.browser.opera) {
					//newLeft = (viewportWidth - (outerScrollWidth(canvas, options.showOriginalMargins) * canvasZoomFactor)) / 2;
				}
			}
			
			// Calculate new transform Origin
			var transformOriginLeft = (Math.round((baseLeft * 1 + (e.outerWidth() / 2))*10000)/10000) + "px";
			var transformOriginTop = (Math.round((baseTop * 1 + (e.outerHeight() / 2))*10000)/10000) + "px";
			
			if (!options.cachePositions) {
				// If we had to temporarily disable transformation above, set transformations back to how they were
				setTransformation(canvas, transformationBackup);
				setTransformation(e, elementTransformationBackup);
			}

			// Do a setTimeOut to prevent Webkit from tripping up and starting all transitions from xy 0px,0px
			setTimeout(function() {
				// Enable transitions again
				// Set canvas-transition to either a) existing transition or b) transition as given in parameter
				var canvasTransitionString = getTransitionString(transitionsBackup);
				if (canvasTransitionString != "" && options.useExistingTransitionIfAvailable) {
					setTransitions(canvas, transitionsBackup);
				} else {
					setTransitions(canvas, options.transition);
				}
				if (!options.cachePositions) {
					setTransitions(e, transitionsElmBackup);
				}
				// Set canvas transformations to correct values
				var inverseMatrix = (options.followElementTransforms ? processElementTransforms(e) : "");
				var transform =  ' translate('+(Math.round(newLeft*10000)/10000)+'px,'+(Math.round(newTop*10000)/10000)+'px)  scale('+(Math.round(canvasZoomFactor*10000)/10000)+') ' + inverseMatrix;
				setTransformOrigin(canvas, transformOriginLeft, transformOriginTop);
				setTransformation(canvas,transform);
			}, 50);
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
				prevIndex = currentIndex;
				currentIndex = 0;
				this.showCurrent();
			},
			show : function(index) {
				if (elements[index]) {
					prevIndex = currentIndex;
					currentIndex = index;
				} else {
					// Look up by data-presenteerid or, if no match, by raw id
					var foundid;
					for(var i in elements) {
						var element = elements[i].element;
						if ($(element).is(index) || $(element).data("presenteerid") == index) {
							prevIndex = currentIndex;
							currentIndex = i;
							foundid = undefined;
							break;
						} else if ($(element).attr("id") == index) {
							foundid = i;
						}
					}
					// Only use the raw id if no element was found by direct comparison or presenteerid
					if (typeof foundid != 'undefined') {
						prevIndex = currentIndex;
						currentIndex = foundid;
					}
				}
				this.showCurrent();
			},
			next : function() {
				prevIndex = currentIndex;
				currentIndex++;
				if (currentIndex > elements.length-1) {
					currentIndex = 0;
				}
				this.showCurrent();
			},
			prev : function() {
				prevIndex = currentIndex;
				currentIndex--;
				if (currentIndex < 0) {
					currentIndex = elements.length-1;
				}
				this.showCurrent();
			},
			previous : function() {
				this.prev();
			},
			showCurrent : function() {
				// Forward-moving 'before' callbacks
				if (prevIndex < currentIndex) {
					if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeaveToNext) == "function") {
						elements[prevIndex].onBeforeLeaveToNext();
					}
					if (typeof(elements[currentIndex].onBeforeEnterFromPrev) == "function") {
						elements[currentIndex].onBeforeEnterFromPrev();
					}
				}
				// Backward-moving 'before' callbacks
				if (prevIndex > currentIndex) {
					if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeaveToPrev) == "function") {
						elements[prevIndex].onBeforeLeaveToPrev();
					}
					if (typeof(elements[currentIndex].onBeforeEnterFromNext) == "function") {
						elements[currentIndex].onBeforeEnterFromNext();
					}
				}
				// All-direction 'before' callbacks
				if (elements[prevIndex] && typeof(elements[prevIndex].onBeforeLeave) == "function") {
					elements[prevIndex].onBeforeLeave();
				}
				if (typeof(elements[currentIndex].onBeforeEnter) == "function") {
					elements[currentIndex].onBeforeEnter();
				}
				// General callbacks
				if (elements[prevIndex]) { options.onBeforeLeave(elements[prevIndex]); }
				options.onBeforeEnter(elements[currentIndex]);
				
				// Show element
				show(elements[currentIndex]);
				
				// Forward-moving 'after' callbacks
				if (prevIndex < currentIndex) {
					if (elements[prevIndex] && typeof(elements[prevIndex].onAfterLeaveToNext) == "function") {
						elements[prevIndex].onAfterLeaveToNext();
					}
					if (typeof(elements[currentIndex].onAfterEnterFromPrev) == "function") {
						elements[currentIndex].onAfterEnterFromPrev();
					}
				}
				// Backward-moving 'after' callbacks
				if (prevIndex > currentIndex) {
					if (typeof(elements[prevIndex].onAfterLeaveToPrev) == "function") {
						elements[prevIndex].onAfterLeaveToPrev();
					}
					if (typeof(elements[currentIndex].onAfterEnterFromNext) == "function") {
						elements[currentIndex].onAfterEnterFromNext();
					}
				}
				// All-direction 'after' callbacks
				if (elements[prevIndex] && typeof(elements[prevIndex].onAfterLeave) == "function") {
					elements[prevIndex].onAfterLeave();
				}
				if (typeof(elements[currentIndex].onAfterEnter) == "function") {
					elements[currentIndex].onAfterEnter();
				}
				// General callbacks
				if (elements[prevIndex]) { options.onAfterLeave(elements[prevIndex]); }
				options.onAfterEnter(elements[currentIndex]);
			},
			getCanvas : function() {
				return $(canvas);
			},
			
			getCurrentIndex : function() {
				return currentIndex*1;
			},
			getPrevIndex : function() {
				return prevIndex*1;
			},
			getTotal : function() {
				return elements.length;
			},
			
			toggleFullScreen : function(elm) {
				toggleFullScreen(elm);
				show(elements[currentIndex]);
			},
			fullScreen : function(elm) {
				fullScreen(elm);
				show(elements[currentIndex]);
			},
			cancelFullScreen : function() {
				cancelFullScreen();
				show(elements[currentIndex]);
			},
			isFullScreen : function() {
				return isFullScreen;
			},
			update : function() {
				elements = getElements(elementsArgument);
				if (options.cachePositions) {
					cachePositions();
				}
			},
			/*
			* Function translates the position in the viewport to the exact position at the canvas
			* Imagine a canvas that scales *2 with transform-origin at 0,0, then all x at the canvas
			* end up at x*2 in the viewport. Consequently, going from a point in the viewport to canvas,
			* we need to do viewport.x/2 to arrive at the correct canvas-position.
			*
			*/
			getPositionAtCanvas : function(opts) {
				if (opts.positionInViewport) {
					// Multiply the position in the viewport with the matrix of the canvas
					var inverseMatrixString = getInverseMatrixString(canvas);
					var transformOriginCanvas = getTransformOrigin(canvas);
					// Transform-origin of canvas remains the same regardless of what transformation is applied
					// I.e. if it is 150,150 then it will remain 150,150 if a "scale(0.5) translate(100,100)" is applied
					// So if we assume that the canvas is at 0,0 in the viewport, we can calculate the distance from our point to the transform-origin
					var distanceFromOriginX = opts.positionInViewport.x - parseInt(transformOriginCanvas.x, 10);
					var distanceFromOriginY = opts.positionInViewport.y - parseInt(transformOriginCanvas.y, 10);
					
					// Apply the inverse matrix to our point
					var inverseMatrix = getMatrixFromMatrixString(inverseMatrixString);
					var finalPosition = matrixMultiply(
						inverseMatrix,
						[
							[distanceFromOriginX],
							[distanceFromOriginY],
							[1]
						]
					);
					// Finally add  the transform-origin again to return to the original reference axis
					finalPosition[0][0] += parseInt(transformOriginCanvas.x, 10);
					finalPosition[1][0] += parseInt(transformOriginCanvas.y, 10);
					return {x: finalPosition[0][0], y: finalPosition[1][0]};
				}
			}
		};
	}
	
	//----------------------
	// jQuery plugins
	//----------------------
	$.fn.scaleToFit = $.fn.scaleToFit || function(settings) {
		$(this).each(function(index,elm) {
			var $parent = settings.parent ? $(settings.parent) : $(elm).parent();
			
			var width = $(elm).outerWidth(false);
			var parentWidth = $parent.width();
			var widthAspectRatio = parentWidth / width;
			
			var height = $(elm).outerHeight(false);
			var parentHeight = $parent.height();
			var heightAspectRatio = parentHeight / height;
			
			if (settings && settings.zoomFromCenter) {
				// only zoom from center if the element 'floats' in the middle of its parent (i.e. when the width or height of its parent is greater than that of himself)
				// otherwise, the zoom-center (of the original element) is not in the middle of the screen
				setTransformOrigin(elm,width/2,height/2);
			} else {
				setTransformOrigin(elm,0,0);
			}
			
			// If we add the translateZ transformation to the setTransformation() line, then Opera will choke. Have no idea why.
			setTransformation(elm, "scale(" + Math.min(heightAspectRatio,widthAspectRatio) + ")");
			//addTransformation(elm, " translateZ(0)");
		});
	};
	
	$.fn.flipsideContent = $.fn.flipsideContent || function(html) {
		$next = $(this).next(".presenteerjs-flipback");
		if ($next.length == 0) {
			$elm = $('<div class="presenteerjs-flipback"></div>');
			var styles = getStyle(this);
			styles["background"] = "#fff";
			$elm.css(styles);
			addTransformation($elm, " rotateY(180deg)");
			$(this).after($elm);
		}
		$(this).next(".presenteerjs-flipback").html(html);
		return this;
	}
	
	$.fn.flip = $.fn.flip || function(useSelfAsBackFace, showFront) {
		var deferred = new $.Deferred();
		// Add necessary CSS class if not already present
		if ($("#presenteerjs-flipped").size() == 0) {
			$("body").append("<div id='presenteerjs-flipped'><style>" +
				".presenteerjs-flipped-transition { -webkit-transition: all 0.4s linear !important; -moz-transition: all 0.4s ease !important; -o-transition: all 0.4s ease !important; -ms-transition: all 0.4s ease !important; transition: all 0.4s ease !important; }</style></div>"
			);
		}
		$(this).each(function(index,elm) {
			// Add white backside, if useSelfAsBackFace == false
			if (!useSelfAsBackFace && $(elm).next(".presenteerjs-flipback").length == 0) {
				disableAllTransitions();
				disableAllTransformations();
				$(this).flipsideContent("");
				undoDisableAllTransformations();
				setTimeout(function() {
					undoDisableAllTransitions();
					// Add transition, and remove it afterwards
					$(elm).addClass("presenteerjs-flipped-transition");
					$(elm).next(".presenteerjs-flipback").addClass("presenteerjs-flipped-transition");
					// Apply transformation
					if (showFront || hasTransformation(elm,"rotateY(180deg)")) {
						// Go to front
						removeTransformation(elm,"rotateY(180deg)");
						addTransformation($(elm).next(), " rotateY(180deg)");
					} else {
						// Go to back
						addTransformation(elm, " rotateY(180deg)");
						removeTransformation($(elm).next(".presenteerjs-flipback"),"rotateY(180deg)");
						$(elm).next(".presenteerjs-flipback").css("webkitBackfaceVisibility", "hidden");
						$(elm).next(".presenteerjs-flipback").css("-moz-backface-visibility", "hidden");
						$(elm).next(".presenteerjs-flipback").css("backface-visibility", "hidden");
					}
					setTimeout(function() {
						$(elm).removeClass("presenteerjs-flipped-transition");
						$(elm).next(".presenteerjs-flipback").removeClass("presenteerjs-flipped-transition");
						deferred.resolve();
					}, 500);
				}, 1);
			} else {
				setTimeout(function() {
					// Add transition, and remove it afterwards
					$(elm).addClass("presenteerjs-flipped-transition");
					$(elm).next(".presenteerjs-flipback").addClass("presenteerjs-flipped-transition");
					// Apply transformation
					if (showFront || hasTransformation(elm,"rotateY(180deg)")) {
						// Go to front
						removeTransformation(elm,"rotateY(180deg)");
						addTransformation($(elm).next(), " rotateY(180deg)");
					} else {
						// Go to back
						addTransformation(elm, " rotateY(180deg)");
						removeTransformation($(elm).next(".presenteerjs-flipback"),"rotateY(180deg)");
						$(elm).next(".presenteerjs-flipback").css("webkitBackfaceVisibility", (useSelfAsBackFace ? "visible" : "hidden"));
						$(elm).next(".presenteerjs-flipback").css("-moz-backface-visibility", (useSelfAsBackFace ? "visible" : "hidden"));
						$(elm).next(".presenteerjs-flipback").css("backface-visibility", (useSelfAsBackFace ? "visible" : "hidden"));
					}
					setTimeout(function() {
						$(elm).removeClass("presenteerjs-flipped-transition");
						$(elm).next(".presenteerjs-flipback").removeClass("presenteerjs-flipped-transition");
						deferred.resolve();
					}, 500);
				},10);
			}
			//$("#someSelector").bind("transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd", function(){ ... });
		});
		return deferred.promise();
	};
	
	$.fn.presenteer = $.fn.presenteer || function(elements, options) {
		return new Presenteer($(this).first(), elements, options);
	};
	
	//----------------------
	// Helper functions
	//----------------------
	var prefixes = { moz : "Moz", webkit : "Webkit", o : "O", ms : "ms", all : "" };
	
	function calculatePosition(e,canvas) {
		return { left: (e.offset().left  - canvas.offset().left), top: (e.offset().top  - canvas.offset().top) };
	}
	
	function disableAllTransitions() {
		$("body").append("<div id='presenteerjs-notransition'><style>*{ -webkit-transition: none !important; -moz-transition: none !important; -o-transition: none !important; -ms-transition: none !important; transition: none !important; }</style></div>");
	}
	
	function undoDisableAllTransitions() {
		$("#presenteerjs-notransition").remove();
	}
	
	function disableAllTransformations() {
		$("body").append("<div id='presenteerjs-notransformation'><style>*{ -webkit-transform: none !important; -moz-transform: none !important; -o-transform: none !important; -ms-transform: none !important; transform: none !important;}</style></div>");
	}
	
	function undoDisableAllTransformations() {
		$("#presenteerjs-notransformation").remove();
	}
	
	function getTransitions(e) {
		var ret = {};
		var elm = $(e);
		
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var p = ret[prefixID] = {};
			p["transition-delay"] = elm.css(prefix + "TransitionDelay");
			p["transition-duration"] = elm.css(prefix + "TransitionDuration");
			p["transition-property"] = elm.css(prefix + "TransitionProperty");
			p["transition-timing-function"] = elm.css(prefix + "TransitionTimingFunction");
		}
		return ret;
	}
	
	function getStyle(e) {
		// This works for Webkit but not for other browsers: document.defaultView.getComputedStyle($(e).get(0), "").cssText
		// This does not work anywhere because jQuery sees the style object as an Array and only considers the values with a numeric index: var result = $.map(style, function(value,index) { return (isNaN(index) ? (index + ":" + value) : null); }).join(";");
		// See http://stackoverflow.com/questions/1004475/jquery-css-plugin-that-returns-computed-style-of-element-to-pseudo-clone-that-el for a cross-browser function
		var style = document.defaultView.getComputedStyle($(e).get(0), "");
		/*
		var cssText = "";
		for(index in style) {
			cssText += (isNaN(index) && index !== "quotes" && style[index] && typeof(style[index]) == "string" ? index + ":" + style[index] + "; " : "");
		}
		console.log(cssText);
		return (cssText + " -webkit-transform: " + getTransformation($(e)) );
		*/
		var camelize = function(a,b){
			return b.toUpperCase();
		}
		var returns = [];
		for(var i=0;i<style.length;i++){
			var prop = style[i];
			var camel = prop.replace(/\-([a-z])/g, camelize);
			var val = style.getPropertyValue(prop);
			returns[camel] = val;
		}
		return returns;
	}
	
	function setTransitions(e, transitions) {
		var elm = $(e);
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			var transitionElms = transitions[prefixID] || {};
			elm.css(prefix+"TransitionDelay", transitionElms["transition-delay"] || transitions["transition-delay"] || "0s");
			elm.css(prefix+"TransitionDuration", transitionElms["transition-duration"] || transitions["transition-duration"] || "0s");
			elm.css(prefix+"TransitionProperty", transitionElms["transition-property"] || transitions["transition-property"] || "none");
			elm.css(prefix+"TransitionTimingFunction", transitionElms["transition-timing-function"] || transitions["transition-timing-function"] || "");
		}
	}
	
	function getTransitionString(transitions) {
		for (var prefixID in transitions) {
			var p = transitions[prefixID];
			var transitionIsInThisPrefix = false;
			if (
				p["transition-duration"] != "" 
				&& p["transition-duration"] != "0" 
				&& p["transition-duration"] != "0s"
				&& p["transition-duration"] != null)
			{
				return p["transition-property"] + " " + p["transition-duration"] + " " + p["transition-timing-function"];
			}
		}
		return "";
	}
	
	function setTransformOrigin(elm, left, top) {
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			$(elm).css(prefix ? prefix+"TransformOrigin" : "transformOrigin", left+" "+top); 
		}
	}

	function getTransformOrigin(elm) {
		var origin = $(elm).get(0).style.WebkitTransformOrigin || $(elm).get(0).style.MozTransformOrigin || $(elm).get(0).style.OTransformOrigin || $(elm).get(0).style.msTransformOrigin || $(elm).get(0).style.transformOrigin ||  "";
		var result = origin.match(/^([^ ]+) ([^ ]+)$/);
		if (result) {
			return {x: result[1], y:result[2]};
		} else {
			return {x:0, y:0};
		}
	}
	
	function getTransformation(elm) {
		return $(elm).get(0).style.WebkitTransform || $(elm).get(0).style.MozTransform || $(elm).get(0).style.OTransform || $(elm).get(0).style.msTransform || $(elm).get(0).style.transform ||  "";
	}
	
	function setTransformation(elm, transform) {
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			$(elm).css(prefix ? prefix+"Transform" : "transform", transform);
		}
	}
	
	function addTransformation(elm, transform) {
		var style = $(elm).get(0).style;
		if (style.MozTransform) { style.MozTransform += transform; }
		if (style.WebkitTransform) { style.WebkitTransform += transform; }
		if (style.OTransform) { style.OTransform += transform; }
		if (style.msTransform) { style.msTransform += transform; }
		if (style.transform) { style.transform += transform; }
	}
	
	function logTransformations(elm) {
		var style = $(elm).get(0).style;
		console.log(style.MozTransform);
		console.log(style.WebkitTransform);
		console.log(style.OTransform);
		console.log(style.msTransform);
		console.log(style.transform);
	}
	
	function hasTransformation(elm, transform) {
		var style = $(elm).get(0).style;
		return (
			(style.MozTransform && style.MozTransform.indexOf(transform) !== -1) ||
			(style.WebkitTransform && style.WebkitTransform.indexOf(transform) !== -1) ||
			(style.OTransform && style.OTransform.indexOf(transform) !== -1) ||
			(style.msTransform && style.msTransform.indexOf(transform) !== -1) ||
			(style.transform && style.transform.indexOf(transform) !== -1)
		);
	}
	
	function removeTransformation(elm, transform) {
		if (!transform) { 
			return setTransformation(elm, ""); 
		}
		var style = $(elm).get(0).style;
		for(i in prefixes) {
			var prefix = prefixes[i];
			if (style[prefix ? prefix+"Transform" : "transform"]) {
				var s = style[prefix ? prefix+"Transform" : "transform"].toLowerCase().replace(transform.toLowerCase(), " ");
				$(elm).css(prefix ? prefix+"Transform" : "transform", s);
			}
		}
	}
	
	function processElementTransforms(elm) {
		return getInverseMatrixString(elm);
	}

	function getMatrixFromMatrixString(matrixString) {
		var sylvesterMatrixString = matrixString.replace(/matrix\((.+)\, (.+)\, (.+)\, (.+)\, (.+?)p?x?\, (.+?)p?x?\)/, "[[$1,$3,$5],[$2,$4,$6],[0,0,1]]");
		return eval(sylvesterMatrixString);
	}

	function getInverseMatrixString(elm) {
		var matrix = "";
		for(var prefixID in prefixes) {
			var prefix = prefixes[prefixID];
			if ($(elm).css(prefix+"Transform") != null && $(elm).css(prefix+"Transform").indexOf("matrix") === 0) {
				var matrix = $(elm).css(prefix ? prefix+"Transform" : "transform");
				break;
			}
		}
		if (matrix != "") {
			// Calculate the inverse
			// Or work with the raw elements via matrix.substr(7, matrix.length - 8).split(', ');
			var sylvesterMatrix = $M(getMatrixFromMatrixString(matrix));
			var inverseMatrix = sylvesterMatrix.inverse();
			// .e(row,column), 1-based
			var inverseMatrixString = "";
			if (inverseMatrix != null) {
				inverseMatrixString = "matrix(" 
					+ Math.round(inverseMatrix.e(1,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,1)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,2)*100000000)/100000000 + ", "
					+ Math.round(inverseMatrix.e(2,2)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(1,3)*100000000)/100000000 + ", " + Math.round(inverseMatrix.e(2,3)*100000000)/100000000 + ""
				+ ")";
			}
			// Return inverse
			return inverseMatrixString;
		}
		return "";
	}

	/*
	var m1 = [
	  [1,7,3],
	  [9,4,0],
	  [2,7,1]
	]
	*/
	function matrixMultiply(m1,m2) {
		var columnsCount1 = m1[0].length;
		var rowsCount2 = m2.length;
		if (columnsCount1 !== rowsCount2) {
			return false;
		}
		var result = [];
		for(var rowIndex1 in m1) {
			var row1 = m1[rowIndex1];
			var row2 = m2[rowIndex1];
			// Loop over all columns in row2
			for(var columnIndex2 in row2) {
				var subresult = 0;
				// Loop over all columns in row1 and multiply their values with their corresponding row in the column2
				for(var columnIndex1 in row1) {
					subresult += (row1[columnIndex1] * m2[columnIndex1][columnIndex2]);
				}
				result[rowIndex1] = result[rowIndex1] || [];
				result[rowIndex1][columnIndex2] = subresult;
			}
		}
		return result;
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
	
	function toggleFullScreen(elm) {  
		if (isFullScreen === false) {
			if (typeof(elm) == "undefined") {
				var elm = $(canvas).parent().get(0);
			}
			fullScreen();
		} else {  
			cancelFullScreen();
		}  
	}
	
	function fullScreen(elm) {
		if (typeof(elm) == "undefined") {
			fullScreenElement = $(canvas).parent().get(0);
		} else {
			fullScreenElement = $(elm).get(0);
		}
		if (fullScreenSupport) {
			if (fullScreenElement.requestFullScreen) {
				fullScreenElement.requestFullScreen();
			} else if (fullScreenElement.mozRequestFullScreen) {
				fullScreenElement.mozRequestFullScreen();
				fullScreenElement.mozfullscreenerror = function() { isFullScreen = false; return; }
			} else if (fullScreenElement.webkitRequestFullScreen) {  
				fullScreenElement.webkitRequestFullScreen(Element.ALLOW_KEYBOARD_INPUT);
			} else if (fullScreenElement.oRequestFullScreen) {  
				fullScreenElement.oRequestFullScreen();
			}
		} else {
			// Set black background
			$("body").append("<div id='presenteerjsfullscreenbackground' style='position: fixed; background: #000; left: 0px; top: 0px; right: 0px; bottom: 0px;'></div>");
			// Set element to full-screen
			fullScreenBackupStyling = $(fullScreenElement).attr("style");
			$(fullScreenElement).attr("style", fullScreenBackupStyling + "; position: fixed; z-index: 1000; left: 0px; top: 0px; right: 0px; bottom: 0px;");
		}
		isFullScreen = true;
	}
	
	function cancelFullScreen() {
		if (fullScreenSupport) {
			if (document.cancelFullScreen) {  
			  document.cancelFullScreen();  
			} else if (document.mozCancelFullScreen) {  
			  document.mozCancelFullScreen();  
			} else if (document.webkitCancelFullScreen) {  
			  document.webkitCancelFullScreen();  
			} else if (document.oCancelFullScreen) {  
			  document.oCancelFullScreen();  
			}
		} else {
			// Remove black background
			$("#presenteerjsfullscreenbackground").remove();
			// Set element to normal style
			$(fullScreenElement).attr("style", (fullScreenBackupStyling||""));
		}
		isFullScreen = false;
	}
		
})();