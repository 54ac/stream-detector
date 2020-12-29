"use strict";

const supported = [
	{
		ext: ["m3u8"],
		ct: ["application/x-mpegurl", "application/vnd.apple.mpegurl"],
		type: "HLS"
	},
	{ ext: ["mpd"], ct: ["application/dash+xml"], type: "DASH" },
	{ ext: ["f4m"], ct: ["application/f4m"], type: "HDS" },
	{ ext: ["ism"], ct: [], type: "MSS" },
	{ ext: ["vtt"], ct: ["text/vtt"], type: "VTT" },
	{ ext: ["srt"], ct: ["application/x-subrip"], type: "SRT" },
	{ ext: ["ttml", "ttml2"], ct: ["application/ttml+xml"], type: "TTML" },
	{ ext: ["dfxp"], ct: ["application/ttaf+xml"], type: "DFXP" }
];

const _ = browser.i18n.getMessage;

const manifestVersion = browser.runtime.getManifest().version;

let urlStorage = [];
let urlStorageRestore = [];
let badgeText = 0;
let queue = [];
let notifPref = false;

const urlFilter = requestDetails => {
	let ext;

	if (requestDetails.requestHeaders) {
		const url = new URL(requestDetails.url).pathname.toLowerCase();
		ext = supported.find(f => f.ext.some(fe => url.includes("." + fe)));
	} else if (requestDetails.responseHeaders) {
		const header = requestDetails.responseHeaders.find(
			h => h.name.toLowerCase() === "content-type"
		);

		if (header)
			ext = supported.find(f => f.ct.includes(header.value.toLowerCase()));
	}

	if (ext) {
		requestDetails.ext = ext.type;
		addURL(requestDetails);
	}
};

const addURL = requestDetails => {
	let newEntry = false;

	if (
		!queue.includes(requestDetails.requestId) &&
		urlStorage.filter(e => e.url === requestDetails.url).length === 0 // only new urls
	) {
		queue.push(requestDetails.requestId);

		const url = new URL(requestDetails.url);

		const urlPath = url.pathname.toLowerCase();
		// eslint-disable-next-line no-nested-ternary
		const filename = +urlPath.lastIndexOf("/")
			? urlPath.slice(urlPath.lastIndexOf("/") + 1)
			: urlPath[0] === "/"
			? urlPath.slice(1)
			: urlPath;

		const { hostname } = url;
		const timestamp = Date.now();
		const headers =
			requestDetails.requestHeaders || requestDetails.responseHeaders;

		const newRequestDetails = {
			...requestDetails,
			headers,
			filename,
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
				message: `${_("notifText", requestDetails.ext) + filename}`
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
};

const deleteURL = message => {
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
};

const setup = () => {
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
						urlFilter,
						{ urls: ["<all_urls>"] },
						["requestHeaders"]
					);
					browser.webRequest.onHeadersReceived.addListener(
						urlFilter,
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
					browser.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
					browser.webRequest.onHeadersReceived.hasListener(urlFilter)
				) {
					browser.webRequest.onBeforeSendHeaders.removeListener(urlFilter);
					browser.webRequest.onHeadersReceived.removeListener(urlFilter);
				} else if (
					options.disablePref === false &&
					!browser.webRequest.onBeforeSendHeaders.hasListener(urlFilter) &&
					!browser.webRequest.onHeadersReceived.hasListener(urlFilter)
				) {
					browser.webRequest.onBeforeSendHeaders.addListener(
						urlFilter,
						{ urls: ["<all_urls>"] },
						["requestHeaders"]
					);
					browser.webRequest.onHeadersReceived.addListener(
						urlFilter,
						{ urls: ["<all_urls>"] },
						["responseHeaders"]
					);
				}

				// eslint-disable-next-line prefer-destructuring
				notifPref = options.notifPref;
			});
		}
	});
};

setup();
