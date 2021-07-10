import 'material-components-web/dist/material-components-web.css'
import './material-icons/index.css'

import './index.css'
import {
	addKeyboardShortcuts,
	initialiseKeyboardShortcutsDialog
} from './keyboard-shortcuts/index.js'
import {
	focusCurrentlyOpenSession,
	initialiseMaterialComponents,
} from './session-manager/index.js'
import createSessionCards from './session-manager/createSessionCards.js'

(async function (){
	await createSessionCards()
	focusCurrentlyOpenSession()
	addKeyboardShortcuts()
	initialiseMaterialComponents()
	// initialiseKeyboardShortcutsDialog()
}())
