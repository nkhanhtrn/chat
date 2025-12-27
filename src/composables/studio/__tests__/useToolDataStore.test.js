import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useToolDataStore } from '../useToolDataStore.js'

describe('useToolDataStore', () => {
  const TOOL_NAME = 'test-tool'
  const STORAGE_KEY = 'tool-data-test-tool'

  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('creates a record with auto-generated id', () => {
      const db = useToolDataStore(TOOL_NAME)
      const record = db.create({ text: 'Hello', done: false })

      expect(record.id).toBeDefined()
      expect(record.text).toBe('Hello')
      expect(record.done).toBe(false)
      expect(record._createdAt).toBeDefined()
    })

    it('persists to localStorage', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'Test' })

      const stored = JSON.parse(localStorage.getItem(STORAGE_KEY))
      expect(Object.keys(stored).length).toBe(1)
    })

    it('creates multiple records with unique ids', () => {
      const db = useToolDataStore(TOOL_NAME)
      const r1 = db.create({ text: 'First' })
      const r2 = db.create({ text: 'Second' })

      expect(r1.id).not.toBe(r2.id)
    })
  })

  describe('read', () => {
    it('returns all records as array when no id provided', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'First' })
      db.create({ text: 'Second' })

      const all = db.read()
      expect(Array.isArray(all)).toBe(true)
      expect(all.length).toBe(2)
    })

    it('returns records sorted by creation time (newest first)', async () => {
      const db = useToolDataStore(TOOL_NAME)
      const r1 = db.create({ text: 'First' })

      // Wait to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 5))

      const r2 = db.create({ text: 'Second' })

      const all = db.read()
      expect(all[0].id).toBe(r2.id)
      expect(all[1].id).toBe(r1.id)
    })

    it('returns single record when id provided', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Test' })

      const record = db.read(created.id)
      expect(record.id).toBe(created.id)
      expect(record.text).toBe('Test')
    })

    it('returns null for non-existent id', () => {
      const db = useToolDataStore(TOOL_NAME)
      const record = db.read('non-existent')
      expect(record).toBe(null)
    })

    it('returns empty array when no records exist', () => {
      const db = useToolDataStore(TOOL_NAME)
      const all = db.read()
      expect(all).toEqual([])
    })
  })

  describe('update', () => {
    it('updates existing record', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Original', done: false })

      const updated = db.update(created.id, { done: true })

      expect(updated.done).toBe(true)
      expect(updated.text).toBe('Original')
      expect(updated._updatedAt).toBeDefined()
    })

    it('persists update to localStorage', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Test' })
      db.update(created.id, { text: 'Updated' })

      // Create new instance to verify persistence
      const db2 = useToolDataStore(TOOL_NAME)
      const record = db2.read(created.id)
      expect(record.text).toBe('Updated')
    })

    it('returns null for non-existent id', () => {
      const db = useToolDataStore(TOOL_NAME)
      const result = db.update('non-existent', { text: 'Test' })
      expect(result).toBe(null)
    })

    it('merges updates with existing data', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ a: 1, b: 2, c: 3 })

      db.update(created.id, { b: 20 })

      const record = db.read(created.id)
      expect(record.a).toBe(1)
      expect(record.b).toBe(20)
      expect(record.c).toBe(3)
    })
  })

  describe('delete', () => {
    it('removes existing record', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Test' })

      const result = db.delete(created.id)

      expect(result).toBe(true)
      expect(db.read(created.id)).toBe(null)
    })

    it('returns false for non-existent id', () => {
      const db = useToolDataStore(TOOL_NAME)
      const result = db.delete('non-existent')
      expect(result).toBe(false)
    })

    it('persists deletion to localStorage', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Test' })
      db.delete(created.id)

      const db2 = useToolDataStore(TOOL_NAME)
      expect(db2.read(created.id)).toBe(null)
    })
  })

  describe('query', () => {
    it('filters records by predicate', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'Task 1', done: true })
      db.create({ text: 'Task 2', done: false })
      db.create({ text: 'Task 3', done: true })

      const completed = db.query(r => r.done === true)

      expect(completed.length).toBe(2)
      expect(completed.every(r => r.done === true)).toBe(true)
    })

    it('returns empty array when no matches', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'Task', done: false })

      const completed = db.query(r => r.done === true)

      expect(completed).toEqual([])
    })

    it('supports complex predicates', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ name: 'Alice', age: 30 })
      db.create({ name: 'Bob', age: 25 })
      db.create({ name: 'Charlie', age: 35 })

      const results = db.query(r => r.age >= 30 && r.name.startsWith('A'))

      expect(results.length).toBe(1)
      expect(results[0].name).toBe('Alice')
    })
  })

  describe('clear', () => {
    it('removes all records', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'First' })
      db.create({ text: 'Second' })

      db.clear()

      expect(db.read()).toEqual([])
    })

    it('persists clear to localStorage', () => {
      const db = useToolDataStore(TOOL_NAME)
      db.create({ text: 'Test' })
      db.clear()

      const db2 = useToolDataStore(TOOL_NAME)
      expect(db2.read()).toEqual([])
    })
  })

  describe('count', () => {
    it('returns number of records', () => {
      const db = useToolDataStore(TOOL_NAME)
      expect(db.count()).toBe(0)

      db.create({ text: 'First' })
      expect(db.count()).toBe(1)

      db.create({ text: 'Second' })
      expect(db.count()).toBe(2)
    })
  })

  describe('namespace isolation', () => {
    it('different tool names have separate data', () => {
      const db1 = useToolDataStore('tool-a')
      const db2 = useToolDataStore('tool-b')

      db1.create({ text: 'From A' })
      db2.create({ text: 'From B' })

      expect(db1.read().length).toBe(1)
      expect(db1.read()[0].text).toBe('From A')

      expect(db2.read().length).toBe(1)
      expect(db2.read()[0].text).toBe('From B')
    })

    it('clearing one tool does not affect another', () => {
      const db1 = useToolDataStore('tool-a')
      const db2 = useToolDataStore('tool-b')

      db1.create({ text: 'From A' })
      db2.create({ text: 'From B' })

      db1.clear()

      expect(db1.read()).toEqual([])
      expect(db2.read().length).toBe(1)
    })
  })

  describe('data persistence', () => {
    it('data survives creating new store instance', () => {
      const db1 = useToolDataStore(TOOL_NAME)
      const created = db1.create({ text: 'Persistent' })

      const db2 = useToolDataStore(TOOL_NAME)
      const record = db2.read(created.id)

      expect(record.text).toBe('Persistent')
    })
  })

  describe('error handling', () => {
    it('handles corrupted localStorage gracefully', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json{')

      const db = useToolDataStore(TOOL_NAME)
      const all = db.read()

      expect(all).toEqual([])
    })

    it('can recover by creating new records after corruption', () => {
      localStorage.setItem(STORAGE_KEY, 'invalid json{')

      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({ text: 'Recovery' })

      expect(created.text).toBe('Recovery')
      expect(db.read().length).toBe(1)
    })
  })

  describe('flexible JSON support', () => {
    it('stores nested objects', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({
        user: { name: 'John', email: 'john@example.com' },
        settings: { theme: 'dark', notifications: true }
      })

      const record = db.read(created.id)
      expect(record.user.name).toBe('John')
      expect(record.settings.theme).toBe('dark')
    })

    it('stores arrays', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({
        tags: ['work', 'important', 'urgent'],
        items: [{ id: 1 }, { id: 2 }]
      })

      const record = db.read(created.id)
      expect(record.tags).toEqual(['work', 'important', 'urgent'])
      expect(record.items.length).toBe(2)
    })

    it('updates nested properties', () => {
      const db = useToolDataStore(TOOL_NAME)
      const created = db.create({
        config: { level1: { level2: 'original' } }
      })

      db.update(created.id, {
        config: { level1: { level2: 'updated' } }
      })

      const record = db.read(created.id)
      expect(record.config.level1.level2).toBe('updated')
    })
  })
})
