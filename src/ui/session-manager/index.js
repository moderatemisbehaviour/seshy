import * as mdc from 'material-components-web'

class ShelvedSessionManager {
	resume () {

	}

	remove () {

	}

	rename () {

	}
}

class UnsavedSessionManager {
	resume () {
		console.info('RESUMING')
	}

	remove () {

	}

	rename () {

	}
}

class UnshelvedSessionManager {
	resume () {

	}

	remove () {

	}

	rename () {

	}
}

export function factory(sessionCard) {
	const sessionType = sessionCard.dataset.type

	if (sessionType === 'unsaved') {
		return new UnsavedSessionManager()
	} else if (sessionType === 'unshelved') {
		return new UnshelvedSessionManager()
	} else if (sessionType === 'shelved') {
		return new ShelvedSessionManager()
	}

	throw new Error('Unknown session type', sessionType)
}

export function getSessionLists () {
	return document.getElementsByClassName('session-list')
}

export function getSessionsFromSessionList (sessionList) {
	return sessionList.getElementsByClassName('session-card')
}

export function initialiseMaterialComponents () {
	mdc.autoInit()
}

export async function focusCurrentlyOpenSession () {
	const currentlyOpenWindow = await chrome.windows.getCurrent(null)
	const sessionCard = document.querySelector(`[data-id="${currentlyOpenWindow.id}"]`)
	sessionCard.focus()
}

export default {
	factory,
	ShelvedSessionManager,
	UnsavedSessionManager,
	UnshelvedSessionManager,
}