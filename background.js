const listenerFilter = {
	urls: [
		"*://*/*.m3u8",
		"*://*/*.m3u8?*",
		"*://*/*.mpd",
		"*://*/*.mpd?*",
		"*://*/*.f4m",
		"*://*/*.f4m?*",
		"*://*/*.ism",
		"*://*/*.ism/*",
		"*://*/*.vtt",
		"*://*/*.vtt/*"
	]
};

var paused = false;
const _ = browser.i18n.getMessage;
var badgenum,
	urlList = [];
browser.browserAction.setTitle({ title: "The Stream Detector" });

function refresh() {
	//clear everything and/or set up
	browser.menus.removeAll();
	browser.notifications.getAll().then(clearNotifs);
	browser.browserAction.setBadgeText({ text: "" });
	browser.browserAction.disable();
	browser.browserAction.setBadgeBackgroundColor({ color: "#797C80" });
	badgenum = 0;
	urlList = [];

	browser.menus.create({
		id: "m3u8link",
		title: "The Stream Detector"
	});
	browser.menus.create({
		type: "checkbox",
		checked: paused,
		id: "m3u8linkPause",
		title: _("pauseTitle"),
		parentId: "m3u8link"
	});
}
refresh();

function addURL(requestDetails) {
	if (!Object.keys(urlList).includes(requestDetails.url)) {
		if (!Object.keys(urlList).length) {
			browser.menus.create({
				id: "m3u8linkClear",
				title: _("clearTitle"),
				parentId: "m3u8link"
			});
			browser.menus.create({
				type: "separator",
				parentId: "m3u8link"
			});
			browser.menus.create({
				id: "m3u8linkCopyAll",
				title: _("copyAllTitle"),
				parentId: "m3u8link"
			});
		}

		//using the url as the id is not the best thing ever
		urlList[requestDetails.url] = requestDetails;

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
		urlList[requestDetails.url].filename = filename;

		var ext = url.href.slice(url.href.lastIndexOf(".") + 1, url.href.length);
		ext = ext.slice(
			0,
			ext.lastIndexOf("/") === -1 ? ext.length : ext.lastIndexOf("/")
		);
		ext = ext.slice(
			0,
			ext.lastIndexOf("?") === -1 ? ext.length : ext.lastIndexOf("?")
		);
		urlList[requestDetails.url].ext = ext;

		browser.menus.create({
			id: requestDetails.url, //this was way worse before, trust me
			title: `[${ext.toUpperCase()}] ${url.hostname} – ${filename}`,
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

function copyURL(info) {
	browser.storage.local.get().then(method => {
		var list = { urls: [], filenames: [], methodIncomp: false };
		info.forEach(e => {
			var code, ua, methodIncomp;
			if (!method.copyMethod) method.copyMethod = "url"; //default

			const streamURL = urlList[e].url;
			const filename = urlList[e].filename;
			const ext = urlList[e].ext;

			if (
				(ext === "f4m" && method.copyMethod === "ffmpeg") ||
				(ext === "ism" && method.copyMethod !== "youtubedl") ||
				(ext === "vtt" && method.copyMethod !== "youtubedl") ||
				(ext !== "m3u8" && method.copyMethod === "hlsdl")
			) {
				method.copyMethod = "url";
				methodIncomp = true;
			}

			if (method.copyMethod === "url") {
				code = streamURL;
			} else {
				ua = false;
				//the switchboard of doom begins
				switch (method.copyMethod) {
					case "ffmpeg":
						code = "ffmpeg";
						break;
					case "streamlink":
						code = "streamlink";
						break;
					case "youtubedl":
						code = "youtube-dl --no-part --restrict-filenames";
						break;
					case "hlsdl":
						code = "hlsdl -b";
						break;
				}

				//custom command line
				let prefName = "customCommand" + method.copyMethod;
				if (method[prefName]) {
					code += " " + method[prefName];
				}

				//additional headers
				if (method.headersPref === true) {
					for (let header of urlList[e].requestHeaders) {
						if (header.name.toLowerCase() === "user-agent") {
							switch (method.copyMethod) {
								case "ffmpeg":
									code += ` -user_agent "${header.value}"`;
									break;
								case "streamlink":
									code += ` --http-header "User-Agent=${header.value}"`;
									break;
								case "youtubedl":
									code += ` --user-agent "${header.value}"`;
									break;
								case "hlsdl":
									code += ` -u "${header.value}"`;
									break;
							}
							ua = true;
						}
						if (header.name.toLowerCase() === "cookie") {
							switch (method.copyMethod) {
								case "ffmpeg":
									code += ` -headers "Cookie: ${header.value}"`;
									break;
								case "streamlink":
									code += ` --http-header "Cookie=${header.value}"`;
									break;
								case "youtubedl":
									code += ` --add-header "Cookie:${header.value}"`;
									break;
								case "hlsdl":
									code += ` -h "Cookie:${header.value}"`;
									break;
							}
						}
						if (header.name.toLowerCase() === "referer") {
							switch (method.copyMethod) {
								case "ffmpeg":
									code += ` -referer "${header.value}"`;
									break;
								case "streamlink":
									code += ` --http-header "Referer=${header.value}"`;
									break;
								case "youtubedl":
									code += ` --referer "${header.value}"`;
									break;
								case "hlsdl":
									code += ` -h "Referer:${header.value}"`;
									break;
							}
						}
					}

					//user agent fallback if not supplied earlier
					if (ua === false) {
						switch (method.copyMethod) {
							case "ffmpeg":
								code += ` -user_agent "${navigator.userAgent}"`;
								break;
							case "streamlink":
								code += ` --http-header "User-Agent=${navigator.userAgent}"`;
								break;
							case "youtubedl":
								code += ` --user-agent "${navigator.userAgent}"`;
								break;
							case "hlsdl":
								code += ` -u "${navigator.userAgent}"`;
								break;
						}
					}
				}

				//final part of command
				switch (method.copyMethod) {
					case "ffmpeg":
						code += ` -i "${streamURL}" -c copy "${filename}.ts"`;
						break;
					case "streamlink":
						if (!method.streamlinkOutput) method.streamlinkOutput = "file";
						if (method.streamlinkOutput === "file")
							code += ` -o "${filename}.ts"`;
						code += ` "${streamURL}" best`;
						break;
					case "youtubedl":
						code += ` "${streamURL}"`;
						break;
					case "hlsdl":
						code += ` -o "${filename}.ts" "${streamURL}"`;
				}
			}

			//used to communicate with clipboard/notifications api
			list.urls.push(code);
			list.filenames.push(filename + "." + ext);
			list.methodIncomp = methodIncomp;
		});

		navigator.clipboard.writeText(list.urls.join("\n")).then(
			() => {
				browser.storage.local.get().then(function(notifs) {
					if (notifs.notifPref !== true) {
						if (list.methodIncomp === true) {
							browser.notifications.getAll().then(() => {
								browser.notifications.create("copied", {
									type: "basic",
									iconUrl: "data/icon-dark-96.png",
									title: _("notifCopiedTitle"),
									message:
										_("notifIncompCopiedText") + list.filenames.join("\n")
								});
							});
						} else {
							browser.notifications.getAll().then(() => {
								browser.notifications.create("copied", {
									type: "basic",
									iconUrl: "data/icon-dark-96.png",
									title: _("notifCopiedTitle"),
									message: _("notifCopiedText") + list.filenames.join("\n")
								});
							});
						}
					}
				});
			},
			error => {
				browser.storage.local.get().then(function(notifs) {
					if (notifs.notifPref !== true) {
						browser.notifications.getAll().then(() => {
							browser.notifications.create("error", {
								type: "basic",
								iconUrl: "data/icon-dark-96.png",
								title: _("notifErrorTitle"),
								message: _("notifErrorText") + error
							});
						});
					}
				});
			}
		);
	});
}

function clearNotifs(all) {
	for (let key of Object.keys(all)) {
		browser.notifications.clear(key);
	}
}

browser.browserAction.onClicked.addListener(() => refresh());

browser.menus.onClicked.addListener((info, tab) => {
	if (info.menuItemId === "m3u8linkPause") {
		//not the most elegant solution but it works fine
		if (info.checked) {
			paused = true;
			browser.webRequest.onSendHeaders.removeListener(addURL);
		} else {
			paused = false;
			browser.webRequest.onSendHeaders.addListener(addURL, listenerFilter, [
				"requestHeaders"
			]);
		}
	} else if (info.menuItemId === "m3u8linkClear") {
		refresh();
	} else {
		if (info.menuItemId === "m3u8linkCopyAll") {
			copyURL(Object.keys(urlList)); //each id is a url because the menus api is the way it is
		} else {
			copyURL(Array.of(info.menuItemId)); //for the sake of compatibility
		}
	}
});

browser.webRequest.onSendHeaders.addListener(addURL, listenerFilter, [
	"requestHeaders"
]);
