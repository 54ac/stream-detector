var badgenum = 0;
var urlList = [];
const _ = browser.i18n.getMessage;
browser.browserAction.disable();
browser.browserAction.setBadgeBackgroundColor({ color: "#797C80" });
browser.browserAction.setTitle({ title: _("buttonTitle") });

function addURL(requestDetails) {
	if (!urlList.includes(requestDetails.url)) {
		if (!urlList.length)
			browser.menus.create({
				id: "m3u8link",
				title: "The Stream Detector"
			});

		//very basic way of checking for duplicates in context menu entries because there's no way of listing them
		urlList.push(requestDetails.url);
		const url = new URL(requestDetails.url);

		var filename;
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

		var ext = url.href.slice(url.href.lastIndexOf(".") + 1, url.href.length);
		ext = ext.slice(
			0,
			ext.lastIndexOf("/") === -1 ? ext.length : ext.lastIndexOf("/")
		);
		ext = ext
			.slice(0, ext.lastIndexOf("?") === -1 ? ext.length : ext.lastIndexOf("?"))
			.toUpperCase();

		browser.menus.create({
			id: JSON.stringify(requestDetails), //this is absolutely terrible but will have to do since there's no value property
			title: `[${ext}] ${url.hostname} – ${filename}`,
			parentId: "m3u8link",
			icons: {
				"16": "data/icon-dark-16.png"
			}
		});

		browser.browserAction.enable();
		browser.browserAction.setBadgeBackgroundColor({ color: "#C00000" });
		badgenum++;
		browser.browserAction.setBadgeText({ text: badgenum.toString() });

		browser.storage.local.get().then(notifs => {
			if (notifs.notifPref !== true) {
				browser.notifications.getAll().then(all => {
					clearNotifs(all);
					browser.notifications.create(`notif-${filename}`, {
						type: "basic",
						iconUrl: "data/icon-dark-96.png",
						title: _("notifTitle", ext),
						message: _("notifText", ext)
					});
				});
			}
		});
	}
}

function clearNotifs(all) {
	for (let key of Object.keys(all)) {
		browser.notifications.clear(key);
	}
}

browser.browserAction.onClicked.addListener(() => {
	//clear everything when button is clicked
	browser.menus.removeAll();
	browser.notifications.getAll().then(clearNotifs);
	browser.browserAction.setBadgeText({ text: "" });
	browser.browserAction.disable();
	browser.browserAction.setBadgeBackgroundColor({ color: "#797C80" });
	badgenum = 0;
	urlList = [];
});

browser.menus.onClicked.addListener((info, tab) => {
	browser.storage.local.get().then(method => {
		var code, ua, methodIncomp;
		if (!method.copyMethod) method.copyMethod = "url";
		const streamURL = JSON.stringify(JSON.parse(info.menuItemId).url); //terrible again but works

		var filename = streamURL.slice(
			streamURL.lastIndexOf("/") + 1,
			streamURL.lastIndexOf(".") || streamURL.lastIndexOf("?")
		);
		filename = filename
			.slice(
				0,
				filename.indexOf("?") === -1 ? filename.length : filename.indexOf("?")
			)
			.replace(/[/\\?%*:|"<>]/g, "-");

		var ext = streamURL.slice(
			streamURL.lastIndexOf(".") + 1,
			streamURL.length - 1
		);
		ext = ext.slice(0, ext.indexOf("/") === -1 ? ext.length : ext.indexOf("/"));
		ext = ext.slice(0, ext.indexOf("?") === -1 ? ext.length : ext.indexOf("?"));

		if (
			(ext === "f4m" && method.copyMethod === "ffmpeg") ||
			(ext === "ism" && method.copyMethod !== "youtubedl")
		) {
			method.copyMethod = "url";
			methodIncomp = true;
		}

		if (method.copyMethod === "url") {
			code = "copyToClipboard(" + streamURL + ");";
		} else if (method.copyMethod === "ffmpeg") {
			ua = false;
			code = "copyToClipboard('ffmpeg";

			let prefName = "customCommand" + method.copyMethod;
			if (method[prefName]) {
				code += " " + method[prefName];
			}

			if (method.headersPref === true) {
				for (let header of JSON.parse(info.menuItemId).requestHeaders) {
					if (header.name.toLowerCase() === "user-agent") {
						code += ' -user_agent "' + header.value + '"';
						ua = true;
					}
					if (header.name.toLowerCase() === "cookie") {
						code += ' -headers "Cookie: ' + header.value + '"';
					}
					if (header.name.toLowerCase() === "referer") {
						code += ' -referer "' + header.value + '"';
					}
				}
				if (ua === false) {
					code += ' -user_agent "' + navigator.userAgent + '"';
				}
			}
			code += " -i " + streamURL + ' -c copy "' + filename + ".ts\"');";
		} else if (method.copyMethod === "streamlink") {
			ua = false;
			code = "copyToClipboard('streamlink";

			let prefName = "customCommand" + method.copyMethod;
			if (method[prefName]) {
				code += " " + method[prefName];
			}

			if (method.headersPref === true) {
				for (var header of JSON.parse(info.menuItemId).requestHeaders) {
					if (header.name.toLowerCase() === "user-agent") {
						code += ' --http-header "User-Agent=' + header.value + '"';
						ua = true;
					}
					if (header.name.toLowerCase() === "cookie") {
						code += ' --http-header "Cookie=' + header.value + '"';
					}
					if (header.name.toLowerCase() === "referer") {
						code += ' --http-header "Referer=' + header.value + '"';
					}
				}
				if (ua === false) {
					code += ' --http-header "User-Agent=' + navigator.userAgent + '"';
				}
			}
			code += ' -o "' + filename + '.ts" ' + streamURL + " best');";
		} else if (method.copyMethod === "youtubedl") {
			ua = false;
			code = "copyToClipboard('youtube-dl --no-part --restrict-filenames";

			let prefName = "customCommand" + method.copyMethod;
			if (method[prefName]) {
				code += " " + method[prefName];
			}

			if (method.headersPref === true) {
				for (let header of JSON.parse(info.menuItemId).requestHeaders) {
					if (header.name.toLowerCase() === "user-agent") {
						code += ' --user-agent "' + header.value + '"';
						ua = true;
					}
					if (header.name.toLowerCase() === "cookie") {
						code += ' --add-header "Cookie:' + header.value + '"';
					}
					if (header.name.toLowerCase() === "referer") {
						code += ' --referer "' + header.value + '"';
					}
				}
				if (ua === false) {
					code += ' --user-agent "' + navigator.userAgent + '"';
				}
			}
			code += " " + streamURL + "');";
		}
		browser.tabs
			.executeScript({
				code: "typeof copyToClipboard === 'function';"
			})
			.then(results => {
				if (!results || results[0] !== true) {
					return browser.tabs.executeScript(tab.id, {
						file: "clipboard-helper.js" //sourced from https://github.com/mdn/webextensions-examples/blob/master/context-menu-copy-link-with-types/clipboard-helper.js
					});
				}
			})
			.then(() => {
				browser.storage.local.get().then(function(notifs) {
					if (notifs.notifPref !== true) {
						if (methodIncomp === true) {
							browser.notifications.getAll().then(() => {
								browser.notifications.create(`copied-${filename}`, {
									type: "basic",
									iconUrl: "data/icon-dark-96.png",
									title: _("notifCopiedTitle", ext.toUpperCase()),
									message: _("notifIncompCopiedText")
								});
							});
						} else {
							browser.notifications.getAll().then(() => {
								browser.notifications.create(`copied-${filename}`, {
									type: "basic",
									iconUrl: "data/icon-dark-96.png",
									title: _("notifCopiedTitle", ext.toUpperCase()),
									message: _("notifCopiedText")
								});
							});
						}
					}
				});
				return browser.tabs.executeScript(tab.id, {
					code
				});
			})
			.catch(error => {
				browser.storage.local.get().then(function(notifs) {
					if (notifs.notifPref !== true) {
						browser.notifications.getAll().then(() => {
							browser.notifications.create(`error-${filename}`, {
								type: "basic",
								iconUrl: "data/icon-dark-96.png",
								title: _("notifErrorTitle"),
								message: _("notifErrorText") + error
							});
						});
					}
				});
			});
	});
});

browser.webRequest.onSendHeaders.addListener(
	addURL,
	{
		urls: [
			"*://*/*.m3u8",
			"*://*/*.m3u8?*",
			"*://*/*.mpd",
			"*://*/*.mpd?*",
			"*://*/*.f4m",
			"*://*/*.f4m?*",
			"*://*/*.ism",
			"*://*/*.ism/*"
		]
	},
	["requestHeaders"]
);
