import test from 'ava'
import {persistSession} from './index.js'

const windowId = '1'
const bookmarkFolderId = '1'

const exampleDotCom = 'http://example.com/'
const githubDotCom = 'https://github.com/'
const playwrightDotCom = 'https://playwright.dev/'

test.afterEach(() => {
	chrome.windows.get.flush()
	chrome.bookmarks.getSubTree.flush()
	chrome.bookmarks.create.flush()
	chrome.bookmarks.move.flush()
})

// TODO: Find out how to use sinon in parallely executed tests, see: https://github.com/avajs/ava/issues/1066
test('One new tab creates one new bookmark', async t => {
	chrome.windows.get.withArgs(windowId).resolves({
		id: windowId,
		tabs: [
			{
				index: 0,
				title: 'Example',
				url: exampleDotCom,
			},
			{
				index: 1,
				title: 'GitHub',
				url: githubDotCom,
			}
		]
	})
	chrome.bookmarks.getSubTree.withArgs(bookmarkFolderId).resolves([{
		id: bookmarkFolderId,
		children: [
			{
				index: 0,
				title: 'Example',
				url: exampleDotCom,
			}
		]
	}])
	chrome.bookmarks.create.resolves({})

	await persistSession(windowId, bookmarkFolderId)

	t.assert(chrome.bookmarks.create.calledOnceWith({
		index: 1,
		parentId: bookmarkFolderId,
		title: 'GitHub',
		url: githubDotCom,
	}))
})

test('Two new tabs creates two new bookmarks', async t => {
	chrome.windows.get.withArgs(windowId).resolves({
		id: windowId,
		tabs: [
			{
				index: 0,
				title: 'Example',
				url: exampleDotCom,
			},
			{
				index: 1,
				title: 'GitHub',
				url: githubDotCom,
			},
			{
				index: 2,
				title: 'Playwright',
				url: playwrightDotCom,
			}
		]
	})
	chrome.bookmarks.getSubTree.withArgs(bookmarkFolderId).resolves([{
		id: bookmarkFolderId,
		children: [
			{
				index: 0,
				url: exampleDotCom
			}
		]
	}])
	chrome.bookmarks.create.resolves({})

	await persistSession(windowId, bookmarkFolderId)

	t.assert(chrome.bookmarks.create.calledTwice)
	t.assert(
		chrome.bookmarks.create.calledWith({
			index: 1,
			parentId: bookmarkFolderId,
			title: 'GitHub',
			url: githubDotCom,
		})
	)
	t.assert(
		chrome.bookmarks.create.calledWith(
			{
				index: 2,
				parentId: bookmarkFolderId,
				title: 'Playwright',
				url: playwrightDotCom
			}
		)
	)
})

test('One closed tab removes one bookmark', async t => {
	chrome.windows.get.withArgs(windowId).resolves({
		id: windowId,
		tabs: [
			{
				id: '1',
				index: 0,
				url: exampleDotCom,
			},
		]
	})
	chrome.bookmarks.getSubTree.withArgs(bookmarkFolderId).resolves([{
		id: bookmarkFolderId,
		children: [
			{
				id: '1',
				index: 0,
				url: exampleDotCom
			},
			{
				id: '2',
				index: 1,
				url: githubDotCom,
			}
		]
	}])
	chrome.bookmarks.create.resolves({})

	await persistSession(windowId, bookmarkFolderId)

	t.assert(chrome.bookmarks.remove.calledOnceWith('2'))
})

test('One tab moved moves one bookmark', async t => {
	chrome.windows.get.withArgs(windowId).resolves({
		id: windowId,
		tabs: [
			{
				id: '1',
				index: 0,
				url: exampleDotCom,
			},
			{
				id: '2',
				index: 1,
				url: playwrightDotCom,
			},
			{
				id: '3',
				index: 2,
				url: githubDotCom,
			}
		]
	})
	chrome.bookmarks.getSubTree.withArgs(bookmarkFolderId).resolves([{
		id: bookmarkFolderId,
		children: [
			{
				id: '1',
				index: 0,
				url: exampleDotCom,
			},
			{
				id: '3',
				index: 1,
				url: githubDotCom,
			},
			{
				id: '2',
				index: 2,
				url: playwrightDotCom,
			}
		]
	}])
	chrome.bookmarks.create.resolves({})
	chrome.bookmarks.move.resolves({})

	await persistSession(windowId, bookmarkFolderId)
	// TODO: Deal with this dumb bug that means you have to increment index by 1 when the bookmark is moving to a higher index than its current one: https://stackoverflow.com/questions/13264060/chrome-bookmarks-api-using-move-to-reorder-bookmarks-in-the-same-folder
	t.assert(chrome.bookmarks.move.calledTwice)
	t.assert(chrome.bookmarks.move.calledWith('2', {index: 2}))	
	t.assert(chrome.bookmarks.move.calledWith('3', {index: 1}))
})

// TODO: Add a test for when there are no children in the bookmark folder (in which case bookmarkFolder.children) is undefined