import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadInit } from './helper'

function setupDom() {
  localStorage.clear()
  window.location.hash = ''
  document.body.innerHTML = '<div id="app"></div>'
  return loadInit()
}

describe('parseHash', () => {
  var parseHash

  beforeEach(() => {
    parseHash = setupDom().parseHash
  })

  it('parses #/library', () => {
    window.location.hash = '#/library'
    expect(parseHash()).toEqual({ route: 'library' })
  })

  it('parses #/book/:id', () => {
    window.location.hash = '#/book/abc123'
    expect(parseHash()).toEqual({ route: 'book', id: 'abc123' })
  })

  it('returns root for empty hash', () => {
    window.location.hash = ''
    expect(parseHash()).toEqual({ route: 'root' })
  })

  it('returns root for #/', () => {
    window.location.hash = '#/'
    expect(parseHash()).toEqual({ route: 'root' })
  })

  it('returns unknown for unrecognized routes', () => {
    window.location.hash = '#/settings'
    expect(parseHash()).toEqual({ route: 'unknown' })
  })
})

describe('navigate', () => {
  var mod

  beforeEach(() => {
    mod = setupDom()
  })

  it('sets hash for library route', () => {
    mod.navigate('/library')
    expect(window.location.hash).toBe('#/library')
  })

  it('sets hash for book route', () => {
    mod.navigate('/book/xyz')
    expect(window.location.hash).toBe('#/book/xyz')
  })
})

describe('router dispatch', () => {
  var mod

  beforeEach(() => {
    mod = setupDom()
    mod.state.token = null
    mod.state.books = [{ id: 'b1', title: 'Book One', author: 'Auth' }]
  })

  afterEach(() => {
    mod.state.token = null
    mod.state.currentRendition = null
    mod.state.view = 'login'
  })

  it('renders login when no token', () => {
    mod.router()
    expect(document.getElementById('login-form')).toBeTruthy()
  })

  it('renders library when token present and route is library', () => {
    mod.state.token = 'fake-token'
    window.location.hash = '#/library'
    mod.router()
    expect(document.querySelector('.lib')).toBeTruthy()
  })

  it('renders viewer when token present and route is book/:id', () => {
    mod.state.token = 'fake-token'
    window.location.hash = '#/book/b1'
    mod.router()
    expect(document.querySelector('.viewer')).toBeTruthy()
  })

  it('renders library for unknown route when token present', () => {
    mod.state.token = 'fake-token'
    window.location.hash = '#/settings'
    mod.router()
    expect(document.querySelector('.lib')).toBeTruthy()
  })

  it('renders library for root route when token present', () => {
    mod.state.token = 'fake-token'
    window.location.hash = ''
    mod.router()
    expect(document.querySelector('.lib')).toBeTruthy()
  })
})
