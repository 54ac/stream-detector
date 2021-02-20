"use strict";

const defaultOptions = { tabThis: true }; // used in restoreOptions

const _ = chrome.i18n.getMessage; // i18n

const table = document.getElementById("popupUrlList");

let titlePref;
let filenamePref;
let urlList = [];

const copyURL = (info) => {
	chrome.storage.local.get((options) => {
		const list = { urls: [], filenames: [], methodIncomp: false };
		for (const e of info) {
			let code;
			let methodIncomp;
			let fileMethod;

			const streamURL = e.url;
			const { filename, type } = e;
			fileMethod = !options.copyMethod ? "url" : options.copyMethod; // default to url - just in case

			if (
				(type === "HDS" && fileMethod === "ffmpeg") ||
				(type === "MSS" &&
					fileMethod !== "youtubedl" &&
					fileMethod !== "youtubedlc") ||
				((type === "VTT" ||
					type === "SRT" ||
					type === "TTML" ||
					type === "DFXP") &&
					fileMethod !== "url") ||
				(type !== "HLS" && fileMethod === "hlsdl")
			) {
				fileMethod = "url";
				methodIncomp = true;
			}

			// don't use user-defined command if empty
			if (fileMethod === "user" && options.userCommand.length === 0) {
				fileMethod = "url";
				methodIncomp = true;
			}

			if (fileMethod === "url") {
				code = streamURL;
			} else {
				// the switchboard of doom begins
				switch (fileMethod) {
					case "ffmpeg":
						code = "ffmpeg";
						break;
					case "streamlink":
						code = "streamlink";
						break;
					case "youtubedl":
						code = "youtube-dl --no-part --restrict-filenames";
						// use external downloader
						if (options.downloaderPref === true && options.downloaderCommand)
							code += ` --external-downloader "${options.downloaderCommand}"`;
						break;
					// this could be implemented better - maybe someday
					case "youtubedlc":
						code = "youtube-dlc --no-part --restrict-filenames";
						if (options.downloaderPref === true && options.downloaderCommand)
							code += ` --external-downloader "${options.downloaderCommand}"`;
						break;
					case "hlsdl":
						code = "hlsdl -b -c";
						break;
					case "user":
						code = options.userCommand;
						break;
					default:
						break;
				}

				// custom command line
				const prefName = `customCommand${fileMethod}`;
				if (options[prefName]) {
					code += ` ${options[prefName]}`;
				}

				// http proxy
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
						case "youtubedlc":
							code += ` --proxy "${options.proxyCommand}"`;
							break;
						case "hlsdl":
							code += ` -p "${options.proxyCommand}"`;
							break;
						case "user":
							code = code.replace(
								new RegExp("%proxy%", "g"),
								options.proxyCommand
							);
							break;
						default:
							break;
					}
				}

				// additional headers
				if (options.headersPref === true) {
					let headerUserAgent = e.headers.find(
						(header) => header.name.toLowerCase() === "user-agent"
					);
					headerUserAgent
						? (headerUserAgent = headerUserAgent.value)
						: (headerUserAgent = navigator.userAgent);

					let headerCookie = e.headers.find(
						(header) => header.name.toLowerCase() === "cookie"
					);
					if (headerCookie)
						headerCookie = headerCookie.value.replace(
							new RegExp(`"`, "g"),
							`'`
						); // double quotation marks mess up the command

					let headerReferer = e.headers.find(
						(header) => header.name.toLowerCase() === "referer"
					);
					headerReferer = headerReferer
						? headerReferer.value
						: e.originUrl || e.documentUrl || (e.tabData && e.tabData.url);

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
							case "youtubedlc":
								code += ` --user-agent "${headerUserAgent}"`;
								break;
							case "hlsdl":
								code += ` -u "${headerUserAgent}"`;
								break;
							case "user":
								code = code.replace(
									new RegExp("%useragent%", "g"),
									headerUserAgent
								);
								break;
							default:
								break;
						}
					} else if (fileMethod === "user")
						code = code.replace(new RegExp("%useragent%", "g"), "");

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
							case "youtubedlc":
								code += ` --add-header "Cookie:${headerCookie}"`;
								break;
							case "hlsdl":
								code += ` -h "Cookie:${headerCookie}"`;
								break;
							case "user":
								code = code.replace(new RegExp("%cookie%", "g"), headerCookie);
								break;
							default:
								break;
						}
					} else if (fileMethod === "user")
						code = code.replace(new RegExp("%cookie%", "g"), "");

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
							case "youtubedlc":
								code += ` --referer "${headerReferer}"`;
								break;
							case "hlsdl":
								code += ` -h "Referer:${headerReferer}"`;
								break;
							case "user":
								code = code.replace(
									new RegExp("%referer%", "g"),
									headerReferer
								);
								break;
							default:
								break;
						}
					} else if (fileMethod === "user")
						code = code.replace(new RegExp("%referer%", "g"), "");

					if (
						fileMethod === "user" &&
						(e.documentUrl || e.originUrl || (e.tabData && e.tabData.url))
					)
						code = code.replace(
							new RegExp("%origin%", "g"),
							e.documentUrl || e.originUrl || (e.tabData && e.tabData.url)
						);
					else if (fileMethod === "user")
						code = code.replace(new RegExp("%origin%", "g"), "");

					if (fileMethod === "user" && e.tabData && e.tabData.title)
						code = code.replace(
							new RegExp("%tabtitle%", "g"),
							e.tabData.title.replace(/[/\\?%*:|"<>]/g, "_")
						);
					else if (fileMethod === "user")
						code = code.replace(new RegExp("%tabtitle%", "g"), "");
				}

				let outFilename;
				if (filenamePref && e.tabData && e.tabData.title)
					outFilename = e.tabData.title.replace(/[/\\?%*:|"<>]/g, "_");
				else {
					outFilename = filename;
					if (outFilename.indexOf(".")) {
						// filename without extension
						outFilename = outFilename.split(".");
						outFilename.pop();
						outFilename = outFilename.join(".");
					}
				}

				// final part of command
				switch (fileMethod) {
					case "ffmpeg":
						code += ` -i "${streamURL}" -c copy "${outFilename}.ts"`;
						break;
					case "streamlink":
						// streamlink output to file or player
						if (options.streamlinkOutput === "file")
							code += ` -o "${outFilename}.ts"`;
						code += ` "${streamURL}" best`;
						break;
					case "youtubedl":
						if (filenamePref && e.tabData && e.tabData.title)
							code += ` --output "${outFilename}.%(ext)s"`;
						code += ` "${streamURL}"`;
						break;
					case "youtubedlc":
						if (filenamePref && e.tabData && e.tabData.title)
							code += ` --output "${outFilename}.%(ext)s"`;
						code += ` "${streamURL}"`;
						break;
					case "hlsdl":
						code += ` -o "${outFilename}.ts" "${streamURL}"`;
						break;
					case "user":
						code = code.replace(new RegExp("%url%", "g"), streamURL);
						code = code.replace(new RegExp("%filename%", "g"), filename);
						break;
					default:
						break;
				}
			}

			// used to communicate with clipboard/notifications api
			list.urls.push(code);
			list.filenames.push(filename);
			list.methodIncomp = methodIncomp;
		}
		// old copying method for compatibility purposes
		const copyText = document.createElement("textarea");
		copyText.style.position = "absolute";
		copyText.style.left = "-5454px";
		copyText.style.top = "-5454px";
		document.body.appendChild(copyText);
		copyText.value = list.urls.join("\n");
		try {
			copyText.select();
			document.execCommand("copy");
			document.body.removeChild(copyText);
			if (options.notifPref !== true) {
				chrome.notifications.create("copy", {
					type: "basic",
					iconUrl: "img/icon-dark-96.png",
					title: _("notifCopiedTitle"),
					message:
						(list.methodIncomp === true
							? _("notifIncompCopiedText")
							: _("notifCopiedText")) + list.filenames.join("\n")
				});
			}
		} catch (e) {
			chrome.notifications.create("error", {
				type: "basic",
				iconUrl: "img/icon-dark-96.png",
				title: _("notifErrorTitle"),
				message: _("notifErrorText") + e
			});
		}
	});
};

const deleteURL = (requestDetails) => {
	const deleteUrlStorage = [requestDetails];
	chrome.runtime.sendMessage({
		delete: deleteUrlStorage,
		previous: document.getElementById("tabPrevious").checked
	}); // notify background script to update urlstorage. workaround
};

const getIdList = () =>
	Array.from(
		document.getElementById("popupUrlList").getElementsByTagName("tr")
	).map((tr) => tr.id);

const copyAll = () => {
	// this seems like a roundabout way of doing this but oh well
	const idList = getIdList();
	const copyUrlList = urlList.filter((url) => idList.includes(url.requestId));

	copyURL(copyUrlList);
};

const clearList = () => {
	const idList = getIdList();
	const deleteUrlStorage = urlList.filter((url) =>
		idList.includes(url.requestId)
	);

	chrome.runtime.sendMessage({
		delete: deleteUrlStorage,
		previous: document.getElementById("tabPrevious").checked
	});
};

const createList = () => {
	const insertList = (urls) => {
		document.getElementById("copyAll").disabled = false;
		document.getElementById("clearList").disabled = false;
		document.getElementById("filterInput").disabled = false;

		for (const requestDetails of urls) {
			// everyone's favorite - dom manipulation in vanilla js
			const row = document.createElement("tr");
			row.id = requestDetails.requestId;

			const extCell = document.createElement("td");
			extCell.textContent = requestDetails.type.toUpperCase();

			const urlCell = document.createElement("td");
			const urlHref = document.createElement("a");
			urlHref.textContent = requestDetails.filename;
			urlHref.href = requestDetails.url;
			urlCell.onclick = (e) => {
				e.preventDefault();
				copyURL([requestDetails]);
			};
			urlHref.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				copyURL([requestDetails]);
			};
			urlCell.style.cursor = "pointer";
			urlHref.style.whiteSpace = "nowrap";
			urlHref.title = requestDetails.url;
			urlCell.appendChild(urlHref);

			const sourceCell = document.createElement("td");
			sourceCell.textContent =
				titlePref &&
				requestDetails.tabData &&
				requestDetails.tabData.title &&
				// tabData.title falls back to url
				!requestDetails.url.includes(requestDetails.tabData.title)
					? requestDetails.tabData.title
					: requestDetails.hostname;
			sourceCell.title =
				requestDetails.documentUrl ||
				requestDetails.originUrl ||
				requestDetails.tabData.url;
			sourceCell.style.overflowWrap = "anywhere";

			const timestampCell = document.createElement("td");
			timestampCell.textContent =
				new Date(requestDetails.timestamp).toLocaleDateString() +
				" " +
				new Date(requestDetails.timestamp).toLocaleTimeString();

			const deleteCell = document.createElement("td");
			deleteCell.textContent = "✖";
			deleteCell.onclick = () => deleteURL(requestDetails);
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

			table.appendChild(row);
		}
	};

	const insertPlaceholder = () => {
		document.getElementById("copyAll").disabled = true;
		document.getElementById("clearList").disabled = true;
		if (document.getElementById("filterInput").value.length === 0)
			document.getElementById("filterInput").disabled = true;

		const row = document.createElement("tr");

		const placeholderCell = document.createElement("td");
		placeholderCell.colSpan = document.getElementsByTagName("th").length; // i would never remember to update this manually
		placeholderCell.textContent = "No URLs available.";

		row.appendChild(placeholderCell);

		table.appendChild(row);
	};

	chrome.storage.local.get((options) => {
		// clear list first just in case - quick and dirty
		table.innerHTML = "";

		if (
			(options.urlStorage && options.urlStorage.length > 0) ||
			(options.urlStorageRestore && options.urlStorageRestore.length > 0)
		) {
			const urlStorageFilter = document
				.getElementById("filterInput")
				.value.toLowerCase();

			// do the query first to avoid async issues
			chrome.tabs.query({ active: true, currentWindow: true }, (tab) => {
				if (document.getElementById("tabThis").checked === true) {
					urlList = options.urlStorage
						? options.urlStorage.filter((url) => url.tabId === tab[0].id)
						: [];
				} else if (document.getElementById("tabAll").checked === true) {
					urlList = options.urlStorage || [];
				} else if (document.getElementById("tabPrevious").checked === true) {
					urlList = options.urlStorageRestore || [];
				}

				if (urlStorageFilter)
					urlList =
						urlList &&
						urlList.filter(
							(url) =>
								url.filename.toLowerCase().includes(urlStorageFilter) ||
								(url.tabData &&
									url.tabData.title &&
									url.tabData.title.toLowerCase().includes(urlStorageFilter)) ||
								url.type.toLowerCase().includes(urlStorageFilter) ||
								url.hostname.toLowerCase().includes(urlStorageFilter)
						);

				urlList.length > 0
					? insertList(urlList.reverse()) // latest entries first
					: insertPlaceholder();
			});
		} else {
			insertPlaceholder();
		}
	});
};

const saveOption = (e) => {
	const options = document.getElementsByClassName("option");
	if (e.target.type === "checkbox") {
		chrome.storage.local.set({
			[e.target.id]: e.target.checked
		});
		chrome.runtime.sendMessage({ options: true });
	} else if (e.target.type === "radio") {
		// update entire radio group
		for (const option of options) {
			if (option.name === e.target.name) {
				chrome.storage.local.set({
					[option.id]: document.getElementById(option.id).checked
				});
			}
		}
		createList();
	} else {
		chrome.storage.local.set({
			[e.target.id]: e.target.value
		});
		chrome.runtime.sendMessage({ options: true });
	}
};

const restoreOptions = () => {
	// change badge text background when clicked
	chrome.browserAction.setBadgeBackgroundColor({ color: "silver" });

	const options = document.getElementsByClassName("option");
	// should probably consolidate this with the other one at some point
	chrome.storage.local.get((item) => {
		// eslint-disable-next-line prefer-destructuring
		titlePref = item.titlePref;
		filenamePref = item.filenamePref;

		for (const option of options) {
			if (defaultOptions[option.id]) {
				if (item[option.id] !== undefined) {
					document.getElementById(option.id).checked = item[option.id];
				} else {
					document.getElementById(option.id).checked =
						defaultOptions[option.id];
					chrome.storage.local.set({
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
		for (const option of options) {
			option.onchange = (e) => saveOption(e);
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

		// button and text input functionality
		document.getElementById("copyAll").onclick = (e) => {
			e.preventDefault();
			copyAll();
		};
		document.getElementById("clearList").onclick = (e) => {
			e.preventDefault();
			clearList();
		};
		document.getElementById("openOptions").onclick = (e) => {
			e.preventDefault();
			chrome.runtime.openOptionsPage();
		};
		document.getElementById("filterInput").onkeyup = () => createList();

		createList();
	});
};

document.addEventListener("DOMContentLoaded", () => {
	restoreOptions();

	chrome.runtime.onMessage.addListener((message) => {
		if (message.urlStorage) createList();
	});
});
