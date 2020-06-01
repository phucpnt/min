console.info('injected...');
const keybindings = require('keybindings.js');
const webviews = require('webviews.js');

window.__minBrowser = {
  keybindings,
  webviews,
}

const script = document.createElement("script");
script.src="https://localhost:10786/js/minbrowser.js";

document.head.appendChild(script);
