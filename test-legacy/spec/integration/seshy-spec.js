/* global chrome */

import { getCurrentlyOpenSessionElements, isFunction, asyncLoop } from '/js/util.js'
import { BookmarkPersistenceManager } from '/js/persistence.js'
import { TestDataCreator } from '/test/spec/integration/test-data-creator.js'
import { SessionManager } from '/js/index.js'
import {
  setActionIconToUnsaved, setActionIconToSaved, setActionIconToSaving
} from '/js/api.js'
import { assertSessionWindowTabs } from '/test/spec/assertions.js'

describe('Integration tests.', function () {
  beforeAll(function (done) {
    this.bookmarkPersistenceManager = new BookmarkPersistenceManager()
    this.sessionManager = new SessionManager()
    this.testDataCreator = new TestDataCreator()
    console.log('Waiting for seshyFolder variable to be populated.')
    setTimeout(done, 1000) // Wait for initialise() to create Seshy folder.
  })

  describe('Creating sessions.', function () {
    beforeEach(function (done) {
      spyOn(chrome.storage.local, 'remove')
      this.testDataCreator.openUnsavedTestSession((session) => {
        this.session = session
        done()
      })
    })

    it('Removes window to session mappings that have the same window ID as the newly opened window.', function (done) {
      // There is an event listener on removal of windows that removes session mappings but unfortunately this does
      // not work on the last window. Chrome closes before the cleanup can be done. Must therefore check on window
      // creation too.
      expect(chrome.storage.local.remove.calls.count()).toEqual(1)
      expect(chrome.storage.local.remove.calls.argsFor(0)).toEqual([
        this.session.window.id.toString()
      ])
      done()
    })

    afterEach(function (done) {
      this.testDataCreator.cleanUp(done)
    })
  })

  describe('Saving sessions.', function () {
    describe('Saves open sessions as they are updated.', function () {
      beforeEach(function (done) {
        this.assertBookmarks = function (expectedTabSetNumber, sessionFolderBookmarks) {
          var expectedTabsInfo = this.testDataCreator.getTabsOrBookmarksInfo(null, true, expectedTabSetNumber)
          for (var i = 0; i < sessionFolderBookmarks.length; i++) {
            var bookmark = sessionFolderBookmarks[i]
            var expectedTabInfo = expectedTabsInfo[i]
            expect(bookmark.index).toEqual(expectedTabInfo.index)
            expect(bookmark.url).toEqual(expectedTabInfo.url)
          }
        }

        this.testDataCreator.createAndSaveTestSession((session) => {
          this.session = session
          done()
        })
      })

      it('Saves a set of tabs as bookmarks in a folder.', function (done) {
        this.session.updateBookmarkFolder((updatedBookmarkFolder) => {
          this.assertBookmarks(1, this.session.bookmarkFolder.children)
          done()
        })
      })

      it('Saves an already saved session to the same session folder as before.', function (done) {
        var assertOneSessionFolder = (callback) => {
          this.bookmarkPersistenceManager.getAllSessionFolders((sessionFolders) => {
            expect(sessionFolders.length).toBe(1)
            callback()
          })
        }

        var saveSessionAgain = () => {
          this.bookmarkPersistenceManager.saveSession(this.session, getSessionFolderBookmarksAndAssert)
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
          chrome.windows.get(
            this.session.window.id,
            {populate: true},
            testWindow => {
              this.testWindow = testWindow
              expect(testWindow.id).toBe(this.session.window.id)
              changeOpenTabs()
            }
          )
        }

        var changeOpenTabs = () => {
          var tabs = this.testWindow.tabs
          this.expectedTabsInfo = this.testDataCreator.getTabsOrBookmarksInfo(null, false, 2)
          for (var i = 0; i < tabs.length; i++) {
            var tabId = tabs[i].id
            chrome.tabs.update(tabId, {url: this.expectedTabsInfo[i]['url']})
          }
          setTimeout(() => {
            this.bookmarkPersistenceManager.saveSession(this.session, getSessionFolderBookmarksAndAssert)
          }, 1000)
        }

        var getSessionFolderBookmarksAndAssert = () => {
          this.testDataCreator.getSessionFolderBookmarks(this.session.bookmarkFolder, captureSessionFolderBookmarksAndAssert)
        }

        var captureSessionFolderBookmarksAndAssert = (sessionFolderBookmarks) => {
          this.assertBookmarks(2, sessionFolderBookmarks)
          done()
        }

        getTestWindow()
      })
    })

    describe("Saving of 'saved' sessions when their window is closed.", function () {
      beforeEach(function (done) {
        this.testDataCreator.createAndSaveTestSession((session) => {
          this.session = session
          done()
        })
      })

      it('Saves the session again when a tab is added.', function (done) {
        var sessionWindowId = this.session.window.id

        var closeWindow = () => {
          chrome.windows.remove(this.session.window.id, () => {
            // Give event listener time to remove window-to-session-folder-mapping so that session correctly appears in
            // unsaved session list.
            setTimeout(resetSessionManager, 1000)
          })
        }

        var resetSessionManager = () => {
          this.testDataCreator.resetTestContainer()
          this.sessionManager.setUp(() => {
            var savedSessionsList = document.getElementById('saved-sessions')
            var savedSessionElements = savedSessionsList.getElementsByClassName(
              'session-card'
            )
            expect(savedSessionElements.length).toEqual(1)
            this.sessionElement = savedSessionElements[0]
            // TODO call `resumeSelectedSession` session instead.
            this.bookmarkPersistenceManager.resumeSession(this.sessionElement.seshySession, assertTabs)
          })
        }

        var assertTabs = () => {
          var sessionWindow = chrome.windows.getAll(
            {populate: true},
            windows => {
              var resumedSessionWindow = windows[1]
              expect(resumedSessionWindow.tabs.length).toEqual(5)
              expect(resumedSessionWindow.tabs[4].url).toEqual(this.expectedUrl)
              done()
            }
          )
        }

        this.expectedUrl = 'chrome://history/syncedTabs'
        var createProperties = {
          windowId: sessionWindowId,
          url: this.expectedUrl
        }
        chrome.tabs.create(createProperties, () => {
          setTimeout(closeWindow, 2000)
        })
      })

      xit("Saves the session again when a tab's URL is changed.", function () {
        console.log('Unimplemented test.')
      })

      xit('Saves the session again when a tab is removed.', function () {
        console.log('Unimplemented test.')
      })

      xit('Saves the session again when a tab is moved.', function () {
        console.log('Unimplemented test.')
      })
    })

    describe('Representation of saved state.', function () {
      describe('Browser action icon.', function () {
        beforeEach(function (done) {
          var captureSession = session => {
            this.session = session
            done()
          }

          this.testDataCreator.openUnsavedTestSession(captureSession)
        })

        it("Is an 'bookmark border' icon when the currently focused session is unsaved.", function (done) {
          var assertActionIconSetToUnsavedState = () => {
            expect(chrome.action.setIcon).toHaveBeenCalledWith({path: '../status/unsaved.png'})
            // TODO Assert icon is changed back to idle.
            done()
          }

          spyOn(chrome.action, 'setIcon')
          setTimeout(assertActionIconSetToUnsavedState, 1000)
        })

        it("Is a 'sync' icon whilst a session save is pending.", function (done) {
          var assertActionIconSetToSavingState = () => {
            expect(chrome.action.setIcon).toHaveBeenCalledWith({path: '../status/saving.png'})
            // TODO Assert icon is changed back to idle.
            done()
          }

          spyOn(chrome.action, 'setIcon')
          this.session.element.focus()
          this.session.saveSession(() => {
            setTimeout(assertActionIconSetToSavingState, 500)
          })
        })

        it("Is a 'bookmark' icon when the currently focused session is saved.", function (done) {
          var assertActionIconSetToSavedState = () => {
            expect(chrome.action.setIcon).toHaveBeenCalledWith({path: '../status/saved.png'})
            // TODO Assert icon is changed back to idle.
            done()
          }

          spyOn(chrome.action, 'setIcon')
          this.session.element.focus()
          this.bookmarkPersistenceManager.saveSession(this.session, () => {
            setTimeout(assertActionIconSetToSavedState, 500)
          })
        })
      })

      describe('Session cards in the session manager.', function () {
        beforeEach(function (done) {
          var saveTestSessionAndCaptureSession = session => {
            this.session = session
            done()
          }
          this.testDataCreator.openUnsavedTestSession(saveTestSessionAndCaptureSession)
        })

        it('Displays a bookmark icon on the session card when it is saved.', function (done) {
          var sessionStateIcon = this.session.element.getElementsByClassName(
            'saved-state-icon'
          )[0]
          expect(sessionStateIcon.textContent).toBe('bookmark_border')

          document.getElementsByClassName('session-card')[0].focus()
          this.session.saveSession(() => {
            expect(sessionStateIcon.textContent).toBe('bookmark')
            done()
          })
        })
      })
    })

    afterEach(function (done) {
      this.testDataCreator.cleanUp(done)
    })
  })

  describe('Resuming sessions.', function () {
    beforeEach(function () {
      // The spy is needed to verify that the window is focused.
      // For some reason the testing of focusing other windows does not work in the spec runner.
      // The window gains focus but the spec runner gains focus before the next line in the spec file can assert that
      // the window is focused.
      // Happy to settle for verification that the chrome API is called in this instance.
      spyOn(chrome.windows, 'update').and.callThrough()

      this.assertSessionWindowFocused = (sessionWindow) => {
        expect(chrome.windows.update.calls.count()).toBe(1)
        var actualArgs = chrome.windows.update.calls.argsFor(0)
        expect(actualArgs).toContain(sessionWindow.id)
        expect(actualArgs).toContain({'focused': true})
      }

      this.assertGoneToSession = (session, callback) => {
        this.assertSessionWindowFocused(session.window)
        var expectedTabs = this.testDataCreator.getTabsOrBookmarksInfo(session.window.id)
        assertSessionWindowTabs(session.window, expectedTabs)
        callback()
      }
    })

    describe('User resumes a session from the session manager.', function () {
      beforeEach(function (done) {
        this.testDataCreator.createAndSaveTestSession((session) => {
          this.session = session
          done()
        })
      })

      it('Resumes an unshelved session that is already focused by exiting the session manager.', function (done) {
        this.bookmarkPersistenceManager.resumeSession(this.session, () => {
          this.assertGoneToSession(this.session, done)
        })
      })

      it('Resumes an unshelved session that is not already focused by focusing it.', function (done) {
        this.testDataCreator.createAndSaveTestSession((session) => {
          this.sessionTwo = session
          this.bookmarkPersistenceManager.resumeSession(this.session, () => {
            this.assertGoneToSession(this.session, done)
          })
        })
      })

      it("Resumes a shelved session by creating a window with session's tabs and focusing it.", function (done) {
        var resumeSessionThenAssert = () => {
          this.bookmarkPersistenceManager.resumeSession(this.session, () => {
            this.assertGoneToSession(this.session, done)
          })
        }

        var removeWindowThenResumeSession = () => {
          chrome.windows.remove(this.session.window.id, resumeSessionThenAssert)
        }

        this.testDataCreator.createAndSaveTestSession(resumeSessionThenAssert)
      })

      afterEach(function (done) {
        this.testDataCreator.cleanUp(done)
      })
    })

    describe('Identifying existing session and prompting to resume.', function () {
      beforeEach(function (done) {
        var createTestSession = (sessionFolder) => {
          this.expectedBookmarkFolderId = sessionFolder.id
          this.testDataCreator.openUnsavedTestSession(callTest, 1)
        }

        var callTest = (session) => {
          this.window = session.window
          this.bookmarkPersistenceManager.getSession(this.window, captureExistingSession) // Method under test.
        }

        var captureExistingSession = actualBookmarkFolder => {
          this.actualBookmarkFolderId =
            actualBookmarkFolder === null ? null : actualBookmarkFolder.id
          done()
        }

        this.testDataCreator.createSessionBookmarksFolderThenBookmarks(createTestSession)
      })

      afterEach(function (done) {
        this.testDataCreator.cleanUp(done)
      })

      it('Should recognise when a set of opened tabs represents an existing session.', function () {
        expect(this.expectedBookmarkFolderId).toEqual(
          this.actualBookmarkFolderId
        )
      })
    })
  })

  describe('Ending sessions.', function () {
    beforeEach(function (done) {
      var addWindowToSessionMapping = newWindow => {
        this.windowId = newWindow.id
        var fakeSessionFolderId = 1
        var items = {}
        items[newWindow.id.toString()] = fakeSessionFolderId
        chrome.storage.local.set(items, done)
      }

      chrome.windows.create({}, addWindowToSessionMapping)
    })

    it('Removes any window to session folder mapping from local storage.', function (done) {
      var assertWindowToSessionFolderMappingRemoved = allLocalStorageObject => {
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

      this.bookmarkPersistenceManager.removeWindowToSessionFolderMapping(this.windowId, () => {
        this.testDataCreator.getAllLocalStorage(assertWindowToSessionFolderMappingRemoved)
      }) // Method under test.
    })

    afterEach(function (done) {
      this.testDataCreator.cleanUp(done)
    })
  })

  describe('Deleting sessions.', function () {
    var assertSessionDeleted = (session, callback) => {
      var assertSessionElementRemoved = (session, callback) => {
        var sessionElements = document.getElementsByClassName('session-card')
        var sessionElementRemoved = true

        for (var i = 0; i < sessionElements.length; i++) {
          var sessionElement = sessionElements[i]
          if (sessionElement === session.element) {
            sessionElementRemoved = false
          }
        }

        expect(sessionElementRemoved).toBe(true)
        callback()
      }

      var tryGetSessionFolder = () => {
        if (session.bookmarkFolder && session.bookmarkFolder.id) {
          chrome.bookmarks.get(
            session.bookmarkFolder.id.toString(),
            assertBookmarkFolderDeleted
          )
        } else {
          callback()
        }
      }

      var assertBookmarkFolderDeleted = bookmarkFolderId => {
        var sessionFolderDeleted = false
        if (chrome.runtime.lastError) {
          sessionFolderDeleted = true
        }
        expect(sessionFolderDeleted).toBe(true)
        callback()
      }

      assertSessionElementRemoved(session, tryGetSessionFolder)
    }

    describe('Unsaved sessions.', function () {
      beforeEach(function (done) {
        this.testDataCreator.openUnsavedTestSession((session) => {
          this.session = session
          done()
        })
      })

      it('Deletes an unsaved session by removing its window.', function (done) {
        this.bookmarkPersistenceManager.deleteSession(this.session, () => {
          assertSessionDeleted(this.session, done)
        })
      })
    })

    describe('Saved sessions.', function () {
      beforeEach(function (done) {
        this.testDataCreator.createAndSaveTestSession((session) => {
          this.session = session
          done()
        })
      })

      it('Deletes a shelved session by removing its bookmark folder.', function (done) {
        var assertSessionDeletedThenDone = () => {
          assertSessionDeleted(this.session, done)
        }

        chrome.windows.remove(this.session.window.id, () => {
          this.session.window = null
          this.bookmarkPersistenceManager.deleteSession(this.session, assertSessionDeletedThenDone)
        })
      })

      it('Deletes an unshelved session by removing its window and bookmark folder.', function (done) {
        var assertSessionDeletedThenDone = () => {
          assertSessionDeleted(this.session, done)
        }

        this.bookmarkPersistenceManager.deleteSession(this.session, assertSessionDeletedThenDone)
      })
    })

    describe('Deleting a session with keyboard shortcuts.', function () {
      beforeEach(function (done) {
        this.testDataCreator.openThreeUnsavedTestSessions((sessions) => {
          this.sessions = sessions
          this.sessionElements = document.getElementsByClassName('session-card')
          this.secondSessionElement = this.sessionElements[1]
          this.thirdSessionElement = this.sessionElements[2]
          this.secondSessionElement.focus()
          this.secondSessionElement.classList.add('selected')
          done()
        })
      })

      xit('Selects the next session.', function (done) {
        // See TODOs for commented out implementation.
        var assertSelectedSession = () => {
          var selectedSession = document.activeElement
          expect(selectedSession).toEqual(this.thirdSessionElement)
          done()
        }

        this.sessions[1].deleteSession(assertSelectedSession)
      })
    })

    afterEach(function (done) {
      this.testDataCreator.cleanUp(done)
    })
  })

  describe('Browsing sessions.', function () {
    describe('Currently open sessions.', function () {
      beforeEach(function (done) {
        this.windows = []

        var createWindow = (uselessNumber, callback) => {
          chrome.windows.create(null, aWindow => {
            this.windows.push(aWindow)
            callback()
          })
        }

        var createSavedSecondSession = () => {
          this.testDataCreator.getSeshyFolder((seshyFolder) => {
            this.testDataCreator.createSessionBookmarksFolder(seshyFolder, storeWindowToBookmarkFolderMapping)
          })
        }

        var storeWindowToBookmarkFolderMapping = (bookmarkFolder) => {
          this.bookmarkPersistenceManager.storeWindowToSessionFolderMapping(this.windows[0].id, bookmarkFolder.id, initialiseSessionManager)
        }

        var initialiseSessionManager = () => {
          this.sessionManager.setUp(done)
        }

        asyncLoop([1, 2], createWindow, createSavedSecondSession)
      })

      it('Shows the name of currently open saved sessions.', function (done) {
        var assertSessionNameShown = () => {
          var currentlyOpenSessions = getCurrentlyOpenSessionElements()
          expect(currentlyOpenSessions.length).toBe(3) // Includes spec runner window.

          var expectedSessionNames = [
            'Unsaved Session',
            'Test Session',
            'Unsaved Session'
          ]

          for (var i = 0; i < currentlyOpenSessions.length; i++) {
            var savedSession = currentlyOpenSessions[i]
            var sessionNameInput = savedSession.getElementsByClassName(
              'session-name-input'
            )[0]
            var expectedText = expectedSessionNames[i]
            var actualText = sessionNameInput.value
            expect(actualText).toEqual(expectedText)
          }

          done()
        }

        setTimeout(assertSessionNameShown, 500)
      })

      it('Shows sessions in the order they were opened.', function (done) {
        var assertSessionsOrder = () => {
          var currentlyOpenSessionElements = getCurrentlyOpenSessionElements()

          var expectedWindowIdsInOrder = []
          for (let i = 0; i < currentlyOpenSessionElements.length; i++) {
            let windowId =
              currentlyOpenSessionElements[i].seshySession.window.id
            expectedWindowIdsInOrder.push(windowId)
          }

          var actualWindowIdsInOrder = []
          for (let i = 0; i < currentlyOpenSessionElements.length; i++) {
            let windowId =
              currentlyOpenSessionElements[i].seshySession.window.id
            actualWindowIdsInOrder.push(windowId)
          }

          expect(expectedWindowIdsInOrder).toEqual(actualWindowIdsInOrder)
          done()
        }

        assertSessionsOrder()
      })

      afterEach(function (done) {
        this.testDataCreator.cleanUp(done)
      })
    })

    describe('Shelved sessions.', function () {
      beforeEach(function (done) {
        var callSetupThenDone = () => {
          this.sessionManager.setUp(done)
        }

        this.testDataCreator.createAndSaveTestSession((session) => {
          this.testDataCreator.resetTestContainer()
          chrome.storage.local.remove(session.window.id.toString(), callSetupThenDone)
        })
      })

      it('Shows the number of tabs in the session.', function (done) {
        var assertNumberOfTabsShown = () => {
          var expectedText = '4 tabs'
          var shelvedSessionsList = document.getElementById('saved-sessions')
          var shelvedSessions = shelvedSessionsList.getElementsByClassName(
            'session-card'
          )
          expect(shelvedSessions.length).toBe(1)
          var shelvedSession = shelvedSessions[0]
          var numberOfTabsSpan = shelvedSession.getElementsByClassName(
            'tabs-number'
          )[0]
          var actualText = numberOfTabsSpan.textContent.trim()
          expect(actualText).toEqual(expectedText)
          done()
        }
        setTimeout(assertNumberOfTabsShown, 500)
      })

      it(
        "Shows all sessions in the 'Shelved Sessions' list with a bookmark icon " +
          "(because all 'shelved' sessions are by definition also 'saved' sessions.)",
        function (done) {
          var expectedIconName = 'bookmark'

          var assertBookmarkIconOnPatientCard = () => {
            var shelvedSessionsList = document.getElementById('saved-sessions')
            var shelvedSessions = shelvedSessionsList.getElementsByClassName(
              'session-card'
            )
            expect(shelvedSessions.length).toBe(1)
            var shelvedSession = shelvedSessions[0]
            var savedStateIcon = shelvedSession.getElementsByClassName(
              'saved-state-icon'
            )[0]
            var actualIconName = savedStateIcon.textContent

            expect(actualIconName).toEqual(expectedIconName)
            done()
          }
          // TODO Find out why a setTimeout is necessary here. Style should be applied before `setUp` callsback.
          setTimeout(assertBookmarkIconOnPatientCard, 500)
        }
      )

      it('Shows the name of shelved sessions.', function (done) {
        var assertSessionNameShown = () => {
          var expectedText = 'Test Session'
          var shelvedSessionList = document.getElementById('saved-sessions')
          var shelvedSessions = shelvedSessionList.getElementsByClassName(
            'session-card'
          )
          expect(shelvedSessions.length).toBe(1)
          var shelvedSession = shelvedSessions[0]
          var sessionNameInput = shelvedSession.getElementsByClassName(
            'session-name-input'
          )[0]
          var actualText = sessionNameInput.value
          expect(actualText).toEqual(expectedText)
          done()
        }
        setTimeout(assertSessionNameShown, 500)
      })

      afterEach(function (done) {
        this.testDataCreator.cleanUp(done)
      })
    })

    xdescribe('Selecting sessions.', function () {
      beforeAll(function (done) {
        this.windowIds = []

        var createSessionManagerDom = callback => {
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
            this.testDataCreator.openUnsavedTestSession((newWindowId) => {
              this.windowIds.push(newWindowId)
              this.tabsInfo = this.testDataCreator.getTabsOrBookmarksInfo(this.windowId)
              if (this.windowIds.length === 3) {
                createSessionManagerDom(() => {
                  this.sessionManager.setUp(() => {
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
        this.testDataCreator.cleanUp(done)
        console.log('FINISHED!')
      })

      it('Focuses the currently open session when opened.', function () {
        console.log('Asserting focused.')
        // Currently open session will be the last opened window and therefore the last one in the list.
        let currentlyOpenSession = this.container.getElementsByClassName(
          'session-card'
        )[3]
        let currentlyOpenSessionNameInput = currentlyOpenSession.getElementsByClassName(
          'session-name-input'
        )[0]
        expect(currentlyOpenSessionNameInput).toBe(document.activeElement)
      })

      it("Assigns 'selected' class to session with focus.", function () {
        console.log('Asserting selected.')
        // Currently open session will be the last opened window and therefore the last one in the list.
        let currentlyOpenSession = this.container.getElementsByClassName(
          'session-card'
        )[3]
        expect(currentlyOpenSession.classList.contains('selected')).toBe(true)
      })

      it("Only ever assigns one session card the 'selected' class.", function () {
        let currentlyOpenSession = this.container.getElementsByClassName(
          'selected'
        )
        expect(currentlyOpenSession.length).toBe(1)
      })

      xit('Creates an orange border around the currently open session.', () => {
        // Not implemented.
      })
    })

    describe('Browser action icon.', function () {
      xit('Shows a tooltip on mouseover that provides information about the session for the current window.', function () {
        console.log('Unimplemented test.')
      })
    })
  })

  describe('Renaming sessions.', function () {
    beforeEach(function (done) {
      this.testDataCreator.createAndSaveThreeTestSessions((sessions) => {
        this.sessions = sessions
        this.secondSession = this.sessions[1]
        this.secondSessionEditIcon = this.secondSession.element.getElementsByClassName('edit-icon')[0]
        this.sessionManager.addKeyboardShortcuts()
        this.secondSession.element.focus()
        done()
      })
    })

    it("Starts the renaming when the 'edit' icon is clicked by focusing the session name input...", function (done) {
      expect(document.activeElement).toEqual(this.secondSession.element)
      this.secondSession.startEditingSession(this.secondSession, () => {
        var secondSessionNameInput = this.secondSession.element.getElementsByClassName('session-name-input')[0]
        expect(document.activeElement).toEqual(secondSessionNameInput)
        done()
      })
    })

    xit('...Or alternatively when the `r` button is pressed.', function (done) {
      console.log('Unimplemented test.')
      done()
    })

    it("Changes the 'edit' button to a 'done' button once the renaming has started.", function (done) {
      expect(this.secondSessionEditIcon.textContent).toEqual('edit')
      this.secondSession.startEditingSession(this.secondSession, () => {
        expect(this.secondSessionEditIcon.textContent).toEqual('done')
        done()
      })
    })

    it("Saves the renaming when the 'done' icon is clicked...", function (done) {
      var saveRenamingThenAssert = () => {
        secondSessionNameInput.value = 'Renamed Session'
        this.secondSession.finishEditingSession(this.secondSession, () => {
          assertSessionRenamed(this.secondSession, 'Renamed Session', done)
        })
      }

      var assertSessionRenamed = (session, expectedName, callback) => {
        session.updateBookmarkFolder(() => {
          expect(session.bookmarkFolder.title).toEqual(expectedName)
          expect(secondSessionNameInput.value).toEqual(expectedName)
          callback()
        })
      }

      var secondSessionNameInput = this.secondSession.element.getElementsByClassName('session-name-input')[0]
      this.secondSession.startEditingSession(this.secondSession, saveRenamingThenAssert)
    })

    xit('...Or alternatively when the `ENTER` key is pressed.', function (done) {
      console.log('Unimplemented test.')
    })

    xit(
      'Restores the session name to its original value if the session name input loses focus before confirming the ' +
        'renaming.',
      function (done) {
        console.log('Unimplemented test.')
        done()
      }
    )

    xit('Saves the session if was not already saved.', function (done) {
      console.log('Unimplemented test.')
      done()
    })

    xit('Disables the keyboard shortcuts whilst renaming.', function (done) {
      console.log('Unimplemented test.')
      done()
    })

    afterEach(function (done) {
      this.testDataCreator.cleanUp(done)
    })
  })
})
