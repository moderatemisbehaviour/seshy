function saved () {
	chrome.action.setIcon({path: '../ui/status/saved.png'})
}

function saving () {
	chrome.action.setIcon({path: '../ui/status/saving.png'})
}

function unsaved () {
	chrome.action.setIcon({path: '../ui/status/unsaved.png'})
}

export default {
	saved,
	saving,
	unsaved,
}