"use strict";

import {
	saveOptionStorage,
	getStorage,
	setStorage
} from "./components/storage.js";

import notifIcon from "../img/icon-dark-96.png";

const _ = chrome.i18n.getMessage; // i18n

const table = document.getElementById("popupUrlList");

let titlePref;
let filenamePref;
let timestampPref;
let downloadDirectPref;
let newline;
let recentPref;
let recentAmount;
let noRestorePref;
let urlList = [];

const getTimestamp = (timestamp) => {
	const date = new Date(timestamp);
	return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
};

// https://stackoverflow.com/a/18650828
const formatBytes = (bytes) => {
	const sizes = ["B", "KB", "MB", "GB", "TB"];

	const i = Math.floor(Math.log(bytes) / Math.log(1024));

	return parseFloat((bytes / 1024 ** i).toFixed(2)) + " " + sizes[i];
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
				iconUrl: notifIcon,
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
		const { filename } = e;
		fileMethod = (await getStorage("copyMethod")) || "url"; // default to url - just in case

		// don't use user-defined command if empty
		if (
			fileMethod.startsWith("user") &&
			(await getStorage("userCommand" + fileMethod.at(-1))) === null
		) {
			fileMethod = "url";
			methodIncomp = true;
		}

		if (fileMethod === "url") code = streamURL;
		else if (fileMethod === "tableForm")
			code = `${streamURL} | ${
				titlePref && e.tabData?.title && !streamURL.includes(e.tabData.title)
					? e.tabData.title
					: e.hostname
			} | ${getTimestamp(e.timeStamp)}`;
		else if (fileMethod === "kodiUrl") code = streamURL;
		else if (fileMethod === "ffmpeg") code = "ffmpeg";
		else if (fileMethod === "streamlink") code = "streamlink";
		else if (fileMethod === "ytdlp") {
			code = "yt-dlp --no-part --restrict-filenames";

			if (
				(await getStorage("multithreadPref")) &&
				(await getStorage("multithreadAmount"))
			)
				code += ` -N ${await getStorage("multithreadAmount")}`;

			if (
				(await getStorage("downloaderPref")) &&
				(await getStorage("downloaderCommand"))
			)
				code += ` --downloader "${await getStorage("downloaderCommand")}"`;
		} else if (fileMethod === "hlsdl") code = "hlsdl -b -c";
		else if (fileMethod === "nm3u8dl") code = `N_m3u8DL-RE "${streamURL}"`;
		else if (fileMethod.startsWith("user"))
			code = await getStorage("userCommand" + fileMethod.at(-1));

		// custom command line
		const prefName = `customCommand${fileMethod}`;
		if ((await getStorage("customCommandPref")) && (await getStorage(prefName)))
			code += ` ${await getStorage(prefName)}`;

		// http proxy
		if ((await getStorage("proxyPref")) && (await getStorage("proxyCommand"))) {
			if (fileMethod === "ffmpeg")
				code += ` -http_proxy "${await getStorage("proxyCommand")}"`;
			else if (fileMethod === "streamlink")
				code += ` --http-proxy "${await getStorage("proxyCommand")}"`;
			else if (fileMethod === "ytdlp")
				code += ` --proxy "${await getStorage("proxyCommand")}"`;
			else if (fileMethod === "hlsdl")
				code += ` -p "${await getStorage("proxyCommand")}"`;
			else if (fileMethod === "nm3u8dl")
				code += ` --custom-proxy "${await getStorage("proxyCommand")}"`;
			else if (fileMethod.startsWith("user"))
				code = code.replace(
					new RegExp("%proxy%", "g"),
					await getStorage("proxyCommand")
				);
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
				(header) =>
					header.name.toLowerCase() === "cookie" ||
					header.name.toLowerCase() === "set-cookie"
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
				if (fileMethod === "kodiUrl")
					code += `|User-Agent=${encodeURIComponent(headerUserAgent)}`;
				else if (fileMethod === "ffmpeg")
					code += ` -user_agent "${headerUserAgent}"`;
				else if (fileMethod === "streamlink")
					code += ` --http-header "User-Agent=${headerUserAgent}"`;
				else if (fileMethod === "ytdlp")
					code += ` --user-agent "${headerUserAgent}"`;
				else if (fileMethod === "hlsdl") code += ` -u "${headerUserAgent}"`;
				else if (fileMethod === "nm3u8dl")
					code += ` --header "User-Agent: ${headerUserAgent}"`;
				else if (fileMethod.startsWith("user"))
					code = code.replace(new RegExp("%useragent%", "g"), headerUserAgent);
			} else if (fileMethod.startsWith("user"))
				code = code.replace(new RegExp("%useragent%", "g"), "");

			if (headerCookie) {
				if (fileMethod === "kodiUrl") {
					if (headerUserAgent) code += "&";
					else code += "|";
					code += `Cookie=${encodeURIComponent(headerCookie)}`;
				} else if (fileMethod === "ffmpeg")
					code += ` -headers "Cookie: ${headerCookie}"`;
				else if (fileMethod === "streamlink")
					code += ` --http-header "Cookie=${headerCookie}"`;
				else if (fileMethod === "ytdlp")
					code += ` --add-header "Cookie:${headerCookie}"`;
				else if (fileMethod === "hlsdl") code += ` -h "Cookie:${headerCookie}"`;
				else if (fileMethod === "nm3u8dl")
					code += ` --header "Cookie: ${headerCookie}"`;
				else if (fileMethod.startsWith("user"))
					code = code.replace(new RegExp("%cookie%", "g"), headerCookie);
			} else if (fileMethod.startsWith("user"))
				code = code.replace(new RegExp("%cookie%", "g"), "");

			if (headerReferer) {
				if (fileMethod === "kodiUrl") {
					if (headerUserAgent || headerCookie) code += "&";
					else code += "|";
					code += `Referer=${encodeURIComponent(headerReferer)}`;
				} else if (fileMethod === "ffmpeg")
					code += ` -referer "${headerReferer}"`;
				else if (fileMethod === "streamlink")
					code += ` --http-header "Referer=${headerReferer}"`;
				else if (fileMethod === "ytdlp")
					code += ` --referer "${headerReferer}"`;
				else if (fileMethod === "hlsdl")
					code += ` -h "Referer:${headerReferer}"`;
				else if (fileMethod === "nm3u8dl")
					code += ` --header "Referer: ${headerReferer}"`;
				else if (fileMethod.startsWith("user"))
					code = code.replace(new RegExp("%referer%", "g"), headerReferer);
			} else if (fileMethod.startsWith("user"))
				code = code.replace(new RegExp("%referer%", "g"), "");
		}

		if (
			fileMethod.startsWith("user") &&
			(e.documentUrl || e.originUrl || e.initiator || e.tabData?.url)
		)
			code = code.replace(
				new RegExp("%origin%", "g"),
				e.documentUrl || e.originUrl || e.initiator || e.tabData?.url
			);
		else if (fileMethod.startsWith("user"))
			code = code.replace(new RegExp("%origin%", "g"), "");

		if (fileMethod.startsWith("user") && e.tabData?.title)
			code = code.replace(
				new RegExp("%tabtitle%", "g"),
				e.tabData.title.replace(/[/\\?%*:|"<>]/g, "_")
			);
		else if (fileMethod.startsWith("user"))
			code = code.replace(new RegExp("%tabtitle%", "g"), "");

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
		if (fileMethod === "ffmpeg") {
			code += ` -i "${streamURL}" -c copy "${outFilename}`;
			if (timestampPref) code += ` ${outTimestamp}`;
			code += `.${outExtension}"`;
		} else if (fileMethod === "streamlink") {
			if ((await getStorage("streamlinkOutput")) === "file") {
				code += ` -o "${outFilename}`;
				if (timestampPref) code += ` ${outTimestamp}`;
				code += `.${outExtension}"`;
			}
			code += ` "${streamURL}" best`;
		} else if (fileMethod === "ytdlp") {
			if ((filenamePref && e.tabData?.title) || timestampPref) {
				code += ` --output "${outFilename}`;
				if (timestampPref) code += ` %(epoch)s`;
				code += `.%(ext)s"`;
			}
			code += ` "${streamURL}"`;
		} else if (fileMethod === "hlsdl") {
			code += ` -o "${outFilename}`;
			if (timestampPref) code += ` ${outTimestamp}`;
			code += `.${outExtension}" "${streamURL}"`;
		} else if (fileMethod === "nm3u8dl") {
			code += ` --save-name "${outFilename}`;
			if (timestampPref) code += ` ${outTimestamp}`;
			code += `"`;
		} else if (fileMethod.startsWith("user")) {
			code = code.replace(new RegExp("%url%", "g"), streamURL);
			code = code.replace(new RegExp("%filename%", "g"), filename);
			code = code.replace(new RegExp("%timestamp%", "g"), outTimestamp);
		}

		// regex for user command
		if (
			fileMethod.startsWith("user") &&
			(await getStorage("regexCommandPref"))
		) {
			const regexCommand = await getStorage("regexCommand");
			const regexReplace = await getStorage("regexReplace");

			code = code.replace(new RegExp(regexCommand, "g"), regexReplace || "");
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
				iconUrl: notifIcon,
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
			iconUrl: notifIcon,
			title: _("notifErrorTitle"),
			message: _("notifErrorText") + e
		});
	}
};

const handleURL = (url) => {
	if (
		downloadDirectPref &&
		(url.category === "files" || url.category === "custom")
	)
		downloadURL(url);
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

			if (document.body.id === "popup") {
				const extCell = document.createElement("td");
				extCell.textContent =
					(requestDetails.category === "files" ||
						requestDetails.category === "custom") &&
					downloadDirectPref
						? "🔽 " + requestDetails.type.toUpperCase()
						: requestDetails.type.toUpperCase();
				row.appendChild(extCell);
			}

			const urlCell = document.createElement("td");
			urlCell.className = "urlCell";
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
			urlHref.title = requestDetails.url;
			urlCell.appendChild(urlHref);
			row.appendChild(urlCell);

			if (document.body.id === "popup") {
				const sizeCell = document.createElement("td");
				const sizeCellHeader = requestDetails.headers.find(
					(header) => header.name.toLowerCase() === "content-length"
				);
				if (
					(requestDetails.category === "files" ||
						requestDetails.category === "custom") &&
					sizeCellHeader &&
					Number(sizeCellHeader.value) !== 0
				) {
					sizeCell.textContent = formatBytes(sizeCellHeader.value);
					sizeCell.title = sizeCellHeader.value;
				} else sizeCell.textContent = "-";
				row.appendChild(sizeCell);

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
				row.appendChild(sourceCell);

				const timestampCell = document.createElement("td");
				timestampCell.textContent = getTimestamp(requestDetails.timeStamp);
				row.appendChild(timestampCell);
			}

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

	if (urlStorage.length || urlStorageRestore.length) {
		if (recentPref && urlList.length > recentAmount)
			urlList.length = recentAmount;

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

			urlList = urlList.length && urlList.reverse(); // latest entries first

			if (urlStorageFilter)
				urlList =
					urlList.length &&
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
				? insertList(urlList) // latest entries first
				: insertPlaceholder();
		});
	} else {
		table.innerHTML = "";
		insertPlaceholder();
	}
};

const saveOption = (e) => {
	if (e.target.type === "radio") createList();
	saveOptionStorage(e, document.getElementsByClassName("option"));
};

const restoreOptions = async () => {
	titlePref = await getStorage("titlePref");
	filenamePref = await getStorage("filenamePref");
	timestampPref = await getStorage("timestampPref");
	downloadDirectPref = await getStorage("downloadDirectPref");
	newline = await getStorage("newline");
	recentPref = await getStorage("recentPref");
	recentAmount = await getStorage("recentAmount");
	noRestorePref = await getStorage("noRestorePref");

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
};

document.addEventListener("DOMContentLoaded", async () => {
	// reset badge when clicked
	if (document.body.id === "popup") {
		chrome.browserAction.setBadgeBackgroundColor({ color: "silver" });
		chrome.browserAction.setBadgeText({ text: "" });
		// workaround to detect popup close
		chrome.runtime.connect({ name: "popup" });
	}

	await restoreOptions();

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
		setStorage({ filterInput: "" });
		createList();
		document.getElementById("clearFilterInput").style.cursor = "default";
	};

	if (noRestorePref) {
		if (document.getElementById("tabPrevious").checked)
			document.getElementById("tabAll").checked = true;
		document.getElementById("tabPrevious").parentElement.style.display = "none";
	}
	createList();

	chrome.runtime.onMessage.addListener((message) => {
		if (message.urlStorage) createList();
		if (document.body.id === "sidebar" && message.options) restoreOptions();
	});
});
