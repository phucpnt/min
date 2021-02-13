var searchbarPlugins = require('searchbar/searchbarPlugins.js')

var urlParser = require('util/urlParser.js')
var searchEngine = require('util/searchEngine.js')

function showSearchSuggestions (text, input, event) {
  // TODO support search suggestions for other search engines
  if (searchEngine.getCurrent().name !== 'DuckDuckGo') {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  if ((searchbarPlugins.getResultCount() - searchbarPlugins.getResultCount('searchSuggestions')) > 3) {
    searchbarPlugins.reset('searchSuggestions')
    return
  }

  fetch('https://ac.duckduckgo.com/ac/?t=min&q=' + encodeURIComponent(text), {
    cache: 'force-cache'
  })
    .then(function (response) {
      return response.json()
    })
    .then(function (results) {
      searchbarPlugins.reset('searchSuggestions')

      if (searchbarPlugins.getResultCount() > 3) {
        return
      }

      if (results) {
        results = results.slice(0, 3)
        results.forEach(function (result) {
          var data = {
            title: result.phrase,
            url: result.phrase
          }

          if (urlParser.isURL(result.phrase) || urlParser.isURLMissingProtocol(result.phrase)) { // website suggestions
            data.icon = 'carbon:earth-filled'
          } else { // regular search results
            data.icon = 'carbon:search'
          }

          searchbarPlugins.addResult('searchSuggestions', data)
        })
      }
    })
}

function initialize () {
  searchbarPlugins.register('searchSuggestions', {
    index: 4,
    trigger: function (text) {
      return !!text && text.indexOf('!') !== 0 && !tabs.get(tabs.getSelected()).private
    },
    showResults: debounce(showSearchSuggestions, 50)
  })
}

module.exports = { initialize }
