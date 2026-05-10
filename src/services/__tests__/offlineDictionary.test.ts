import { describe, it, expect, vi, beforeEach } from 'vitest'
import { _test, dictionaryLookup, isDictionaryLoaded } from '../offlineDictionary'

const { editDistance, fuzzyMatch, toResult } = _test

describe('editDistance', () => {
  it('returns 0 for identical strings', () => {
    expect(editDistance('hello', 'hello')).toBe(0)
  })

  it('returns length for empty string comparison', () => {
    expect(editDistance('', 'abc')).toBe(3)
    expect(editDistance('abc', '')).toBe(3)
  })

  it('returns 0 for two empty strings', () => {
    expect(editDistance('', '')).toBe(0)
  })

  it('computes single substitution', () => {
    expect(editDistance('cat', 'car')).toBe(1)
  })

  it('computes single insertion', () => {
    expect(editDistance('cat', 'cats')).toBe(1)
  })

  it('computes single deletion', () => {
    expect(editDistance('cats', 'cat')).toBe(1)
  })

  it('computes multiple edits', () => {
    expect(editDistance('kitten', 'sitting')).toBe(3)
  })

  it('is case sensitive', () => {
    expect(editDistance('Hello', 'hello')).toBe(1)
  })
})

describe('fuzzyMatch', () => {
  const dict: Record<string, { d: string; p?: string }> = {
    'hello': { d: 'a greeting' },
    'world': { d: 'the earth' },
    'their': { d: 'belonging to them' },
    'there': { d: 'at that place' },
    'apple': { d: 'a fruit' },
    'application': { d: 'a formal request' },
  }

  it('finds exact match', () => {
    expect(fuzzyMatch('hello', dict)).toBe('hello')
  })

  it('finds match with 1-char typo', () => {
    expect(fuzzyMatch('helo', dict)).toBe('hello')
  })

  it('finds match case-insensitively', () => {
    expect(fuzzyMatch('HELLO', dict)).toBe('hello')
  })

  it('returns null for too different input', () => {
    expect(fuzzyMatch('xyz', dict)).toBeNull()
  })

  it('returns null for empty input', () => {
    expect(fuzzyMatch('', dict)).toBeNull()
  })

  it('picks closest match when multiple candidates exist', () => {
    expect(fuzzyMatch('thier', dict)).toBe('their')
  })
})

describe('toResult', () => {
  it('returns definition and pronunciation', () => {
    const result = toResult({ d: 'a greeting', p: '/həˈloʊ/' }, false)
    expect(result).toEqual({
      definition: 'a greeting',
      pronunciation: '/həˈloʊ/',
      fuzzy: false,
    })
  })

  it('defaults pronunciation to empty string', () => {
    const result = toResult({ d: 'a greeting' }, true)
    expect(result.pronunciation).toBe('')
    expect(result.fuzzy).toBe(true)
  })
})

describe('dictionaryLookup', () => {
  const mockDict = {
    'hello': { d: '**n.** a greeting\n\n**v.** to greet someone', p: '/həˈloʊ/' },
    'think': { d: '**v.** to reason about something', p: '/θɪŋk/' },
    'cat': { d: '**n.** a small domesticated feline' },
  }

  beforeEach(() => {
    vi.resetModules()
  })

  it('returns exact match', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(mockDict),
        put: vi.fn(),
      }),
    }))

    const { dictionaryLookup: lookup } = await import('../offlineDictionary')
    const result = await lookup('hello')

    expect(result).not.toBeNull()
    expect(result!.definition).toContain('a greeting')
    expect(result!.pronunciation).toBe('/həˈloʊ/')
    expect(result!.fuzzy).toBe(false)
  })

  it('returns fuzzy match for typo', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(mockDict),
        put: vi.fn(),
      }),
    }))

    const { dictionaryLookup: lookup } = await import('../offlineDictionary')
    const result = await lookup('thikn')

    expect(result).not.toBeNull()
    expect(result!.definition).toContain('to reason')
    expect(result!.fuzzy).toBe(true)
  })

  it('returns null for unknown word', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(mockDict),
        put: vi.fn(),
      }),
    }))

    const { dictionaryLookup: lookup } = await import('../offlineDictionary')
    const result = await lookup('xyz12345')

    expect(result).toBeNull()
  })

  it('is case insensitive', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(mockDict),
        put: vi.fn(),
      }),
    }))

    const { dictionaryLookup: lookup } = await import('../offlineDictionary')
    const result = await lookup('HELLO')

    expect(result).not.toBeNull()
    expect(result!.fuzzy).toBe(false)
  })
})

describe('isDictionaryLoaded', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('returns true when dictionary is cached', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue({ hello: { d: 'greeting' } }),
        put: vi.fn(),
      }),
    }))

    const { isDictionaryLoaded: isLoaded } = await import('../offlineDictionary')
    const result = await isLoaded()

    expect(result).toBe(true)
  })

  it('returns false when no dictionary available', async () => {
    vi.doMock('@/services/sync/IndexedDBService', () => ({
      getDB: vi.fn().mockResolvedValue({
        get: vi.fn().mockResolvedValue(null),
        put: vi.fn(),
      }),
    }))

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404 }))

    const { isDictionaryLoaded: isLoaded } = await import('../offlineDictionary')
    const result = await isLoaded()

    expect(result).toBe(false)
  })
})
