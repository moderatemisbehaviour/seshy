var openNewTabThenExitActionPopup = (url) => {
	var createProperties = {url}
	chrome.tabs.create(createProperties)
	window.close()
}

var submitAFeatureRequest = () => {
	openNewTabThenExitActionPopup('https://github.com/moderatemisbehaviour/seshy/issues?q=is%3Aopen+is%3Aissue+label%3Aenhancement')
}

var reportABug = () => {
	openNewTabThenExitActionPopup('https://github.com/moderatemisbehaviour/seshy/issues?q=is%3Aopen+is%3Aissue+label%3Abug')
}

var seeOpenSourceCredits = () => {
	window.location.href = '/credits/index.html'
}

var setUp = () => {
	var submitAFeatureRequestElement = document.getElementById('submit-a-feature-request')
	var reportABugElement = document.getElementById('report-a-bug')
	var seeOpenSourceCreditsElement = document.getElementById('see-open-source-credits')

	submitAFeatureRequestElement.addEventListener('click', submitAFeatureRequest)
	reportABugElement.addEventListener('click', reportABug)
	seeOpenSourceCreditsElement.addEventListener('click', seeOpenSourceCredits)
}

setUp()
