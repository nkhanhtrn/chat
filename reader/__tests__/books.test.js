import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadApi } from './helper'

function makeDoc(id, fields) {
  return { name: 'projects/x/databases/(default)/documents/users/u1/books/' + id, fields }
}

function MockXHR(responseText) {
  this.status = 200
  this.readyState = 4
  this.responseText = responseText
  this.url = ''
  this.method = ''
  this.body = null
  this.headers = {}
}
MockXHR.prototype.open = function (method, url) { this.method = method; this.url = url }
MockXHR.prototype.setRequestHeader = function (k, v) { this.headers[k] = v }
MockXHR.prototype.send = function (body) { this.body = body; this.onreadystatechange() }

function setAuth(state) {
  state.token = 'tok'
  state.uid = 'u1'
  state.tokenExpiry = Date.now() + 3600000
}

describe('fetchBooks', () => {
  let origXHR

  beforeEach(() => {
    localStorage.clear()
    origXHR = window.XMLHttpRequest
  })
  afterEach(() => { window.XMLHttpRequest = origXHR })

  it('parses runQuery response, sorts alphabetically', () => {
    window.XMLHttpRequest = function () {
      return new MockXHR(JSON.stringify([
        { document: makeDoc('b1', { title: { stringValue: 'Zebra' }, author: { stringValue: 'Z' } }) },
        { document: makeDoc('b2', { title: { stringValue: 'Apple' }, author: { stringValue: 'A' } }) },
      ]))
    }

    const { fetchBooks, state } = loadApi()
    setAuth(state)

    fetchBooks(function (err, books) {
      expect(err).toBe(null)
      expect(books.map(function (b) { return b.title })).toEqual(['Apple', 'Zebra'])
      expect(state.books).toHaveLength(2)
    })
  })

  it('uses runQuery with select and where fileType=epub', () => {
    let capturedBody = null
    window.XMLHttpRequest = function () {
      var xhr = new MockXHR('[]')
      var origSend = xhr.send.bind(xhr)
      xhr.send = function (body) { capturedBody = JSON.parse(body); origSend(body) }
      return xhr
    }

    const { fetchBooks, state } = loadApi()
    setAuth(state)

    fetchBooks(function () {})

    expect(capturedBody.structuredQuery.select.fields.map(function (f) { return f.fieldPath }))
      .toEqual(['title', 'author', 'readingProgress'])
    expect(capturedBody.structuredQuery.where.fieldFilter.value.stringValue).toBe('epub')
    expect(capturedBody.structuredQuery.where.fieldFilter.op).toBe('EQUAL')
  })
})

describe('saveProgress', () => {
  let origXHR
  let lastXHR

  beforeEach(() => {
    localStorage.clear()
    origXHR = window.XMLHttpRequest
    lastXHR = null
    window.XMLHttpRequest = function () { lastXHR = new MockXHR('{}'); return lastXHR }
  })
  afterEach(() => { window.XMLHttpRequest = origXHR })

  it('sends PATCH with correct URL and mask', () => {
    const { saveProgress, state } = loadApi()
    setAuth(state)

    saveProgress('book-42', 'epubcfi(/6/4!/4/2)', 0.5, function () {})

    expect(lastXHR.method).toBe('PATCH')
    expect(lastXHR.url).toContain('/users/u1/books/book-42')
    expect(lastXHR.url).toContain('updateMask.fieldPaths=lastCfi')
    expect(lastXHR.url).toContain('updateMask.fieldPaths=readingProgress')
  })

  it('sends cfi as stringValue and progress as integerValue (0-100)', () => {
    const { saveProgress, state } = loadApi()
    setAuth(state)

    saveProgress('b1', 'epubcfi(/6/4!/4/2)', 0.427, function () {})

    var body = JSON.parse(lastXHR.body)
    expect(body.fields.lastCfi.stringValue).toBe('epubcfi(/6/4!/4/2)')
    expect(body.fields.readingProgress.integerValue).toBe('43')
  })

  it('rounds progress to nearest integer', () => {
    const { saveProgress, state } = loadApi()
    setAuth(state)

    saveProgress('b1', 'cfi', 0.001, function () {})
    expect(JSON.parse(lastXHR.body).fields.readingProgress.integerValue).toBe('0')

    saveProgress('b1', 'cfi', 0.999, function () {})
    expect(JSON.parse(lastXHR.body).fields.readingProgress.integerValue).toBe('100')
  })

  it('includes Authorization header', () => {
    const { saveProgress, state } = loadApi()
    state.token = 'mytoken'
    state.tokenExpiry = Date.now() + 3600000

    saveProgress('b1', 'cfi', 0.5, function () {})

    expect(lastXHR.headers['Authorization']).toBe('Bearer mytoken')
    expect(lastXHR.headers['Content-Type']).toBe('application/json')
  })
})
