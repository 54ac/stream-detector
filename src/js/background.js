"use strict";

import defaults from "./components/defaults.js";
import supported from "./components/supported.js";
import { getStorage, setStorage, clearStorage } from "./components/storage.js";

const _ = chrome.i18n.getMessage;

const CLEAR_STORAGE = false;

const queue = [];
const allRequestDetails = [];
let urlStorage = [];
let urlStorageRestore = [];
let requestTimeoutId = -1;

let subtitlePref;
let filePref;
let fileSizePref;
let fileSizeAmount;
let manifestPref;
let blacklistPref;
let blacklistEntries;
let customExtPref;
let customCtPref;
let cleanupPref;
let disablePref;
let notifDetectPref;
let notifPref;
let downloadDirectPref;
let autoDownloadPref;
let newline;

const customSupported = { ext: [], ct: [], type: "CUSTOM", category: "custom" };
const isChrome = chrome.runtime.getURL("").startsWith("chrome-extension://");
const iconTheme = () =>
	window.matchMedia("(prefers-color-scheme: dark)").matches ? "light" : "dark";

const updateVars = async () => {
	// the web storage api crashes the entire browser sometimes so I have to resort to this nonsense
	subtitlePref = await getStorage("subtitlePref");
	filePref = await getStorage("filePref");
	fileSizePref = await getStorage("fileSizePref");
	fileSizeAmount = await getStorage("fileSizeAmount");
	manifestPref = await getStorage("manifestPref");
	blacklistPref = await getStorage("blacklistPref");
	blacklistEntries = await getStorage("blacklistEntries");
	customExtPref = await getStorage("customExtPref");
	customSupported.ext = await getStorage("customExtEntries");
	customCtPref = await getStorage("customCtPref");
	customSupported.ct = await getStorage("customCtEntries");
	cleanupPref = await getStorage("cleanupPref");
	disablePref = await getStorage("disablePref");
	notifDetectPref = await getStorage("notifDetectPref");
	notifPref = await getStorage("notifPref");
	downloadDirectPref = await getStorage("downloadDirectPref");
	autoDownloadPref = await getStorage("autoDownloadPref");
};

const addListeners = () => {
	chrome.webRequest.onBeforeSendHeaders.addListener(
		urlFilter,
		{ urls: ["<all_urls>"] },
		isChrome ? ["requestHeaders", "extraHeaders"] : ["requestHeaders"]
	);
	chrome.webRequest.onHeadersReceived.addListener(
		urlFilter,
		{ urls: ["<all_urls>"] },
		isChrome ? ["responseHeaders", "extraHeaders"] : ["responseHeaders"]
	);
};

const init = async () => {
	for (const option in defaults) {
		if ((await getStorage(option)) === null)
			// write defaults to storage
			await setStorage({ [option]: defaults[option] });
	}

	// reset filter on startup
	await setStorage({ filterInput: "" });

	setStorage({ version: chrome.runtime.getManifest().version });

	// newline shouldn't really be an issue but just in case
	chrome.runtime.getPlatformInfo(async (info) => {
		newline = info.os === "win" ? "\r\n" : "\n";
		setStorage({ newline });
	});

	chrome.browserAction.setBadgeText({ text: "" });

	chrome.browserAction.onClicked.addListener(
		(tab, OnClickData) =>
			OnClickData?.button === 1 && chrome.tabs.create({ url: "/popup.html" })
	);

	await updateVars();
};

const getTabData = async (tab) =>
	new Promise((resolve) => chrome.tabs.get(tab, (data) => resolve(data)));

const urlFilter = (requestDetails) => {
	let ext;
	let head;

	const url = new URL(requestDetails.url).pathname.toLowerCase();
	// check file extension and see if the url matches
	ext =
		customExtPref === true &&
		customSupported.ext?.some((fe) => url.toLowerCase().includes("." + fe)) &&
		customSupported;
	if (!ext)
		ext = supported.find((f) =>
			f.ext?.some((fe) => url.toLowerCase().includes("." + fe))
		);

	// depends which listener caught it
	requestDetails.headers =
		requestDetails.requestHeaders || requestDetails.responseHeaders;

	const headerCt = requestDetails.headers?.find(
		(h) => h.name.toLowerCase() === "content-type"
	);
	if (headerCt?.value) {
		// check content type header and see if it matches
		head =
			customCtPref === true &&
			customSupported?.ct?.some((fe) =>
				headerCt.value.toLowerCase().includes(fe.toLowerCase())
			) &&
			customSupported;
		if (!head)
			head = supported.find((f) =>
				f.ct?.some((fe) => headerCt.value.toLowerCase() === fe.toLowerCase())
			);
	}

	const headerSize = requestDetails.headers?.find(
		(h) => h.name.toLowerCase() === "content-length"
	);

	const e = head || ext;

	if (
		e &&
		!urlStorage.find((u) => u.url === requestDetails.url) && // urlStorage because promises are too slow sometimes
		!queue.includes(requestDetails.requestId) && // queue in case urlStorage is also too slow
		requestDetails.tabId !== -1 &&
		(!subtitlePref || (subtitlePref && e.category !== "subtitles")) &&
		(!filePref || (filePref && e.category !== "files")) &&
		(!fileSizePref ||
			(fileSizePref && isNaN(fileSizeAmount)) ||
			(fileSizePref &&
				fileSizeAmount &&
				e.category !== "stream" &&
				// hardcoded MB for size limits for now
				headerSize?.value &&
				Math.floor(headerSize.value / 1024 / 1024) >= fileSizeAmount)) &&
		(!manifestPref || (manifestPref && e.category !== "stream")) &&
		(!blacklistPref ||
			(blacklistPref &&
				!blacklistEntries?.some(
					(entry) =>
						requestDetails.url?.toLowerCase().includes(entry.toLowerCase()) ||
						(
							requestDetails.documentUrl ||
							requestDetails.originUrl ||
							requestDetails.initiator
						)
							?.toLowerCase()
							.includes(entry.toLowerCase()) ||
						headerCt?.value?.toLowerCase().includes(entry.toLowerCase()) ||
						e.type.toLowerCase().includes(entry.toLowerCase())
				)))
	) {
		queue.push(requestDetails.requestId);
		requestDetails.type = e.type;
		requestDetails.category = e.category;
		addURL(requestDetails);
	}
};

const addURL = async (requestDetails) => {
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

	const tabData = await getTabData(requestDetails.tabId);

	if (
		(requestDetails.category === "files" ||
			requestDetails.category === "custom") &&
		downloadDirectPref &&
		autoDownloadPref
	) {
		const dlFilename = tabData
			? (tabData.title + "/" + filename).replace(/[?%*:|"<>]/g, "_")
			: (hostname + "/" + filename).replace(/[?%*:|"<>]/g, "_");

		const dlHeaders = requestDetails.headers?.filter(
			(h) => h.name.toLowerCase() === "referer"
		);

		const dlOptions = chrome.runtime
			.getURL("")
			.startsWith("chrome-extension://")
			? {
					filename: dlFilename,
					url: requestDetails.url,
					saveAs: false
			  }
			: {
					filename: dlFilename,
					headers: dlHeaders || [],
					incognito: tabData?.incognito || false,
					url: requestDetails.url,
					saveAs: false
			  };

		chrome.downloads.download(dlOptions);
	} else {
		// web storage api optimization
		const newRequestDetails = {
			category: requestDetails.category,
			documentUrl: requestDetails.documentUrl,
			originUrl: requestDetails.originUrl,
			initiator: requestDetails.initiator,
			requestId: requestDetails.requestId,
			tabId: requestDetails.tabId,
			timeStamp: requestDetails.timeStamp,
			type: requestDetails.type,
			url: requestDetails.url,
			headers: requestDetails.headers?.filter(
				(h) =>
					h.name.toLowerCase() === "user-agent" ||
					h.name.toLowerCase() === "referer" ||
					h.name.toLowerCase() === "cookie" ||
					h.name.toLowerCase() === "set-cookie" ||
					h.name.toLowerCase() === "content-length"
			),
			filename,
			hostname,
			tabData: {
				title: tabData?.title,
				url: tabData?.url,
				incognito: tabData?.incognito
			}
		};
		urlStorage.push(newRequestDetails);

		// debounce lots of requests in a short period of time
		clearTimeout(requestTimeoutId);
		allRequestDetails.push({
			requestId: newRequestDetails.requestId,
			filename: newRequestDetails.filename,
			type: newRequestDetails.type
		});

		requestTimeoutId = setTimeout(async () => {
			await setStorage({ urlStorage });
			chrome.runtime.sendMessage({ urlStorage: true }); // update popup if opened
			chrome.browserAction.setBadgeBackgroundColor({ color: "green" });
			chrome.browserAction.setBadgeText({
				text: urlStorage.length.toString()
			});
			allRequestDetails
				.map((d) => d.requestId)
				.forEach((id) => queue.splice(queue.indexOf(id, 1))); // remove all batched requests from queue

			if (!notifDetectPref && !notifPref) {
				if (allRequestDetails.length > 1)
					// multiple files detected
					chrome.notifications.create("add", {
						// id = only one notification of this type appears at a time
						type: "basic",
						iconUrl: "img/icon-dark-96.png",
						title: _("notifManyTitle"),
						message:
							_("notifManyText") +
							allRequestDetails.map((d) => d.filename).join(newline)
					});
				else
					chrome.notifications.create("add", {
						type: "basic",
						iconUrl: "img/icon-dark-96.png",
						title: _("notifTitle"),
						message: _("notifText", requestDetails.type) + filename
					});
			}

			allRequestDetails.length = 0; // clear array for next batch
		}, 100);
	}
};

const deleteURL = async (message) => {
	// url deletion
	if (message.previous !== true) {
		urlStorage = urlStorage.filter(
			(url) =>
				!message.delete
					.map((msgUrl) => msgUrl.requestId)
					.includes(url.requestId)
		);
	} else {
		urlStorageRestore = urlStorageRestore.filter(
			(url) =>
				!message.delete
					.map((msgUrl) => msgUrl.requestId)
					.includes(url.requestId)
		);
	}

	await setStorage({ urlStorage });
	await setStorage({ urlStorageRestore });
	chrome.runtime.sendMessage({ urlStorage: true });
	if (message.previous !== true)
		chrome.browserAction.setBadgeText({
			text: urlStorage.length === 0 ? "" : urlStorage.length.toString() // only display at 1+
		});
};

(async () => {
	// clear everything and/or set up

	// cleanup for major updates
	const manifestVersion = chrome.runtime.getManifest().version;
	const addonVersion = await getStorage("version");
	if (CLEAR_STORAGE && addonVersion && addonVersion !== manifestVersion)
		await clearStorage();

	await init();

	if (disablePref !== true) {
		addListeners();
		chrome.browserAction.setIcon({
			path: {
				16: `img/icon-${iconTheme()}-enabled-16.png`,
				48: `img/icon-${iconTheme()}-enabled-48.png`,
				96: `img/icon-${iconTheme()}-enabled-96.png`
			}
		});
	}

	urlStorage = await getStorage("urlStorage");
	urlStorageRestore = await getStorage("urlStorageRestore");

	// restore urls on startup
	if (urlStorage && urlStorage.length > 0)
		urlStorageRestore = [...urlStorageRestore, ...urlStorage];

	if (urlStorageRestore && urlStorageRestore.length > 0) {
		if (cleanupPref)
			urlStorageRestore = urlStorageRestore.filter(
				(url) => new Date().getTime() - url.timeStamp < 604800000
			);

		// remove all entries previously detected in private windows
		urlStorageRestore = urlStorageRestore.filter(
			(url) => url.tabData?.incognito !== true
		);

		// urls from previous session were moved to urlStorageRestore
		urlStorage = [];

		await setStorage({ urlStorageRestore });
		await setStorage({ urlStorage: [] });
	}

	chrome.runtime.onMessage.addListener(async (message) => {
		if (message.delete) deleteURL(message);
		else if (message.options) {
			await updateVars();
			if (
				disablePref === true &&
				chrome.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
				chrome.webRequest.onHeadersReceived.hasListener(urlFilter)
			) {
				chrome.webRequest.onBeforeSendHeaders.removeListener(urlFilter);
				chrome.webRequest.onHeadersReceived.removeListener(urlFilter);
				chrome.browserAction.setIcon({
					path: {
						16: `img/icon-${iconTheme()}-16.png`,
						48: `img/icon-${iconTheme()}-48.png`,
						96: `img/icon-${iconTheme()}-96.png`
					}
				});
			} else if (
				disablePref !== true &&
				!chrome.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
				!chrome.webRequest.onHeadersReceived.hasListener(urlFilter)
			) {
				addListeners();
				chrome.browserAction.setIcon({
					path: {
						16: `img/icon-${iconTheme()}-enabled-16.png`,
						48: `img/icon-${iconTheme()}-enabled-48.png`,
						96: `img/icon-${iconTheme()}-enabled-96.png`
					}
				});
			}
		} else if (message.reset) {
			await clearStorage();
			urlStorage = [];
			urlStorageRestore = [];
			await init();
			chrome.runtime.sendMessage({ options: true });
		}
	});

	chrome.commands.onCommand.addListener((cmd) => {
		if (cmd === "open-popup") chrome.browserAction.openPopup();
	});
})();
