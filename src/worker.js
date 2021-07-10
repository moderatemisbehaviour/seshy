import { debounce } from 'debounce'
import status from './ui/status/index.js'
import {
	getBookmarkFolderId,
	persistSession,
} from './api/index.js'
import openSavedSessionTracker from './api/openSavedSessionTracker'

// Listeners must be at the top-level: https://developer.chrome.com/docs/extensions/mv2/background_migration/#listeners
chrome.tabs.onUpdated.addListener(debounce(onUpdatedListener, 2000))
chrome.tabs.onCreated.addListener(tab => console.debug('tab created', tab))
chrome.tabs.onRemoved.addListener(tab => console.debug('tab removed', tab))
chrome.windows.onRemoved.addListener(
	openSavedSessionTracker.removeClosedWindowId
)
chrome.storage.onChanged.addListener(openSavedSessionTracker.removeStaleWindowIds)
chrome.windows.onFocusChanged.addListener(setActionIcon)

async function onUpdatedListener (_, changeInfo, tab) {
	console.debug('tab updated', changeInfo)
	const bookmarkFolderId = await getBookmarkFolderId(tab.windowId)
	const isSavedSession = !!bookmarkFolderId
	if (isSavedSession) {
		console.debug('persisting session')
		persistSession(tab.windowId, bookmarkFolderId)
	}
}

async function setActionIcon (windowId) {
	const openSavedSessionWindowIds = await openSavedSessionTracker.getOpenSessionWindowIds()
	const isOpenSavedSession = openSavedSessionWindowIds.includes(windowId)
	if (isOpenSavedSession) {
		status.saved()
	} else {
		status.unsaved()
	}
}
