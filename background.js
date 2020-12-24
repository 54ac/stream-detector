"use strict";

const extensions = [
	"m3u8",
	"mpd",
	"f4m",
	"ism",
	"vtt",
	"srt",
	"ttml",
	"ttml2",
	"dfxp"
];

const contentTypes = [
	"application/x-mpegurl",
	"application/vnd.apple.mpegurl",
	"application/dash+xml",
	"application/f4m",
	"text/vtt",
	"application/x-subrip",
	"application/ttml+xml",
	"application/ttaf+xml"
];

const _ = browser.i18n.getMessage;

const manifestVersion = browser.runtime.getManifest().version;

let urlStorage = [];
let urlStorageRestore = [];
let badgeText = 0;
let queue = [];
let notifPref = false;

function getExtension(url) {
	let ext = url.href.slice(url.href.lastIndexOf(".") + 1, url.href.length);
	ext = ext.slice(
		0,
		ext.lastIndexOf("/") === -1 ? ext.length : ext.lastIndexOf("/")
	);
	ext = ext.slice(
		0,
		ext.lastIndexOf("?") === -1 ? ext.length : ext.lastIndexOf("?")
	);

	return ext.toLowerCase();
}

function filterExtension(requestDetails) {
	const url = new URL(requestDetails.url);
	if (extensions.includes(getExtension(url))) addURL(requestDetails);
}

function filterContentType(requestDetails) {
	const header = requestDetails.responseHeaders.find(
		h => h.name.toLowerCase() === "content-type"
	);
	if (header) {
		const value = header.value.toLowerCase();
		if (contentTypes.some(ct => ct === value)) addURL(requestDetails);
	}
}

function addURL(requestDetails) {
	let newEntry = false;

	if (
		!queue.includes(requestDetails.requestId) &&
		urlStorage.filter(e => e.url === requestDetails.url).length === 0 // only new urls
	) {
		queue.push(requestDetails.requestId);

		const url = new URL(requestDetails.url);

		let filename = "";
		if (url.href.indexOf(".ism") === -1) {
			filename = url.href.slice(
				url.href.lastIndexOf("/") + 1,
				url.href.lastIndexOf(".") || url.href.lastIndexOf("?")
			);
			filename = filename.slice(
				0,
				filename.indexOf("?") === -1 ? filename.length : filename.indexOf("?")
			); // why does slice have to be the way it is
		} else {
			filename = url.href.slice(
				url.href.lastIndexOf("/", url.href.lastIndexOf(".ism")) + 1,
				url.href.lastIndexOf(".")
			);
		}
		const ext = getExtension(url);
		const { hostname } = url;
		const timestamp = Date.now();
		const headers =
			requestDetails.requestHeaders || requestDetails.responseHeaders;

		const newRequestDetails = {
			...requestDetails,
			headers,
			filename,
			ext,
			hostname,
			timestamp
		};

		urlStorage.push(newRequestDetails);
		newEntry = true;

		// the promises are too slow - queue used as workaround
		queue = queue.filter(e => e !== requestDetails.requestId);

		if (notifPref === false) {
			browser.notifications.create("add", {
				// id = only one notification of this type appears at a time
				type: "basic",
				iconUrl: "img/icon-dark-96.png",
				title: _("notifTitle"),
				message: `${_("notifText") + filename}.${ext}`
			});
		}
	}

	if (
		queue.length === 0 && // do not fire until async queue has finished processing - absolutely terrible
		newEntry
	) {
		badgeText = urlStorage.length;
		browser.browserAction.setBadgeBackgroundColor({ color: "green" });
		browser.browserAction.setBadgeText({
			text: badgeText.toString()
		});
		newEntry = false;

		browser.storage.local.set({ urlStorage, badgeText }).then(
			() => browser.runtime.sendMessage({ urlStorage: true }) // update popup if opened
		);
	}
}

function deleteURL(message) {
	// url deletion
	if (message.previous === false) {
		urlStorage = urlStorage.filter(
			url =>
				!message.delete.map(msgUrl => msgUrl.requestId).includes(url.requestId)
		);
		badgeText = urlStorage.length;
	} else {
		urlStorageRestore = urlStorageRestore.filter(
			url =>
				!message.delete.map(msgUrl => msgUrl.requestId).includes(url.requestId)
		);
	}

	browser.storage.local
		.set({ urlStorage, urlStorageRestore, badgeText })
		.then(() => {
			browser.runtime.sendMessage({ urlStorage: true });
			if (message.previous === false)
				browser.browserAction.setBadgeText({
					text: badgeText === 0 ? "" : badgeText.toString() // only display at 1+
				});
		});
}

function setup() {
	// clear everything and/or set up
	browser.browserAction.setBadgeText({ text: "" });

	browser.storage.local.get().then(options => {
		if (
			(options.version &&
				(options.version.split(".")[0] < manifestVersion.split(".")[0] ||
					(options.version.split(".")[0] === manifestVersion.split(".")[0] &&
						options.version.split(".")[1] < manifestVersion.split(".")[1]))) ||
			!options.version
		)
			browser.storage.local.clear();

		browser.storage.local
			.set({
				// first init also happens here
				disablePref: options.disablePref || false,
				copyMethod: options.copyMethod || "url",
				headersPref: options.headersPref || true,
				streamlinkOutput: options.streamlinkOutput || "file",
				downloaderPref: options.downloaderPref || false,
				downloaderCommand: options.downloaderCommand || "",
				proxyPref: options.proxyPref || false,
				proxyCommand: options.proxyCommand || "",
				customCommand: options.customCommand || "",
				userCommand: options.userCommand || "",
				notifPref: options.notifPref || false,
				urlStorageRestore: options.urlStorageRestore || [],
				version: manifestVersion
			})
			.then(() => {
				if (!options.disablePref || options.disablePref === false) {
					browser.webRequest.onBeforeSendHeaders.addListener(
						filterExtension,
						{ urls: ["<all_urls>"] },
						["requestHeaders"]
					);
					browser.webRequest.onHeadersReceived.addListener(
						filterContentType,
						{ urls: ["<all_urls>"] },
						["responseHeaders"]
					);
				}

				notifPref = options.notifPref || false;

				if (options.urlStorageRestore && options.urlStorageRestore.length > 0)
					// eslint-disable-next-line prefer-destructuring
					urlStorageRestore = options.urlStorageRestore;

				if (options.urlStorage && options.urlStorage.length > 0)
					urlStorageRestore = [...urlStorageRestore, ...options.urlStorage];

				// restore urls on startup
				if (urlStorageRestore.length > 0)
					browser.storage.local.set({
						urlStorageRestore,
						urlStorage: []
					});
			});
	});

	browser.runtime.onMessage.addListener(message => {
		if (message.delete) deleteURL(message);
		else if (message.options) {
			browser.storage.local.get().then(options => {
				if (
					options.disablePref === true &&
					browser.webRequest.onBeforeSendHeaders.hasListener(filterExtension) &&
					browser.webRequest.onHeadersReceived.hasListener(filterContentType)
				) {
					browser.webRequest.onBeforeSendHeaders.removeListener(
						filterExtension
					);
					browser.webRequest.onHeadersReceived.removeListener(
						filterContentType
					);
				} else if (
					options.disablePref === false &&
					!browser.webRequest.onBeforeSendHeaders.hasListener(
						filterExtension
					) &&
					!browser.webRequest.onHeadersReceived.hasListener(filterContentType)
				) {
					browser.webRequest.onBeforeSendHeaders.addListener(
						filterExtension,
						{ urls: ["<all_urls>"] },
						["requestHeaders"]
					);
					browser.webRequest.onHeadersReceived.addListener(
						filterContentType,
						{ urls: ["<all_urls>"] },
						["responseHeaders"]
					);
				}

				// eslint-disable-next-line prefer-destructuring
				notifPref = options.notifPref;
			});
		}
	});
}

setup();
