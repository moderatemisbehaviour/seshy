import chrome from '../chrome.js'
import diff from 'hyperdiff'

export async function persistSession (windowId, bookmarkFolderId) {
	const window = await chrome.windows.get(windowId, {populate: true})
	const [bookmarkFolder] = await chrome.bookmarks.getSubTree(bookmarkFolderId)

	const {added, removed, common} = diff(bookmarkFolder.children || [], window.tabs || [], 'url')

	const createOperations = added.map(({index, title, url}) => chrome.bookmarks.create({
		index,
		parentId: bookmarkFolder.id,
		title,
		url,
	}))
	const removeOperations = removed.map(tab => chrome.bookmarks.remove(tab.id)) // TODO: Update to use bookmark folder ID
	const moveOperations = common
		.filter(tab => window.tabs[tab.index].url !== bookmarkFolder.children[tab.index].url)
		.map(tab => chrome.bookmarks.move(
			bookmarkFolder.children.find(bookmark => bookmark.url === tab.url).id,
			{index: tab.index})
		)

	await Promise.all([
		...createOperations,
		...removeOperations,
		...moveOperations,
	])
}

export async function getBookmarkFolderId (windowId) {
	const items = await new Promise(resolve => {
		chrome.storage.local.get(windowId.toString(), resolve)
	})
	return items[windowId] || null
}
