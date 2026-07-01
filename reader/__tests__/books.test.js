import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadReader } from './helper'

function makeBookDoc(id, fields) {
  return {
    name: 'projects/nkhanhtrn-chat/databases/(default)/documents/users/uid123/books/' + id,
    fields: fields,
  }
}

function mockXHR(responseText) {
  return function () {
    this.status = 200
    this.readyState = 4
    this.responseText = responseText
    this.open = function () {}
    this.setRequestHeader = function () {}
    this.send = function () { this.onreadystatechange() }
  }
}

describe('fetchBooks', () => {
  let R
  var origXHR

  beforeEach(() => {
    localStorage.clear()
    window.location.hash = ''
    R = loadReader()
    R.state.token = 'fake-token'
    R.state.uid = 'uid123'
    origXHR = window.XMLHttpRequest
  })

  afterEach(() => {
    window.XMLHttpRequest = origXHR
  })

  it('parses books from Firestore documents', () => {
    window.XMLHttpRequest = mockXHR(JSON.stringify({
      documents: [
        makeBookDoc('book1', {
          title: { stringValue: 'Dune' },
          author: { stringValue: 'Frank Herbert' },
          coverUrl: { stringValue: 'https://example.com/cover.jpg' },
          readingProgress: { doubleValue: 0.5 },
          fileType: { stringValue: 'epub' },
        }),
        makeBookDoc('book2', {
          title: { stringValue: '1984' },
          author: { stringValue: 'Orwell' },
          readingProgress: { doubleValue: 0 },
          fileType: { stringValue: 'epub' },
        }),
      ]
    }))

    R.fetchBooks(function (err, books) {
      expect(err).toBe(null)
      expect(books).toHaveLength(2)
      // Sorted alphabetically: "1984" before "Dune"
      expect(books[0].title).toBe('1984')
      expect(books[1].id).toBe('book1')
      expect(books[1].title).toBe('Dune')
      expect(books[1].readingProgress).toBe(0.5)
    })
  })

  it('skips deleted books', () => {
    window.XMLHttpRequest = mockXHR(JSON.stringify({
      documents: [
        makeBookDoc('book1', {
          title: { stringValue: 'Active' },
          fileType: { stringValue: 'epub' },
        }),
        makeBookDoc('book2', {
          title: { stringValue: 'Deleted' },
          fileType: { stringValue: 'epub' },
          deletedAt: { timestampValue: '2024-01-01T00:00:00Z' },
        }),
      ]
    }))

    R.fetchBooks(function (err, books) {
      expect(books).toHaveLength(1)
      expect(books[0].title).toBe('Active')
    })
  })

  it('sorts books alphabetically by title', () => {
    window.XMLHttpRequest = mockXHR(JSON.stringify({
      documents: [
        makeBookDoc('b', { title: { stringValue: 'Zebra' } }),
        makeBookDoc('a', { title: { stringValue: 'Apple' } }),
        makeBookDoc('c', { title: { stringValue: 'Mango' } }),
      ]
    }))

    R.fetchBooks(function (err, books) {
      expect(books.map(function (b) { return b.title })).toEqual(['Apple', 'Mango', 'Zebra'])
    })
  })
})
