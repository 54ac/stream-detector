"use strict";

import "../css/options.css";
import { saveOptionStorage, getStorage } from "./components/storage.js";

const _ = chrome.i18n.getMessage; // i18n

const checkHeadersPref = () => {
	document.getElementById("subtitlePref").disabled = false;
	document.getElementById("filePref").disabled = false;
	document.getElementById("headersPref").disabled = false;
	document.getElementById("titlePref").disabled = false;
	document.getElementById("filenamePref").disabled = false;
	document.getElementById("manifestPref").disabled = false;
	document.getElementById("timestampPref").disabled = false;
	document.getElementById("fileExtension").disabled = true;
	document.getElementById("streamlinkOutput").disabled = true;
	document.getElementById("downloaderPref").disabled = true;
	document.getElementById("downloaderCommand").disabled = true;
	document.getElementById("proxyPref").disabled = false;
	document.getElementById("proxyCommand").disabled = true;
	document.getElementById("customCommandPref").disabled = false;
	document.getElementById("customCommand").disabled = true;
	document.getElementById("userCommand").disabled = true;
	document.getElementById("regexCommandPref").disabled = true;
	document.getElementById("regexCommand").disabled = true;
	document.getElementById("regexReplace").disabled = true;
	document.getElementById("customExtPref").disabled = false;
	document.getElementById("customExtEntries").disabled = true;
	document.getElementById("customCtPref").disabled = false;
	document.getElementById("customCtEntries").disabled = true;
	document.getElementById("blacklistPref").disabled = false;
	document.getElementById("blacklistEntries").disabled = true;
	document.getElementById("cleanupPref").disabled = false;
	document.getElementById("notifDetectPref").disabled = false;
	document.getElementById("downloadDirectPref").disabled = false;
	document.getElementById("autoDownloadPref").disabled = false;

	document.getElementById("subtitlePref").disabled = document.getElementById(
		"disablePref"
	).checked;

	document.getElementById("filePref").disabled = document.getElementById(
		"disablePref"
	).checked;

	document.getElementById(
		"downloadDirectPref"
	).disabled = document.getElementById("filePref").checked;

	document.getElementById("autoDownloadPref").disabled =
		!document.getElementById("downloadDirectPref").checked ||
		document.getElementById("filePref").checked;

	document.getElementById("manifestPref").disabled = document.getElementById(
		"disablePref"
	).checked;

	document.getElementById("notifDetectPref").disabled = document.getElementById(
		"notifPref"
	).checked;

	document.getElementById(
		"downloaderCommand"
	).disabled = !document.getElementById("downloaderPref").checked;

	document.getElementById("proxyCommand").disabled = !document.getElementById(
		"proxyPref"
	).checked;

	document.getElementById("customCommand").disabled = !document.getElementById(
		"customCommandPref"
	).checked;

	document.getElementById(
		"customExtEntries"
	).disabled = !document.getElementById("customExtPref").checked;
	document.getElementById(
		"customCtEntries"
	).disabled = !document.getElementById("customCtPref").checked;
	document.getElementById(
		"blacklistEntries"
	).disabled = !document.getElementById("blacklistPref").checked;

	document.getElementById("regexCommand").disabled = !document.getElementById(
		"regexCommandPref"
	).checked;
	document.getElementById("regexReplace").disabled = !document.getElementById(
		"regexCommandPref"
	).checked;

	if (
		document.getElementById("copyMethod").value === "url" ||
		document.getElementById("copyMethod").value === "tableForm"
	) {
		document.getElementById("headersPref").disabled = true;
		document.getElementById("filenamePref").disabled = true;
		document.getElementById("timestampPref").disabled = true;
		document.getElementById("proxyPref").disabled = true;
		document.getElementById("proxyCommand").disabled = true;
		document.getElementById("customCommandPref").disabled = true;
		document.getElementById("customCommand").disabled = true;
	} else if (document.getElementById("copyMethod").value === "kodiUrl") {
		document.getElementById("filenamePref").disabled = true;
		document.getElementById("timestampPref").disabled = true;
		document.getElementById("proxyPref").disabled = true;
		document.getElementById("proxyCommand").disabled = true;
		document.getElementById("customCommandPref").disabled = true;
		document.getElementById("customCommand").disabled = true;
	} else if (document.getElementById("copyMethod").value === "streamlink") {
		document.getElementById("streamlinkOutput").disabled = false;
	} else if (
		document.getElementById("copyMethod").value === "youtubedl" ||
		document.getElementById("copyMethod").value === "ytdlp"
	) {
		document.getElementById("downloaderPref").disabled = false;
	} else if (
		document.getElementById("copyMethod").value === "ffmpeg" ||
		document.getElementById("copyMethod").value === "streamlink" ||
		document.getElementById("copyMethod").value === "hlsdl"
	) {
		document.getElementById("fileExtension").disabled = false;
	} else if (document.getElementById("copyMethod").value === "user") {
		document.getElementById("headersPref").disabled = true;
		document.getElementById("filenamePref").disabled = true;
		document.getElementById("timestampPref").disabled = true;
		document.getElementById("proxyPref").disabled = true;
		document.getElementById("proxyCommand").disabled = true;
		document.getElementById("customCommand").disabled = true;
		document.getElementById("userCommand").disabled = false;
		document.getElementById("regexCommandPref").disabled = false;
	}
};

const saveOption = (e) => {
	saveOptionStorage(e);
	checkHeadersPref();
};

const restoreOptions = async () => {
	const options = document.getElementsByClassName("option");
	for (const option of options) {
		if (option.id === "customCommand") {
			const prefName = option.id + document.getElementById("copyMethod").value;
			document.getElementById(option.id).value =
				(await getStorage(prefName)) || "";
		} else if (option.tagName.toLowerCase() === "textarea") {
			if (await getStorage(option.id)) {
				const textareaValue = await getStorage(option.id);
				if (textareaValue !== null)
					document.getElementById(option.id).value = textareaValue.join("\n");
			}
		} else if ((await getStorage(option.id)) !== null) {
			if (
				document.getElementById(option.id).type === "checkbox" ||
				document.getElementById(option.id).type === "radio"
			) {
				document.getElementById(option.id).checked = await getStorage(
					option.id
				);
			} else {
				document.getElementById(option.id).value = await getStorage(option.id);
			}
		}
	}

	checkHeadersPref();
};

document.addEventListener("DOMContentLoaded", () => {
	const options = document.getElementsByClassName("option");
	for (const option of options) {
		if (option.type !== "button") option.onchange = (e) => saveOption(e);
	}

	// reset button
	document.getElementById("resetButton").onclick = () =>
		window.confirm(_("resetButtonConfirm")) &&
		chrome.runtime.sendMessage({ reset: true });

	// i18n
	const labels = document.getElementsByTagName("label");
	for (const label of labels) {
		label.textContent = _(label.htmlFor) + ":";
	}
	const selectOptions = document.getElementsByTagName("option");
	for (const selectOption of selectOptions) {
		if (!selectOption.textContent)
			selectOption.textContent = _(selectOption.value);
	}
	const spans = document.getElementsByTagName("span");
	for (const span of spans) {
		// mouseover tooltip
		span.parentElement.title = _(span.id);
	}
	const buttons = document.getElementsByTagName("button");
	for (const button of buttons) {
		button.textContent = _(button.id);
	}

	restoreOptions();

	// sync with popup changes
	chrome.runtime.onMessage.addListener((message) => {
		if (message.options) restoreOptions();
	});
});
