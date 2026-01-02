import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ref, nextTick } from 'vue'
import { useToolInstanceStore } from '../useToolInstanceStore.js'

describe('useToolInstanceStore', () => {
  const TOOL_NAME = 'test-tool'
  const TOOL_ID = 'test-tool-123'
  const SESSION_ID = 'test-session-456'

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('get', () => {
    it('returns stored value', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('name', 'Alice')

      expect(await store.get('name')).toBe('Alice')
    })

    it('returns undefined for non-existent key by default', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store.get('missing')).toBe(undefined)
    })

    it('returns default value for non-existent key', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store.get('missing', 'default')).toBe('default')
      expect(await store.get('count', 0)).toBe(0)
      expect(await store.get('flag', true)).toBe(true)
    })

    it('returns complex objects', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const obj = { nested: { value: 42 }, arr: [1, 2, 3] }
      await store.set('complex', obj)

      expect(await store.get('complex')).toEqual(obj)
      expect((await store.get('complex')).nested.value).toBe(42)
    })
  })

  describe('set', () => {
    it('sets a value', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('value', 'test')

      expect(await store.get('value')).toBe('test')
    })

    it('overwrites existing value', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('key', 'first')
      await store.set('key', 'second')

      expect(await store.get('key')).toBe('second')
    })
  })

  describe('update', () => {
    it('updates multiple values at once', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('a', 1)
      await store.set('b', 2)

      await store.update({ a: 10, c: 30 })

      expect(await store.get('a')).toBe(10)
      expect(await store.get('b')).toBe(2)
      expect(await store.get('c')).toBe(30)
    })
  })

  describe('remove', () => {
    it('removes a key', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('toRemove', 'value')

      await store.remove('toRemove')

      expect(await store.get('toRemove')).toBe(undefined)
      expect(await store.has('toRemove')).toBe(false)
    })
  })

  describe('clear', () => {
    it('removes all data', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('a', 1)
      await store.set('b', 2)
      await store.set('c', 3)

      await store.clear()

      expect(await store.keys()).toEqual([])
      expect(await store.get('a')).toBe(undefined)
    })
  })

  describe('keys', () => {
    it('returns all keys', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('a', 1)
      await store.set('b', 2)
      await store.set('c', 3)

      const keys = await store.keys()
      expect(keys.sort()).toEqual(['a', 'b', 'c'])
    })

    it('returns empty array when no data', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store.keys()).toEqual([])
    })
  })

  describe('has', () => {
    it('returns true for existing key', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('exists', true)

      expect(await store.has('exists')).toBe(true)
    })

    it('returns false for missing key', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store.has('missing')).toBe(false)
    })

    it('returns false after removal', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('temp', 'value')
      await store.remove('temp')

      expect(await store.has('temp')).toBe(false)
    })
  })

  describe('getState', () => {
    it('returns all state as object', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.update({ a: 1, b: 2, c: 3 })

      expect(await store.getState()).toEqual({ a: 1, b: 2, c: 3 })
    })

    it('returns empty object when no data', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store.getState()).toEqual({})
    })
  })

  describe('getStateSync', () => {
    it('returns cached state synchronously', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      // Initially empty
      expect(store.getStateSync()).toEqual({})

      await store.set('key', 'value')

      // After setting, cache is updated
      expect(store.getStateSync()).toEqual({ key: 'value' })
    })
  })

  describe('setState', () => {
    it('replaces entire state', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('old', 'data')

      await store.setState({ new: 'data' })

      expect(await store.get('old')).toBe(undefined)
      expect(await store.get('new')).toBe('data')
    })
  })

  describe('watchAndPersist', () => {
    it('watches a ref and persists changes', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const value = ref('initial')

      store.watchAndPersist(value, 'watched')

      await nextTick()
      expect(await store.get('watched')).toBe('initial')

      value.value = 'updated'

      await nextTick()
      expect(await store.get('watched')).toBe('updated')
    })

    it('uses default key "value" when not specified', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const value = ref(42)

      store.watchAndPersist(value)

      await nextTick()
      expect(await store.get('value')).toBe(42)
    })
  })

  describe('tool instance isolation', () => {
    it('different tool instances have separate storage', async () => {
      const store1 = useToolInstanceStore(TOOL_NAME, 'instance-1', SESSION_ID)
      const store2 = useToolInstanceStore(TOOL_NAME, 'instance-2', SESSION_ID)

      await store1.set('shared', 'from-1')
      await store2.set('shared', 'from-2')

      expect(await store1.get('shared')).toBe('from-1')
      expect(await store2.get('shared')).toBe('from-2')
    })

    it('clearing one instance does not affect another', async () => {
      const store1 = useToolInstanceStore(TOOL_NAME, 'instance-1', SESSION_ID)
      const store2 = useToolInstanceStore(TOOL_NAME, 'instance-2', SESSION_ID)

      await store1.set('data', 'value-1')
      await store2.set('data', 'value-2')

      await store1.clear()

      expect(await store1.get('data')).toBe(undefined)
      expect(await store2.get('data')).toBe('value-2')
    })

    it('same tool instance ID returns same data', async () => {
      const store1 = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store1.set('persistent', 'value')

      const store2 = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)

      expect(await store2.get('persistent')).toBe('value')
    })
  })

  describe('session isolation', () => {
    it('different sessions have separate storage', async () => {
      const store1 = useToolInstanceStore(TOOL_NAME, TOOL_ID, 'session-1')
      const store2 = useToolInstanceStore(TOOL_NAME, TOOL_ID, 'session-2')

      await store1.set('config', 'config-a')
      await store2.set('config', 'config-b')

      expect(await store1.get('config')).toBe('config-a')
      expect(await store2.get('config')).toBe('config-b')
    })
  })

  describe('data types', () => {
    it('handles strings', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('str', 'hello')

      expect(await store.get('str')).toBe('hello')
    })

    it('handles numbers', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('num', 42)
      await store.set('float', 3.14)

      expect(await store.get('num')).toBe(42)
      expect(await store.get('float')).toBe(3.14)
    })

    it('handles booleans', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('bool', true)

      expect(await store.get('bool')).toBe(true)
    })

    it('handles null', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      await store.set('nullVal', null)

      expect(await store.get('nullVal')).toBe(null)
    })

    it('handles arrays', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const arr = [1, 2, 3]
      await store.set('arr', arr)

      expect(await store.get('arr')).toEqual(arr)
    })

    it('handles objects', async () => {
      const store = useToolInstanceStore(TOOL_NAME, TOOL_ID, SESSION_ID)
      const obj = { a: 1, b: { c: 2 } }
      await store.set('obj', obj)

      expect(await store.get('obj')).toEqual(obj)
      expect((await store.get('obj')).b.c).toBe(2)
    })
  })

  describe('no-op fallback', () => {
    it('returns no-op store when toolId is missing', async () => {
      const store = useToolInstanceStore(TOOL_NAME, '', SESSION_ID)

      expect(await store.get('any', 'default')).toBe('default')
      await store.set('any', 'value')
      expect(await store.get('any', 'default')).toBe('default')
    })

    it('no-op store has safe methods', async () => {
      const store = useToolInstanceStore(TOOL_NAME, '', SESSION_ID)

      expect(() => store.set('x', 1)).not.toThrow()
      expect(() => store.update({ x: 1 })).not.toThrow()
      expect(() => store.remove('x')).not.toThrow()
      expect(() => store.clear()).not.toThrow()
      expect(() => store.watchAndPersist(ref(1))).not.toThrow()
    })
  })
})
