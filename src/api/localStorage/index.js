async function getAll () {
	const items = await new Promise(resolve => {
		chrome.storage.local.get(null, resolve)
	})
	return items || {}
}

async function remove (keys) {
	await new Promise(resolve => {
		chrome.storage.local.remove(keys, resolve)
	})
}

export default {
	getAll,
	remove
}
