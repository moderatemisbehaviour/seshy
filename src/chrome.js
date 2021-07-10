// TODO: Deprecate this module in favour of sinon mock module loaded by configuration
let chromeRealOrFake

if (chrome && chrome.bookmarks) {
	console.info('In an extension page env so using real chrome object.')
	chromeRealOrFake = chrome
} else {
	console.info('In a Node env so using a fake chrome object for basic checking that the extension hangs together.')
	// TODO: Return a bunch of test data and consider using a mock Chrome library.
	const fakeChrome = {
		bookmarks: {
			search: (query, callback) => {
				if (query.title === 'Seshy') {
					callback([{id: '1'}])
				}
			},
			getSubTree: (bookmarkFolderId, callback) => {
				callback([{
					id: '2',
					children: [
						{title: 'yo'}
					]
				}])
			}
		},
		storage: {
			local: {
				get: () => null
			}       
		}
	}
	chromeRealOrFake = fakeChrome
}

export default chromeRealOrFake
