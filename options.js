const defaultOptions = {
	copyMethod: "url",
	streamlinkOutput: "file",
	headersPref: true
}; //used in restoreOptions

function checkHeadersPref() {
	//no need to confuse people
	if (document.getElementById("copyMethod").value === "url") {
		document.getElementById("streamlinkOutput").disabled = true;
		document.getElementById("headersPref").disabled = true;
		document.getElementById("customCommand").disabled = true;
	} else if (document.getElementById("copyMethod").value === "streamlink") {
		document.getElementById("streamlinkOutput").disabled = false;
		document.getElementById("headersPref").disabled = false;
		document.getElementById("customCommand").disabled = false;
	} else {
		document.getElementById("streamlinkOutput").disabled = true;
		document.getElementById("headersPref").disabled = false;
		document.getElementById("customCommand").disabled = false;
	}
}

function saveOption(e) {
	if (e.target.id === "copyMethod" && e.target.value !== "url") {
		let prefName = "customCommand" + e.target.value;
		browser.storage.local.get(prefName).then(res => {
			res[prefName]
				? (document.getElementById("customCommand").value = res[prefName])
				: (document.getElementById("customCommand").value = "");
		});
	}

	if (e.target.id === "customCommand") {
		browser.storage.local.set({
			[e.target.id + document.getElementById("copyMethod").value]: e.target
				.value
		});
	} else if (e.target.type === "checkbox") {
		browser.storage.local.set({
			[e.target.id]: e.target.checked
		});
	} else {
		browser.storage.local.set({
			[e.target.id]: e.target.value
		});
	}

	checkHeadersPref();
}

function restoreOptions() {
	//this is truly a pain in vanilla JS but frameworks would have been overkill
	browser.storage.local.get().then(item => {
		for (let entry = 0; entry < options.length; entry++) {
			if (options[entry].id === "customCommand") {
				let prefName =
					options[entry].id + document.getElementById("copyMethod").value;
				item[prefName]
					? (document.getElementById(options[entry].id).value = item[prefName])
					: (document.getElementById(options[entry].id).value = "");
			} else if (defaultOptions[options[entry].id]) {
				if (document.getElementById(options[entry].id).type === "checkbox") {
					if (item[options[entry].id] !== undefined) {
						document.getElementById(options[entry].id).checked =
							item[options[entry].id];
					} else {
						document.getElementById(options[entry].id).checked =
							defaultOptions[options[entry].id];
						browser.storage.local.set({
							[options[entry].id]: defaultOptions[options[entry].id]
						});
					}
				} else {
					if (item[options[entry].id] !== undefined) {
						document.getElementById(options[entry].id).value =
							item[options[entry].id];
					} else {
						document.getElementById(options[entry].id).value =
							defaultOptions[options[entry].id];
						browser.storage.local.set({
							[options[entry].id]: defaultOptions[options[entry].id]
						});
					}
				}
			} else if (item[options[entry].id] !== undefined) {
				if (document.getElementById(options[entry].id).type === "checkbox") {
					document.getElementById(options[entry].id).checked =
						item[options[entry].id];
				} else {
					document.getElementById(options[entry].id).value =
						item[options[entry].id];
				}
			}
		}

		checkHeadersPref();
	});
}

const options = document.getElementsByClassName("option");
document.addEventListener("DOMContentLoaded", restoreOptions);

for (let entry = 0; entry < options.length; entry++) {
	options[entry].addEventListener("change", e => saveOption(e));
}

const _ = browser.i18n.getMessage; //i18n of options menu
const labels = document.getElementsByTagName("label");
for (let entry = 0; entry < labels.length; entry++) {
	labels[entry].textContent = _(labels[entry].htmlFor);
}
const selectOptions = document.getElementsByTagName("option");
for (let entry = 0; entry < selectOptions.length; entry++) {
	selectOptions[entry].textContent = _(selectOptions[entry].value);
}
