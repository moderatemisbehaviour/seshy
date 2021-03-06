import { isFunction, asyncLoop } from './util.js'
import { BookmarkPersistenceManager } from './persistence/index.js'

// const debounceWaitTime =
//   typeof debounceWaitTimeOverride === 'undefined'
//   	? 300
//   	: debounceWaitTimeOverride

// function debounce (func, wait, immediate) {
// 	var timeout
// 	return function () {
// 		var context = this
// 		var args = arguments
// 		var later = function () {
// 			timeout = null
// 			if (!immediate) func.apply(context, args)
// 		}
// 		var callNow = immediate && !timeout
// 		clearTimeout(timeout)
// 		timeout = setTimeout(later, wait)
// 		if (callNow) func.apply(context, args)
// 	}
// }

// ---===~ Add listeners. ~===------------------------------------------------------------------------------------------
chrome.runtime.onStartup.addListener(() => {
	console.debug('Startup event fired.')
})
chrome.runtime.onSuspend.addListener(() => {
	console.debug('Suspend event fired.')
})

// TODO Break these methods up into multiple independent listeners.
chrome.windows.onCreated.addListener(
	removePotentiallyReusedWindowIdFromInternalMappingOfOpenSessions
)
chrome.windows.onRemoved.addListener(
	removeClosedSessionFromInternalMappingOfOpenSessions
)
chrome.windows.onFocusChanged.addListener(setActionIcon)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	console.debug('tab updated', changeInfo)
	scheduleSaveSessionIfNecessary(tabId, changeInfo, tab)
})
chrome.tabs.onCreated.addListener(tab => console.debug('tab created', tab))
chrome.tabs.onRemoved.addListener(tab => console.debug('tab removed', tab))

var pendingTabUpdatedListenerCalls = 0

/**
 * The first implementation for this was dumb in that it would simply get all the tabs for the parent window, remove
 * all bookmarks from the bookmark folder, and re-create all the bookmarks based on the tabs currently in the window.
 * This did not work for several reasons...
 *
 * Creation of tabs seems to be quicker than removal of tabs. This means that if 2 tabs are created or updated in quick
 * succession then they will both trigger a series of removals and creations. A third tab change event may be triggered
 * when the creations have completed but the removals have not, meaning that at some point there are duplicate bookmarks
 * in the bookmark folder because 2 sets were created before the removals completed.
 *
 * In addition bookmark removals may be pending as other creations come through and trigger their own removals.
 * In the time it takes to get to some of the later removals an earlier pending removal may complete resulting in a
 * "can't find bookmark for id" error.
 */
function scheduleSaveSessionIfNecessary (tabId, changeInfo, tab) {
	console.log('Tab %d is %s.', tabId, changeInfo.status)

	var sessionWindowId = tab.windowId
	console.debug(sessionWindowId)
	var bookmarkFolderId
	chrome.windows.get(sessionWindowId, {populate: true}, sessionWindow => {
		if (chrome.runtime.lastError) {
			// If tab is changed and then window removed quickly this listener can fire after the window is removed.
			bookmarkPersistenceManager.removeWindowToSessionFolderMapping(sessionWindowId)
			return
		}

		console.log('Tab %d caused window %d to be retrieved with %d tabs.', tab.id, sessionWindowId, sessionWindow.tabs.length)

		bookmarkPersistenceManager.checkIfSavedSession(sessionWindowId.toString(), (storageObject) => {
			bookmarkFolderId = storageObject[sessionWindowId]
			// `bookmarkFolderId` will be undefined and therefore falsey if no window-to-bookmark-folder-mapping exists.
			if (bookmarkFolderId) {
				setActionIconToSaving()
				pendingTabUpdatedListenerCalls++
				setTimeout(() => {
					saveSessionIfNoPendingTabUpdatedListenerCalls(
						sessionWindow,
						bookmarkFolderId
					)
				}, 1000)
			}
		})
	})
}

function saveSessionIfNoPendingTabUpdatedListenerCalls (
	sessionWindow,
	bookmarkFolderId
) {
	if (--pendingTabUpdatedListenerCalls !== 0) {
		console.log(
			'%d newer pending tab updated listener calls. Returning without trying to save.',
			pendingTabUpdatedListenerCalls
		)
		return
	}
	console.log(
		'%d newer pending tab updated listener calls. Saving session to bookmark folder.',
		pendingTabUpdatedListenerCalls
	)

	bookmarkPersistenceManager.saveWindowAsBookmarkFolder(sessionWindow, bookmarkFolderId.toString(), () => {
		console.log(`Session with window ID ${sessionWindow.id} saved to bookmark folder with ID ${bookmarkFolderId}`)
		setActionIconToSaved()
	})
}

function setActionIconToUnsaved () {
	chrome.action.setIcon({path: '../status/unsaved.png'})
}

function setActionIconToSaving () {
	chrome.action.setIcon({path: '../status/saving.png'})
}
function setActionIconToSaved () {
	chrome.action.setIcon({path: '../status/saved.png'})
}

// TODO: This may delete the mapping that was just stored by resuming a saved session. Need to move the storage from
// `resumeSession` to here so that there can't be any clash.
/**
 * Closing a window calls chrome.windows.remove so need to saveSession there somehow. But window is already gone.
 * A wrapper for chrome's window.remove method won't work because the user can effectively call that explicitly at any
 * time by closing the window.
 */
function removePotentiallyReusedWindowIdFromInternalMappingOfOpenSessions (windowToCheck) {
	console.log('The windows.onCreated event fired. Clearing window to session folder mapping...')
	bookmarkPersistenceManager.removeWindowToSessionFolderMapping(windowToCheck.id, () => {
		bookmarkPersistenceManager.getSession(windowToCheck)
	})
}

/**
 * If a window-to-bookmark-folder-mapping exists then it is considered to be a saved session that is currently open.
 * It is not enough to remove the mapping when a window is opened because any logic that is executed inbetween the
 * window closing and another one opening (such as saving updated sessions) will think that sessions are still open.
 */
function removeClosedSessionFromInternalMappingOfOpenSessions (windowId) {
	console.log(
		'The windows.onRemoved event fired. Clearing window to session folder mapping...'
	)
	// Have to remove the mapping here rather than in `removeWindow` so that it
	bookmarkPersistenceManager.removeWindowToSessionFolderMapping(windowId)
}

function setActionIcon (windowId) {
	var setActionIconToSavedOrUnsaved = storageObject => {
		var bookmarkFolderId = storageObject[windowId]
		if (bookmarkFolderId) {
			setActionIconToSaved()
		} else {
			setActionIconToUnsaved()
		}
	}

	bookmarkPersistenceManager.checkIfSavedSession(windowId.toString(), setActionIconToSavedOrUnsaved)
}

// ---===~ Initialisation ~===------------------------------------------------------------------------------------------
var bookmarkPersistenceManager = new BookmarkPersistenceManager()
initialise()

// TODO Ensure this is loaded before anything else occurs.
// Currently it only works because it finishes before anything tries to reference seshyFolderId.
function initialise () {
	console.log('Extension started, pruning local storage...')
	pruneLocalStorage(() => {
		console.log('Local storage cleared.')
	})
}

function pruneLocalStorage (callback) {
	var windowIdsToRemove = []

	var getAllWindows = (storageObject) => {
		chrome.windows.getAll(null, (windows) => {
			getStorageKeysToBeRemoved(storageObject, windows)
		})
	}

	var getStorageKeysToBeRemoved = (storageObject, windows) => {
		var storedWindowIds = Object.keys(storageObject).map(windowId =>
			parseInt(windowId)
		)
		var currentlyOpenWindowIds = windows.map(aWindow => aWindow.id)

		var iterateFunction = (storedWindowId, callback) => {
			if (!currentlyOpenWindowIds.includes(storedWindowId)) {
				windowIdsToRemove.push(storedWindowId)
			}
			callback()
		}

		asyncLoop(storedWindowIds, iterateFunction, removeStorageKeysIfNecessary)
	}

	var removeStorageKeysIfNecessary = () => {
		if (windowIdsToRemove) {
			var keysToRemove = windowIdsToRemove.map(windowId => windowId.toString())
			chrome.storage.local.remove(keysToRemove, () => {
				if (isFunction(callback)) callback()
			})
		} else {
			if (isFunction(callback)) callback()
		}
	}

	chrome.storage.local.get(null, getAllWindows)
}
