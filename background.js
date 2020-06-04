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

function setup() {
	//clear everything and/or set up
	browser.browserAction.setBadgeText({ text: "" });

	browser.storage.local.get().then(options => {
		browser.storage.local
			.set({
				disablePref: !options.disablePref ? false : options.disablePref,
				urlStorage: !options.urlStorage ? [] : options.urlStorage,
				badgeText: 0
			})
			.then(() => {
				browser.webRequest.onBeforeSendHeaders.addListener(
					addURL,
					listenerFilter,
					["requestHeaders"]
				);
			});
		if (options.urlStorage && options.urlStorage.length > 0) {
			//restore urls on startup
			for (let url of options.urlStorage) {
				url.restore = true;
				addURL(url);
			}
		}
	});
}

function addURL(requestDetails) {
	browser.storage.local.get().then(options => {
		const checkUrl = options.urlStorage.filter(
			url => url.url === requestDetails.url
		);

		if (
			(!options.disablePref && //only run if it's not disabled by checkbox
				(checkUrl.length === 0 || //and if it's either a new url
					checkUrl.filter(url => url.restore === undefined).length === 0)) || //or a new url for this session
			requestDetails.restore //or if it's a restore
		) {
			if (!requestDetails.restore) {
				browser.browserAction.setBadgeBackgroundColor({ color: "green" });
				browser.browserAction.setBadgeText({
					text: (options.badgeText + 1).toString()
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
						filename.indexOf("?") === -1
							? filename.length
							: filename.indexOf("?")
					); //why does slice have to be the way it is
				} else {
					filename = url.href.slice(
						url.href.lastIndexOf("/", url.href.lastIndexOf(".ism")) + 1,
						url.href.lastIndexOf(".")
					);
				}

				let ext = url.href.slice(
					url.href.lastIndexOf(".") + 1,
					url.href.length
				);
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

				browser.storage.local
					.set({
						urlStorage: [...options.urlStorage, newRequestDetails],
						badgeText: options.badgeText + 1
					})
					.then(() => {
						browser.runtime.sendMessage({}); //must contain object, empty for now
						if (options.notifPref !== true) {
							browser.notifications.create("", {
								type: "basic",
								iconUrl: "img/icon-dark-96.png",
								title: _("notifTitle"),
								message: _("notifText") + filename + "." + ext
							});
						}
					});
			}
		}
	});
}

setup();
