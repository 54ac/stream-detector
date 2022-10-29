"use strict";

import "../css/options.css";
import {
	saveOptionStorage,
	getStorage,
	getAllStorage,
	setStorage
} from "./components/storage.js";

const _ = chrome.i18n.getMessage; // i18n

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
};

document.addEventListener("DOMContentLoaded", () => {
	const options = document.getElementsByClassName("option");
	for (const option of options) {
		if (option.type !== "button") option.onchange = (e) => saveOptionStorage(e);
	}

	// buttons
	document.getElementById("exportButton").onclick = async () => {
		const allStorage = await getAllStorage();
		delete allStorage.urlStorage;
		delete allStorage.urlStorageRestore;
		delete allStorage.version;
		delete allStorage.newline;

		const settingsBlob = new Blob([JSON.stringify(allStorage)], {
			type: "application/json"
		});
		const settingsFile = document.createElement("a");
		settingsFile.href = URL.createObjectURL(settingsBlob);
		settingsFile.download = `stream-detector-settings-${Date.now()}.json`;
		settingsFile.click();
		URL.revokeObjectURL(settingsBlob);
		settingsFile.remove();
	};
	document.getElementById("importButton").onclick = () => {
		const settingsFile = document.createElement("input");
		settingsFile.type = "file";
		settingsFile.accept = ".json";

		settingsFile.onchange = () => {
			const settingsReader = new FileReader();
			const [file] = settingsFile.files;

			settingsReader.onload = () => {
				try {
					JSON.parse(settingsReader.result);
				} catch {
					window.alert(_("importButtonFailure"));
				}
				setStorage(JSON.parse(settingsReader.result));
				restoreOptions();
				chrome.runtime.sendMessage({ options: true });
				settingsFile.remove();
			};
			if (file) settingsReader.readAsText(file);
		};
		settingsFile.click();
	};

	document.getElementById("resetButton").onclick = () =>
		window.confirm(_("resetButtonConfirm")) &&
		chrome.runtime.sendMessage({ reset: true });

	restoreOptions();

	// i18n
	const labels = document.getElementsByTagName("label");
	for (const label of labels) label.textContent = _(label.htmlFor) + ":";

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

	// sync with popup changes
	chrome.runtime.onMessage.addListener((message) => {
		if (message.options) restoreOptions();
	});
});
