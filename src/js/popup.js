"use strict";

import "../css/popup.css";
import { saveOptionStorage, getStorage } from "./components/storage.js";

const _ = chrome.i18n.getMessage; // i18n

const table = document.getElementById("popupUrlList");

let titlePref;
let filenamePref;
let timestampPref;
let downloadDirectPref;
let newline;
let urlList = [];

const getTimestamp = (timestamp) => {
	const date = new Date(timestamp);
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

const downloadURL = (file) => {
	// only firefox supports replacing the referer header
	const dlOptions = chrome.runtime.getURL("").startsWith("chrome-extension://")
		? {
				url: file.url
		  }
		: {
				headers:
					file.headers?.filter((h) => h.name.toLowerCase() === "referer") || [],
				incognito: file.tabData?.incognito || false,
				url: file.url
		  };

	chrome.downloads.download(
		dlOptions,
		(err) =>
			// returns undefined if download is not successful
			err === undefined &&
			chrome.notifications.create("error", {
				type: "basic",
				iconUrl: "img/icon-dark-96.png",
				title: _("notifDownErrorTitle"),
				message: _("notifDownErrorText") + file.filename
			})
	);
};

const copyURL = async (info) => {
	const list = { urls: [], filenames: [], methodIncomp: false };
	for (const e of info) {
		let code;
		let methodIncomp;
		let fileMethod;

		const streamURL = e.url;
		const { filename, type, category } = e;
		fileMethod = (await getStorage("copyMethod")) || "url"; // default to url - just in case

		if (
			(type === "HDS" && fileMethod === "ffmpeg") ||
			(type === "MSS" &&
				fileMethod !== "youtubedl" &&
				fileMethod !== "ytdlp" &&
				fileMethod !== "user") ||
			(category === "subtitles" &&
				fileMethod !== "url" &&
				fileMethod !== "user") ||
			(type !== "HLS" && fileMethod === "hlsdl") ||
			(type !== "HLS" && fileMethod === "nm3u8dl") ||
			(type === "CUSTOM" && fileMethod !== "url" && fileMethod !== "user")
		) {
			fileMethod = "url";
			methodIncomp = true;
		}

		// don't use user-defined command if empty
		if (fileMethod === "user" && (await getStorage("userCommand")) === null) {
			fileMethod = "url";
			methodIncomp = true;
		}

		if (fileMethod === "url") {
			code = streamURL;
		} else if (fileMethod === "tableForm") {
			code = `${streamURL} | ${
				titlePref && e.tabData?.title && !streamURL.includes(e.tabData.title)
					? e.tabData.title
					: e.hostname
			} | ${getTimestamp(e.timeStamp)}`;
		} else {
			// the switchboard of doom begins
			switch (fileMethod) {
				case "kodiUrl":
					code = streamURL;
					break;
				case "ffmpeg":
					code = "ffmpeg";
					break;
				case "streamlink":
					code = "streamlink";
					break;
				case "youtubedl":
					code = "youtube-dl --no-part --restrict-filenames";
					// use external downloader
					if (
						(await getStorage("downloaderPref")) &&
						(await getStorage("downloaderCommand"))
					)
						code += ` --external-downloader "${await getStorage(
							"downloaderCommand"
						)}"`;
					break;
				// this could be implemented better - maybe someday
				case "ytdlp":
					code = "yt-dlp --no-part --restrict-filenames";
					if (
						(await getStorage("downloaderPref")) &&
						(await getStorage("downloaderCommand"))
					)
						code += ` --external-downloader "${await getStorage(
							"downloaderCommand"
						)}"`;
					break;
				case "hlsdl":
					code = "hlsdl -b -c";
					break;
				case "nm3u8dl":
					code = `N_m3u8DL-CLI "${streamURL}" --enableMuxFastStart --enableDelAfterDone`;
					break;
				case "user":
					code = await getStorage("userCommand");
					break;
				default:
					break;
			}

			// custom command line
			const prefName = `customCommand${fileMethod}`;
			if (
				(await getStorage("customCommandPref")) &&
				(await getStorage(prefName))
			) {
				code += ` ${await getStorage(prefName)}`;
			}

			// http proxy
			if (
				(await getStorage("proxyPref")) &&
				(await getStorage("proxyCommand"))
			) {
				switch (fileMethod) {
					case "ffmpeg":
						code += ` -http_proxy "${await getStorage("proxyCommand")}"`;
						break;
					case "streamlink":
						code += ` --http-proxy "${await getStorage("proxyCommand")}"`;
						break;
					case "youtubedl":
						code += ` --proxy "${await getStorage("proxyCommand")}"`;
						break;
					case "ytdlp":
						code += ` --proxy "${await getStorage("proxyCommand")}"`;
						break;
					case "hlsdl":
						code += ` -p "${await getStorage("proxyCommand")}"`;
						break;
					case "nm3u8dl":
						code += ` --proxyAddress "${await getStorage("proxyCommand")}"`;
						break;
					case "user":
						code = code.replace(
							new RegExp("%proxy%", "g"),
							await getStorage("proxyCommand")
						);
						break;
					default:
						break;
				}
			}

			// additional headers
			if (await getStorage("headersPref")) {
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
					headerCookie = headerCookie.value.replace(new RegExp(`"`, "g"), `'`); // double quotation marks mess up the command

				let headerReferer = e.headers.find(
					(header) => header.name.toLowerCase() === "referer"
				);
				headerReferer = headerReferer
					? headerReferer.value
					: e.originUrl || e.documentUrl || e.initiator || e.tabData?.url;
				if (
					headerReferer?.startsWith("about:") ||
					headerReferer?.startsWith("chrome:")
				)
					headerReferer = undefined;

				if (headerUserAgent) {
					switch (fileMethod) {
						case "kodiUrl":
							code += `|User-Agent=${encodeURIComponent(headerUserAgent)}`;
							break;
						case "ffmpeg":
							code += ` -user_agent "${headerUserAgent}"`;
							break;
						case "streamlink":
							code += ` --http-header "User-Agent=${headerUserAgent}"`;
							break;
						case "youtubedl":
							code += ` --user-agent "${headerUserAgent}"`;
							break;
						case "ytdlp":
							code += ` --user-agent "${headerUserAgent}"`;
							break;
						case "hlsdl":
							code += ` -u "${headerUserAgent}"`;
							break;
						case "nm3u8dl":
							code += ` --header "User-Agent:${encodeURIComponent(
								headerUserAgent
							)}`;
							if (!headerCookie && !headerReferer) code += `"`;
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

				if (headerCookie) {
					switch (fileMethod) {
						case "kodiUrl":
							if (headerUserAgent) code += "&";
							else code += "|";
							code += `Cookie=${encodeURIComponent(headerCookie)}`;
							break;
						case "ffmpeg":
							code += ` -headers "Cookie: ${headerCookie}"`;
							break;
						case "streamlink":
							code += ` --http-header "Cookie=${headerCookie}"`;
							break;
						case "youtubedl":
							code += ` --add-header "Cookie:${headerCookie}"`;
							break;
						case "ytdlp":
							code += ` --add-header "Cookie:${headerCookie}"`;
							break;
						case "hlsdl":
							code += ` -h "Cookie:${headerCookie}"`;
							break;
						case "nm3u8dl":
							if (!headerUserAgent) code += ` --header "`;
							else code += `|`;
							code += `Cookie:${encodeURIComponent(headerCookie)}`;
							if (!headerReferer) code += `"`;
							break;
						case "user":
							code = code.replace(new RegExp("%cookie%", "g"), headerCookie);
							break;
						default:
							break;
					}
				} else if (fileMethod === "user")
					code = code.replace(new RegExp("%cookie%", "g"), "");

				if (headerReferer) {
					switch (fileMethod) {
						case "kodiUrl":
							if (headerUserAgent || headerCookie) code += "&";
							else code += "|";
							code += `Referer=${encodeURIComponent(headerReferer)}`;
							break;
						case "ffmpeg":
							code += ` -referer "${headerReferer}"`;
							break;
						case "streamlink":
							code += ` --http-header "Referer=${headerReferer}"`;
							break;
						case "youtubedl":
							code += ` --referer "${headerReferer}"`;
							break;
						case "ytdlp":
							code += ` --referer "${headerReferer}"`;
							break;
						case "hlsdl":
							code += ` -h "Referer:${headerReferer}"`;
							break;
						case "nm3u8dl":
							if (!headerUserAgent && !headerCookie) code += ` --header "`;
							else code += `|`;
							code += `Referer:${encodeURIComponent(headerReferer)}"`;
							break;
						case "user":
							code = code.replace(new RegExp("%referer%", "g"), headerReferer);
							break;
						default:
							break;
					}
				} else if (fileMethod === "user")
					code = code.replace(new RegExp("%referer%", "g"), "");

				if (
					fileMethod === "user" &&
					(e.documentUrl || e.originUrl || e.initiator || e.tabData?.url)
				)
					code = code.replace(
						new RegExp("%origin%", "g"),
						e.documentUrl || e.originUrl || e.initiator || e.tabData?.url
					);
				else if (fileMethod === "user")
					code = code.replace(new RegExp("%origin%", "g"), "");

				if (fileMethod === "user" && e.tabData?.title)
					code = code.replace(
						new RegExp("%tabtitle%", "g"),
						e.tabData.title.replace(/[/\\?%*:|"<>]/g, "_")
					);
				else if (fileMethod === "user")
					code = code.replace(new RegExp("%tabtitle%", "g"), "");
			}

			let outFilename;
			if (filenamePref && e.tabData?.title) outFilename = e.tabData.title;
			else {
				outFilename = filename;
				if (outFilename.indexOf(".")) {
					// filename without extension
					outFilename = outFilename.split(".");
					outFilename.pop();
					outFilename = outFilename.join(".");
				}
			}

			// sanitize tab title and timestamp
			outFilename = outFilename.replace(/[/\\?%*:|"<>]/g, "_");
			const outExtension = (await getStorage("fileExtension")) || "ts";
			const outTimestamp = getTimestamp(e.timeStamp).replace(
				/[/\\?%*:|"<>]/g,
				"_"
			);

			// final part of command
			switch (fileMethod) {
				case "ffmpeg":
					code += ` -i "${streamURL}" -c copy "${outFilename}`;
					if (timestampPref) code += ` ${outTimestamp}`;
					code += `.${outExtension}"`;
					break;
				case "streamlink":
					if ((await getStorage("streamlinkOutput")) === "file") {
						code += ` -o "${outFilename}`;
						if (timestampPref) code += ` ${outTimestamp}`;
						code += `.${outExtension}"`;
					}
					code += ` "${streamURL}" best`;
					break;
				case "youtubedl":
					if ((filenamePref && e.tabData?.title) || timestampPref) {
						code += ` --output "${outFilename}`;
						if (timestampPref) code += ` %(epoch)s`;
						code += `.%(ext)s"`;
					}
					code += ` "${streamURL}"`;
					break;
				case "ytdlp":
					if ((filenamePref && e.tabData?.title) || timestampPref) {
						code += ` --output "${outFilename}`;
						if (timestampPref) code += ` %(epoch)s`;
						code += `.%(ext)s"`;
					}
					code += ` "${streamURL}"`;
					break;
				case "hlsdl":
					code += ` -o "${outFilename}`;
					if (timestampPref) code += ` ${outTimestamp}`;
					code += `.${outExtension}" "${streamURL}"`;
					break;
				case "nm3u8dl":
					code += ` --saveName "${outFilename}`;
					if (timestampPref) code += ` ${outTimestamp}`;
					code += `"`;
					break;
				case "user":
					code = code.replace(new RegExp("%url%", "g"), streamURL);
					code = code.replace(new RegExp("%filename%", "g"), filename);
					code = code.replace(new RegExp("%timestamp%", "g"), outTimestamp);
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

	try {
		if (navigator.clipboard?.writeText)
			navigator.clipboard.writeText(list.urls.join(newline));
		else {
			// old copying method for compatibility purposes
			const copyText = document.createElement("textarea");
			copyText.style.position = "absolute";
			copyText.style.left = "-5454px";
			copyText.style.top = "-5454px";
			document.body.appendChild(copyText);
			copyText.value = list.urls.join(newline);
			copyText.select();
			document.execCommand("copy");
			document.body.removeChild(copyText);
		}
		if ((await getStorage("notifPref")) === false) {
			chrome.notifications.create("copy", {
				type: "basic",
				iconUrl: "img/icon-dark-96.png",
				title: _("notifCopiedTitle"),
				message:
					(list.methodIncomp
						? _("notifIncompCopiedText")
						: _("notifCopiedText")) + list.filenames.join(newline)
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
};

const handleURL = (url) => {
	if (downloadDirectPref && url.category === "files") downloadURL(url);
	else copyURL([url]);
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

const createList = async () => {
	const insertList = (urls) => {
		document.getElementById("copyAll").disabled = false;
		document.getElementById("clearList").disabled = false;
		document.getElementById("filterInput").disabled = false;
		document.getElementById("headers").style.display = "";

		for (const requestDetails of urls) {
			// everyone's favorite - dom manipulation in vanilla js
			const row = document.createElement("tr");
			row.id = requestDetails.requestId;
			row.className = "urlEntry";

			const extCell = document.createElement("td");
			extCell.textContent =
				requestDetails.category === "files" && downloadDirectPref
					? "🔽 " + requestDetails.type.toUpperCase()
					: requestDetails.type.toUpperCase();

			const urlCell = document.createElement("td");
			const urlHref = document.createElement("a");
			urlHref.textContent = requestDetails.filename;
			urlHref.href = requestDetails.url;
			urlCell.onclick = (e) => {
				e.preventDefault();
				handleURL(requestDetails);
			};
			urlHref.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				handleURL(requestDetails);
			};
			urlCell.style.cursor = "pointer";
			urlHref.title = requestDetails.url;
			urlCell.appendChild(urlHref);

			const sourceCell = document.createElement("td");
			sourceCell.textContent =
				titlePref &&
				requestDetails.tabData?.title &&
				// tabData.title falls back to url
				!requestDetails.url.includes(requestDetails.tabData.title)
					? requestDetails.tabData.title
					: requestDetails.hostname;
			sourceCell.title =
				requestDetails.documentUrl ||
				requestDetails.originUrl ||
				requestDetails.initiator ||
				requestDetails.tabData.url;

			const timestampCell = document.createElement("td");
			timestampCell.textContent = getTimestamp(requestDetails.timeStamp);

			const deleteCell = document.createElement("td");
			const deleteX = document.createElement("a");
			deleteX.textContent = "✖";
			deleteX.href = "";
			deleteX.style.textDecoration = "none";
			deleteX.onclick = (e) => {
				e.preventDefault();
				e.stopPropagation();
				deleteURL(requestDetails);
			};
			deleteCell.onclick = (e) => {
				e.preventDefault();
				deleteURL(requestDetails);
			};
			deleteX.onfocus = () => (urlCell.style.textDecoration = "line-through");
			deleteX.onblur = () => (urlCell.style.textDecoration = "initial");
			deleteCell.onmouseover = () =>
				(urlCell.style.textDecoration = "line-through");
			deleteCell.onmouseout = () => (urlCell.style.textDecoration = "initial");
			deleteCell.style.cursor = "pointer";
			deleteCell.title = _("deleteTooltip");
			deleteCell.appendChild(deleteX);

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
		if (!document.getElementById("filterInput").value)
			document.getElementById("filterInput").disabled = true;
		document.getElementById("headers").style.display = "none";

		const row = document.createElement("tr");

		const placeholderCell = document.createElement("td");
		placeholderCell.colSpan = document.getElementsByTagName("th").length; // i would never remember to update this manually
		placeholderCell.textContent = _("placeholderCell");

		row.appendChild(placeholderCell);

		table.appendChild(row);
	};

	const urlStorage = await getStorage("urlStorage");
	const urlStorageRestore = await getStorage("urlStorageRestore");

	if (urlStorage.length > 0 || urlStorageRestore.length > 0) {
		const urlStorageFilter = document
			.getElementById("filterInput")
			.value.toLowerCase();

		// do the query first to avoid async issues
		chrome.tabs.query({ active: true, currentWindow: true }, (tab) => {
			if (document.getElementById("tabThis").checked) {
				urlList = urlStorage
					? urlStorage.filter((url) => url.tabId === tab[0].id)
					: [];
			} else if (document.getElementById("tabAll").checked) {
				urlList = urlStorage
					? urlStorage.filter(
							(url) => url.tabData?.incognito === tab[0].incognito
					  )
					: [];
			} else if (document.getElementById("tabPrevious").checked) {
				urlList = urlStorageRestore || [];
			}

			if (urlStorageFilter)
				urlList =
					urlList &&
					urlList.filter(
						(url) =>
							url.filename.toLowerCase().includes(urlStorageFilter) ||
							url.tabData?.title?.toLowerCase().includes(urlStorageFilter) ||
							url.type.toLowerCase().includes(urlStorageFilter) ||
							url.hostname.toLowerCase().includes(urlStorageFilter)
					);

			// clear list first just in case - quick and dirty
			table.innerHTML = "";

			urlList.length
				? insertList(urlList.reverse()) // latest entries first
				: insertPlaceholder();
		});
	} else {
		table.innerHTML = "";
		insertPlaceholder();
	}
};

const saveOption = (e) => {
	if (e.target.type === "radio") createList();
	const options = document.getElementsByClassName("option");
	saveOptionStorage(e, options);
};

document.addEventListener("DOMContentLoaded", async () => {
	// change badge text background when clicked
	chrome.browserAction.setBadgeBackgroundColor({ color: "silver" });

	titlePref = await getStorage("titlePref");
	filenamePref = await getStorage("filenamePref");
	timestampPref = await getStorage("timestampPref");
	downloadDirectPref = await getStorage("downloadDirectPref");
	newline = await getStorage("newline");

	const options = document.getElementsByClassName("option");
	for (const option of options) {
		option.onchange = (e) => saveOption(e);
		if ((await getStorage(option.id)) !== null) {
			if (
				document.getElementById(option.id).type === "checkbox" ||
				document.getElementById(option.id).type === "radio"
			)
				document.getElementById(option.id).checked = await getStorage(
					option.id
				);
			else
				document.getElementById(option.id).value = await getStorage(option.id);
		}
	}

	// i18n
	const labels = document.getElementsByTagName("label");
	for (const label of labels) {
		label.textContent = _(label.htmlFor);
	}
	const selectOptions = document.getElementsByTagName("option");
	for (const selectOption of selectOptions) {
		if (!selectOption.textContent)
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

	document.getElementById("filterInput").onkeyup = () => {
		createList();
		if (!document.getElementById("filterInput").value) {
			document.getElementById("clearFilterInput").disabled = true;
			document.getElementById("clearFilterInput").style.cursor = "default";
		} else {
			document.getElementById("clearFilterInput").disabled = false;
			document.getElementById("clearFilterInput").style.cursor = "pointer";
		}
	};

	if (!document.getElementById("filterInput").value) {
		document.getElementById("clearFilterInput").disabled = true;
		document.getElementById("clearFilterInput").style.cursor = "default";
	} else {
		document.getElementById("clearFilterInput").disabled = false;
		document.getElementById("clearFilterInput").style.cursor = "pointer";
	}

	document.getElementById("clearFilterInput").onclick = () => {
		document.getElementById("filterInput").value = "";
		createList();
		document.getElementById("clearFilterInput").style.cursor = "default";
	};

	createList();

	chrome.runtime.onMessage.addListener((message) => {
		if (message.urlStorage) createList();
	});
});
