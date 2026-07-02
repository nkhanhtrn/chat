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
  })

  it('parses word|ipa|def (3-field) format', () => {
    const { _parseDict, _resetDict, dictLookup } = loadDict()
    _resetDict()
    _parseDict('apple|\u02C8\xE6p\u0259l|a fruit\nbook|b\xCA\x8Ak|a written work\n')
    expect(dictLookup).toBeTruthy()
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
    cacheSet('__dict_eng__', 'apple|a round fruit\nbook|a written work\n', function () {
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
    await p(function (cb) { cacheSet('__dict_eng__', 'cat|an animal\n', cb) })
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
    await p(function (cb) { cacheSet('__dict_eng__', 'a|def\n', cb) })
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

  it('accepts 304 Not Modified (browser cache)', async () => {
    mockXHR('apple|a fruit\n', 304)
    const { _resetDict, downloadDictionary, getDictStatus } = loadDict()
    _resetDict()
    var result = await p(function (cb) { downloadDictionary(cb) })
    expect(result[0]).toBe(null)
    var status = await p(function (cb) { getDictStatus(cb) })
    expect(status[0]).toBe('ready')
    expect(status[1]).toBe(1)
  })
})

// ===== Suffix Stripping =====
describe('_stripSuffix', () => {
  const { _stripSuffix } = loadDict()

  it('strips -ing', () => {
    expect(_stripSuffix('asking')).toContain('ask')
  })

  it('strips -ing with restored -e', () => {
    expect(_stripSuffix('making')).toContain('make')
  })

  it('strips -ing with doubled consonant', () => {
    expect(_stripSuffix('running')).toContain('run')
  })

  it('strips -ed', () => {
    expect(_stripSuffix('asked')).toContain('ask')
  })

  it('strips -ed with doubled consonant', () => {
    expect(_stripSuffix('stopped')).toContain('stop')
  })

  it('strips -ly', () => {
    expect(_stripSuffix('quickly')).toContain('quick')
  })

  it('strips -ily to -y', () => {
    expect(_stripSuffix('easily')).toContain('easy')
  })

  it('strips -ally and -ically', () => {
    expect(_stripSuffix('optimistically')).toContain('optimistic')
  })

  it('strips -s', () => {
    expect(_stripSuffix('cats')).toContain('cat')
  })

  it('strips -es', () => {
    expect(_stripSuffix('boxes')).toContain('box')
  })

  it('strips -ies to -y', () => {
    expect(_stripSuffix('studies')).toContain('study')
  })

  it('strips -er', () => {
    expect(_stripSuffix('bigger')).toContain('big')
  })

  it('strips -ier to -y', () => {
    expect(_stripSuffix('happier')).toContain('happy')
  })

  it('does not strip -ss', () => {
    expect(_stripSuffix('class')).not.toContain('cla')
  })

  it('returns empty for short words', () => {
    expect(_stripSuffix('is')).toEqual([])
  })
})

describe('generateStems', () => {
  const { generateStems } = loadDict()

  it('generates recursive stems for -ally words', () => {
    var stems = generateStems('optimistically')
    expect(stems).toContain('optimistic')
    expect(stems).toContain('optimistical')
  })

  it('generates stem for -ing words', () => {
    expect(generateStems('asking')).toContain('ask')
  })

  it('generates stem for -ness words', () => {
    expect(generateStems('happiness')).toContain('happy')
  })

  it('deduplicates stems', () => {
    var stems = generateStems('running')
    var unique = stems.filter(function (s, i) { return stems.indexOf(s) === i })
    expect(stems.length).toBe(unique.length)
  })

  it('does not generate stems shorter than 3', () => {
    var stems = generateStems('asks')
    for (var i = 0; i < stems.length; i++)
      expect(stems[i].length).toBeGreaterThanOrEqual(3)
  })
})

// ===== Levenshtein =====
describe('_levenshtein', () => {
  const { _levenshtein } = loadDict()

  it('returns 0 for identical strings', () => {
    expect(_levenshtein('hello', 'hello', 3)).toBe(0)
  })

  it('returns 1 for single substitution', () => {
    expect(_levenshtein('cat', 'bat', 3)).toBe(1)
  })

  it('returns 1 for single insertion', () => {
    expect(_levenshtein('opstimistic', 'optimistic', 3)).toBe(1)
  })

  it('returns 1 for single deletion', () => {
    expect(_levenshtein('optimistic', 'optmistic', 3)).toBe(1)
  })

  it('returns 2 for two edits', () => {
    expect(_levenshtein('kitten', 'sitten', 2)).toBe(1)
    expect(_levenshtein('kitten', 'sittin', 2)).toBe(2)
  })

  it('respects maxDist early exit', () => {
    expect(_levenshtein('abc', 'xyz', 1)).toBe(2)
    expect(_levenshtein('abc', 'xyz', 0)).toBe(1)
  })

  it('returns maxDist+1 for too-different strings', () => {
    expect(_levenshtein('ab', 'abcdefgh', 2)).toBe(3)
  })
})

// ===== Fuzzy dictLookup =====
describe('dictLookup (fuzzy)', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  function load(dictText) {
    var api = loadDict()
    api._resetDict()
    api._parseDict(dictText)
    return api
  }

  it('finds word via suffix stripping (-ing → base)', async () => {
    const { dictLookup } = load('ask|\u00E6sk|to request\n')
    var result = await p(function (cb) { dictLookup('asking', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('ask')
  })

  it('finds word via suffix stripping (-ally → -ic)', async () => {
    const { dictLookup } = load('optimistic|\u02CC\u0251pt\u0259\u02C8m\u026Ast\u026Ak|hopeful\n')
    var result = await p(function (cb) { dictLookup('optimistically', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('optimistic')
  })

  it('finds word via suffix stripping (-s → base)', async () => {
    const { dictLookup } = load('cat|k\u00E6t|an animal\n')
    var result = await p(function (cb) { dictLookup('cats', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('cat')
  })

  it('finds word via fuzzy (typo: extra letter)', async () => {
    const { dictLookup } = load('optimistic|\u02CC\u0251pt\u0259\u02C8m\u026Ast\u026Ak|hopeful\n')
    var result = await p(function (cb) { dictLookup('opstimistic', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('optimistic')
  })

  it('finds word via fuzzy on stem (typo + suffix)', async () => {
    const { dictLookup } = load('optimistic|\u02CC\u0251pt\u0259\u02C8m\u026Ast\u026Ak|hopeful\n')
    var result = await p(function (cb) { dictLookup('opstimistical', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('optimistic')
  })

  it('returns IPA in entry for 3-field format', async () => {
    const { dictLookup } = load('ask|\u00E6sk|to request\n')
    var result = await p(function (cb) { dictLookup('ask', cb) })
    expect(result[1].ipa).toBe('\u00E6sk')
  })

  it('returns empty IPA for 2-field format', async () => {
    const { dictLookup } = load('ask|to request\n')
    var result = await p(function (cb) { dictLookup('ask', cb) })
    expect(result[1].ipa).toBe('')
  })

  it('returns null when no match at all', async () => {
    const { dictLookup } = load('cat|k\u00E6t|an animal\n')
    var result = await p(function (cb) { dictLookup('xyzqwerty', cb) })
    expect(result[1]).toBe(null)
  })

  it('does not fuzzy-match short words to much shorter words', async () => {
    const { dictLookup } = load('m|em|letter\nmom|m\u0251m|mother\n')
    var result = await p(function (cb) { dictLookup('mom', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('mom')
  })

  it('does not fuzzy-match short words when no close match exists', async () => {
    const { dictLookup } = load('m|em|letter\nman|m\u00E6n|adult male\n')
    var result = await p(function (cb) { dictLookup('mom', cb) })
    expect(result[1]).toBe(null)
  })
})

// ===== French Dictionary =====
describe('_stripElision', () => {
  const { _stripElision } = loadDict()

  it('strips l-apostrophe', () => {
    expect(_stripElision("l'arbre")).toBe('arbre')
  })

  it('strips d-apostrophe', () => {
    expect(_stripElision("d'accord")).toBe('accord')
  })

  it('strips qu-apostrophe', () => {
    expect(_stripElision("qu'il")).toBe('il')
  })

  it('strips j-apostrophe', () => {
    expect(_stripElision("j'ai")).toBe('ai')
  })

  it('does not strip words without apostrophe', () => {
    expect(_stripElision('arbre')).toBe('arbre')
  })

  it('handles uppercase elision', () => {
    expect(_stripElision("L'arbre")).toBe('arbre')
  })
})

describe('_removeAccents', () => {
  const { _removeAccents } = loadDict()

  it('removes common French accents', () => {
    expect(_removeAccents('cafe')).toBe('cafe')
    expect(_removeAccents('\u00E9l\u00E8ve')).toBe('eleve')
    expect(_removeAccents('fran\u00E7ais')).toBe('francais')
    expect(_removeAccents('h\u00F4tel')).toBe('hotel')
  })

  it('expands ligatures', () => {
    expect(_removeAccents('c\u0153ur')).toBe('coeur')
  })

  it('leaves non-accented text unchanged', () => {
    expect(_removeAccents('chat')).toBe('chat')
  })
})

describe('dictLookup (French)', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  function loadFre(text) {
    var api = loadDict()
    api._resetDict()
    api.state.activeDict = 'fre'
    api._parseDict(text, 'fre')
    return api
  }

  it('finds exact French word', async () => {
    const { dictLookup } = loadFre('chat||cat\nchien||dog\n')
    var result = await p(function (cb) { dictLookup('chat', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('chat')
    expect(result[1].def).toBe('cat')
  })

  it('finds conjugated verb form', async () => {
    const { dictLookup } = loadFre('manger||to eat\nmangeait||(manger) to eat\n')
    var result = await p(function (cb) { dictLookup('mangeait', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('mangeait')
  })

  it('finds word via accent-insensitive match', async () => {
    const { dictLookup } = loadFre('caf\u00E9||coffee\n')
    var result = await p(function (cb) { dictLookup('cafe', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('caf\u00E9')
  })

  it('finds word via elision stripping', async () => {
    const { dictLookup } = loadFre('arbre||tree\n')
    var result = await p(function (cb) { dictLookup("l'arbre", cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('arbre')
  })

  it('finds plural form', async () => {
    const { dictLookup } = loadFre('cheval||horse\nchevaux||(plural of cheval) horse\n')
    var result = await p(function (cb) { dictLookup('chevaux', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('chevaux')
  })
})

describe('dictLookup (active dict selection)', () => {
  var restore
  beforeEach(() => { restore = setupIDB() })
  afterEach(() => restore())

  it('uses eng when activeDict is eng', async () => {
    const api = loadDict()
    api._resetDict()
    api._parseDict('chat|to talk (eng)\n', 'eng')
    api._parseDict('chat||cat (fre)\n', 'fre')
    api.state.activeDict = 'eng'
    var result = await p(function (cb) { api.dictLookup('chat', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].def).toBe('to talk (eng)')
  })

  it('uses fre when activeDict is fre', async () => {
    const api = loadDict()
    api._resetDict()
    api._parseDict('chat|to talk (eng)\n', 'eng')
    api._parseDict('chat||cat (fre)\n', 'fre')
    api.state.activeDict = 'fre'
    var result = await p(function (cb) { api.dictLookup('chat', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].def).toBe('cat (fre)')
  })

  it('returns null when active dict has no match', async () => {
    const api = loadDict()
    api._resetDict()
    api._parseDict('dog|an animal\n', 'eng')
    api._parseDict('chat||cat\n', 'fre')
    api.state.activeDict = 'eng'
    var result = await p(function (cb) { api.dictLookup('chat', cb) })
    expect(result[1]).toBe(null)
  })

  it('defaults to eng when activeDict not set', async () => {
    const api = loadDict()
    api._resetDict()
    api._parseDict('dog|an animal\n', 'eng')
    api.state.activeDict = undefined
    var result = await p(function (cb) { api.dictLookup('dog', cb) })
    expect(result[1]).toBeTruthy()
    expect(result[1].word).toBe('dog')
  })
})
