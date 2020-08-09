var viewMap = {} // id: view
var viewStateMap = {} // id: view state

const BrowserView = electron.BrowserView

function buildWebReferences(optionStr, url) {
  let webPreferences = JSON.parse(optionStr);
  if (String(url).indexOf("https://localhost:10786") > -1) {
    webPreferences = {
      webPreferences: {
        ...webPreferences.webPreferences,
        nodeIntegration: true,
        nodeIntegrationInSubFrames: false,
        contextIsolation: false,
        sandbox: false,
        enableRemoteModule: true,
        plugins: true,
        nativeWindowOpen: true,
        webSecurity: false,
        javascript: true,
        enableWebSQL: false,
        webviewTag: true,
      },
    };
  }

  return webPreferences;
}

function createView (id, webPreferencesString, boundsString, events, url) {

  let view = new BrowserView(buildWebReferences(webPreferencesString, url));

  events.forEach(function (event) {
    view.webContents.on(event, function (e) {
      /*
      new-window is special because its arguments contain a webContents object that can't be serialized and needs to be removed.
      */
      var args = Array.prototype.slice.call(arguments).slice(1)
      if (event === "new-window") {
        const [, frameName, disposition, options] = args;
        let preventDefault = ["_self", "_blank"].indexOf(frameName) > -1;
        preventDefault = preventDefault || disposition === "foreground-tab";
        if(preventDefault) {
          e.preventDefault();
          args = args.slice(0, 3);
        } else if(disposition === 'new-window') {
          e.preventDefault();
          // options1 = Object.assign(options, {
          let options1 = {
            show: options.show,
            x: options.x,
            y: options.y,
            width: options.width,
            height: options.height,
            webContents: options.webContents,
            webPreferences: {
              // ...options.webPreferences,
              nodeIntegration: false,
              nodeIntegrationInSubFrames: false,
              nodeIntegrationInWorker: false,
              enableRemoteModule: false,
              allowRunningInsecureContent: false,
              webSecurity: true,
              contextIsolation: true,
              plugins: true,
              nativeWindowOpen: true,
              webviewTag: false,
              javascript: true,
              plugins: true,
            }
          }
          e.newGuest = new electron.BrowserWindow(options1);
          return;
        }
      }

      mainWindow.webContents.send('view-event', {
        viewId: id,
        event: event,
        args: args
      })
    })
  })

  /*
  Workaround for crashes when calling preventDefault() on the new-window event (https://github.com/electron/electron/issues/23859#issuecomment-650270680)
  Calling preventDefault also prevents the new-window event from occurring, so create a new event here instead
  */
  view.webContents.on('-will-add-new-contents', function (e, url) {
    e.preventDefault()
    mainWindow.webContents.send('view-event', {
      viewId: id,
      event: 'new-window',
      args: [url, '', 'new-window']
    })
  })

  view.webContents.on('ipc-message', function (e, channel, data) {
    mainWindow.webContents.send('view-ipc', {
      id: id,
      name: channel,
      data: data,
      frameId: e.frameId
    })
  })

  // Open a login prompt when site asks for http authentication
  view.webContents.on('login', (event, authenticationResponseDetails, authInfo, callback) => {
    if (authInfo.scheme !== 'basic') {  // Only for basic auth
      return
    }
    event.preventDefault()
    var title = l('loginPromptTitle').replace('%h', authInfo.host).replace('%r', authInfo.realm)
    createPrompt({
      text: title,
      values: [{ placeholder: l('username'), id: 'username', type: 'text' },
               { placeholder: l('password'), id: 'password', type: 'password' }],
      ok: l('dialogConfirmButton'),
      cancel: l('dialogSkipButton'),
      width: 400,
      height: 200
    }, function (result) {
       // resend request with auth credentials
      callback(result.username, result.password)
    })
  })

  view.setBounds(JSON.parse(boundsString))

  viewMap[id] = view
  viewStateMap[id] = {loadedInitialURL: false}

  return view
}

function destroyView (id) {
  if (!viewMap[id]) {
    return
  }

  // destroy an associated partition

  var partition = viewMap[id].webContents.getWebPreferences().partition
  if (partition) {
    session.fromPartition(partition).destroy()
  }
  if (viewMap[id] === mainWindow.getBrowserView()) {
    mainWindow.setBrowserView(null)
  }
  viewMap[id].destroy()
  delete viewMap[id]
  delete viewStateMap[id]
}

function destroyAllViews () {
  for (let id in viewMap) {
    destroyView(id)
  }
}

function setView (id) {
  mainWindow.setBrowserView(viewMap[id])
}

function setBounds (id, bounds) {
  if (viewMap[id]) {
    viewMap[id].setBounds(bounds)
  }
}

function focusView (id) {
  // empty views can't be focused because they won't propogate keyboard events correctly, see https://github.com/minbrowser/min/issues/616
  // also, make sure the view exists, since it might not if the app is shutting down
  if (viewMap[id] && (viewMap[id].webContents.getURL() !== '' || viewMap[id].webContents.isLoading())) {
    viewMap[id].webContents.focus()
  } else if (mainWindow) {
    mainWindow.webContents.focus()
  }
}

function hideCurrentView () {
  mainWindow.setBrowserView(null)
  mainWindow.webContents.focus()
}

function getView (id) {
  return viewMap[id]
}

function getViewIDFromWebContents (contents) {
  for (var id in viewMap) {
    if (viewMap[id].webContents === contents) {
      return id
    }
  }
}

ipc.on('createView', function (e, args) {
  createView(args.id, args.webPreferencesString, args.boundsString, args.events, args.url)
})

ipc.on('destroyView', function (e, id) {
  destroyView(id)
})

ipc.on('destroyAllViews', function () {
  destroyAllViews()
})

ipc.on('setView', function (e, args) {
  setView(args.id)
  setBounds(args.id, args.bounds)
  if (args.focus) {
    focusView(args.id)
  }
})

ipc.on('setBounds', function (e, args) {
  setBounds(args.id, args.bounds)
})

ipc.on('focusView', function (e, id) {
  focusView(id)
})

ipc.on('hideCurrentView', function (e) {
  hideCurrentView()
})

ipc.on('loadURLInView', function (e, args) {
  // wait until the first URL is loaded to set the background color so that new tabs can use a custom background
  if (!viewStateMap[args.id].loadedInitialURL) {
    viewMap[args.id].setBackgroundColor('#fff')
  }
  viewMap[args.id].webContents.loadURL(args.url)
  viewStateMap[args.id].loadedInitialURL = true
})

ipc.on('callViewMethod', function (e, data) {
  var error, result
  try {
    var webContents = viewMap[data.id].webContents
    var methodOrProp = webContents[data.method]
    if (methodOrProp instanceof Function) {
      // call function
      result = methodOrProp.apply(webContents, data.args)
    } else {
      // set property
      if (data.args && data.args.length > 0) {
        webContents[data.method] = data.args[0]
      }
      // read property
      result = methodOrProp
    }
  } catch (e) {
    error = e
  }
  if (result instanceof Promise) {
    result.then(function (result) {
      if (data.callId) {
        mainWindow.webContents.send('async-call-result', {callId: data.callId, error: null, result})
      }
    })
    result.catch(function (error) {
      if (data.callId) {
        mainWindow.webContents.send('async-call-result', {callId: data.callId, error, result: null})
      }
    })
  } else if (data.callId) {
    mainWindow.webContents.send('async-call-result', {callId: data.callId, error, result})
  }
})

ipc.on('getCapture', function (e, data) {
  var view = viewMap[data.id]
  if (!view) {
    // view could have been destroyed
    return
  }

  view.webContents.capturePage().then(function (img) {
    var size = img.getSize()
    if (size.width === 0 && size.height === 0) {
      return
    }
    img = img.resize({width: data.width, height: data.height})
    mainWindow.webContents.send('captureData', {id: data.id, url: img.toDataURL()})
  })
})

global.getView = getView
