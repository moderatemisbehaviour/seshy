var openNewTabThenExitActionPopup = (url) => {
	var createProperties = {url}
	chrome.tabs.create(createProperties)
	window.close()
}

function Credit (name, description, websiteUrl, copyright, license) {
	copyright = typeof copyright === 'undefined' ? true : copyright
	license = typeof license === 'undefined' ? true : license

	var creditElement = document.createElement('li')
	creditElement.setAttribute('class', 'mdc-list-item')
	creditElement.setAttribute('tabindex', '0') // Make `li` element focusable.

	creditElement.innerHTML = getCreditInnerHtml(name, description, copyright, license)
	createWebsiteLinkClickListener(creditElement, websiteUrl)

	var creditList = document.getElementById('credit-list')
	creditList.appendChild(creditElement)
}

function getCreditInnerHtml (name, description, copyright, license) {
	var innerHtml = `
  <span class="mdc-list-item__text">
      ${name}
      <span class="mdc-list-item__secondary-text">
        ${description}
      </span>
  </span>
  <span class="mdc-list-item__meta">
    <button class="go-to-website-button" title="go to website">
      <i class="material-icons">open_in_browser</i>
    </button>
  `
	var fileName = name.toLowerCase().replace(/\s/g, '-')
	if (copyright) {
		innerHtml += `
    <a href="./copyrights/${fileName}">
      <button class="view-copright-button" title="view copyright">
        <i class="material-icons">copyright</i>
      </button>
    </a>
    `
	}
	if (license) {
		innerHtml += `
    <a href="./licenses/${fileName}">
      <button class="view-license-button" title="view license">
        <i class="material-icons">subject</i>
      </button>
    </a>
    `
	}
	innerHtml += '</span>'
	return innerHtml
}

function createWebsiteLinkClickListener (creditElement, websiteUrl) {
	var goToWebsiteButton = creditElement.getElementsByClassName('go-to-website-button')[0]
	goToWebsiteButton.addEventListener('click', () => {
		openNewTabThenExitActionPopup(websiteUrl)
	})
}

var setUp = () => {
	/* eslint-disable no-new */
	new Credit('Material Components for Web', 'For making the UI.', 'https://material.io/components/web/')
	new Credit('Jasmine', 'For testing.', 'https://jasmine.github.io/')
	new Credit('Selenium', 'For testing.', 'https://github.com/SeleniumHQ/selenium/wiki/WebDriverJs/')
	new Credit('Grunt', 'For building and automating development tasks.', 'https://gruntjs.com/', false, false)
	new Credit('ES Lint', 'For enforcing code style and quality.', 'https://eslint.org/', false, false)
	new Credit('Elementary OS', 'My favourite Linux distro.', 'https://elementary.io/', false, false)
	new Credit('NPM', 'For managing dependencies.', 'https://www.npmjs.com/', false, false)
	new Credit('Atom', 'For writing code.', 'https://atom.io/', false, false)
	new Credit('Atom IDE', 'For writing code better.', 'https://ide.atom.io/', false, false)
	new Credit('Travis', 'For building, testing, and publishing.', 'https://travis-ci.org/', false, false)
	/* eslint-enable no-new */
}

setUp()
