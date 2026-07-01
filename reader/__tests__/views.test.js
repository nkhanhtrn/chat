import { describe, it, expect } from 'vitest'
import { loadViews } from './helper'

function makeBooks(n) {
  var books = []
  for (var i = 0; i < n; i++) {
    books.push({ id: 'b' + i, title: 'Book ' + i, author: 'Author ' + i, coverUrl: '', readingProgress: 0 })
  }
  return books
}

describe('renderLibraryPage', () => {
  function setup(books) {
    var api = loadViews()
    api.state.books = books
    document.body.innerHTML = '<div id="lib-content"></div>'
    return api
  }

  it('renders max 8 books on first page', () => {
    var { renderLibraryPage } = setup(makeBooks(20))
    renderLibraryPage(0)
    expect(document.querySelectorAll('.book-row').length).toBe(8)
  })

  it('renders remaining books on last page', () => {
    var { renderLibraryPage } = setup(makeBooks(20))
    renderLibraryPage(2)
    expect(document.querySelectorAll('.book-row').length).toBe(4)
  })

  it('shows pager when more than 1 page', () => {
    var { renderLibraryPage } = setup(makeBooks(20))
    renderLibraryPage(0)
    expect(document.getElementById('prev-page')).toBeTruthy()
    expect(document.getElementById('next-page')).toBeTruthy()
  })

  it('hides pager when single page', () => {
    var { renderLibraryPage } = setup(makeBooks(5))
    renderLibraryPage(0)
    expect(document.getElementById('prev-page')).toBeNull()
    expect(document.getElementById('next-page')).toBeNull()
  })

  it('hides pager when exactly 8 books', () => {
    var { renderLibraryPage } = setup(makeBooks(8))
    renderLibraryPage(0)
    expect(document.getElementById('prev-page')).toBeNull()
  })

  it('disables prev on first page', () => {
    var { renderLibraryPage } = setup(makeBooks(20))
    renderLibraryPage(0)
    expect(document.getElementById('prev-page').disabled).toBe(true)
    expect(document.getElementById('next-page').disabled).toBe(false)
  })

  it('disables next on last page', () => {
    var { renderLibraryPage } = setup(makeBooks(20))
    renderLibraryPage(2)
    expect(document.getElementById('prev-page').disabled).toBe(false)
    expect(document.getElementById('next-page').disabled).toBe(true)
  })

  it('updates state.libPage', () => {
    var { renderLibraryPage, state } = setup(makeBooks(20))
    renderLibraryPage(1)
    expect(state.libPage).toBe(1)
  })

  it('clamps out-of-range page', () => {
    var { renderLibraryPage, state } = setup(makeBooks(20))
    renderLibraryPage(99)
    expect(state.libPage).toBe(2)
    renderLibraryPage(-1)
    expect(state.libPage).toBe(0)
  })

  it('shows page number in pager info', () => {
    var { renderLibraryPage } = setup(makeBooks(30))
    renderLibraryPage(1)
    var info = document.querySelector('.pager-info')
    expect(info.textContent).toBe('2 / 4')
  })
})
