// TODO Do something about all these.
/* global chrome saveSession resumeSession tabEqualToBookmark getSession getTabsOrBookmarksInfo createTabs
removeWindowToSessionFolderMapping deleteSession saveTestSession cleanUp getSeshyFolder
createSessionBookmarksFolder getAllLocalStorage openUnsavedTestSession */

describe('Creating sessions.', function () {
  beforeEach(function (done) {
    spyOn(chrome.storage.local, 'remove')
    openUnsavedTestSession((session) => {
      this.session = session
      done()
    })
  })

  it('Removes window to session mappings that have the same window ID as the newly opened window.', function (done) {
    // There is an event listener on removal of windows that removes session mappings but unfortunately this does
    // not work on the last window. Chrome closes before the cleanup can be done. Must therefore check on window
    // creation too.
    expect(chrome.storage.local.remove.calls.count()).toEqual(1)
    expect(chrome.storage.local.remove.calls.argsFor(0)).toEqual([this.session.window.id.toString()])
    done()
  })
})

describe('Saving sessions.', function () {
  beforeEach(function (done) {
    // TODO Extract this common setup into a test-data-creator function.
    var saveTestSessionAndCaptureSessionFolder = (session) => {
      this.session = session
      saveSession(session, done)
    }

    openUnsavedTestSession(saveTestSessionAndCaptureSessionFolder)
  })

  var assertBookmarks = (expectedTabSetNumber, sessionFolderBookmarks) => {
    var expectedTabsInfo = getTabsOrBookmarksInfo(null, true, expectedTabSetNumber)
    for (var i = 0; i < sessionFolderBookmarks.length; i++) {
      var bookmark = sessionFolderBookmarks[i]
      var expectedTabInfo = expectedTabsInfo[i]
      expect(bookmark.index).toEqual(expectedTabInfo.index)
      expect(bookmark.url).toEqual(expectedTabInfo.url)
    }
  }

  it('Saves a set of tabs as bookmarks in a folder.', function (done) {
    this.session.updateBookmarkFolder((updatedBookmarkFolder) => {
      assertBookmarks(1, this.session.bookmarkFolder.children)
      done()
    })
  })

  it('Saves an already saved session to the same session folder as before.', function (done) {
    var assertOneSessionFolder = (callback) => {
      getAllSessionFolders((sessionFolders) => {
        expect(sessionFolders.length).toBe(1)
        callback()
      })
    }

    var saveSessionAgain = () => {
      saveSession(this.session, getSessionFolderBookmarksAndAssert)
    }

    var getSessionFolderBookmarksAndAssert = () => {
      assertOneSessionFolder(done)
      // TODO Assert is actually the same session folder.
    }

    assertOneSessionFolder(saveSessionAgain)
  })

  it('Overwrites the bookmarks in a folder when an already saved session is saved again.', function (done) {
    // TODO This is probably redundant as the window is a property of the session anyway.
    var getTestWindow = () => {
      chrome.windows.get(this.session.window.id, {'populate': true}, (testWindow) => {
        this.testWindow = testWindow
        expect(testWindow.id).toBe(this.session.window.id)
        changeOpenTabs()
      })
    }

    var changeOpenTabs = () => {
      var tabs = this.testWindow.tabs
      this.expectedTabsInfo = getTabsOrBookmarksInfo(null, false, 2)
      for (var i = 0; i < tabs.length; i++) {
        var tabId = tabs[i].id
        chrome.tabs.update(tabId, {'url': this.expectedTabsInfo[i]['url']})
      }
      setTimeout(() => {
        saveSession(this.session, getSessionFolderBookmarksAndAssert)
      }, 1000)
    }

    var getSessionFolderBookmarksAndAssert = () => {
      getSessionFolderBookmarks(this.session.bookmarkFolder, captureSessionFolderBookmarksAndAssert)
    }

    var captureSessionFolderBookmarksAndAssert = (sessionFolderBookmarks) => {
      assertBookmarks(2, sessionFolderBookmarks)
      done()
    }

    getTestWindow()
  })

  xit('Saves shelved sessions when their window is closed.', function (done) {
    console.log('Unimplemented test.')
  })

  xit('Adds a window ID to session folder ID mapping in local storage.', function (done) {
    console.log('Unimplemented test.')
  })

  describe('Representation of saved state.', function () {
    beforeEach(function (done) {
      var saveTestSessionAndCaptureSession = (session) => {
        this.session = session
        done()
      }

      openUnsavedTestSession(saveTestSessionAndCaptureSession)
    })

    it('Fills the save icon blue when a session is saved.', function (done) {
      var savedClassAdded = () => {
        return this.session.element.classList.contains('saved')
      }
      expect(savedClassAdded()).toBe(false)

      saveSession(this.session, () => {
        expect(savedClassAdded()).toBe(true)
        done()
      })
    })
  })

  afterEach(function (done) {
    cleanUp(done)
  })
})

describe('Resuming sessions.', function () {
  describe('User restores a session from the session manager.', function () {
    beforeEach(function (done) {
      var saveTestSessionAndCaptureSessionFolderId = (session) => {
        this.session = session
        this.bookmarksInfo = getTabsOrBookmarksInfo(this.session.window.id, false)
        saveTestSession(this.session, captureSessionFolderId)
      }

      var captureSessionFolderId = (newSessionFolderId) => {
        this.sessionFolderId = newSessionFolderId
        chrome.windows.remove(this.session.window.id, () => {
          done()
        })
      }

      openUnsavedTestSession(saveTestSessionAndCaptureSessionFolderId)
    })

    it('Adds a window ID to session folder ID mapping in local storage.', function (done) {
      var assertWindowToSessionFolderMappingAdded = (allLocalStorageObject) => {
        var allLocalStorageKeys = Object.keys(allLocalStorageObject)

        var matchingLocalStorageKey
        var matchingLocalStorageKeyValue

        for (var i = 0; i < allLocalStorageKeys.length; i++) {
          var localStorageKey = allLocalStorageKeys[i]
          // Local storage is always returned as a string but will be comparing to an integer.
          localStorageKey = parseInt(localStorageKey)

          if (localStorageKey === this.windowId) {
            matchingLocalStorageKey = localStorageKey
            matchingLocalStorageKeyValue = allLocalStorageObject[this.windowId.toString()]
          }
        }
        expect(matchingLocalStorageKey).toBe(this.windowId)
        expect(matchingLocalStorageKeyValue).toBe(this.sessionFolderId)
        done()
      }

      resumeSession(this.sessionFolderId, (newWindow) => {
        this.windowId = newWindow.id
        chrome.storage.local.get(null, assertWindowToSessionFolderMappingAdded)
      })
    })

    it('Opens a window with all the tabs as they were when the session was saved.', function (done) {
      var assertSessionRestored = (newWindow, bookmarksInfo) => {
        var tabs = newWindow.tabs

        var expectedTabsNumber = bookmarksInfo.length
        expect(tabs.length).toBe(expectedTabsNumber)

        var allTabsEqualToBookmarks = true
        for (var i = 0; i++; i < tabs.length) {
          var tab = tabs[i]
          var bookmark = bookmarksInfo[i]
          if (tabEqualToBookmark(tab, bookmark)) {
            var allTabsEqualBookmarks = false
          }
        }
        expect(allTabsEqualToBookmarks).toBe(true)
        done()
      }

      resumeSession(this.sessionFolderId, (newWindow) => {
        assertSessionRestored(newWindow, this.bookmarksInfo)
      })
    })

    xit('Focuses the appropriate window if the session is already open.', function (done) {
      console.log('Unimplemented test.')
      done()
    })

    afterEach(function (done) {
      cleanUp(done)
    })
  })

  describe('Identifying existing session and prompting to resume.', function () {
    beforeEach(function (done) {
      var createSessionBookmarksFolderThenBookmarks = (bookmarkTreeNodes) => {
        createSessionBookmarksFolder(bookmarkTreeNodes, createBookmarks)
      }

      var createBookmarks = (bookmarksFolder) => {
        this.expectedBookmarkFolderId = bookmarksFolder.id
        var asBookmarks = true
        this.bookmarksInfo = getTabsOrBookmarksInfo(this.expectedBookmarkFolderId, asBookmarks)

        chrome.bookmarks.create(this.bookmarksInfo[0])
        chrome.bookmarks.create(this.bookmarksInfo[1])
        chrome.bookmarks.create(this.bookmarksInfo[2])
        chrome.bookmarks.create(this.bookmarksInfo[3], createWindow)
      }

      var createWindow = (bookmarkTreeNode) => {
        var tabUrls = getTabsOrBookmarksInfo(null, false, 1, true)
        var createData = {url: tabUrls}
        chrome.windows.create(createData, callTest)
      }

      var callTest = (testWindow) => {
        this.window = testWindow
        getSession(this.window, captureExistingSession) // Method under test.
      }

      var captureExistingSession = (actualBookmarkFolder) => {
        this.actualBookmarkFolderId = actualBookmarkFolder === null ? null : actualBookmarkFolder.id
        done()
      }

      getSeshyFolder(createSessionBookmarksFolderThenBookmarks)
    })

    afterEach(function (done) {
      cleanUp(done)
    })

    it('Should recognise when a set of opened tabs represents an existing session.', function () {
      expect(this.expectedBookmarkFolderId).toEqual(this.actualBookmarkFolderId)
    })
  })
})

describe('Ending sessions.', function () {
  beforeEach(function (done) {
    var addWindowToSessionMapping = (newWindow) => {
      this.windowId = newWindow.id
      var fakeSessionFolderId = 1
      var items = {}
      items[newWindow.id.toString()] = fakeSessionFolderId
      chrome.storage.local.set(items, done)
    }

    chrome.windows.create({}, addWindowToSessionMapping)
  })

  it('Removes any window to session folder mapping from local storage.', function (done) {
    var assertWindowToSessionFolderMappingRemoved = (allLocalStorageObject) => {
      var allLocalStorageKeys = Object.keys(allLocalStorageObject)

      var matchingLocalStorageKey = false
      var windowIdString = this.windowId.toString()

      for (var i = 0; i < allLocalStorageKeys.length; i++) {
        var localStorageKey = allLocalStorageKeys[i]
        if (localStorageKey === windowIdString) {
          matchingLocalStorageKey = true
        }
      }
      expect(matchingLocalStorageKey).toBe(false)
      done()
    }

    removeWindowToSessionFolderMapping(this.windowId, () => {
      getAllLocalStorage(assertWindowToSessionFolderMappingRemoved)
    }) // Method under test.
  })

  afterEach(function (done) {
    cleanUp(done)
  })
})

describe('Deleting sessions.', function () {
  beforeEach(function (done) {
    var saveTestSessionAndCaptureSessionFolderId = (newWindowId) => {
      this.windowId = newWindowId
      saveTestSession(this.windowId, captureSessionFolderId)
    }

    var captureSessionFolderId = (sessionFolderId) => {
      this.expectedDeletedSessionFolderId = sessionFolderId
      done()
    }

    openUnsavedTestSession(saveTestSessionAndCaptureSessionFolderId)
  })

  it('Deletes the session folder.', function (done) {
    var tryGetSessionFolder = (sessionFolderId) => {
      chrome.bookmarks.get(sessionFolderId.toString(), assertSessionFolderDeleted)
      this.sessionFolderDeleted = false
    }

    var assertSessionFolderDeleted = (sessionFolderId) => {
      if (chrome.runtime.lastError) {
        this.sessionFolderDeleted = true
      }
      expect(this.sessionFolderDeleted).toBe(true)
      done()
    }

    deleteSession(this.expectedDeletedSessionFolderId, tryGetSessionFolder) // Method under test.
  })

  afterEach(function (done) {
    cleanUp(done)
  })
})

describe('Browsing sessions.', function () {
  describe('Currently open sessions.', function () {
    beforeEach(function (done) {
      var callSetupThenDone = () => {
        setUp(done)
      }
      createAndSaveTestSession((session) => {
        resetTestContainer()
        callSetupThenDone()
      })
    })

    it('Shows the name of currently open saved sessions.', function (done) {
      var assertSessionNameShown = () => {
        var expectedText = 'Test Session'
        var currentlyOpenSessionList = document.getElementById('currently-open-sessions')
        var currentlyOpenSessions = currentlyOpenSessionList.getElementsByClassName('session-card')
        expect(currentlyOpenSessions.length).toBe(2)  // Includes spec runner window.
        var testSession = currentlyOpenSessions[1]
        var sessionNameInput = testSession.getElementsByClassName('session-name-input')[0]
        var actualText = sessionNameInput.value
        expect(actualText).toEqual(expectedText)
        done()
      }
      setTimeout(assertSessionNameShown, 500)
    })

    afterEach(function (done) {
      cleanUp(done)
    })
  })

  describe('Shelved sessions.', function () {
    beforeEach(function (done) {
      var callSetupThenDone = () => {
        setUp(done)
      }
      createAndSaveTestSession((session) => {
        resetTestContainer()
        chrome.storage.local.remove(session.window.id.toString(), callSetupThenDone)
      })
    })

    it('Shows the number of tabs in the session.', function (done) {
      var assertNumberOfTabsShown = () => {
        var expectedText = '4 tabs'
        var shelvedSessionsList = document.getElementById('saved-sessions')
        var shelvedSessions = shelvedSessionsList.getElementsByClassName('session-card')
        expect(shelvedSessions.length).toBe(1)
        var shelvedSession = shelvedSessions[0]
        var numberOfTabsSpan = shelvedSession.getElementsByClassName('tabs-number')[0]
        var actualText = numberOfTabsSpan.textContent.trim()
        expect(actualText).toEqual(expectedText)
        done()
      }
      setTimeout(assertNumberOfTabsShown, 500)
    })

    it('Shows all sessions in the \'Shelved Sessions\' list with a blue saved state icon ' +
       '(because all \'shelved\' sessions are by definition also \'saved\' sessions.)', function (done) {
         var expectedRgbColorValue = 'rgb(65, 105, 225)'
         var assertSavedStateIconColor = () => {
           var shelvedSessionsList = document.getElementById('saved-sessions')
           var shelvedSessions = shelvedSessionsList.getElementsByClassName('session-card')
           expect(shelvedSessions.length).toBe(1)
           var shelvedSession = shelvedSessions[0]
           var savedStateIcon = shelvedSession.getElementsByClassName('saved-state-icon')[0]
           var savedStateIconColor = window.getComputedStyle(savedStateIcon, null).getPropertyValue('color')

           expect(savedStateIconColor).toEqual(expectedRgbColorValue)
           done()
         }
         // TODO Find out why a setTimeout is necessary here. Style should be applied before `setUp` callsback.
         setTimeout(assertSavedStateIconColor, 500)
    })

    it('Shows the name of shelved sessions.', function (done) {
      var assertSessionNameShown = () => {
        var expectedText = 'Test Session'
        var shelvedSessionList = document.getElementById('saved-sessions')
        var shelvedSessions = shelvedSessionList.getElementsByClassName('session-card')
        expect(shelvedSessions.length).toBe(1)
        var shelvedSession = shelvedSessions[0]
        var sessionNameInput = shelvedSession.getElementsByClassName('session-name-input')[0]
        var actualText = sessionNameInput.value
        expect(actualText).toEqual(expectedText)
        done()
      }
      setTimeout(assertSessionNameShown, 500)
    })

    afterEach(function (done) {
      cleanUp(done)
    })
  })
})

xdescribe('Selecting sessions.', function () {
  beforeAll(function (done) {
    this.windowIds = []

    var createSessionManagerDom = (callback) => {
      this.container = document.getElementById('test-container')
      this.container.innerHTML = `
        <ul id="currently-open-sessions">
        </ul>
        <ul id="saved-sessions">
        </ul>
      `
      if (isFunction(callback)) callback()
    }

    var openThreeUnsavedTestSessions = () => {
      for (var i = 0; i < 3; i++) {
        openUnsavedTestSession((newWindowId) => {
          this.windowIds.push(newWindowId)
          this.tabsInfo = getTabsOrBookmarksInfo(this.windowId)
          if (this.windowIds.length === 3) {
            createSessionManagerDom(() => {
              setUp(() => {
                setTimeout(done, 1000)
              })
            })
          }
        })
      }
    }

    // TODO Get rid of this setTimeout to wait for Seshy bookmarks folder to be created when running this test by itself.
    openThreeUnsavedTestSessions()
  })

  afterAll(function (done) {
    cleanUp(done)
    console.log('FINISHED!')
  })

  it('Focuses the currently open session when opened.', function () {
    console.log('Asserting focused.')
    // Currently open session will be the last opened window and therefore the last one in the list.
    let currentlyOpenSession = this.container.getElementsByClassName('session-card')[3]
    let currentlyOpenSessionNameInput = currentlyOpenSession.getElementsByClassName('session-name-input')[0]
    expect(currentlyOpenSessionNameInput).toBe(document.activeElement)
  })

  it('Assigns \'selected\' class to session with focus.', function () {
    console.log('Asserting selected.')
    // Currently open session will be the last opened window and therefore the last one in the list.
    let currentlyOpenSession = this.container.getElementsByClassName('session-card')[3]
    expect(currentlyOpenSession.classList.contains('selected')).toBe(true)
  })

  it('Only ever assigns one session card the \'selected\' class.', function () {
    let currentlyOpenSession = this.container.getElementsByClassName('selected')
    expect(currentlyOpenSession.length).toBe(1)
  })

  xit('Creates an orange border around the currently open session.', () => {
    // Not implemented.
  })
})
