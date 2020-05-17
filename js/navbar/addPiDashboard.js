// @global tabs

var browserUI = require('browserUI.js');

var addTabButton = document.getElementById('add-pi-dashboard')
console.info('loaded');

addTabButton.addEventListener('click', function (e) {
  console.info('clicked');
  var newTab = tabs.add({
    url: 'https://localhost:10786/_invest.html',
    private: false,
  })

  browserUI.addTab(newTab, {
    enterEditMode: false,
    openInBackground: false,
  });
})
