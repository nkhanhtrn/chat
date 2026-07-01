import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { loadViews, loadInit } from './helper'

describe('estimateProgress', () => {
  const { estimateProgress } = loadViews()

  it('uses percentageFromCfi when locations are generated', () => {
    var bookObj = {
      locations: { length: 100, percentageFromCfi: function () { return 0.42 } },
      spine: { length: 10 },
    }
    var location = { start: { cfi: 'epubcfi(/6/4)', index: 0 } }
    expect(estimateProgress(bookObj, location, 0)).toBe(0.42)
  })

  it('estimates from spine index when locations not generated', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 10 } }
    var location = { start: { cfi: 'x', index: 4 } }
    expect(estimateProgress(bookObj, location, 0)).toBe(0.5)
  })

  it('chapter 0 of 20 = 5%', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 20 } }
    var location = { start: { cfi: 'x', index: 0 } }
    expect(estimateProgress(bookObj, location, 0)).toBe(0.05)
  })

  it('last chapter of 20 = 100%', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 20 } }
    var location = { start: { cfi: 'x', index: 19 } }
    expect(estimateProgress(bookObj, location, 0)).toBe(1)
  })

  it('falls back to stored progress when no spine info', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 0 } }
    var location = { start: { cfi: 'x', index: 0 } }
    expect(estimateProgress(bookObj, location, 0.35)).toBe(0.35)
  })

  it('falls back when location is null', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 10 } }
    expect(estimateProgress(bookObj, null, 0.5)).toBe(0.5)
  })

  it('falls back when location.start is missing', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 10 } }
    expect(estimateProgress(bookObj, {}, 0.5)).toBe(0.5)
  })

  it('falls back when spine.index is not a number', () => {
    var bookObj = { locations: { length: 0 }, spine: { length: 10 } }
    var location = { start: { cfi: 'x', index: undefined } }
    expect(estimateProgress(bookObj, location, 0.3)).toBe(0.3)
  })
})

describe('Keydown swap (PageUp=next, PageDown=prev)', () => {
  let state, handler

  beforeEach(() => {
    localStorage.clear()
    document.body.innerHTML = '<div id="app"></div>'

    var origAdd = document.addEventListener
    var captured = null
    document.addEventListener = function (type, fn) {
      if (type === 'keydown') captured = fn
    }

    var mod = loadInit()
    state = mod.state

    document.addEventListener = origAdd
    handler = captured

    state.view = 'viewer'
    state.currentRendition = { prev: vi.fn(), next: vi.fn() }
  })

  afterEach(() => {
    state.currentRendition = null
    state.view = 'login'
  })

  function press(code, key) {
    handler({ keyCode: code, key: key || '', target: { tagName: 'DIV' }, preventDefault: function () {} })
  }

  it('PageUp (33) calls rendition.next()', () => {
    press(33)
    expect(state.currentRendition.next).toHaveBeenCalledTimes(1)
    expect(state.currentRendition.prev).not.toHaveBeenCalled()
  })

  it('PageDown (34) calls rendition.prev()', () => {
    press(34)
    expect(state.currentRendition.prev).toHaveBeenCalledTimes(1)
    expect(state.currentRendition.next).not.toHaveBeenCalled()
  })

  it('ArrowLeft calls rendition.next()', () => {
    press(0, 'ArrowLeft')
    expect(state.currentRendition.next).toHaveBeenCalledTimes(1)
  })

  it('ArrowRight calls rendition.prev()', () => {
    press(0, 'ArrowRight')
    expect(state.currentRendition.prev).toHaveBeenCalledTimes(1)
  })

  it('ignores keydown when target is INPUT', () => {
    handler({ keyCode: 33, key: '', target: { tagName: 'INPUT' }, preventDefault: function () {} })
    expect(state.currentRendition.next).not.toHaveBeenCalled()
  })

  it('PageUp navigates to next TOC page when overlay open', () => {
    var overlay = document.createElement('div')
    overlay.id = 'toc-overlay'
    var body = document.createElement('div'); body.id = 'toc-body'
    var footer = document.createElement('div'); footer.id = 'toc-footer'
    overlay.appendChild(body)
    overlay.appendChild(footer)
    document.body.appendChild(overlay)

    state.tocPage = 0
    state.toc = []
    for (var i = 0; i < 25; i++) state.toc.push({ href: 'c' + i, label: 'C' + i })

    press(33)
    expect(state.tocPage).toBe(1)

    press(33)
    expect(state.tocPage).toBe(2)

    document.body.removeChild(overlay)
  })
})
