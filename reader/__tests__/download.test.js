import 'fake-indexeddb/auto'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadApi } from './helper'

function p(fn) {
  return new Promise(function (resolve) {
    fn(function () { resolve(Array.prototype.slice.call(arguments)); })
  })
}

function MockBlobXHR(arrayBuffer) {
  this.status = 200
  this.readyState = 4
  this.response = arrayBuffer
  this.responseText = ''
  this.url = ''
  this.method = ''
  this.body = null
  this.headers = {}
}
MockBlobXHR.prototype.open = function (method, url) { this.method = method; this.url = url }
MockBlobXHR.prototype.setRequestHeader = function (k, v) { this.headers[k] = v }
MockBlobXHR.prototype.send = function (body) { this.body = body; this.onreadystatechange() }

function setAuth(state) {
  state.token = 'tok'
  state.uid = 'u1'
  state.tokenExpiry = Date.now() + 3600000
}

describe('downloadBook', () => {
  let origXHR

  beforeEach(() => {
    localStorage.clear()
    indexedDB = new IDBFactory()
    origXHR = window.XMLHttpRequest
  })
  afterEach(() => { window.XMLHttpRequest = origXHR })

  it('downloads from network when cache is empty', async () => {
    var fakeBuf = new ArrayBuffer(16)
    var capturedUrl = null
    window.XMLHttpRequest = function () {
      var xhr = new MockBlobXHR(fakeBuf)
      var origOpen = xhr.open.bind(xhr)
      xhr.open = function (method, url) { capturedUrl = url; origOpen(method, url) }
      return xhr
    }

    const { downloadBook, state } = loadApi()
    setAuth(state)

    var result = await p(function (cb) { downloadBook('b1', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBe(fakeBuf)
    expect(capturedUrl).toContain('users%2Fu1%2Fbooks%2Fb1%2Fbook.epub')
    expect(capturedUrl).toContain('alt=media')
  })

  it('returns cached file without making network request', async () => {
    const { downloadBook, state, cacheSet } = loadApi()
    setAuth(state)

    var cachedBuf = new ArrayBuffer(32)
    var networkCalled = false
    window.XMLHttpRequest = function () { networkCalled = true; return new MockBlobXHR(new ArrayBuffer(1)) }

    await p(function (cb) { cacheSet('b1', cachedBuf, cb) })
    var result = await p(function (cb) { downloadBook('b1', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBeInstanceOf(ArrayBuffer)
    expect(result[1].byteLength).toBe(32)
    expect(networkCalled).toBe(false)
  })

  it('caches downloaded file for subsequent calls', async () => {
    var fakeBuf = new ArrayBuffer(16)
    var downloadCount = 0
    window.XMLHttpRequest = function () {
      downloadCount++
      return new MockBlobXHR(fakeBuf)
    }

    const { downloadBook, state } = loadApi()
    setAuth(state)

    await p(function (cb) { downloadBook('b1', cb) })
    expect(downloadCount).toBe(1)

    await p(function (cb) { downloadBook('b1', cb) })
    expect(downloadCount).toBe(1)
  })

  it('includes Authorization header', async () => {
    var lastXHR = null
    window.XMLHttpRequest = function () { lastXHR = new MockBlobXHR(new ArrayBuffer(4)); return lastXHR }

    const { downloadBook, state } = loadApi()
    setAuth(state)

    await p(function (cb) { downloadBook('b1', cb) })

    expect(lastXHR.headers['Authorization']).toBe('Bearer tok')
  })

  it('returns error on HTTP failure', async () => {
    var errXHR = new MockBlobXHR(null)
    errXHR.status = 403
    window.XMLHttpRequest = function () { return errXHR }

    const { downloadBook, state } = loadApi()
    setAuth(state)

    var result = await p(function (cb) { downloadBook('b1', cb) })
    expect(result[0]).toBeTruthy()
  })
})
