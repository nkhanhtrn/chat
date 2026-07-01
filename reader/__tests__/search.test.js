import { describe, it, expect, beforeEach } from 'vitest'
import { loadViews } from './helper'

describe('normalizeSearch', () => {
  const { normalizeSearch } = loadViews()

  it('lowercases', () => {
    expect(normalizeSearch('HELLO')).toBe('hello')
  })

  it('removes spaces', () => {
    expect(normalizeSearch('Andrew Hut')).toBe('andrewhut')
  })

  it('removes dots and punctuation', () => {
    expect(normalizeSearch('J.D Salinger')).toBe('jdsalinger')
  })

  it('removes all special characters', () => {
    expect(normalizeSearch("It's a Test!")).toBe('itsatest')
  })

  it('keeps digits', () => {
    expect(normalizeSearch('1984')).toBe('1984')
  })

  it('handles null', () => {
    expect(normalizeSearch(null)).toBe('')
  })

  it('handles undefined', () => {
    expect(normalizeSearch(undefined)).toBe('')
  })

  it('removes hyphens and underscores', () => {
    expect(normalizeSearch('well-known_author')).toBe('wellknownauthor')
  })
})

describe('getFilteredBooks (normalized search)', () => {
  let views

  beforeEach(() => {
    localStorage.clear()
    views = loadViews()
    views.state.books = [
      { id: '1', title: 'The Hobbit', author: 'J.R.R. Tolkien' },
      { id: '2', title: '1984', author: 'George Orwell' },
      { id: '3', title: 'To Kill a Mockingbird', author: 'Harper Lee' },
      { id: '4', title: 'Catcher in the Rye', author: 'J.D. Salinger' },
    ]
  })

  it('returns all books when query is empty', () => {
    views.state.searchQuery = ''
    expect(views.getFilteredBooks()).toHaveLength(4)
  })

  it('returns all books when query is whitespace only', () => {
    views.state.searchQuery = '   '
    expect(views.getFilteredBooks()).toHaveLength(4)
  })

  it('matches without spaces: andrewhut → Andrew Hut', () => {
    views.state.searchQuery = 'andrewhut'
    var result = views.getFilteredBooks()
    expect(result).toEqual([])
  })

  it('matches author ignoring dots: jrrtolkien → J.R.R. Tolkien', () => {
    views.state.searchQuery = 'jrrtolkien'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('matches author ignoring dots: jdsalinger → J.D. Salinger', () => {
    views.state.searchQuery = 'jdsalinger'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('4')
  })

  it('matches partial title', () => {
    views.state.searchQuery = 'hob'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('matches digits', () => {
    views.state.searchQuery = '1984'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('2')
  })

  it('case insensitive', () => {
    views.state.searchQuery = 'TOLKIEN'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('1')
  })

  it('no match returns empty array', () => {
    views.state.searchQuery = 'xyznonexistent'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(0)
  })

  it('matches title ignoring special chars', () => {
    views.state.searchQuery = 'tokillamockingbird'
    var result = views.getFilteredBooks()
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('3')
  })
})
