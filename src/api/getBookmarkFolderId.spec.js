import test from 'ava'
import {getBookmarkFolderId} from './index.js'

const windowIdForSavedSession = 1
const windowIdForUnsavedSession = 2
const bookmarkFolderId = 7

test.before(() => {
	chrome.storage.local.get.withArgs(windowIdForSavedSession.toString()).yields({
		[windowIdForSavedSession]: bookmarkFolderId
	})
	chrome.storage.local.get.withArgs('2').yields({})
})

test('Returns bookmark folder ID if window ID is a key in local storage', async t => {
	const result = await getBookmarkFolderId(windowIdForSavedSession)
	t.is(result, bookmarkFolderId)
})

test('Returns null if window ID is not a key in local storage', async t => {
	const result = await getBookmarkFolderId(windowIdForUnsavedSession)
	t.is(result, null)
})
