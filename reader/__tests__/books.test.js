import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { loadApi } from './helper'

function makeDoc(id, fields) {
  return { name: 'projects/x/databases/(default)/documents/users/u1/books/' + id, fields }
}

function MockXHR(responseText) {
  this.status = 200
  this.readyState = 4
  this.responseText = responseText
}
MockXHR.prototype.open = function () {}
MockXHR.prototype.setRequestHeader = function () {}
MockXHR.prototype.send = function () { this.onreadystatechange() }

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
