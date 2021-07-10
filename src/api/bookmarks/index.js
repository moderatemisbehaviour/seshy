async function getAllFolders () {
	const seshyFolder = await getSeshyFolder()
	const seshyFolderSubtree = await chrome.bookmarks.getSubTree(seshyFolder.id)
	const bookmarkFolders = seshyFolderSubtree[0].children
		.filter(bookmarkFolder => !isSystemFolder(bookmarkFolder))
	return bookmarkFolders
}

function isSystemFolder (bookmarkFolder) {
	return new RegExp('^_').test(bookmarkFolder.title)
}

async function getFolder (bookmarkFolderId) {
	return chrome.bookmarks.get(bookmarkFolderId)
}

async function getSeshyFolder () {
	const bookmarkTreeNodes = await chrome.bookmarks.search({title: 'Seshy'})
	if (bookmarkTreeNodes.length > 1) throw new Error('There is more than one Seshy folder, please remove one.')
	return bookmarkTreeNodes[0]
}

export default {
	getAllFolders,
	getFolder,
	getSeshyFolder,
}
