// @global tabs

var browserUI = require('browserUI.js');

var addTabButton = document.getElementById('add-pi-dashboard')

function initialize() {
addTabButton.addEventListener('click', function (e) {
  var newTab = tabs.add({
    url: 'https://localhost:10786/_invest.html',
    private: false,
  })

  browserUI.addTab(newTab, {
    enterEditMode: false,
    openInBackground: false,
  });
})
}

module.exports = {initialize};
