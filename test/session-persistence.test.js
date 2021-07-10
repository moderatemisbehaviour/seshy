import test from 'ava'
import {chromium} from 'playwright'

// TODO: Move to separate files.
const unsavedSessionName = 'Unsaved Session'

const exampleDotCom = 'http://example.com/'
const githubDotCom = 'https://github.com/'
const playwrightDotCom = 'https://playwright.dev/'

const urls = [
	exampleDotCom,
	githubDotCom,
	playwrightDotCom
]

test.beforeEach(async t => {
	const pathToExtension = 'build/'
	const userDataDir = `/tmp/seshy-development/test-runs/${parseInt(Math.random() * 1000000)}`
	console.log(userDataDir)

	const browserContext = t.context.browserContext = await chromium.launchPersistentContext(userDataDir,{
		headless: false,
		args: [
			`--disable-extensions-except=${pathToExtension}`,
			`--load-extension=${pathToExtension}`
		],
		// slowMo: 1000
	})

	const sessionManagerPage = t.context.sessionManagerPage = await browserContext.pages()[0]
	sessionManagerPage.on('pageerror', (error) => {
		console.error(error.message)
	})

	await sessionManagerPage.goto('chrome://extensions')
	await sessionManagerPage.click('#devMode')
	const extensionId = (await sessionManagerPage.innerText('#extension-id')).substring(4)
	await sessionManagerPage.goto(`chrome-extension://${extensionId}/index.html`)

	sessionManagerPage.setDefaultTimeout(5000) // Otherwise failed tests hang for ages if waitForEvent is never satisfied.
})

test.afterEach.always(async t => {
	if (process.env.PWDEBUG) await t.context.sessionManagerPage.waitForTimeout(1000000)
	await t.context.browserContext.close()
})

test('Saving, re-opening, then deleting sessions', async t => {
	const {sessionManagerPage} = t.context

	await sessionManagerPage.reload()
	// This is breaking the fourth wall a bit because its actually a window with the session manager that we're making assertions against.
	await assertOpenSessions(t, sessionManagerPage, [unsavedSessionName])

	const [window] = await createWindow(t, sessionManagerPage)
	await sessionManagerPage.reload() // TODO: Try replacing with page.waitForSelector(selector[, options])
	await assertOpenSessions(t, sessionManagerPage, [unsavedSessionName, unsavedSessionName])

	await createTabs(sessionManagerPage, window.id, urls)
	await closeNewTab(sessionManagerPage, window)

	const sessionName = 'Test session'
	await sessionManagerPage.waitForTimeout(1000) // Necessary because the window ID is not removed from the mapping in local storage before the closeWindow promise returns.
	await updateSessionName(sessionManagerPage, sessionName)
	await assertSessionName(t, sessionManagerPage, sessionName)

	await closeWindow(sessionManagerPage, window.id)
	await sessionManagerPage.reload()
	await assertOpenSessions(t, sessionManagerPage, [unsavedSessionName])
	await assertShelvedSessions(t, sessionManagerPage, [sessionName])

	await sessionManagerPage.reload()
	const [page, _] = await Promise.all([
		t.context.browserContext.waitForEvent('page', {timeout: 2000}),
		resumeSession(sessionManagerPage, sessionName)
	])

	await sessionManagerPage.waitForTimeout(1000) // TODO: Find out how to properly wait for resumed session ID to be added to mapping.
	await sessionManagerPage.reload()
	await assertOpenSessions(t, sessionManagerPage, [unsavedSessionName, sessionName])
	await assertShelvedSessions(t, sessionManagerPage, [])
	const unshelvedSessionWindow = await getCurrentWindow(sessionManagerPage)
	await assertWindowTabUrls(t, unshelvedSessionWindow, urls)

	t.is((await getWindows(sessionManagerPage)).length, 2)
	await Promise.all([
		page.waitForEvent('close', {timeout: 2000}), // This isn't picking up the default timeout for some reason >:[
		deleteSession(sessionManagerPage, sessionName)
	])
	t.is((await getWindows(sessionManagerPage)).length, 1)
	const sessions = await getSessionNames(sessionManagerPage)
	t.deepEqual(sessions, [unsavedSessionName])
})

test.todo('Saving, re-opening, then deleting sessions (with keyboard shortcuts)')

// TODO: Create a SesssionManagerPageAsserter or something like that to avoid passing it as an arg all the time.
async function assertOpenSessions(t, sessionManagerPage, expectedUnsavedSessionNames) {
	const unsavedSessionNames = await sessionManagerPage.$$eval('#currently-open-sessions .session-card input', inputs => inputs.map(input => input.value))
	t.deepEqual(unsavedSessionNames, expectedUnsavedSessionNames)
}

async function assertShelvedSessions(t, sessionManagerPage, expectedShelvedSessionNames) {
	const shelvedSessionNames = await sessionManagerPage.$$eval('#saved-sessions .session-card input', inputs => inputs.map(input => input.value))
	t.deepEqual(shelvedSessionNames, expectedShelvedSessionNames)
}

async function assertSessionName(t, sessionManagerPage, name) {
	const sessionCardInput = await sessionManagerPage.$('.session-card:nth-child(2) .session-name-input')
	const sessionName = await sessionCardInput.evaluate(input => input.value)
	t.is(sessionName, name)
}

async function createWindow(t, sessionManagerPage) {
	const [page, window] = await Promise.all([
		t.context.browserContext.waitForEvent('page'),
		sessionManagerPage.evaluate(() => new Promise(resolve => {
			chrome.windows.create(window => {
				resolve(window)
			})
		})),
	])
	return [window, page]
}

async function createTab(sessionManagerPage, createProperties) {
	return await sessionManagerPage.evaluate(createProperties => new Promise(resolve => {
		chrome.tabs.create(
			createProperties,
			tab => resolve(tab)
		)
	}), createProperties)
}

async function closeNewTab(sessionManagerPage, window) {
	const newTab = window.tabs[0]
	return await sessionManagerPage.evaluate(newTab => new Promise(resolve => {
		chrome.tabs.remove(newTab.id, resolve)
	}), newTab)
}

async function createTabs(sessionManagerPage, windowId, urls) {
	await Promise.all(urls.map(url => 
		createTab(sessionManagerPage, {
			windowId,
			url,
		})
	))
	const pages = await sessionManagerPage.context().pages()
	const openedPages = pages.filter(page => urls.includes(page.url()))
	await Promise.all(openedPages.map(openedPage => openedPage.waitForLoadState()))
}

async function updateSessionName (sessionManagerPage, name) {
	const editButton = await sessionManagerPage.$('.session-card:nth-child(2) .edit-button')
	await editButton.click()
	await sessionManagerPage.keyboard.type(name)
	await editButton.click()
}

async function closeWindow (sessionManagerPage, windowId) {
	const window = await sessionManagerPage.evaluate(windowId => new Promise(resolve => {
		chrome.windows.remove(windowId, resolve)
	}), windowId)
	await sessionManagerPage.waitForTimeout(1000) // Necessary because it returns before the window is actually considered closed by Chrome. Wait on page close doesn't work because that's only one tab.
	return window
}

async function resumeSession (sessionManagerPage, sessionName) {
	const resumeButton = await sessionManagerPage.$(`.session-card:has(.session-name-input[value="${sessionName}"]) .resume-button`)
	await resumeButton.click()
}

async function getCurrentWindow(sessionManagerPage) {
	return await sessionManagerPage.evaluate(() => new Promise(resolve => {
		chrome.windows.getLastFocused({populate: true}, window => {
			resolve(window)
		})
	}))
}

async function getWindows(sessionManagerPage) {
	return await sessionManagerPage.evaluate(() => new Promise(resolve => {
		chrome.windows.getAll({populate: true}, windows => {
			resolve(windows)
		})
	}))
}

async function assertWindowTabUrls(t, window, urls) {
	const windowTabUrls = window.tabs.map(tab => tab.url)
	t.deepEqual(urls, windowTabUrls)
}

async function deleteSession(sessionManagerPage, sessionName) {
	const deleteButton = await sessionManagerPage.$(`.session-card:has(.session-name-input[value="${sessionName}"]) .delete-button`)
	await deleteButton.click()
}

async function getSessionNames(sessionManagerPage) {
	const sessionNameInputs = await sessionManagerPage.$$('.session-name-input')
	const sessionNames = await Promise.all(sessionNameInputs.map(session => session.getAttribute('value')))
	return sessionNames
}