import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createIDBMock } from './idb-mock'
import { loadDict } from './helper'

function p(fn) {
  return new Promise(function (resolve) {
    fn(function () { resolve(Array.prototype.slice.call(arguments)) })
  })
}

function setupIDB() {
  var orig = globalThis.indexedDB
  globalThis.indexedDB = createIDBMock()
  return function restore() { globalThis.indexedDB = orig }
}

describe('_parseDict', () => {
  it('parses word|definition lines into parallel arrays', () => {
    const { _parseDict, _resetDict } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\nbook|a written work\ncat|an animal\n')
    // Can't directly access _dictWords, test via lookup
  })
})

describe('_binarySearchWords', () => {
  const { _binarySearchWords } = loadDict()

  it('finds existing words', () => {
    var arr = ['apple', 'banana', 'cherry', 'date', 'elderberry']
    expect(_binarySearchWords(arr, 'apple')).toBe(0)
    expect(_binarySearchWords(arr, 'cherry')).toBe(2)
    expect(_binarySearchWords(arr, 'elderberry')).toBe(4)
  })

  it('returns -1 for missing words', () => {
    var arr = ['apple', 'banana', 'cherry']
    expect(_binarySearchWords(arr, 'apricot')).toBe(-1)
    expect(_binarySearchWords(arr, 'zebra')).toBe(-1)
  })

  it('handles empty array', () => {
    expect(_binarySearchWords([], 'test')).toBe(-1)
  })

  it('handles single element', () => {
    expect(_binarySearchWords(['only'], 'only')).toBe(0)
    expect(_binarySearchWords(['only'], 'other')).toBe(-1)
  })
})

describe('dictLookup', () => {
  var restore
  beforeEach(() => {
    restore = setupIDB()
  })
  afterEach(() => restore())

  it('returns definition for a known word (cached)', async () => {
    const { cacheSet, _resetDict, _parseDict, dictLookup } = loadDict()
    _resetDict()
    cacheSet('__dictionary__', 'apple|a round fruit\nbook|a written work\n', function () {
      _parseDict('apple|a round fruit\nbook|a written work\n')
    })

    // Wait for cacheSet then lookup
    await new Promise(function (r) { setTimeout(r, 10) })
    _parseDict('apple|a round fruit\nbook|a written work\n')
    var result = await p(function (cb) { dictLookup('apple', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('apple')
    expect(result[1].def).toBe('a round fruit')
  })

  it('returns null for unknown word', async () => {
    const { _resetDict, _parseDict, dictLookup } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\nbook|a work\n')
    var result = await p(function (cb) { dictLookup('zebra', cb) })
    expect(result[0]).toBe(null)
    expect(result[1]).toBe(null)
  })

  it('normalizes to lowercase before lookup', async () => {
    const { _resetDict, _parseDict, dictLookup } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\n')
    var result = await p(function (cb) { dictLookup('APPLE', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('apple')
  })

  it('trims whitespace before lookup', async () => {
    const { _resetDict, _parseDict, dictLookup } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\n')
    var result = await p(function (cb) { dictLookup('  apple  ', cb) })
    expect(result[1]).toBeTruthy()
  })

  it('returns null for empty string', async () => {
    const { _resetDict, _parseDict, dictLookup } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\n')
    var result = await p(function (cb) { dictLookup('', cb) })
    expect(result[1]).toBe(null)
  })
})

describe('ensureDictionary', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  it('returns dict-not-downloaded when not cached', async () => {
    const { _resetDict, ensureDictionary } = loadDict()
    _resetDict()
    var result = await p(function (cb) { ensureDictionary(cb) })
    expect(result[0]).toBe('dict-not-downloaded')
  })

  it('succeeds when cached in IDB', async () => {
    const { cacheSet, _resetDict, ensureDictionary } = loadDict()
    _resetDict()
    await p(function (cb) { cacheSet('__dictionary__', 'cat|an animal\n', cb) })
    var result = await p(function (cb) { ensureDictionary(cb) })
    expect(result[0]).toBe(null)
  })

  it('succeeds when already in memory', async () => {
    const { _resetDict, _parseDict, ensureDictionary } = loadDict()
    _resetDict()
    _parseDict('cat|an animal\n')
    var result = await p(function (cb) { ensureDictionary(cb) })
    expect(result[0]).toBe(null)
  })
})

describe('getDictStatus', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  it('returns not-downloaded when nothing cached', async () => {
    const { _resetDict, getDictStatus } = loadDict()
    _resetDict()
    var result = await p(function (cb) { getDictStatus(cb) })
    expect(result[0]).toBe('not-downloaded')
  })

  it('returns ready with count when parsed in memory', async () => {
    const { _resetDict, _parseDict, getDictStatus } = loadDict()
    _resetDict()
    _parseDict('a|def a\nb|def b\nc|def c\n')
    var result = await p(function (cb) { getDictStatus(cb) })
    expect(result[0]).toBe('ready')
    expect(result[1]).toBe(3)
  })

  it('returns cached when in IDB but not parsed', async () => {
    const { cacheSet, _resetDict, getDictStatus } = loadDict()
    _resetDict()
    await p(function (cb) { cacheSet('__dictionary__', 'a|def\n', cb) })
    var result = await p(function (cb) { getDictStatus(cb) })
    expect(result[0]).toBe('cached')
  })
})

describe('clearDictionary', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  it('clears in-memory state and IDB cache', async () => {
    const { _resetDict, _parseDict, clearDictionary, getDictStatus } = loadDict()
    _resetDict()
    _parseDict('cat|an animal\n')
    await p(function (cb) { clearDictionary(cb) })
    var result = await p(function (cb) { getDictStatus(cb) })
    expect(result[0]).toBe('not-downloaded')
  })
})

describe('downloadDictionary', () => {
  var restore
  var origXHR

  beforeEach(() => {
    restore = setupIDB()
    origXHR = globalThis.XMLHttpRequest
  })
  afterEach(() => {
    restore()
    globalThis.XMLHttpRequest = origXHR
  })

  function mockXHR(responseText, status) {
    var instances = []
    function FakeXHR() {
      instances.push(this)
      this.readyState = 0
      this.status = 0
      this.responseText = ''
    }
    FakeXHR.prototype.open = function () {}
    FakeXHR.prototype.send = function () {
      var self = this
      setTimeout(function () {
        self.readyState = 4
        self.status = status || 200
        self.responseText = responseText || ''
        if (self.onreadystatechange) self.onreadystatechange()
      }, 0)
    }
    globalThis.XMLHttpRequest = FakeXHR
    return instances
  }

  it('downloads, caches, and parses dictionary', async () => {
    mockXHR('apple|a fruit\nbook|a written work\n')
    const { _resetDict, downloadDictionary, getDictStatus } = loadDict()
    _resetDict()
    var result = await p(function (cb) { downloadDictionary(cb) })
    expect(result[0]).toBe(null)
    var status = await p(function (cb) { getDictStatus(cb) })
    expect(status[0]).toBe('ready')
    expect(status[1]).toBe(2)
  })

  it('returns error on HTTP failure', async () => {
    mockXHR('', 404)
    const { _resetDict, downloadDictionary } = loadDict()
    _resetDict()
    var result = await p(function (cb) { downloadDictionary(cb) })
    expect(result[0]).toBe('HTTP 404')
  })

  it('does not re-download if already in memory', async () => {
    var instances = mockXHR('should not be called')
    const { _resetDict, _parseDict, downloadDictionary } = loadDict()
    _resetDict()
    _parseDict('apple|a fruit\n')
    var result = await p(function (cb) { downloadDictionary(cb) })
    expect(result[0]).toBe(null)
    expect(instances.length).toBe(0)
  })
})
