export function createIDBMock() {
  var data = new Map()

  function fire(req, type) {
    setTimeout(function () {
      var ev = { target: req }
      if (type === 'success' && req.onsuccess) req.onsuccess(ev)
      else if (type === 'error' && req.onerror) req.onerror(ev)
      else if (type === 'complete' && req.oncomplete) req.oncomplete(ev)
      else if (type === 'upgrade' && req.onupgradeneeded) req.onupgradeneeded(ev)
    }, 0)
  }

  function makeReq() {
    return { result: null, error: null, onsuccess: null, onerror: null, oncomplete: null, onupgradeneeded: null }
  }

  function makeStore() {
    return {
      get: function (key) {
        var req = makeReq()
        req.result = data.has(key) ? data.get(key) : null
        fire(req, 'success')
        return req
      },
      put: function (val, key) {
        var req = makeReq()
        data.set(key, val)
        fire(req, 'success')
        return req
      },
    }
  }

  var db = {
    name: 'reader-cache',
    objectStoreNames: { contains: function () { return true } },
    createObjectStore: function () { return makeStore(); },
    transaction: function () {
      var tx = makeReq()
      tx.objectStore = function () { return makeStore() }
      fire(tx, 'complete')
      return tx
    },
  }

  function factory() {}
  factory.open = function () {
    var req = makeReq()
    req.result = db
    fire(req, 'upgrade')
    fire(req, 'success')
    return req
  }
  factory._reset = function () { data = new Map() }

  return factory
}
