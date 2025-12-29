import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useToolInstanceStore } from '../useToolInstanceStore.js'

describe('useToolInstanceStore', () => {
  const TOOL_NAME = 'test-tool'
  const TOOL_ID = 'test-tool-123'
  const SESSION_ID = 'test-session-456'
  const STORAGE_KEY = 'tool-instance-test-session-456-test-tool-123'

  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('returns stored value', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('name', 'Alice')

      expect(store.get('name')).toBe('Alice')
    })

    it('returns undefined for non-existent key by default', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.get('missing')).toBe(undefined)
    })

    it('returns default value for non-existent key', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.get('missing', 'default')).toBe('default')
      expect(store.get('count', 0)).toBe(0)
      expect(store.get('flag', true)).toBe(true)
    })

    it('returns complex objects', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const obj = { nested: { value: 42 }, arr: [1, 2, 3] }
      store.set('complex', obj)

      expect(store.get('complex')).toEqual(obj)
      expect(store.get('complex').nested.value).toBe(42)
    })
  })

  describe('set', () => {
    it('sets a value', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('value', 'test')

      expect(localStorage.getItem(STORAGE_KEY)).toContain('value')
      expect(localStorage.getItem(STORAGE_KEY)).toContain('test')
    })

    it('overwrites existing value', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('key', 'first')
      store.set('key', 'second')

      expect(store.get('key')).toBe('second')
    })

    it('persists to localStorage', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('persisted', true)

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored.persisted).toBe(true)
    })
  })

  describe('update', () => {
    it('updates multiple values at once', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('a', 1)
      store.set('b', 2)

      store.update({ a: 10, c: 30 })

      expect(store.get('a')).toBe(10)
      expect(store.get('b')).toBe(2)
      expect(store.get('c')).toBe(30)
    })

    it('persists updates to localStorage', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.update({ name: 'Bob', age: 25 })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored.name).toBe('Bob')
      expect(stored.age).toBe(25)
    })
  })

  describe('remove', () => {
    it('removes a key', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('toRemove', 'value')

      store.remove('toRemove')

      expect(store.get('toRemove')).toBe(undefined)
      expect(store.has('toRemove')).toBe(false)
    })

    it('persists removal to localStorage', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('temp', 'value')
      store.remove('temp')

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect('temp' in stored).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all data', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('a', 1)
      store.set('b', 2)
      store.set('c', 3)

      store.clear()

      expect(store.keys()).toEqual([])
      expect(store.get('a')).toBe(undefined)
    })

    it('persists clear to localStorage', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('data', 'value')
      store.clear()

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored).toEqual({})
    })
  })

  describe('keys', () => {
    it('returns all keys', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('a', 1)
      store.set('b', 2)
      store.set('c', 3)

      expect(store.keys().sort()).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array when no data', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.keys()).toEqual([])
    })
  })

  describe('has', () => {
    it('returns true for existing key', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('exists', true)

      expect(store.has('exists')).toBe(true)
    })

    it('returns false for missing key', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.has('missing')).toBe(false)
    })

    it('returns false after removal', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('temp', 'value')
      store.remove('temp')

      expect(store.has('temp')).toBe(false)
    })
  })

  describe('getState', () => {
    it('returns all state as object', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.update({ a: 1, b: 2, c: 3 })

      expect(store.getState()).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('returns empty object when no data', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.getState()).toEqual({})
    })

    it('returns a copy, not reference', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('key', 'value')

      const state = store.getState()
      state.key = 'modified'

      expect(store.get('key')).toBe('value')
    })
  })

  describe('setState', () => {
    it('replaces entire state', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('old', 'data')

      store.setState({ new: 'data' })

      expect(store.get('old')).toBe(undefined)
      expect(store.get('new')).toBe('data')
    })

    it('persists to localStorage', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.setState({ replaced: true })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(stored).toEqual({ replaced: true })
    })
  })

  describe('watchAndPersist', () => {
    it('watches a ref and persists changes', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const value = ref('initial')

      store.watchAndPersist(value, 'watched')

      await nextTick()
      expect(store.get('watched')).toBe('initial')

      value.value = 'updated'

      await nextTick()
      expect(store.get('watched')).toBe('updated')
    })

    it('uses default key "value" when not specified', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const value = ref(42)

      store.watchAndPersist(value)

      await nextTick()
      expect(store.get('value')).toBe(42)
    })
  })

  describe('tool instance isolation', () => {
    it('different tool instances have separate storage', () => {
      const store1 = useToolInstanceStore(TOOL_NAME, 'instance-1', SESSION_ID)
      const store2 = useToolInstanceStore(TOOL_NAME, 'instance-2', SESSION_ID)

      store1.set('shared', 'from-1')
      store2.set('shared', 'from-2')

      expect(store1.get('shared')).toBe('from-1')
      expect(store2.get('shared')).toBe('from-2')
    })

    it('clearing one instance does not affect another', () => {
      const store1 = useToolInstanceStore(TOOL_NAME, 'instance-1', SESSION_ID)
      const store2 = useToolInstanceStore(TOOL_NAME, 'instance-2', SESSION_ID)

      store1.set('data', 'value-1')
      store2.set('data', 'value-2')

      store1.clear()

      expect(store1.get('data')).toBe(undefined)
      expect(store2.get('data')).toBe('value-2')
    })

    it('same tool instance ID returns same data', () => {
      const store1 = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store1.set('persistent', 'value')

      const store2 = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store2.get('persistent')).toBe('value')
    })
  })

  describe('session isolation', () => {
    it('different sessions have separate storage', () => {
      const store1 = useToolInstanceStore(TOOL_NAME, TOOL_ID, 'session-1')
      const store2 = useToolInstanceStore(TOOL_NAME, TOOL_ID, 'session-2')

      store1.set('config', 'config-a')
      store2.set('config', 'config-b')

      expect(store1.get('config')).toBe('config-a')
      expect(store2.get('config')).toBe('config-b')
    })
  })

  describe('data types', () => {
    it('handles strings', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('str', 'hello')

      expect(store.get('str')).toBe('hello')
    })

    it('handles numbers', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('num', 42)
      store.set('float', 3.14)

      expect(store.get('num')).toBe(42)
      expect(store.get('float')).toBe(3.14)
    })

    it('handles booleans', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('bool', true)

      expect(store.get('bool')).toBe(true)
    })

    it('handles null', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('nullVal', null)

      expect(store.get('nullVal')).toBe(null)
    })

    it('handles arrays', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const arr = [1, 2, 3]
      store.set('arr', arr)

      expect(store.get('arr')).toEqual(arr)
    })

    it('handles objects', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const obj = { a: 1, b: { c: 2 } }
      store.set('obj', obj)

      expect(store.get('obj')).toEqual(obj)
      expect(store.get('obj').b.c).toBe(2)
    })
  })

  describe('error handling', () => {
    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json{')

      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(store.get('any')).toBe(undefined)
      expect(store.keys()).toEqual([])
    })

    it('can recover by setting new values after corruption', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json{')

      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('recovered', 'value')

      expect(store.get('recovered')).toBe('value')
    })
  })

  describe('edge cases', () => {
    it('handles empty string key', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('', 'empty-key')

      expect(store.get('')).toBe('empty-key')
      expect(store.has('')).toBe(true)
    })

    it('handles special characters in keys', () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      store.set('key-with-dash', 'value')
      store.set('key_with_underscore', 'value')
      store.set('key.with.dot', 'value')

      expect(store.get('key-with-dash')).toBe('value')
      expect(store.get('key_with_underscore')).toBe('value')
      expect(store.get('key.with.dot')).toBe('value')
    })
  })

  describe('no-op fallback', () => {
    it('returns no-op store when toolId is missing', () => {
      const store = useToolInstanceStore(TOOL_NAME, '', SESSION_ID)

      expect(store.get('any', 'default')).toBe('default')
      store.set('any', 'value')
      expect(store.get('any', 'default')).toBe('default')
    })

    it('no-op store has safe methods', () => {
      const store = useToolInstanceStore(TOOL_NAME, '', SESSION_ID)

      expect(() => store.set('x', 1)).not.toThrow()
      expect(() => store.update({ x: 1 })).not.toThrow()
      expect(() => store.remove('x')).not.toThrow()
      expect(() => store.clear()).not.toThrow()
      expect(() => store.watchAndPersist(ref(1))).not.toThrow()
    })
  })
})
