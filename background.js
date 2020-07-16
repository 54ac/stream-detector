"use strict";

const listenerFilter = {
	urls: [
		"*://*/*.m3u8",
		"*://*/*.m3u8?*",
		"*://*/*.mpd",
		"*://*/*.mpd?*",
		"*://*/*.f4m",
		"*://*/*.f4m?*",
		"*://*/*.ism",
		"*://*/*.ism?*",
		"*://*/*.ism/*",
		"*://*/*.vtt",
		"*://*/*.vtt?*"
	]
};

const _ = browser.i18n.getMessage;

let urlStorage = [];
function setup() {
	//clear everything and/or set up
	browser.browserAction.setBadgeText({ text: "" });

	browser.storage.local.get().then(options => {
		browser.storage.local
			.set({
				disablePref: !options.disablePref ? false : options.disablePref,
				urlStorage: !options.urlStorage ? [] : options.urlStorage
			})
			.then(() => {
				browser.webRequest.onBeforeSendHeaders.addListener(
					addURL,
					listenerFilter,
					["requestHeaders"]
				);
				if (options.urlStorage && options.urlStorage.length > 0) {
					//restore urls on startup
					for (let url of options.urlStorage) {
						url.restore = true;
						urlStorage.push(url);
					}
					browser.storage.local.set({ urlStorage });
				}
			});
	});

	browser.runtime.onMessage.addListener(message => {
		if (message.delete) deleteURL(message.delete);
	});
}

let badgeText = 0;
function addURL(requestDetails) {
	const checkUrl = urlStorage.filter(e => e.url === requestDetails.url);

	browser.storage.local.get().then(options => {
		if (
			!options.disablePref && //only run if it's not disabled by checkbox
			(checkUrl.length === 0 || //and if it's either a new url
				checkUrl.filter(url => url.restore === undefined).length === 0)
		) {
			browser.browserAction.setBadgeBackgroundColor({ color: "green" });
			badgeText++;
			browser.browserAction.setBadgeText({
				text: badgeText.toString()
			});

			const url = new URL(requestDetails.url);

			let filename;
			if (url.href.indexOf(".ism") === -1) {
				filename = url.href.slice(
					url.href.lastIndexOf("/") + 1,
					url.href.lastIndexOf(".") || url.href.lastIndexOf("?")
				);
				filename = filename.slice(
					0,
					filename.indexOf("?") === -1 ? filename.length : filename.indexOf("?")
				); //why does slice have to be the way it is
			} else {
				filename = url.href.slice(
					url.href.lastIndexOf("/", url.href.lastIndexOf(".ism")) + 1,
					url.href.lastIndexOf(".")
				);
			}

			let ext = url.href.slice(url.href.lastIndexOf(".") + 1, url.href.length);
			ext = ext.slice(
				0,
				ext.lastIndexOf("/") === -1 ? ext.length : ext.lastIndexOf("/")
			);
			ext = ext.slice(
				0,
				ext.lastIndexOf("?") === -1 ? ext.length : ext.lastIndexOf("?")
			);

			const hostname = url.hostname;

			const timestamp = Date.now();

			const newRequestDetails = {
				...requestDetails,
				filename,
				ext,
				hostname,
				timestamp
			};

			urlStorage.push(newRequestDetails); //the following promise is too slow - workaround instead of doing it properly
			if (options.urlStorage != urlStorage && options.badgeText != badgeText)
				browser.storage.local.set({ urlStorage, badgeText }).then(() => {
					browser.runtime.sendMessage({ urlStorage: true }); //update popup if opened
				});

			if (options.notifPref !== true) {
				browser.notifications.create("add", {
					//id = only one notification of this type appears at a time
					type: "basic",
					iconUrl: "img/icon-dark-96.png",
					title: _("notifTitle"),
					message: _("notifText") + filename + "." + ext
				});
			}
		}
	});
}

function deleteURL(message) {
	//url deletion
	urlStorage = urlStorage.filter(
		url => !message.map(url => url.requestId).includes(url.requestId)
	);
	badgeText = urlStorage.filter(url => !url.restore).length;

	browser.storage.local.set({ urlStorage, badgeText }).then(() => {
		browser.runtime.sendMessage({ urlStorage: true });
		browser.browserAction.setBadgeText({
			text: badgeText === 0 ? "" : badgeText.toString() //only display at 1+
		});
	});
}

setup();
