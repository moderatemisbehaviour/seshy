import test from 'ava'

import openSavedSessionTracker from './index.js'

test.afterEach(() => {
	chrome.windows.getAll.flush()
	chrome.storage.local.get.flush()
	chrome.storage.local.remove.flush()
})

test('no IDs are removed when all windows are untracked', async t => {
	chrome.windows.getAll.resolves([
		{
			id: 1,
		},
		{
			id: 2,
		},
		{
			id: 3,
		},
	])
	chrome.storage.local.get.yields({
		1: '11',
		2: '12',
		3: '13',
	})
	chrome.storage.local.remove.yields()

	await openSavedSessionTracker.removeStaleWindowIds()

	t.assert(chrome.storage.local.remove.notCalled)
})

test('no IDs are removed when tracked windows are still open', async t => {
	chrome.windows.getAll.resolves([
		{
			id: 1,
		},
		{
			id: 2,
		},
		{
			id: 3,
		},
	])
	chrome.storage.local.get.yields({
		1: '11',
		2: '12',
		3: '13',
	})
	chrome.storage.local.remove.yields()

	await openSavedSessionTracker.removeStaleWindowIds()

	t.assert(chrome.storage.local.remove.notCalled)
})

test('one ID is removed when one tracked window is no longer open', async t => {
	chrome.windows.getAll.resolves([
		{
			id: 1,
		},
		{
			id: 3,
		},
	])
	chrome.storage.local.get.yields({
		1: '11',
		2: '12',
		3: '13',
	})
	chrome.storage.local.remove.yields()

	await openSavedSessionTracker.removeStaleWindowIds()

	t.assert(chrome.storage.local.remove.calledOnce)
	t.assert(chrome.storage.local.remove.calledWith(['2']))
})

test('three IDs are removed when three tracked windows are no longer open', async t => {
	chrome.windows.getAll.resolves([])
	chrome.storage.local.get.yields({
		1: '11',
		2: '12',
		3: '13',
	})
	chrome.storage.local.remove.yields()

	await openSavedSessionTracker.removeStaleWindowIds()

	t.assert(chrome.storage.local.remove.calledOnce)
	t.assert(chrome.storage.local.remove.calledWith(['1', '2', '3']))
})
