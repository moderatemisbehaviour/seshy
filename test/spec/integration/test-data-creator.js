/* global chrome saveSession resumeSession tabEqualToBookmark getSession seshyFolderId
removeWindowToSessionFolderMapping deleteSession isFunction initialise */

/**
 * Create a test session (which will create a window with some tabs) and save it (which will create a bookmark folder).
 */
function createAndSaveTestSession (callback) {
  var testSession = null;
  var captureBookmarkFolderThenCallback = (bookmarkFolder) => {
    callback(testSession)
  }
  var captureTestSessionThenSave = (session) => {
    testSession = session
    saveTestSession(session, captureBookmarkFolderThenCallback)
  }
  openUnsavedTestSession(captureTestSessionThenSave)
}

/**
 * Save passed session and callback with bookmark folder ID.
 */
function saveTestSession (session, callback) {
  var expectedSessionFolderId

  var createBookmarksThenSaveMapping = (sessionBookmarksFolder) => {
    session.bookmarkFolder = sessionBookmarksFolder
    expectedSessionFolderId = sessionBookmarksFolder.id

    createBookmarks(sessionBookmarksFolder, () => {
      addWindowToSessionMapping(session.window.id, expectedSessionFolderId, returnSessionFolderId)
    })
  }

  var returnSessionFolderId = () => {
    callback(expectedSessionFolderId)
  }

  getSeshyFolder((seshyFolder) => {
    createSessionBookmarksFolder(seshyFolder, createBookmarksThenSaveMapping)
  })
}

var createSessionBookmarksFolderThenBookmarks = (callback) => {
  var createBookmarks = (bookmarksFolder) => {
    var asBookmarks = true
    var bookmarksInfo = getTabsOrBookmarksInfo(bookmarksFolder.id, asBookmarks)

    chrome.bookmarks.create(bookmarksInfo[0])
    chrome.bookmarks.create(bookmarksInfo[1])
    chrome.bookmarks.create(bookmarksInfo[2])
    chrome.bookmarks.create(bookmarksInfo[3], () => {
      callback()
    })
  }

  getSeshyFolder((bookmarkTreeNodes) => {
    createSessionBookmarksFolder(bookmarkTreeNodes, createBookmarks)
  })
}

function openUnsavedTestSession (callback, tabSetNumber) {
  tabSetNumber = tabSetNumber || 1
  var createSession = (testWindow) => {
    var session = new Session(testWindow)
    if (isFunction(callback)) callback(session)
  }

  // chrome.windows.create({}, (testWindow) => {
  //   var tabsInfo = getTabsOrBookmarksInfo(testWindow.id, false, tabSetNumber)
  //   createTabs(tabsInfo, createSession)
  // })
  var tabUrls = getTabsOrBookmarksInfo(null, false, tabSetNumber, true)
  var createData = {
    url: tabUrls
  }
  chrome.windows.create(createData, createSession)
}

function createTabs (tabsInfo, callback) {
  chrome.tabs.create(tabsInfo[0])
  chrome.tabs.create(tabsInfo[1])
  if (isFunction(callback)) {
    chrome.tabs.create(tabsInfo[2], callback)
  } else {
    chrome.tabs.create(tabsInfo[2])
  }
}

function getTabsOrBookmarksInfo (windowOrParentId, asBookmarks, tabSetNumber, urlsOnly) {
  var tabSetNumber = tabSetNumber || 1
  var tabSetIndex = tabSetNumber - 1

  var tabUrls1 = [
    'chrome://extensions/',
    'chrome://settings/',
    'chrome://about/',
    'chrome://newtab/'
  ]
  var tabUrls2 = [
    'chrome://apps/',
    'chrome://downloads/',
    'chrome://history/',
    'chrome://newtab/'
  ]
  var tabUrls = [tabUrls1, tabUrls2]

  if (urlsOnly) return tabUrls[tabSetIndex]

  var tabsInfo = []
  for (var i = 0; i < 4; i++) {
    var tabInfo = {
      index: i,
      url: tabUrls[tabSetIndex][i]
    }
    if (windowOrParentId) {
      if (asBookmarks === true) {
        tabInfo.parentId = windowOrParentId
      } else {
        tabInfo.windowId = windowOrParentId
      }
    }
    tabsInfo[i] = tabInfo
  }

  return tabsInfo
}

function createSessionBookmarksFolder (bookmarkTreeNodes, callback) {
  var seshyFolder = bookmarkTreeNodes[0]
  var options = {
    'parentId': seshyFolder.id, // From seshy.js
    'title': 'Test Session'
  }
  chrome.bookmarks.create(options, callback)
}

function createBookmarks (sessionBookmarksFolder, callback) {
  var asBookmarks = true
  var sessionFolderId = sessionBookmarksFolder.id
  var bookmarksInfo = getTabsOrBookmarksInfo(sessionFolderId, asBookmarks)

  chrome.bookmarks.create(bookmarksInfo[0])
  chrome.bookmarks.create(bookmarksInfo[1])
  chrome.bookmarks.create(bookmarksInfo[2])

  if (isFunction(callback)) {
    chrome.bookmarks.create(bookmarksInfo[3], () => {
      callback(bookmarksInfo)
    })
  } else {
    chrome.bookmarks.create(bookmarksInfo[3])
  }
}

function addWindowToSessionMapping (windowId, expectedSessionFolderId, callback) {
  var items = {}
  items[windowId.toString()] = expectedSessionFolderId
  chrome.storage.local.set(items, () => {
    callback()
  })
}

function cleanUp (done) {
  getSessionFolders(removeBookmarkFolders)
  removeAllWindows()
  chrome.storage.local.clear()

  var currentlyOpenSessions = document.getElementById('currently-open-sessions')
  var savedSessions = document.getElementById('saved-sessions')
  currentlyOpenSessions.innerHTML = ''
  savedSessions.innerHTML = ''

  // Necessary because it takes time for above operations to complete.
  setTimeout(done, 1000)
}

function removeTestWindowThenClearStorage(testWindow, callback) {
  chrome.windows.remove(testWindow.id, () => {
    chrome.storage.local.clear(callback)
  })
}

function getSessionFolders (callback) {
  if (isFunction(callback)) {
    chrome.bookmarks.getChildren(seshyFolderId, callback)
  } else {
    chrome.bookmarks.getChildren(seshyFolderId)
  }
}

function getSessionFolderBookmarks(bookmarkFolder, callback) {
  var getSessionFolderChildren = (bookmarkTreeNodes) => {
    var sessionFolder = bookmarkTreeNodes[0]
    chrome.bookmarks.getChildren(sessionFolder.id, returnChildren)
  }

  var returnChildren = (bookmarkTreeNodes) => {
    callback(bookmarkTreeNodes)
  }

  chrome.bookmarks.getSubTree(bookmarkFolder.id, getSessionFolderChildren)
}

function removeBookmarkFolders (bookmarkTreeNodes) {
  for (var i = 0; i < bookmarkTreeNodes.length; i++) {
    var bookmarkTreeNode = bookmarkTreeNodes[i]
    chrome.bookmarks.removeTree(bookmarkTreeNode.id)
  }
}

function removeAllWindows () {
  chrome.windows.getAll({}, removeWindows)
}

function removeWindows (windows) {
  // Don't remove first window because it will have Jasmine test results.
  for (var i = 1; i < windows.length; i++) {
    var window = windows[i]
    chrome.windows.remove(window.id)
  }
}

function getSeshyFolder (callback) {
  var query = {
    'title': 'Seshy'
  }
  chrome.bookmarks.search(query, callback)
}

// ---===~ Local storage ~===-------------------------------------------------------------------------------------------
function getAllLocalStorage (callback) {
  chrome.storage.local.get(null, callback)
}
