"use strict";

const supported = [
	{
		ext: ["m3u8"],
		ct: ["application/x-mpegurl", "application/vnd.apple.mpegurl"],
		type: "HLS",
		category: "stream"
	},
	{
		ext: ["mpd", "json?base64_init=1"],
		ct: ["application/dash+xml"],
		type: "DASH",
		category: "stream"
	},
	{ ext: ["f4m"], ct: ["application/f4m"], type: "HDS", category: "stream" },
	{ ext: ["ism/manifest"], ct: [], type: "MSS", category: "stream" },
	{ ext: ["vtt"], ct: ["text/vtt"], type: "VTT", category: "subtitles" },
	{
		ext: ["srt"],
		ct: ["application/x-subrip"],
		type: "SRT",
		category: "subtitles"
	},
	{
		ext: ["ttml", "ttml2"],
		ct: ["application/ttml+xml"],
		type: "TTML",
		category: "subtitles"
	},
	{
		ext: ["dfxp"],
		ct: ["application/ttaf+xml"],
		type: "DFXP",
		category: "subtitles"
	},
	{
		ext: ["mp4", "m4v"],
		ct: ["video/x-m4v", "video/m4v", "video/mp4"],
		type: "MP4",
		category: "files"
	},
	{ ext: ["m4a"], ct: ["audio/m4a"], type: "M4A", category: "files" },
	{ ext: ["ts"], ct: ["video/mp2t"], type: "TS", category: "files" },
	{ ext: ["aac"], ct: ["audio/aac"], type: "AAC", category: "files" },
	{ ext: ["mp3"], ct: ["audio/mpeg"], type: "MP3", category: "files" },
	{ ext: ["opus"], ct: ["audio/opus"], type: "OPUS", category: "files" },
	{ ext: ["weba"], ct: ["audio/webm"], type: "WEBM", category: "files" },
	{ ext: ["webm"], ct: ["video/webm"], type: "WEBM", category: "files" }
];

const defaults = {
	disablePref: false,
	copyMethod: "url",
	headersPref: true,
	titlePref: true,
	filenamePref: false,
	timestampPref: false,
	subtitlePref: false,
	filePref: false,
	fileExtension: "ts",
	streamlinkOutput: "file",
	downloaderPref: false,
	proxyPref: false,
	customCommandPref: false,
	blacklistPref: false,
	blacklistEntries: [],
	cleanupPref: false,
	notifDetectPref: true,
	notifPref: false,
	urlStorageRestore: [],
	urlStorage: []
};

const _ = chrome.i18n.getMessage;

let urlStorage = [];
let urlStorageRestore = [];
let badgeText = 0;
let queue = [];

let subtitlePref;
let filePref;
let blacklistPref;
let blacklistEntries;
let cleanupPref;
let disablePref;

const updateVars = () => {
	subtitlePref = JSON.parse(localStorage.getItem("subtitlePref"));
	filePref = JSON.parse(localStorage.getItem("filePref"));
	blacklistPref = JSON.parse(localStorage.getItem("blacklistPref"));
	blacklistEntries = JSON.parse(localStorage.getItem("blacklistEntries"));
	cleanupPref = JSON.parse(localStorage.getItem("cleanupPref"));
	disablePref = JSON.parse(localStorage.getItem("disablePref"));
};

const urlFilter = (requestDetails) => {
	let e;

	if (requestDetails.requestHeaders) {
		const url = new URL(requestDetails.url).pathname.toLowerCase();
		// go through the extensions and see if the url contains any
		e = supported.find((f) => f.ext.some((fe) => url.includes("." + fe)));
	} else if (requestDetails.responseHeaders) {
		const header = requestDetails.responseHeaders.find(
			(h) => h.name.toLowerCase() === "content-type"
		);
		if (header)
			// go through content types and see if the header matches
			e = supported.find((f) => f.ct.includes(header.value.toLowerCase()));
	}

	if (
		e &&
		!urlStorage.find((u) => u.url === requestDetails.url) && // urlStorage because promises are too slow sometimes
		!queue.includes(requestDetails.requestId) && // queue in case urlStorage is also too slow
		(!subtitlePref || (subtitlePref && e.category !== "subtitles")) &&
		(!filePref || (filePref && e.category !== "files")) &&
		(!blacklistPref ||
			(blacklistPref &&
				blacklistEntries?.filter(
					(entry) =>
						requestDetails.url?.includes(entry) ||
						(
							requestDetails.documentUrl ||
							requestDetails.originUrl ||
							requestDetails.initiator
						)?.includes(entry)
				).length === 0))
	) {
		queue.push(requestDetails.requestId);
		requestDetails.type = e.type;
		requestDetails.category = e.category;
		addURL(requestDetails);
	}
};

const addURL = (requestDetails) => {
	const url = new URL(requestDetails.url);

	// MSS workaround
	const urlPath = url.pathname.toLowerCase().includes(".ism/manifest")
		? url.pathname.slice(0, url.pathname.lastIndexOf("/"))
		: url.pathname;

	// eslint-disable-next-line no-nested-ternary
	const filename = +urlPath.lastIndexOf("/")
		? urlPath.slice(urlPath.lastIndexOf("/") + 1)
		: urlPath[0] === "/"
		? urlPath.slice(1)
		: urlPath;

	const { hostname } = url;
	// depends on which listener caught it
	const headers =
		requestDetails.requestHeaders || requestDetails.responseHeaders;

	chrome.tabs.get(requestDetails.tabId, (tabData) => {
		const newRequestDetails = {
			...requestDetails,
			headers,
			filename,
			hostname,
			tabData
		};

		urlStorage.push(newRequestDetails);

		badgeText = urlStorage.length;
		chrome.browserAction.setBadgeBackgroundColor({ color: "green" });
		chrome.browserAction.setBadgeText({
			text: badgeText.toString()
		});

		localStorage.setItem("urlStorage", JSON.stringify(urlStorage));
		localStorage.setItem("badgeText", JSON.stringify(badgeText));

		chrome.runtime.sendMessage({ urlStorage: true }); // update popup if opened
		queue = queue.filter((q) => q !== requestDetails.requestId); // processing finished - remove from queue
	});

	if (
		!JSON.parse(localStorage.getItem("notifDetectPref")) &&
		!JSON.parse(localStorage.getItem("notifPref"))
	) {
		chrome.notifications.create("add", {
			// id = only one notification of this type appears at a time
			type: "basic",
			iconUrl: "img/icon-dark-96.png",
			title: _("notifTitle"),
			message: _("notifText", requestDetails.type) + filename
		});
	}
};

const deleteURL = (message) => {
	// url deletion
	if (message.previous === false) {
		urlStorage = urlStorage.filter(
			(url) =>
				!message.delete
					.map((msgUrl) => msgUrl.requestId)
					.includes(url.requestId)
		);
		badgeText = urlStorage.length;
	} else {
		urlStorageRestore = urlStorageRestore.filter(
			(url) =>
				!message.delete
					.map((msgUrl) => msgUrl.requestId)
					.includes(url.requestId)
		);
	}

	localStorage.setItem("urlStorage", JSON.stringify(urlStorage));
	localStorage.setItem("urlStorageRestore", JSON.stringify(urlStorageRestore));
	localStorage.setItem("badgeText", JSON.stringify(badgeText));
	chrome.runtime.sendMessage({ urlStorage: true });
	if (message.previous === false)
		chrome.browserAction.setBadgeText({
			text: badgeText === 0 ? "" : badgeText.toString() // only display at 1+
		});
};

// clear everything and/or set up
chrome.browserAction.setBadgeText({ text: "" });

// convert options object to separate entries in localstorage - temp
if (localStorage.getItem("options")) {
	const oldOptions = JSON.parse(localStorage.getItem("options"));
	for (const option in oldOptions) {
		localStorage.setItem(option, JSON.stringify(oldOptions[option]));
	}
	localStorage.removeItem("options");
}

// cleanup for major updates
/*
const manifestVersion = chrome.runtime.getManifest().version;
const addonVersion = localStorage.getItem("version");
if (
	(addonVersion &&
		(addonVersion.split(".")[0] < manifestVersion.split(".")[0] ||
			(addonVersion.split(".")[0] === manifestVersion.split(".")[0] &&
				addonVersion.split(".")[1] < manifestVersion.split(".")[1]))) ||
	!addonVersion
) {
	// only when necessary
	// localStorage.clear();
}
*/

// first init happens here
for (const option in defaults) {
	if (localStorage.getItem(option) === null)
		localStorage.setItem(option, JSON.stringify(defaults[option]));
}

updateVars();

// newline shouldn't really be an issue but just in case
chrome.runtime.getPlatformInfo((info) => {
	if (info.os === "win")
		localStorage.setItem("newline", JSON.stringify("\r\n"));
	else localStorage.setItem("newline", JSON.stringify("\n"));
});

urlStorage = JSON.parse(localStorage.getItem("urlStorage"));
urlStorageRestore = JSON.parse(localStorage.getItem("urlStorageRestore"));

if (disablePref === false) {
	chrome.webRequest.onBeforeSendHeaders.addListener(
		urlFilter,
		{ urls: ["<all_urls>"] },
		["requestHeaders"]
	);
	chrome.webRequest.onHeadersReceived.addListener(
		urlFilter,
		{ urls: ["<all_urls>"] },
		["responseHeaders"]
	);
}

// restore urls on startup
if (urlStorage.length > 0)
	urlStorageRestore = [...urlStorageRestore, ...urlStorage];

if (urlStorageRestore.length > 0) {
	if (cleanupPref)
		urlStorageRestore = urlStorageRestore.filter(
			(url) => new Date().getTime() - url.timeStamp < 604800000
		);

	localStorage.setItem("urlStorageRestore", JSON.stringify(urlStorageRestore));
	localStorage.setItem("urlStorage", JSON.stringify([]));
}

chrome.runtime.onMessage.addListener((message) => {
	if (message.delete) deleteURL(message);
	else if (message.options) {
		updateVars();
		if (
			disablePref &&
			chrome.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
			chrome.webRequest.onHeadersReceived.hasListener(urlFilter)
		) {
			chrome.webRequest.onBeforeSendHeaders.removeListener(urlFilter);
			chrome.webRequest.onHeadersReceived.removeListener(urlFilter);
		} else if (
			!disablePref &&
			!chrome.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
			!chrome.webRequest.onHeadersReceived.hasListener(urlFilter)
		) {
			chrome.webRequest.onBeforeSendHeaders.addListener(
				urlFilter,
				{ urls: ["<all_urls>"] },
				["requestHeaders"]
			);
			chrome.webRequest.onHeadersReceived.addListener(
				urlFilter,
				{ urls: ["<all_urls>"] },
				["responseHeaders"]
			);
		}
	}
});

chrome.commands.onCommand.addListener((cmd) => {
	if (cmd === "open-popup") chrome.browserAction.openPopup();
});
