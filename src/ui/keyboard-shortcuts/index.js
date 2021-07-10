import * as mdc from 'material-components-web'

import { getSessionLists, getSessionsFromSessionList } from '../session-manager/index.js'

export function initialiseKeyboardShortcutsDialog () {
	var keyboardShortcutsElement = document.querySelector('#keyboard-shortcuts')
	document.dialog = new mdc.dialog.MDCDialog(keyboardShortcutsElement)
	document.dialog.listen('MDCDialog:accept', () => {
		document.body.style.minHeight = 'initial'
	})
}

export function addKeyboardShortcuts () {
	document.addEventListener('keydown', (event) => {
		switch (event.key) {
		case 'ArrowLeft':
			selectLastSessionInPreviousSessionList()
			break

		case 'ArrowUp':
			selectPreviousSession()
			break

		case 'ArrowRight':
			selectFirstSessionInNextSessionList()
			break

		case 'ArrowDown':
			selectNextSession()
			break

		case '?':
			document.body.style.minHeight = '424px'
			document.dialog.show()
			break

		default: return // Exit this handler for other keys.
		}
		event.preventDefault() // Prevent the default action (scroll / move caret).
	})
}

function selectNextSession () {
	var sessionElement = getNextSession()
	if (sessionElement === null) {
		selectFirstSessionInNextSessionList()
	} else {
		sessionElement.focus()
	}
}

function selectPreviousSession () {
	var sessionElement = getPreviousSession()
	if (sessionElement === null) {
		selectLastSessionInPreviousSessionList()
	} else {
		sessionElement.focus()
	}
}

function selectFirstSessionInNextSessionList () {
	var nextSessionList = getNextSessionList()
	var firstSessionInNextSessionList = getSessionsFromSessionList(nextSessionList)[0]
	firstSessionInNextSessionList.focus()
}

function selectLastSessionInPreviousSessionList () {
	var previousSessionList = getPreviousSessionList()
	var sessions = getSessionsFromSessionList(previousSessionList)
	var lastSessionInPreviousSessionList = sessions[sessions.length - 1]
	lastSessionInPreviousSessionList.focus()
}

function getSelectedSession () {
	// Check if focused element is a session-card. Could be a session-name-input for example.
	var element = document.activeElement
	// if (element.tagName === 'BODY') {
	//   return document.querySelector('.session-card');
	// }
	if (element.classList.contains('session-card')) {
		return document.activeElement
	}
	for (var i = 0; i < 10; i++) {
		element = element.parentElement
		if (element.classList.contains('session-card')) {
			return element
		}
	}
	throw Error(`Save was called with unexpected element ${document.activeElement.tagName} focused.`)
}

function getNextSession () {
	var sessionElement = getSelectedSession()
	return sessionElement.nextElementSibling
}

function getPreviousSession () {
	var sessionElement = getSelectedSession()
	return sessionElement.previousElementSibling
}

function getNextSessionList () {
	var currentlySelectedSession = getSelectedSession()
	var currentSessionList = currentlySelectedSession.parentElement
	var sessionLists = getSessionLists()

	for (var i = 0; i < sessionLists.length; i++) {
		var sessionList = sessionLists[i]
		if (sessionList === currentSessionList) {
			var nextSessionListIndex = ++i % sessionLists.length
		}
	}

	return sessionLists[nextSessionListIndex]
}

function getPreviousSessionList () {
	var currentlySelectedSession = getSelectedSession()
	var currentSessionList = currentlySelectedSession.parentElement
	var sessionLists = getSessionLists()

	for (var i = 0; i < sessionLists.length; i++) {
		var sessionList = sessionLists[i]
		if (sessionList === currentSessionList) {
			var previousSessionListIndex = (sessionLists.length + --i) % sessionLists.length
			break // Otherwise infinite loop.
		}
	}

	return sessionLists[previousSessionListIndex]
}
