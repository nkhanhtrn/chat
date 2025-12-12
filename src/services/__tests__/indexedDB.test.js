import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveChatStateToIDB,
  loadChatStateFromIDB,
  clearChatStateFromIDB,
  migrateFromLocalStorage,
  isIndexedDBAvailable
} from '../indexedDB.js'

// Mock the idb library
const mockStore = {}
const mockDB = {
  put: vi.fn((storeName, value, key) => {
    mockStore[key] = value
    return Promise.resolve()
  }),
  get: vi.fn((storeName, key) => {
    return Promise.resolve(mockStore[key] || null)
  }),
  delete: vi.fn((storeName, key) => {
    delete mockStore[key]
    return Promise.resolve()
  })
}

vi.mock('idb', () => ({
  openDB: vi.fn(() => Promise.resolve(mockDB))
}))

describe('indexedDB.js', () => {
  const mockLocalStorage = {
    store: {},
    getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key, value) => { mockLocalStorage.store[key] = value }),
    removeItem: vi.fn((key) => { delete mockLocalStorage.store[key] }),
    clear: vi.fn(() => { mockLocalStorage.store = {} })
  }

  beforeEach(() => {
    // Clear mock store
    Object.keys(mockStore).forEach(key => delete mockStore[key])

    // Reset mock functions
    mockDB.put.mockClear()
    mockDB.get.mockClear()
    mockDB.delete.mockClear()

    // Reset localStorage mock
    mockLocalStorage.store = {}
    mockLocalStorage.getItem.mockClear()
    mockLocalStorage.setItem.mockClear()
    mockLocalStorage.removeItem.mockClear()

    // Mock global localStorage
    Object.defineProperty(global, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('saveChatStateToIDB', () => {
    it('saves state to IndexedDB', async () => {
      const state = {
        messagesById: { msg1: { id: 'msg1', question: 'Test' } },
        chats: [{ id: 'chat1' }]
      }

      await saveChatStateToIDB(state)

      expect(mockDB.put).toHaveBeenCalledWith('app-data', state, 'chat-state')
    })

    it('throws error when save fails', async () => {
      mockDB.put.mockRejectedValueOnce(new Error('Save failed'))

      const state = { messagesById: {}, chats: [] }

      await expect(saveChatStateToIDB(state)).rejects.toThrow('Save failed')
    })
  })

  describe('loadChatStateFromIDB', () => {
    it('loads state from IndexedDB', async () => {
      const expectedState = {
        messagesById: { msg1: { id: 'msg1' } },
        chats: []
      }
      mockStore['chat-state'] = expectedState

      const result = await loadChatStateFromIDB()

      expect(result).toEqual(expectedState)
      expect(mockDB.get).toHaveBeenCalledWith('app-data', 'chat-state')
    })

    it('returns null when no data exists', async () => {
      const result = await loadChatStateFromIDB()

      expect(result).toBeNull()
    })

    it('returns null when load fails', async () => {
      mockDB.get.mockRejectedValueOnce(new Error('Load failed'))

      const result = await loadChatStateFromIDB()

      expect(result).toBeNull()
    })
  })

  describe('clearChatStateFromIDB', () => {
    it('clears state from IndexedDB', async () => {
      mockStore['chat-state'] = { data: 'test' }

      await clearChatStateFromIDB()

      expect(mockDB.delete).toHaveBeenCalledWith('app-data', 'chat-state')
    })

    it('throws error when clear fails', async () => {
      mockDB.delete.mockRejectedValueOnce(new Error('Delete failed'))

      await expect(clearChatStateFromIDB()).rejects.toThrow('Delete failed')
    })
  })

  describe('migrateFromLocalStorage', () => {
    it('migrates data from localStorage to IndexedDB', async () => {
      const localData = {
        messagesById: { msg1: { id: 'msg1' } },
        chats: [{ id: 'chat1' }]
      }
      mockLocalStorage.store['chat-state'] = JSON.stringify(localData)

      const result = await migrateFromLocalStorage()

      expect(result).toBe(true)
      expect(mockDB.put).toHaveBeenCalledWith('app-data', localData, 'chat-state')
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat-state')
    })

    it('returns false when no localStorage data exists', async () => {
      const result = await migrateFromLocalStorage()

      expect(result).toBe(false)
      expect(mockDB.put).not.toHaveBeenCalled()
    })

    it('skips migration when IndexedDB already has data', async () => {
      const localData = { messagesById: { msg1: {} }, chats: [] }
      const idbData = { messagesById: { msg2: {} }, chats: [] }

      mockLocalStorage.store['chat-state'] = JSON.stringify(localData)
      mockStore['chat-state'] = idbData

      const result = await migrateFromLocalStorage()

      expect(result).toBe(false)
      // Should clear localStorage even if skipping migration
      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat-state')
    })

    it('returns false when migration fails', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify({ data: 'test' })
      mockDB.put.mockRejectedValueOnce(new Error('Migration failed'))

      const result = await migrateFromLocalStorage()

      expect(result).toBe(false)
    })

    it('handles invalid JSON in localStorage gracefully', async () => {
      mockLocalStorage.store['chat-state'] = 'invalid json {'

      const result = await migrateFromLocalStorage()

      expect(result).toBe(false)
    })
  })

  describe('isIndexedDBAvailable', () => {
    it('returns true when indexedDB is available', () => {
      // indexedDB is typically available in jsdom/vitest
      Object.defineProperty(global, 'indexedDB', {
        value: {},
        writable: true
      })

      expect(isIndexedDBAvailable()).toBe(true)
    })

    it('returns false when indexedDB is undefined', () => {
      Object.defineProperty(global, 'indexedDB', {
        value: undefined,
        writable: true
      })

      expect(isIndexedDBAvailable()).toBe(false)
    })
  })
})
