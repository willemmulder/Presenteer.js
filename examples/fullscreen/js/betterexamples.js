/**
* @author Willem Mulder
* @license CC-BYSA 3.0 Unported
*/

$(function() {
	$("body").append("<style> .betterExampleNoSetHeight { height: auto !important; } .betterExampleVisible { display: block !important; visibility: visible !important; } </style>");
});

BetterExamples = {
	instances : {},
	getInstance : function(id) {
		return this.instances[id];
	}
};
BetterExample = function(inputelm, outputelm, options) {

	var options = options || {};

	var id =  options.id || "instance_" + Math.floor(Math.random()*100000000000);
	var inDebug = false;
	var sleepingForDebug = false;
	var textAreaLength = -1;
	var originalTextAreaContent = "";
	
	var currentLine;

	var inputelm = $(inputelm);
	// Return existing instance if present
	if (inputelm.attr("betterexamplesid") && BetterExamples.getInstance(inputelm.attr("betterexamplesid"))) {
		return BetterExamples.getInstance(inputelm.attr("betterexamplesid"));
	} else {
		inputelm.attr("betterexamplesid", id);
	}
	var outputelm = $(outputelm);
	// use wrap="off" because white-space: nowrap does not function correctly in IE
	var inputInnerElm = $("<textarea style='outline: none; z-index:10; position: relative; width: 100%; height: 95%; background: rgba(255,255,255,0); border: none; text-decoration: none; overflow-y: hidden; overflow-x: auto;' wrap='off'></textarea>");
	// Save originalTextAreaContent for restore
	originalTextAreaContent = inputelm.html();
	inputInnerElm.html(originalTextAreaContent);
	inputelm.html(inputInnerElm);
	// Catch Control+R or F9 to run code
	inputelm.on("keydown", function(event) {
		textAreaLength = inputelm.find("textarea").val().length;
		if ((event.which == "82" && event.ctrlKey) || event.which == "120") {
			event.preventDefault();
			event.stopPropagation();
			facade.run();
		}
	});
	
	function fitToScrollHeight() {
		// Only run if textArea has actually changed
		if (textAreaLength != inputelm.find("textarea").val().length) {
			var firstHeight = inputelm.find("textarea").height();
			inputelm.find("textarea").css("height", inputelm.find("textarea").get(0).scrollHeight + "px"); 
			// If textarea was expanded, scroll to bottom of parent element
			if (inputelm.find("textarea").height() > firstHeight) {
				inputelm.parent().animate({
					scrollTop: inputelm.find("textarea").height()
				}, 0);
			}
		}
	}
	// Catch keydowns, blur and focus to check for code-changes
	inputelm.on("keyup focusin focusout", function(event) {
		fitToScrollHeight();
		facade.clearOutput(true); 
	});
	
	var functionBackups = [];
	
	var checkelm = inputelm.find("textarea");
	var inputText = checkelm.html();
	checkelm.addClass("betterExampleNoSetHeight");
	// We need multiple lines in the textarea in order to push the scrollHeight above the 'auto' height of a standard textarea
	// as to obtain a scrollHeight that is determined by the height of the lines instead of the 'auto' height
	checkelm.html("line 1\r\nline 2\r\nline 3\r\nline 4\r\nline 5\r\nline 6\r\nline 7\r\nline 8\r\nline 9\r\nline 10");
	var inputLineHeight = checkelm.get(0).scrollHeight / 10;
	if (!inputLineHeight) {
		// Element is (probably) hidden. Show the element, and all of its parents, and afterwards hide them again
		checkelm.parents().addClass("betterExampleVisible");
		inputLineHeight = checkelm.get(0).scrollHeight / 10;
		checkelm.html(inputText);
		fitToScrollHeight();
		checkelm.parents().removeClass("betterExampleVisible");
	} else {
		checkelm.html(inputText);
	}
	checkelm.removeClass("betterExampleNoSetHeight");
	
	// Set height of textarea to fit the content
	inputelm.find("textarea").css("height", inputelm.find("textarea").get(0).scrollHeight + "px"); 
	
	function visit(node, visitFunction, parentsList) {
		var parents = (typeof parentsList === 'undefined') ? [] : parentsList;
	
		visitFunction = visitFunction || false;
		if (visitFunction && visitFunction(node,parentsList) == false) {
			return;
		}
		for (key in node) {
			if (node.hasOwnProperty(key)) {
				child = node[key];
				path = [ node ];
				path.push(parents);
				if (typeof child === 'object' && child !== null) {
					visit(child, visitFunction, path);
				}
			}
		}
	};
	
	function restoreFunctions() {
		// Restore the altered functions
		for(functionID in functionBackups) {
			window[functionID] = functionBackups[functionID];
			if (functionID == "console.log") {
				// TODO make this generic
				console.log = functionBackups[functionID];
			}
		}
	}
	
	function positionMessages() {
		// Loop over the error messages and show as much of their info as possible (i.e. without overlapping other messages)
		outputelm.find(".betterExamplesLine").each(function() {
			var currentLineNumber = $(this).attr("line");
			var lowestNextLineNumber = -1;
			$(this).siblings(".betterExamplesLine").each(function() {
				if ($(this).attr("line") > currentLineNumber && (lowestNextLineNumber == -1 || lowestNextLineNumber > $(this).attr("line")) ) {
					lowestNextLineNumber = $(this).attr("line");
				}
			});
			if (lowestNextLineNumber != -1) {
				var space = lowestNextLineNumber - $(this).attr("line");
				// See how much height the element would take
				$(this).css("height", "auto");
				// Now restrict the height if the height=auto would take up more height than there is space
				if ($(this).height() > (space * inputLineHeight)) {
					$(this).css("height", (space * inputLineHeight) + "px");
				}
			} else {
				$(this).css("height", "auto"); // unlimited space
			}
		});
	}
	
	function drawDebugBar() {
		ielm = inputelm.find(".betterExamplesDebugBar").first();
		oelm = outputelm.find(".betterExamplesDebugBar").first();
		var line = currentLine;
		if (ielm.length == 0) {
			var start = "<div class='betterExamplesDebugBar' line='" + line + "' style='background: #ffa; position:absolute; left: 0px; top:" + (inputLineHeight*(line-1)) + "px; height: " + inputLineHeight + "px; display: block; width: 100%; z-index: 2; overflow: hidden;'>";
			var end = "</div>";
			outputelm.append(start+"&nbsp;"+end);
			inputelm.prepend(start+"&nbsp;"+end);
		} else {
			// existing bar
			ielm.add(oelm).attr("line", line);
			ielm.add(oelm).css("top", (inputLineHeight*(line-1)) + "px");
		}
	}
	
	function removeDebugBar() {
		outputelm.find(".betterExamplesDebugBar").remove();
		inputelm.find(".betterExamplesDebugBar").remove();
	}
	
	var facade = {
		"debug" : function() {
			inDebug = true;
			this.run();
			inDebug = false;
			removeDebugBar();
		},
		"run" : function() {
			// Set linePointer to the first line
			currentLine = 1;
			// Set alert or log functions to redirect to the output window
			var instance = this;
			functionBackups["alert"] = window.alert;
			window.alert = function(output) { 
				instance.log(output);
			}
			if (typeof(console) != "undefined" && typeof(console.log) != "undefined") {
				functionBackups["console.log"] = console.log;
				console.log = alert;
			}
			// Set error function to redirect to 'alert'
			functionBackups["onerror"] = window.onerror;
			window.onerror = function (message, url, lineNo) {
				var lineIndex = message.indexOf("Line");
				if (lineIndex > -1) {
					// Syntax error
					var until = message.indexOf(":",lineIndex);
					currentLine = message.slice(lineIndex+4, until);
					message = message.slice(until+2);
				} else {
					// Runtime error
					if (message.indexOf("Uncaught") === 0) {
						message = message.slice(message.indexOf(":", 8)+2);
					}
					// Display at current line
					// Alternatively get from function: currentLine = lineNo;
				}
				// Firefox : if (message.indexOf("Line") === 0) {
				// Webkit : if (message.indexOf("Uncaught Error: Line") === 0) {
				// Opera : if (message.indexOf("Uncaught exception: Error: Line") === 0) {
				if (lineIndex == -1) {
					facade.log(message, "Runtime error");
					// Restore functions and position messages. There will be no extra messages anyway, since a runtime error stops execution.
					restoreFunctions();
					positionMessages();
				} else {
					facade.log(message, "Syntax error");
				}
				return true; // Error was handled
			}
			// Remove output
			this.clearOutput();
			//==
			// Run the input, insert line-pointers and render the output
			//==
			var input = inputelm.find("textarea").val();
			// find which lines contain alert or log commands
			var analysis = esprima.parse(input,{ range: true, loc: true });
			var locations = [];
			// Set pointers for every VariableDeclaration or ExpressionStatement
			visit(analysis,function(node, parentsList) {
				if (node.type === "ForStatement" || node.type === "VariableDeclaration" || node.type === "ExpressionStatement") {
					// There is some situations in which we don't want to add pointers because they break the code
					// 1. Directly after {}-less if statements. Indeed, our pointer call would be the first call and the original call would allways be executed.
					// 2. Within a for() construct. There's only three statements allowed, and that's it.
					if (node.type === "VariableDeclaration" && parentsList.length && parentsList[0].type == "ForStatement") {
						// Variable declaration within the declaration of a for-loop. Don't add any functions there, it will result in error.
					} else {
						locations.push({range: node.range, location: node.loc});
					}
					// TODO: at the end of a FOR statement, add a log to the first line, since there might be an error in the increment-operation which will show on wrong line
					// for(x=1;x<10;x+=unknown) { ... } // Will produce error on wrong line
				}
			});
			// Insert pointer function at the specified locations
			var charactersInserted = 0;
			for(locationId in locations) {
				var range = locations[locationId].range;
				var location = locations[locationId].location;
				var func = "BetterExamples.getInstance('" + id + "').enterStep(" + location.start.line + ");";
				var length = func.length;
				var firstPart = input.slice(0,range[0]+charactersInserted);
				var secondPart = input.slice(range[0]+charactersInserted);
				input = firstPart + func + secondPart;
				charactersInserted += length;
			}
			eval(input);
			// If a runtime-error has occurred in the evaluated code, we won't get here so the below will not be executed. The window.onerror will ensure that it will happen anyways.
			restoreFunctions();
			positionMessages();
		},
		"restoreCode" : function() {
			this.clear();
			inputelm.find("textarea").val(originalTextAreaContent);
		},
		"setCode" : function(code) {
			this.clear();
			inputelm.find("textarea").val(code);
			setTimeout(function() {
				fitToScrollHeight();
			},1);
		},
		"clear" : function() { 
			inputelm.find("textarea").val("");
			this.clearOutput();
		},
		"clearOutput" : function(withFade) { 
			if (withFade) {
				inputelm.find(".betterExamplesLine").fadeOut(function() { inputelm.find(".betterExamplesLine").remove(); });
				outputelm.find("*").fadeOut(function() { outputelm.html(""); });
				if (outputelm.find("*").size() == 0) {
					outputelm.html("");
				}	
			} else {
				inputelm.find(".betterExamplesLine").remove();
				outputelm.html("");
			}
		},
		"log" : function(obj,type) {
			var type = type || typeof(obj);
			type = type.charAt(0).toUpperCase() + type.slice(1); // Capitalize first character
			var extraStyle = "";
			if (type.indexOf("error")>-1) { extraStyle = "background: #CC1919; color: #fff;" }
			var line = currentLine;
			var start = function(zindex) {
				return "<div class='betterExamplesLine' line='" + line + "' style='background: #eef; position:absolute; left: 0px; top:" + (inputLineHeight*(line-1)) + "px; height: " + inputLineHeight + "px; display: block; width: 100%; z-index: " + zindex + "; overflow: hidden;' onMouseOver='$(this).attr(\"backupZindex\",$(this).css(\"z-index\")); $(this).attr(\"backupHeight\",$(this).css(\"height\")); $(this).css(\"height\",\"auto\").css(\"z-index\",\"100\")' onMouseOut='$(this).css(\"height\",$(this).attr(\"backupHeight\")).css(\"z-index\",$(this).attr(\"backupZindex\"))'>";
			}
			var output = "<div style='width: 130px; background: #dde; "+ extraStyle + " display: inline-block; z-index: 3;'>" + type + "</div> ";
			if (obj instanceof Function) {
				var func = obj.toString();
				// Remove any pointer-calls
				func = func.replace(/BetterExamples\.getInstance\([^\)]+\)\.enterStep\([0-9]+\)+\;/ig, "");
				output += func;
			} else {
				output += JSON.stringify(obj, null, 4);
			}
			var end = "</div>";
			outputelm.append(start(3) + output + end);
			inputelm.prepend(start(1) + "&nbsp;" + end);
		},
		"getId" : function() {
			return id;
		},
		"setId" : function(newId) {
			delete BetterExamples.instances[id];
			id = newId;
			BetterExamples.instances[id] = facade;
		},
		"enterStep" : function(lineNumber) {
			// Set lineNumber
			currentLine = lineNumber;
			// If we are in debug mode, then 'sleep' until we can get to the next step
			if (inDebug) {
				drawDebugBar();
				//sleepingForDebug = true; // To be used with while loops if that turns out to be more useful
				var returnValue = window.showModalDialog("js/debug.html",null,"dialogleft:0;dialogtop:0;dialogheight:20;dialogwidth:200"); // UI will sleep as long as the modal dialog is open
				if (returnValue == "nextStep") {
					// continue
				} else if (returnValue == "exitDebug") {
					inDebug = false;
					removeDebugBar();
					// continue
				} else {
					inDebug = false; // If anything goes wrong, just get out of debug and don't open the window again and again and again
					removeDebugBar();
					// continue
				}
			}
		},
		"goToNextStep" : function() {
			//sleepingForDebug = false;
		}
	};
	BetterExamples.instances[id] = facade;
	return facade;
}