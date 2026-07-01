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

describe('fetchBooks', () => {
  let origXHR

  beforeEach(() => {
    localStorage.clear()
    origXHR = window.XMLHttpRequest
  })
  afterEach(() => { window.XMLHttpRequest = origXHR })

  it('parses, filters deleted/pdf, sorts alphabetically', () => {
    window.XMLHttpRequest = function () {
      return new MockXHR(JSON.stringify({
        documents: [
          makeDoc('b1', { title: { stringValue: 'Zebra' }, fileType: { stringValue: 'epub' } }),
          makeDoc('b2', { title: { stringValue: 'Apple' }, fileType: { stringValue: 'epub' } }),
          makeDoc('b3', { title: { stringValue: 'Deleted Book' }, fileType: { stringValue: 'epub' }, deletedAt: { timestampValue: '2024-01-01' } }),
          makeDoc('b4', { title: { stringValue: 'PDF Book' }, fileType: { stringValue: 'pdf' } }),
        ],
      }))
    }

    const { fetchBooks, state } = loadApi()
    state.token = 'tok'
    state.uid = 'u1'

    fetchBooks(function (err, books) {
      expect(err).toBe(null)
      expect(books.map(function (b) { return b.title })).toEqual(['Apple', 'Zebra'])
      expect(state.books).toHaveLength(2)
    })
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
    state.token = 'tok'
    state.uid = 'u1'

    saveProgress('book-42', 'epubcfi(/6/4!/4/2)', 0.5, function () {})

    expect(lastXHR.method).toBe('PATCH')
    expect(lastXHR.url).toContain('/users/u1/books/book-42')
    expect(lastXHR.url).toContain('updateMask.fieldPaths=lastCfi')
    expect(lastXHR.url).toContain('updateMask.fieldPaths=readingProgress')
  })

  it('sends cfi as stringValue and progress as integerValue (0-100)', () => {
    const { saveProgress } = loadApi()

    saveProgress('b1', 'epubcfi(/6/4!/4/2)', 0.427, function () {})

    var body = JSON.parse(lastXHR.body)
    expect(body.fields.lastCfi.stringValue).toBe('epubcfi(/6/4!/4/2)')
    expect(body.fields.readingProgress.integerValue).toBe('43')
  })

  it('rounds progress to nearest integer', () => {
    const { saveProgress } = loadApi()

    saveProgress('b1', 'cfi', 0.001, function () {})
    expect(JSON.parse(lastXHR.body).fields.readingProgress.integerValue).toBe('0')

    saveProgress('b1', 'cfi', 0.999, function () {})
    expect(JSON.parse(lastXHR.body).fields.readingProgress.integerValue).toBe('100')
  })

  it('includes Authorization header', () => {
    const { saveProgress, state } = loadApi()
    state.token = 'mytoken'

    saveProgress('b1', 'cfi', 0.5, function () {})

    expect(lastXHR.headers['Authorization']).toBe('Bearer mytoken')
    expect(lastXHR.headers['Content-Type']).toBe('application/json')
  })
})
