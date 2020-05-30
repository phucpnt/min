console.info('injected...');
const keybindings = require('keybindings.js');

window.__minBrowser = {
  keybindings,
}

const script = document.createElement("script");
script.src="https://localhost:10786/js/minbrowser.js";

document.head.appendChild(script);
