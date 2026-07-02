import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createIDBMock } from './idb-mock'
import { loadViews } from './helper'

function setupIDB() {
  var orig = globalThis.indexedDB
  globalThis.indexedDB = createIDBMock()
  return function restore() { globalThis.indexedDB = orig }
}

describe('extractWord', () => {
  const { extractWord } = loadViews()

  it('extracts word when offset is at start', () => {
    expect(extractWord('hello world', 6)).toBe('world')
  })

  it('extracts word when offset is in middle', () => {
    expect(extractWord('hello world', 8)).toBe('world')
  })

  it('extracts word when offset is at end of word', () => {
    expect(extractWord('hello world', 10)).toBe('world')
  })

  it('extracts first word', () => {
    expect(extractWord('hello world', 2)).toBe('hello')
  })

  it('returns preceding word when offset is at boundary before space', () => {
    expect(extractWord('hello world', 5)).toBe('hello')
  })

  it('handles single word', () => {
    expect(extractWord('test', 2)).toBe('test')
  })

  it('handles empty string', () => {
    expect(extractWord('', 0)).toBe('')
  })

  it('handles apostrophes within words', () => {
    expect(extractWord("don't go", 2)).toBe("don't")
  })

  it('does not match digits', () => {
    expect(extractWord('abc123def', 4)).toBe('')
  })

  it('handles offset at 0', () => {
    expect(extractWord('hello', 0)).toBe('hello')
  })

  it('handles offset at end of text (returns last word)', () => {
    expect(extractWord('hello', 5)).toBe('hello')
  })
})

describe('showWordPopup / hideWordPopup', () => {
  var restore
  beforeEach(() => {
    restore = setupIDB()
    document.body.innerHTML = ''
  })
  afterEach(() => {
    restore()
    document.body.innerHTML = ''
  })

  it('creates overlay with word displayed', () => {
    const { showWordPopup } = loadViews()
    showWordPopup('example')
    var overlay = document.getElementById('word-popup-overlay')
    expect(overlay).toBeTruthy()
    var word = overlay.querySelector('.word-popup-word')
    expect(word.textContent).toBe('example')
  })

  it('shows looking-up placeholder initially', () => {
    const { showWordPopup } = loadViews()
    showWordPopup('test')
    var def = document.getElementById('word-popup-def')
    expect(def.textContent).toMatch(/Looking up/)
  })

  it('removes popup on hideWordPopup', () => {
    const { showWordPopup, hideWordPopup } = loadViews()
    showWordPopup('test')
    expect(document.getElementById('word-popup-overlay')).toBeTruthy()
    hideWordPopup()
    expect(document.getElementById('word-popup-overlay')).toBeNull()
  })

  it('replaces existing popup on new showWordPopup', () => {
    const { showWordPopup } = loadViews()
    showWordPopup('first')
    showWordPopup('second')
    var word = document.querySelector('.word-popup-word')
    expect(word.textContent).toBe('second')
    expect(document.querySelectorAll('#word-popup-overlay').length).toBe(1)
  })
})
