export const getStorage = async (key) =>
	new Promise((resolve) =>
		chrome.storage.local.get(key, (value) => {
			if (Object.prototype.hasOwnProperty.call(value, key)) resolve(value[key]);
			else resolve(null);
		})
	);

export const getAllStorage = async () =>
	new Promise((resolve) =>
		chrome.storage.local.get(null, (res) => {
			if (Object.keys(res)?.length > 0) resolve(res);
			else resolve(null);
		})
	);

export const setStorage = async (obj) =>
	new Promise((resolve) => chrome.storage.local.set(obj, () => resolve()));

const removeStorage = async (key) =>
	new Promise((resolve) => chrome.storage.local.remove(key, () => resolve()));

export const clearStorage = async () =>
	new Promise((resolve) => chrome.storage.local.clear(() => resolve()));

export const saveOptionStorage = async (e, options) => {
	if (
		e.target.id === "copyMethod" &&
		e.target.value !== "url" &&
		e.target.value !== "tableForm" &&
		e.target.value !== "kodiUrl" &&
		!e.target.value.startsWith("user")
	) {
		const prefName = "customCommand" + e.target.value;

		if (await getStorage(prefName))
			document.getElementById("customCommand").value =
				(await getStorage(prefName)) || "";
	}

	if (e.target.id === "regexCommand")
		await setStorage({ [e.target.id]: e.target.value });
	else if (e.target.id === "customCommand")
		await setStorage({
			[e.target.id + document.getElementById("copyMethod").value]:
				e.target.value?.trim()
		});
	else if (e.target.tagName.toLowerCase() === "textarea")
		await setStorage({
			[e.target.id]: e.target.value?.split("\n").filter((ee) => ee)
		});
	else if (e.target.type === "checkbox")
		await setStorage({ [e.target.id]: e.target.checked });
	else if (e.target.type === "text" && e.target.value?.trim().length === 0)
		await removeStorage(e.target.id);
	else if (e.target.type === "radio" && options.length > 0) {
		// update entire radio group
		for (const option of options) {
			if (option.name === e.target.name) {
				await setStorage({
					[option.id]: document.getElementById(option.id).checked
				});
			}
		}
	} else await setStorage({ [e.target.id]: e.target.value?.trim() });

	// update other scripts as well
	chrome.runtime.sendMessage({ options: true });
};
