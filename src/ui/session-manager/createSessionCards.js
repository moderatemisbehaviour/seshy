import Session from '../../api/session.js'
import openSavedSessionTracker from '../../api/openSavedSessionTracker/index.js'
import bookmarks from '../../api/bookmarks/index.js'
import sessionManager from './index.js'

const shelvedSessionListId = 'saved-sessions'
const currentlyOpenSessionListId = 'currently-open-sessions' // TODO: Split this up into 3 lists

async function createSessionCards () {
	const windows = await getAllOpenWindows()
	const openSavedSessionWindowIds = await openSavedSessionTracker.getOpenSessionWindowIds()

	const windowsUnsaved = []
	const windowsUnshelved = []

	windows.forEach(window => {
		if (openSavedSessionWindowIds.includes(window.id)) {
			windowsUnshelved.push(window)
		} else {
			windowsUnsaved.push(window)
		}
	})

	createUnsavedSessionCards(windowsUnsaved)
	await createUnshelvedSessionCards(windowsUnshelved)
	createShelvedSessionCards()
	// await initialiseMaterialComponents()
}

async function getAllOpenWindows () { // TODO: Extract to windows module
	return chrome.windows.getAll({populate: true, windowTypes: ['normal']})
}

function createUnsavedSessionCards (windows) {
	windows.forEach(window => {
		const session = new Session({
			name: 'Unsaved session',
			tabs: window.tabs,
			saved: false,
			windowId: window.id,
		})
		createSessionCard(session, 'unsaved')
	})
}

async function createUnshelvedSessionCards (windows) {
	const promises = windows.map(async window => {
		const unshelvedSessionIdMappings = await localStorage.getAll() // TODO: Abstract this away into a higher-level module rather than calling localStorage directly
		const bookmarkFolderId = unshelvedSessionIdMappings[window.id.toString()]
		const bookmarkFolder = await bookmarks.get(bookmarkFolderId)

		const session = new Session({
			name: bookmarkFolder.title,
			tabs: bookmarkFolder.children,
			saved: true,
			windowId: window.id,
		})
		createSessionCard(session, 'unshelved')
	})

	await Promise.all(promises)
}

async function createShelvedSessionCards () {
	const shelvedSessionBookmarkFolderIds = await openSavedSessionTracker.getOpenSessionBookmarkFolderIds()
	const shelvedBookmarkFolders = (await bookmarks.getAllFolders())
		.filter(bookmarkFolder => !shelvedSessionBookmarkFolderIds.includes(bookmarkFolder.id)) // TODO: Should maybe check window IDs instead to avoid stale mappings?

	shelvedBookmarkFolders.forEach(async bookmarkFolder => {
		const session = new Session({
			name: bookmarkFolder.title,
			tabs: bookmarkFolder.children,
			saved: true,
		})
		createSessionCard(session, 'shelved')
	})
}

function createSessionCard (session, sessionType) {
	const listId = sessionType === 'unsaved' || sessionType === 'unshelved' ? currentlyOpenSessionListId : shelvedSessionListId
	const sessionList = document.getElementById(listId)

	const sessionCard = document.createElement('li')
	sessionCard.setAttribute('data-id', session.windowId)
	sessionCard.setAttribute('data-type', sessionType)
	sessionCard.setAttribute('class', 'session-card mdc-list-item mdc-theme--background mdc-elevation--z2')
	sessionCard.setAttribute('tabindex', '0') // Make `li` element focusable.
	sessionCard.innerHTML = getSessionInnerHtml(session.name, session.tabs.length, session.saved)

	sessionList.appendChild(sessionCard)

	sessionCard.addEventListener('focus', (event) => addSelectedClass(event.target))

	const editIcon = sessionCard.getElementsByClassName('edit-icon')[0]
	const resumeIcon = sessionCard.getElementsByClassName('resume-icon')[0]
	const deleteIcon = sessionCard.getElementsByClassName('delete-icon')[0]

	editIcon.addEventListener('click', event => sessionManager.factory(event.target.closest('.session-card')).edit())
	resumeIcon.addEventListener('click', event => sessionManager.factory(event.target.closest('.session-card')).resume())
	deleteIcon.addEventListener('click', event => sessionManager.factory(event.target.closest('.session-card')).remove())

	// sessionCard.addEventListener('click', (event) => {
	// 	var classList = event.target.classList
	// 	if (classList.contains('edit-icon')) {
	// 		if (this.sessionIsBeingRenamed(event.target)) {
	// 			this.finishEditingSession(this)
	// 		} else {
	// 			this.startEditingSession(this)
	// 		}
	// 	} else if (classList.contains('resume-icon')) {
	// 		this.resumeSession(this)
	// 	} else if (classList.contains('delete-icon')) {
	// 		this.deleteSession()
	// 	}
	// })
	// sessionCard.addEventListener('keydown', (event) => {
	// 	if (event.key === 'Enter') {
	// 		if (this.sessionIsBeingRenamed(event.target)) {
	// 			this.finishEditingSession(this)
	// 			event.stopPropagation()
	// 		} else {
	// 			this.resumeSession()
	// 			event.stopPropagation()
	// 		}
	// 	}
	// })
	// sessionCard.addEventListener('keydown', (event) => {
	// 	switch (event.key) {
	// 	case 'r':
	// 		this.startEditingSession(this)
	// 		break

	// 	case '#':
	// 		this.deleteSession()
	// 		break

	// 	default: return
	// 	}
	// 	event.preventDefault()
	// })
}

function getSessionInnerHtml (name, tabsCount, saved) {
	var savedStateIcon = saved ? 'bookmark' : 'bookmark_border'
	var innerHtml = `
    <span class="mdc-list-item__graphic">
      <i class="saved-state-icon material-icons" title="saved state">${savedStateIcon}</i>
    </span>
    <span class="mdc-list-item__text">
      <div class="session-name mdc-text-field mdc-text-field--dense mdc-text-field--fullwidth">
        <span class="mdc-text-field__ripple"></span>
        <input type="text" class="session-name-input mdc-text-field__input" value="${name}" readonly="true">
        <span class="mdc-line-ripple"></span>
      </div>
      <span class="tabs-number mdc-list-item__secondary-text">
        ${tabsCount} tabs
      </span>
    </span>
    <span class="mdc-list-item__meta">
      <button class="edit-button" title="edit">
        <i class="edit-icon material-icons">edit</i>
      </button>
      <button class="resume-button" title="resume">
        <i class="resume-icon material-icons">open_in_new</i>
      </button>
      <button class="delete-button" title="delete">
        <i class="delete-icon material-icons">delete</i>
      </button>
    </span>
  `
	return innerHtml
}

function addSelectedClass (sessionCard) {
	console.debug('Focus event handler triggered. Removing selected class from existing elements.')
	var selectedSessions = document.getElementsByClassName('selected')
	for (var i = 0; i < selectedSessions.length; i++) {
		selectedSessions[i].classList.remove('selected')
	}
	console.debug('Adding selected class to focused element.')
	sessionCard.classList.add('selected')
}

// async function renameSession () {
// 	var sessionNameInput = getSessionNameInput(this)
// 	var newName = sessionNameInput.value

// 	if (isFunction(callback)) {
// 		bookmarkPersistenceManager.renameSession(this, newName, callback)
// 	} else {
// 		bookmarkPersistenceManager.renameSession(this, newName)
// 	}
// }

// async function deleteSession (callback) {
// 	// TODO implement this behaviour somewhere else.
// 	// var focusNextSessionCardThenCallback = () => {
// 	//   nextSessionCard.focus()
// 	//   if (isFunction(callback)) callback()
// 	// }

// 	bookmarkPersistenceManager.deleteSession(this.element.seshySession, callback)
// }

// Session.prototype.sessionIsBeingRenamed = function (element) {
// 	var editIcon
// 	if (element.classList.contains('edit-icon')) {
// 		editIcon = element
// 	} else {
// 		editIcon = this.element.getElementsByClassName('edit-icon')[0]
// 	}
// 	return Boolean(editIcon.textContent === 'done')
// }

// Session.prototype.saveSession = function (callback) {
// 	var updateSavedStateIcon = () => {
// 		this.setSavedIconState(true)
// 		if (isFunction(callback)) callback()
// 	}

// 	var sessionNameInput = getSessionNameInput(this)

// 	this.name = sessionNameInput.value // Session instance was created before name input text changed so must update.
// 	bookmarkPersistenceManager.saveSession(this, updateSavedStateIcon)
// }

// export class BookmarkPersistenceManager {
// 	constructor () {
// 		this.seshyFolderId = null
// 		this.checkIfSeshyFolderExists()
// 	}

// 	/**
// 	 * Callback has no args.
// 	 */
// 	storeWindowToSessionFolderMapping (windowId, sessionFolderId, callback) {
// 		var windowToSessionFolderMapping = {}
// 		windowToSessionFolderMapping[windowId] = sessionFolderId
// 		console.debug(`Storing window to session folder mapping: ${windowToSessionFolderMapping}`)

// 		if (isFunction(callback)) {
// 			chrome.storage.local.set(windowToSessionFolderMapping, callback)
// 		} else {
// 			chrome.storage.local.set(windowToSessionFolderMapping)
// 		}
// 	}

// 	// TODO: See if using Chrome messages API to communicate with Seshy lib will utilise multiple threads and therefore
// 	// improve performance.
// 	// Public methods
// 	// ---===~ Initialisation ~===----------------------------------------------------------------------------------------
// 	checkIfSeshyFolderExists () {
// 		console.log('Checking for existing Seshy folder...')

// 		var query = {
// 			'title': 'Seshy',
// 			'url': null
// 		}
// 		chrome.bookmarks.search(query, (bookmarkTreeNodes) => {
// 			if (bookmarkTreeNodes.length === 0) {
// 				console.log('No existing Seshy folder, creating...')
// 				this.createSeshyFolder()
// 			} else if (bookmarkTreeNodes.length === 1) {
// 				this.seshyFolderId = bookmarkTreeNodes[0].id
// 				console.log('Seshy folder already exists with ID ' + this.seshyFolderId + '.')
// 			} else {
// 				this.seshyFolderId = bookmarkTreeNodes[0].id
// 				console.error('More than one Session folder in Other Bookmarks!')
// 			}
// 		})
// 	}

// 	createSeshyFolder () {
// 		var bookmark = {
// 			'title': 'Seshy'
// 		}
// 		chrome.bookmarks.create(bookmark, (seshyFolder) => {
// 			this.seshyFolderId = seshyFolder.id
// 			var message = 'Created seshy folder with ID ' + this.seshyFolderId + '.'
// 			console.log(message)
// 		})
// 	}

// 	// ---===~ Session Management ~===--------------------------------------------------------------------------------------
// 	// TODO Refactor to consume session objects instead of windows.
// 	/**
//    * Save a session. Sessions can be in multiple states when they are saved.
//    *
//    * The session may be an unsaved one (which means they must be currently open) in which case a new session folder will
//    * be created.
//    *
//    * The session may be saved and shelved, or saved and unshelved (currently open). In either case the existing session
//    * folder will be looked up and overwritten.
//    */
// 	saveSession (session, callback) {
// 		console.log('Saving tab set into bookmarks folder.')

// 		// TODO Replace with global function.
// 		var checkIfSavedSession = (session) => {
// 			if (session.saved()) {
// 				getBookmarksInFolder(session.bookmarkFolder.id)
// 			} else {
// 				this.createSessionFolder(session, (bookmarkTreeNode) => {
// 					session.bookmarkFolder = bookmarkTreeNode
// 					this.saveOpenSessionTabs(session, callStoreWindowToSessionFolderMapping)
// 				})
// 			}
// 		}

// 		// eslint-disable-next-line no-unused-vars
// 		var setBookmarkFolderOnSession = (bookmarkFolderId, callback) => {
// 			chrome.bookmarks.getSubTree(bookmarkFolderId, (bookmarkTreeNodes) => {
// 				session.bookmarkFolder = bookmarkTreeNodes
// 				callback(bookmarkFolderId)
// 			})
// 		}

// 		var getBookmarksInFolder = (bookmarkFolderId) => {
// 			chrome.bookmarks.getChildren(bookmarkFolderId, removeBookmarksInFolder)
// 		}

// 		var removeBookmarksInFolder = (bookmarkTreeNodes) => {
// 			this.removeBookmarks(bookmarkTreeNodes, callSaveTabsAsBookmarks)
// 		}

// 		var callSaveTabsAsBookmarks = () => {
// 			if (session.currentlyOpen()) {
// 				this.saveOpenSessionTabs(session, updateBookmarkFolderThenStoreWindowToSessionFolderMapping)
// 			} else {
// 				this.saveOpenSessionTabs(session, callback)
// 			}
// 		}

// 		var updateBookmarkFolderThenStoreWindowToSessionFolderMapping = () => {
// 			session.updateBookmarkFolder(() => {
// 				callStoreWindowToSessionFolderMapping(callback)
// 			})
// 		}

// 		var callStoreWindowToSessionFolderMapping = () => {
// 			this.storeWindowToSessionFolderMapping(session.window.id, session.bookmarkFolder.id, () => {
// 				this.setActionIconToSaved()
// 				callback()
// 			})
// 		}

// 		session.updateWindow(() => {
// 			checkIfSavedSession(session)
// 		})
// 	}

// 	renameSession (session, newName, callback) {
// 		console.log(`Renaming session ${session.name} to ${newName}.`)

// 		var updateSessionElement = () => {
// 			var sessionNameInput = getSessionNameInput(session)
// 			sessionNameInput.value = newName
// 			if (isFunction(callback)) callback()
// 		}

// 		var bookmarkFolderId = session.bookmarkFolder.id
// 		chrome.bookmarks.update(bookmarkFolderId, {'title': newName}, updateSessionElement)
// 	}

// 	/**
//    * Resumes a session. The callback has no parameters.
//    */
// 	resumeSession (session, callback) {
// 		var extractUrlsFromBookmarks = (session) => {
// 			var sessionFolder = session.bookmarkFolder
// 			var bookmarks = sessionFolder.children
// 			var urls = bookmarks.map((bookmark) => { return bookmark.url })
// 			createWindowForSession(urls)
// 		}

// 		var createWindowForSession = (urls) => {
// 			var createData = {
// 				'url': urls
// 			}
// 			chrome.windows.create(createData, (newWindow) => {
// 				setTimeout(() => {
// 					if (isFunction(callback)) {
// 						this.storeWindowToSessionFolderMapping(newWindow.id, session.bookmarkFolder.id, () => {
// 							callback(newWindow)
// 						})
// 					} else {
// 						this.storeWindowToSessionFolderMapping(newWindow.id, session.bookmarkFolder.id)
// 					}
// 				}, 1000) // TODO: Horrible hack for the bug that means that window created listener can sometimes remove the window ID from the mapping created by.
// 			})
// 		}

// 		if (session.window && session.window.focused) {
// 			window.close()
// 			callback()
// 		} else if (session.currentlyOpen()) {
// 			var updateInfo = {'focused': true}
// 			chrome.windows.update(session.window.id, updateInfo, () => {
// 				if (isFunction(callback)) {
// 					session.updateWindow(callback)
// 				} else {
// 					session.updateWindow()
// 				}
// 			})
// 		} else {
// 			extractUrlsFromBookmarks(session)
// 		}
// 	}

// 	deleteSession (session, callback) {
// 		var removeSessionWindowIfOpen = () => {
// 			if (session.currentlyOpen()) {
// 				session.updateWindow(() => {
// 					chrome.windows.remove(session.window.id, removeBookmarkFolderIfSaved)
// 				})
// 			} else {
// 				removeBookmarkFolderIfSaved()
// 			}
// 		}

// 		var removeBookmarkFolderIfSaved = () => {
// 			if (session.saved()) {
// 				chrome.bookmarks.removeTree(session.bookmarkFolder.id, callback)
// 			} else {
// 				callback()
// 			}
// 		}

// 		this.removeSessionElement(session, removeSessionWindowIfOpen)
// 	}

// 	removeSessionElement (session, callback) {
// 		session.element.remove()
// 		callback()
// 	}

// 	// TODO: Is this method necessary?
// 	/**
//    * Check if the passed window is a saved session and if so callback with its bookmark folder.
//    */
// 	getSession (windowToCheck, callback) {
// 		var getTabs = (windowToCheck) => {
// 			if (windowToCheck.tabs) {
// 				tabs = windowToCheck.tabs
// 				this.getAllSessionFolders(compareWindowWithSessionFolders)
// 			} else {
// 				chrome.tabs.query({windowId: windowToCheck.id}, (windowToCheckTabs) => {
// 					tabs = windowToCheckTabs
// 					this.getAllSessionFolders(compareWindowWithSessionFolders)
// 				})
// 			}
// 		}

// 		var compareWindowWithSessionFolders = (sessionFolders) => {
// 			var matchingSessionFolder = null

// 			for (var i = 0; i < sessionFolders.length; i++) {
// 				var sessionFolder = sessionFolders[i]
// 				var match = compareTabsToBookmarks(tabs, sessionFolder.children)
// 				if (match === true) {
// 					matchingSessionFolder = sessionFolder
// 					break
// 				}
// 			}

// 			if (matchingSessionFolder === null) {
// 				console.log('No existing session found for window with ID ' + windowToCheck.id + '.')
// 			} else {
// 				console.log('Existing session found in bookmark folder with ID ' + matchingSessionFolder.id +
//         ' for window with ID ' + windowToCheck.id + '.')
// 			}

// 			if (isFunction(callback)) callback(matchingSessionFolder)
// 		}

// 		var compareTabsToBookmarks = (tabs, bookmarks) => {
// 			if (tabs.length !== bookmarks.length) {
// 				return false
// 			}

// 			for (var i = 0; i < tabs.length && i < bookmarks.length; i++) {
// 				var tab = tabs[i]
// 				var bookmark = bookmarks[i]

// 				if (tab.index !== bookmark.index) {
// 					return false
// 				}
// 				if (tab.url !== bookmark.url) {
// 					return false
// 				}
// 			}
// 			return true
// 		}

// 		var tabs

// 		console.log('Checking if tab set is a saved session.')
// 		getTabs(windowToCheck)
// 	}

// 	// Private methods
// 	getSeshyFolder (callback) {
// 		var query = {
// 			'title': 'Seshy'
// 		}
// 		chrome.bookmarks.search(query, callback)
// 	}

// 	getAllSessionFolders (callback) {
// 		this.getSeshyFolder(getSessionFolders)

// 		function getSessionFolders (bookmarkTreeNodes) {
// 			var seshyFolder = bookmarkTreeNodes[0]
// 			chrome.bookmarks.getSubTree(seshyFolder.id, returnChildren)
// 		}

// 		function returnChildren (seshyFolderSearchResults) {
// 			var seshyFolder = seshyFolderSearchResults[0]
// 			callback(seshyFolder.children)
// 		}
// 	}

// 	getAllOpenWindows (callback) {
// 		chrome.windows.getAll({populate: true, windowTypes: ['normal']}, callback)
// 	}

// 	createSessionFolder (session, callback) {
// 		console.log(`Creating session folder for session named '${session.name}'.`)
// 		var bookmarkInfo = {
// 			'parentId': this.seshyFolderId,
// 			'title': session.name
// 		}
// 		chrome.bookmarks.create(bookmarkInfo, (bookmarkTreeNode) => {
// 			callback(bookmarkTreeNode)
// 		})
// 	}

// 	// TODO: No need for sessionFolderId anymore.
// 	saveOpenSessionTabs (session, callback) {
// 		session.updateWindow((updatedWindow) => {
// 			this.saveTabsAsBookmarks(updatedWindow.tabs, session.bookmarkFolder.id, callback)
// 		})
// 	}

// 	// TODO Use this function in `saveSession`.
// 	saveWindowAsBookmarkFolder (window, bookmarkFolderId, callback) {
// 		var getBookmarksInFolder = (bookmarkFolderId) => {
// 			chrome.bookmarks.getChildren(bookmarkFolderId, removeBookmarksInFolder)
// 		}

// 		var removeBookmarksInFolder = (bookmarkTreeNodes) => {
// 			if (chrome.runtime.lastError) {
// 				console.info('Tried to save but bookmark folder was not found. Must have been removed since the tab updated ' +
//         'handler was called.')
// 				callback()
// 			} else {
// 				this.removeBookmarks(bookmarkTreeNodes, callSaveTabsAsBookmarks)
// 			}
// 		}

// 		var callSaveTabsAsBookmarks = () => {
// 			this.saveTabsAsBookmarks(window.tabs, bookmarkFolderId, callback)
// 		}

// 		getBookmarksInFolder(bookmarkFolderId)
// 	}

// 	saveTabsAsBookmarks (tabs, bookmarkFolderId, callback) {
// 		console.info('Creating %d bookmarks.', tabs.length)
// 		// TODO: Validate bookmarks have URLs otherwise they become folders
// 		// From the docs: "If url is NULL or missing, it will be a folder."
// 		if (!tabs.every(tab => !!tab.url)) {
// 			throw new Error(`Tabs don't all have URLs which means bookmark folders will be created instead of bookmarks: ${tabs}`)
// 		}
// 		for (var i = 0; i < tabs.length; i++) {
// 			console.info('Creating bookmark %d', i + 1)
// 			var tab = tabs[i]

// 			var createProperties = {
// 				'parentId': bookmarkFolderId,
// 				'title': 'Tab ' + i,
// 				'index': tab.index,
// 				'url': tab.url
// 			}

// 			if (i === tabs.length - 1) {
// 				chrome.bookmarks.create(createProperties, callback)
// 				console.debug(`Saved bookmark ${createProperties.url}`)
// 			} else {
// 				chrome.bookmarks.create(createProperties)
// 				console.debug(`Saved bookmark ${createProperties.url}`)
// 			}
// 		}
// 	}

// 	removeBookmarks (bookmarkTreeNodes, callback) {
// 		console.info('Removing %d tabs.', bookmarkTreeNodes.length)
// 		for (var i = 0; i < bookmarkTreeNodes.length; i++) {
// 			console.info('Removing tab %d', i + 1)
// 			var bookmarkTreeNode = bookmarkTreeNodes[i]
// 			chrome.bookmarks.remove(bookmarkTreeNode.id)
// 			console.debug(`Removed bookmark ${bookmarkTreeNode.id}`)

// 			if (i === bookmarkTreeNodes.length - 1 && isFunction(callback)) {
// 				callback()
// 			}
// 		}
// 	}

// 	// TODO: Duplicate of the function in api.js
// 	setActionIconToSaved () {
// 		chrome.action.setIcon({path: '../ui/status/saved.png'})
// 	}
// }

// export function Session (aWindow, bookmarkFolder) {
// 	if (!aWindow && !bookmarkFolder) {
// 		throw Error('A session must have either a window or a bookmarks folder.')
// 	}

// 	this.name = bookmarkFolder ? bookmarkFolder.title : 'Unsaved Session'
// 	this.window = aWindow || null
// 	this.bookmarkFolder = bookmarkFolder || null
// 	// this.tabs = aWindow ? aWindow.tabs : bookmarkFolder.children

// 	var listId = aWindow ? 'currently-open-sessions' : 'saved-sessions'
// 	var sessionList = document.getElementById(listId)

// 	var sessionElement = document.createElement('li')
// 	sessionElement.setAttribute('class', 'session-card mdc-list-item mdc-theme--background mdc-elevation--z2')
// 	sessionElement.setAttribute('tabindex', '0') // Make `li` element focusable.

// 	var tabsNumber = aWindow ? aWindow.tabs.length : bookmarkFolder.children.length
// 	sessionElement.innerHTML = this.getSessionInnerHtml(this.name, tabsNumber, this.saved())
// 	sessionList.appendChild(sessionElement)

// 	sessionElement.seshySession = this // So this created instance is always easily accessible.
// 	this.element = sessionElement

// 	Session.prototype.addEventListeners.call(this)
// 	// TODO Find out why this doesn't work. Throws syntax error because is not a function.
// 	// this.addEventListeners()
// }

// Session.prototype.currentlyOpen = function () {
// 	return Boolean(this.window)
// }

// Session.prototype.saved = function () {
// 	return Boolean(this.bookmarkFolder)
// }

// Session.prototype.updateWindow = function (callback) {
// 	var session = this
// 	function setWindowAndCallback (updatedWindow) {
// 		session.window = updatedWindow
// 		console.log(callback)
// 		callback(updatedWindow)
// 	}

// 	chrome.windows.get(this.window.id, {populate: true}, setWindowAndCallback)
// }

// Session.prototype.updateBookmarkFolder = function (callback) {
// 	var setBookmarkFolderAndCallback = (bookmarkTreeNodes) => {
// 		this.bookmarkFolder = bookmarkTreeNodes[0]
// 		callback(this.bookmarkFolder)
// 	}

// 	chrome.bookmarks.getSubTree(this.bookmarkFolder.id, setBookmarkFolderAndCallback)
// }

// Session.prototype.addEventListeners = function () {
// 	this.element.addEventListener('focus', () => {
// 		console.log('Focus event handler triggered. Removing selected class from existing elements.')
// 		var selectedSessions = document.getElementsByClassName('selected')
// 		for (var i = 0; i < selectedSessions.length; i++) {
// 			selectedSessions[i].classList.remove('selected')
// 		}
// 		console.log('Adding selected class to focused element.')
// 		this.element.classList.add('selected')
// 	})

// 	this.element.addEventListener('click', (event) => {
// 		var classList = event.target.classList
// 		if (classList.contains('edit-icon')) {
// 			if (this.sessionIsBeingRenamed(event.target)) {
// 				this.finishEditingSession(this)
// 			} else {
// 				this.startEditingSession(this)
// 			}
// 		} else if (classList.contains('resume-icon')) {
// 			this.resumeSession(this)
// 		} else if (classList.contains('delete-icon')) {
// 			this.deleteSession()
// 		}
// 	})

// 	this.keydownEventListener = (event) => {
// 		switch (event.key) {
// 		case 'r':
// 			this.startEditingSession(this)
// 			break

// 		case '#':
// 			this.deleteSession()
// 			break

// 		default: return
// 		}
// 		event.preventDefault()
// 	}

// 	this.enterKeydownEventListener = (event) => {
// 		if (event.key === 'Enter') {
// 			if (this.sessionIsBeingRenamed(event.target)) {
// 				this.finishEditingSession(this)
// 				event.stopPropagation()
// 			} else {
// 				this.resumeSession()
// 				event.stopPropagation()
// 			}
// 		}
// 	}

// 	this.element.addEventListener('keydown', this.enterKeydownEventListener)
// 	this.element.addEventListener('keydown', this.keydownEventListener)
// }

// /**
//  * Pass a truthy value to set saved state icon to 'saved' or a falsey value to set it to 'unsaved'.
//  */
// Session.prototype.setSavedIconState = function (savedBoolean) {
// 	var savedStateIcon = this.element.getElementsByClassName('saved-state-icon')[0]
// 	if (savedBoolean) {
// 		savedStateIcon.textContent = 'bookmark'
// 	} else {
// 		savedStateIcon.textContent = 'bookmark_border'
// 	}
// }

// Session.prototype.startEditingSession = function (session, callback) {
// 	session.element.removeEventListener('keydown', session.keydownEventListener)
// 	document.removeEventListener('keydown', document.keydownEventListener)
// 	var sessionNameInput = session.element.getElementsByClassName('session-name-input')[0]
// 	sessionNameInput.readOnly = false
// 	sessionNameInput.select()
// 	var editIcon = session.element.getElementsByClassName('edit-icon')[0]
// 	this.changeEditIconToConfirmEditIcon(editIcon)
// 	if (isFunction(callback)) callback()
// }

// Session.prototype.finishEditingSession = function (session, callback) {
// 	var updateUiState = () => {
// 		session.element.addEventListener('keydown', session.keydownEventListener)
// 		document.addEventListener('keydown', document.keydownEventListener)
// 		var sessionNameInput = session.element.getElementsByClassName('session-name-input')[0]
// 		sessionNameInput.readOnly = true
// 		var editIcon = session.element.getElementsByClassName('edit-icon')[0]
// 		this.changeConfirmEditIconBackToEditIcon(editIcon)
// 		if (isFunction(callback)) callback()
// 	}

// 	this.finishRenamingSession(session, updateUiState)
// }

// Session.prototype.finishRenamingSession = function (session, callback) {
// 	if (session.saved()) {
// 		console.info('Renaming selected session.')
// 		this.renameSession()
// 	} else {
// 		console.info('Saving selected session.')
// 		this.saveSession()
// 	}
// 	if (isFunction(callback)) callback()
// }

// Session.prototype.changeEditIconToConfirmEditIcon = function (editIcon) {
// 	editIcon.textContent = 'done'
// 	editIcon.style.color = '#4CAF50'
// }

// Session.prototype.changeConfirmEditIconBackToEditIcon = function (editIcon) {
// 	editIcon.textContent = 'edit'
// 	editIcon.style.color = '#000'
// }

export default createSessionCards
