"use strict";

const defaultOptions = { tabThis: true }; //used in restoreOptions

const _ = browser.i18n.getMessage; //i18n

function restoreOptions() {
	//change badge text background when clicked
	browser.browserAction.setBadgeBackgroundColor({ color: "gainsboro" });

	const options = document.getElementsByClassName("option");
	//should probably consolidate this with the other one at some point
	browser.storage.local.get().then(item => {
		for (let option of options) {
			if (defaultOptions[option.id]) {
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
		for (let option of options) {
			option.onchange = e => saveOption(e);
		}

		//i18n
		const labels = document.getElementsByTagName("label");
		for (let label of labels) {
			label.textContent = _(label.htmlFor);
		}
		const selectOptions = document.getElementsByTagName("option");
		for (let selectOption of selectOptions) {
			selectOption.textContent = _(selectOption.value);
		}

		//button and text input functionality
		document.getElementById("copyAll").onmouseup = e => {
			e.preventDefault();
			copyAll();
		};
		document.getElementById("clearList").onmouseup = e => {
			e.preventDefault();
			clearList();
		};
		document.getElementById("filterInput").onkeyup = () => createList();
	});
}

function saveOption(e) {
	const options = document.getElementsByClassName("option");
	if (e.target.type === "checkbox") {
		browser.storage.local.set({
			[e.target.id]: e.target.checked
		});
		//sync with options.js - workaround
		browser.runtime.sendMessage({ options: true });
	} else if (e.target.type === "radio") {
		//update entire radio group
		for (let option of options) {
			if (option.name === e.target.name) {
				browser.storage.local.set({
					[option.id]: document.getElementById(option.id).checked
				});
			}
		}
		createList();
	} else {
		browser.storage.local.set({
			[e.target.id]: e.target.value
		});
		browser.runtime.sendMessage({ options: true });
	}
}

function copyURL(info) {
	browser.storage.local.get().then(options => {
		const list = { urls: [], filenames: [], methodIncomp: false };
		for (let e of info) {
			let code, methodIncomp, fileMethod;

			const streamURL = e.url;
			const { filename, ext } = e;
			fileMethod = !options.copyMethod ? "url" : options.copyMethod; //default to url - just in case

			if (
				(ext === "f4m" && fileMethod === "ffmpeg") ||
				(ext === "ism" && fileMethod !== "youtubedl") ||
				(ext === "vtt" && fileMethod !== "youtubedl") ||
				(ext !== "m3u8" && fileMethod === "hlsdl")
			) {
				fileMethod = "url";
				methodIncomp = true;
			}

			//don't use user-defined command if empty
			if (fileMethod === "user" && options.userCommand.length === 0) {
				fileMethod = "url";
				methodIncomp = true;
			}

			if (fileMethod === "url") {
				code = streamURL;
			} else {
				//the switchboard of doom begins
				switch (fileMethod) {
					case "ffmpeg":
						code = "ffmpeg";
						break;
					case "streamlink":
						code = "streamlink";
						break;
					case "youtubedl":
						code = "youtube-dl --no-part --restrict-filenames";
						break;
					case "hlsdl":
						code = "hlsdl -b";
						break;
					case "user":
						code = options.userCommand;
						break;
				}

				//custom command line
				let prefName = "customCommand" + fileMethod;
				if (options[prefName]) {
					code += " " + options[prefName];
				}

				//http proxy
				if (options.proxyPref === true && options.proxyCommand) {
					switch (fileMethod) {
						case "ffmpeg":
							code += ` -http_proxy "${options.proxyCommand}"`;
							break;
						case "streamlink":
							code += ` --http-proxy "${options.proxyCommand}"`;
							break;
						case "youtubedl":
							code += ` --proxy "${options.proxyCommand}"`;
							break;
						case "hlsdl":
							code += ` -p "${options.proxyCommand}"`;
							break;
						case "user":
							code = code.replace("%proxy%", options.proxyCommand);
							break;
					}
				}

				//additional headers
				if (options.headersPref === true) {
					let headerUserAgent = e.requestHeaders.find(
						header => header.name.toLowerCase() === "user-agent"
					);
					headerUserAgent
						? (headerUserAgent = headerUserAgent.value)
						: (headerUserAgent = navigator.userAgent);

					let headerCookie = e.requestHeaders.find(
						header => header.name.toLowerCase() === "cookie"
					);
					if (headerCookie)
						headerCookie = headerCookie.value.replaceAll(`"`, `'`); //double quotation marks mess up the command

					let headerReferer = e.requestHeaders.find(
						header => header.name.toLowerCase() === "referer"
					);
					if (headerReferer) headerReferer = headerReferer.value;

					if (headerUserAgent && headerUserAgent.length > 0) {
						switch (fileMethod) {
							case "ffmpeg":
								code += ` -user_agent "${headerUserAgent}"`;
								break;
							case "streamlink":
								code += ` --http-header "User-Agent=${headerUserAgent}"`;
								break;
							case "youtubedl":
								code += ` --user-agent "${headerUserAgent}"`;
								break;
							case "hlsdl":
								code += ` -u "${headerUserAgent}"`;
								break;
							case "user":
								code = code.replace("%useragent%", headerUserAgent);
								break;
						}
					} else if (fileMethod === "user") {
						code = code.replace("%useragent%", "");
					}

					if (headerCookie && headerCookie.length > 0) {
						switch (fileMethod) {
							case "ffmpeg":
								code += ` -headers "Cookie: ${headerCookie}"`;
								break;
							case "streamlink":
								code += ` --http-header "Cookie=${headerCookie}"`;
								break;
							case "youtubedl":
								code += ` --add-header "Cookie:${headerCookie}"`;
								break;
							case "hlsdl":
								code += ` -h "Cookie:${headerCookie}"`;
								break;
							case "user":
								code = code.replace("%cookie%", headerCookie);
								break;
						}
					} else if (fileMethod === "user") {
						code = code.replace("%cookie%", "");
					}

					if (headerReferer && headerReferer.length > 0) {
						switch (fileMethod) {
							case "ffmpeg":
								code += ` -referer "${headerReferer}"`;
								break;
							case "streamlink":
								code += ` --http-header "Referer=${headerReferer}"`;
								break;
							case "youtubedl":
								code += ` --referer "${headerReferer}"`;
								break;
							case "hlsdl":
								code += ` -h "Referer:${headerReferer}"`;
								break;
							case "user":
								code = code.replace("%referer%", headerReferer);
								break;
						}
					} else if (fileMethod === "user") {
						code = code.replace("%referer%", "");
					}
				}

				//final part of command
				switch (fileMethod) {
					case "ffmpeg":
						code += ` -i "${streamURL}" -c copy "${filename}.ts"`;
						break;
					case "streamlink":
						if (!options.streamlinkOutput) options.streamlinkOutput = "file";
						if (options.streamlinkOutput === "file")
							code += ` -o "${filename}.ts"`;
						code += ` "${streamURL}" best`;
						break;
					case "youtubedl":
						code += ` "${streamURL}"`;
						break;
					case "hlsdl":
						code += ` -o "${filename}.ts" "${streamURL}"`;
						break;
					case "user":
						code = code.replace("%url%", streamURL);
						code = code.replace("%filename%", filename);
						break;
				}
			}

			//used to communicate with clipboard/notifications api
			list.urls.push(code);
			list.filenames.push(filename + "." + ext);
			list.methodIncomp = methodIncomp;
		}

		navigator.clipboard.writeText(list.urls.join("\n")).then(
			() => {
				if (options.notifPref !== true) {
					browser.notifications.create("copy", {
						type: "basic",
						iconUrl: "img/icon-dark-96.png",
						title: _("notifCopiedTitle"),
						message:
							(list.methodIncomp === true
								? _("notifIncompCopiedText")
								: _("notifCopiedText")) + list.filenames.join("\n")
					});
				}
			},
			error => {
				if (options.notifPref !== true) {
					browser.notifications.create("error", {
						type: "basic",
						iconUrl: "img/icon-dark-96.png",
						title: _("notifErrorTitle"),
						message: _("notifErrorText") + error
					});
				}
			}
		);
	});
}

function deleteURL(requestDetails) {
	const deleteUrlStorage = [requestDetails];
	browser.runtime.sendMessage({ delete: deleteUrlStorage }); //notify background script to update urlstorage. workaround
}

function getIdList() {
	return Array.from(
		document.getElementById("popupUrlList").getElementsByTagName("tr")
	).map(tr => tr.id);
}

function copyAll() {
	//this seems like a roundabout way of doing this but oh well
	const idList = getIdList();
	const copyUrlList = urlList.filter(url => idList.includes(url.requestId));

	copyURL(copyUrlList);
}

function clearList() {
	const idList = getIdList();
	const deleteUrlStorage = urlList.filter(url =>
		idList.includes(url.requestId)
	);

	browser.runtime.sendMessage({ delete: deleteUrlStorage });
}

const table = document.getElementById("popupUrlList");

let urlList = [];

function createList() {
	function insertList(urlList) {
		document.getElementById("copyAll").disabled = false;
		document.getElementById("clearList").disabled = false;
		document.getElementById("filterInput").disabled = false;

		for (let requestDetails of urlList) {
			//everyone's favorite - dom manipulation in vanilla js
			const row = document.createElement("tr");
			row.id = requestDetails.requestId;

			const extCell = document.createElement("td");
			extCell.textContent = requestDetails.ext.toUpperCase();

			const urlCell = document.createElement("td");
			urlCell.textContent = requestDetails.filename;
			urlCell.onmouseup = () => copyURL([requestDetails]);
			urlCell.style.cursor = "pointer";
			urlCell.title = _("copyTooltip");

			const sourceCell = document.createElement("td");
			sourceCell.textContent = requestDetails.hostname;

			const timestampCell = document.createElement("td");
			timestampCell.textContent = new Date(
				requestDetails.timestamp
			).toISOString();

			const deleteCell = document.createElement("td");
			deleteCell.textContent = "X";
			deleteCell.onmouseup = () => deleteURL(requestDetails);
			deleteCell.onmouseover = () =>
				(urlCell.style.textDecoration = "line-through");
			deleteCell.onmouseout = () => (urlCell.style.textDecoration = "initial");
			deleteCell.style.cursor = "pointer";
			deleteCell.title = _("deleteTooltip");

			row.appendChild(extCell);
			row.appendChild(urlCell);
			row.appendChild(sourceCell);
			row.appendChild(timestampCell);
			row.appendChild(deleteCell);

			row.onmouseover = () => (row.style.backgroundColor = "gainsboro");
			row.onmouseout = () => (row.style.backgroundColor = "initial");

			table.appendChild(row);
		}
	}

	function insertPlaceholder() {
		document.getElementById("copyAll").disabled = true;
		document.getElementById("clearList").disabled = true;
		if (document.getElementById("filterInput").value.length === 0)
			document.getElementById("filterInput").disabled = true;

		const row = document.createElement("tr");

		const placeholderCell = document.createElement("td");
		placeholderCell.colSpan = document.getElementsByTagName("th").length; //i would never remember to update this manually
		placeholderCell.textContent = "No URLs available.";

		row.appendChild(placeholderCell);

		table.appendChild(row);
	}

	browser.storage.local.get().then(options => {
		//clear list first just in case - quick and dirty
		table.innerHTML = "";

		if (options.urlStorage && options.urlStorage.length > 0) {
			const urlStorageFilter = document
				.getElementById("filterInput")
				.value.toLowerCase();

			//do the query first to avoid async issues
			browser.tabs.query({ active: true, currentWindow: true }).then(tab => {
				if (document.getElementById("tabThis").checked === true) {
					urlList = options.urlStorage.filter(
						url => url.tabId === tab[0].id && !url.restore
					);
				} else if (document.getElementById("tabAll").checked === true) {
					urlList = options.urlStorage.filter(url => url.restore !== true);
				} else if (document.getElementById("tabPrevious").checked === true) {
					urlList = options.urlStorage.filter(url => url.restore === true);
				}

				if (urlStorageFilter)
					urlList = urlList.filter(
						url =>
							url.filename.toLowerCase().includes(urlStorageFilter) ||
							url.ext.toLowerCase().includes(urlStorageFilter) ||
							url.hostname.toLowerCase().includes(urlStorageFilter)
					);

				urlList.length > 0
					? insertList(urlList.reverse()) //latest entries first
					: insertPlaceholder();
			});
		} else {
			insertPlaceholder();
		}
	});
}

document.addEventListener("DOMContentLoaded", () => {
	restoreOptions();
	createList();

	browser.runtime.onMessage.addListener(message => {
		if (message.urlStorage) createList();
	});
});
