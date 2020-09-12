"use strict";

const defaultOptions = {
	copyMethod: "url",
	streamlinkOutput: "file",
	headersPref: true,
	copyAll: true
}; // used in restoreOptions

const _ = browser.i18n.getMessage; // i18n

function checkHeadersPref() {
	document.getElementById("streamlinkOutput").disabled = true;
	document.getElementById("headersPref").disabled = false;
	document.getElementById("downloaderPref").disabled = true;
	document.getElementById("downloaderCommand").disabled = true;
	document.getElementById("proxyPref").disabled = false;
	document.getElementById("proxyCommand").disabled = false;
	document.getElementById("customCommand").disabled = false;
	document.getElementById("userCommand").disabled = true;

	document.getElementById("downloaderPref").checked === true
		? (document.getElementById("downloaderCommand").disabled = false)
		: (document.getElementById("downloaderCommand").disabled = true);

	document.getElementById("proxyPref").checked === true
		? (document.getElementById("proxyCommand").disabled = false)
		: (document.getElementById("proxyCommand").disabled = true);

	if (document.getElementById("copyMethod").value === "url") {
		document.getElementById("headersPref").disabled = true;
		document.getElementById("proxyPref").disabled = true;
		document.getElementById("proxyCommand").disabled = true;
		document.getElementById("customCommand").disabled = true;
	} else if (document.getElementById("copyMethod").value === "streamlink") {
		document.getElementById("streamlinkOutput").disabled = false;
	} else if (
		document.getElementById("copyMethod").value === "youtubedl" ||
		document.getElementById("copyMethod").value === "youtubedlc"
	) {
		document.getElementById("downloaderPref").disabled = false;
	} else if (document.getElementById("copyMethod").value === "user") {
		document.getElementById("headersPref").disabled = true;
		document.getElementById("proxyPref").disabled = true;
		document.getElementById("proxyCommand").disabled = true;
		document.getElementById("customCommand").disabled = true;
		document.getElementById("userCommand").disabled = false;
	}
}

function saveOption(e) {
	if (e.target.id === "copyMethod" && e.target.value !== "url") {
		const prefName = `customCommand${e.target.value}`;
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
	const options = document.getElementsByClassName("option");
	// this is truly a pain
	browser.storage.local.get().then(item => {
		for (const option of options) {
			if (option.id === "customCommand") {
				const prefName =
					option.id + document.getElementById("copyMethod").value;
				item[prefName]
					? (document.getElementById(option.id).value = item[prefName])
					: (document.getElementById(option.id).value = "");
			} else if (defaultOptions[option.id]) {
				if (
					document.getElementById(option.id).type === "checkbox" ||
					document.getElementById(option.id).type === "radio"
				) {
					if (item[option.id] !== undefined) {
						document.getElementById(option.id).checked = item[option.id];
					} else {
						document.getElementById(option.id).checked =
							defaultOptions[option.id];
						browser.storage.local.set({
							[option.id]: defaultOptions[option.id]
						});
					}
				} else if (item[option.id] !== undefined) {
					document.getElementById(option.id).value = item[option.id];
				} else {
					document.getElementById(option.id).value = defaultOptions[option.id];
					browser.storage.local.set({
						[option.id]: defaultOptions[option.id]
					});
				}
			} else if (item[option.id] !== undefined) {
				if (
					document.getElementById(option.id).type === "checkbox" ||
					document.getElementById(option.id).type === "radio"
				) {
					document.getElementById(option.id).checked = item[option.id];
				} else {
					document.getElementById(option.id).value = item[option.id];
				}
			}
		}

		checkHeadersPref();
	});
}

document.addEventListener("DOMContentLoaded", () => {
	const options = document.getElementsByClassName("option");
	for (const option of options) {
		option.onchange = e => saveOption(e);
	}

	// i18n
	const labels = document.getElementsByTagName("label");
	for (const label of labels) {
		label.textContent = _(label.htmlFor);
	}
	const selectOptions = document.getElementsByTagName("option");
	for (const selectOption of selectOptions) {
		selectOption.textContent = _(selectOption.value);
	}
	const spans = document.getElementsByTagName("span");
	for (const span of spans) {
		// mouseover tooltip
		span.parentElement.title = _(span.id);
	}

	restoreOptions();

	// sync with popup changes
	browser.runtime.onMessage.addListener(message => {
		if (message.options) restoreOptions();
	});
});
