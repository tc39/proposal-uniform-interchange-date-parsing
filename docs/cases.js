document.addEventListener("DOMContentLoaded", onload);

function onload() {
	var heads = document.querySelectorAll(".cases tbody tr.group-head th");
	Array.prototype.forEach.call(heads, function( elHead ) {
		elHead.setAttribute("colspan", "5");
	});

	var refs = document.querySelectorAll(".cases tbody td[data-ref]");
	Array.prototype.forEach.call(refs, function( elRef ) {
		var elLink = document.createElement("a");
	  elLink.setAttribute("href", elLink.getAttribute("data-ref"));
	  elLink.setAttribute("target", "_blank");
	  elLink.innerHTML = elRef.innerHTML + "→";
	  elRef.innerHTML = " ";
		elRef.appendChild(elLink);
	});

	var cases = document.querySelectorAll(".cases tbody tr:not(.group-head)");
	Array.prototype.forEach.call(cases, function( elCase ) {
	  // Collect input.
	  var elInput = elCase.querySelector("td");
	  var strInput = elInput.innerText;
	  
	  // Attempt parsing.
	  var tsOutput = Date.parse(strInput);
	  var bRejected = isNaN(tsOutput);
	  
	  // Output results.
	  var elOutput = elCase.appendChild(document.createElement("td"));
	  if ( bRejected ) {
		elOutput.innerHTML = "<code>NaN</code>";
	  }
	  else {
		// Try to match the input format w.r.t. time.
		var strOutput = new Date(tsOutput).toISOString();
		if ( /[T\x20]./i.test(strInput) ) {
		  var precision = strInput.match(/[:.,]/g).length;
		  var rTime = new RegExp("(([:.]\\d+){" + precision + "})[^Z]*");
		  strOutput = strOutput.replace(rTime, "$1");
		} else {
			strOutput = strOutput.replace(/:\d+\.\d+/i, "");
		}
		elOutput.innerText = strOutput;
	  }
	});
}
