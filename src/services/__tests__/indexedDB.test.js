import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveChatStateToIDB,
  loadChatStateFromIDB,
  clearChatStateFromIDB,
  migrateFromLocalStorage,
  isIndexedDBAvailable,
  saveTool,
  getToolByName,
  getAllTools,
  deleteTool,
  searchToolByQuery
} from '../indexedDB.js'

// Mock the idb library
const mockAppDataStore = {}
const mockToolsStore = {}

// Mock index for tools store
const mockToolsIndex = {
  get: vi.fn((name) => {
    const tool = Object.values(mockToolsStore).find(t => t.name === name)
    return Promise.resolve(tool || undefined)
  })
}

const mockDB = {
  put: vi.fn((storeName, value, key) => {
    if (storeName === 'saved-tools') {
      mockToolsStore[value.id] = value
    } else {
      mockAppDataStore[key] = value
    }
    return Promise.resolve()
  }),
  get: vi.fn((storeName, key) => {
    if (storeName === 'saved-tools') {
      return Promise.resolve(mockToolsStore[key] || null)
    }
    return Promise.resolve(mockAppDataStore[key] || null)
  }),
  getAll: vi.fn((storeName) => {
    if (storeName === 'saved-tools') {
      return Promise.resolve(Object.values(mockToolsStore))
    }
    return Promise.resolve([])
  }),
  delete: vi.fn((storeName, key) => {
    if (storeName === 'saved-tools') {
      delete mockToolsStore[key]
    } else {
      delete mockAppDataStore[key]
    }
    return Promise.resolve()
  }),
  transaction: vi.fn((storeName) => ({
    store: {
      index: vi.fn(() => mockToolsIndex)
    }
  }))
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
    // Clear mock stores
    Object.keys(mockAppDataStore).forEach(key => delete mockAppDataStore[key])
    Object.keys(mockToolsStore).forEach(key => delete mockToolsStore[key])

    // Reset mock functions
    mockDB.put.mockClear()
    mockDB.get.mockClear()
    mockDB.getAll.mockClear()
    mockDB.delete.mockClear()
    mockDB.transaction.mockClear()
    mockToolsIndex.get.mockClear()

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
      mockAppDataStore['chat-state'] = expectedState

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
      mockAppDataStore['chat-state'] = { data: 'test' }

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
      mockAppDataStore['chat-state'] = idbData

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

  describe('Tool Storage', () => {
    describe('saveTool', () => {
      it('saves a new tool', async () => {
        const tool = {
          name: 'Calculator',
          emoji: '🧮',
          type: 'vue-sfc',
          code: '<template>...</template>'
        }

        const result = await saveTool(tool)

        expect(result.name).toBe('Calculator')
        expect(result.emoji).toBe('🧮')
        expect(result.type).toBe('vue-sfc')
        expect(result.code).toBe('<template>...</template>')
        expect(result.id).toBeDefined()
        expect(result.createdAt).toBeDefined()
        expect(result.updatedAt).toBeDefined()
      })

      it('updates existing tool by name (upsert)', async () => {
        // Save initial tool
        const tool1 = await saveTool({
          name: 'Calculator',
          emoji: '🧮',
          type: 'vue-sfc',
          code: '<template>v1</template>'
        })

        // Update the mock index to return the saved tool
        mockToolsIndex.get.mockResolvedValueOnce(tool1)

        // Save updated tool with same name
        const tool2 = await saveTool({
          name: 'Calculator',
          emoji: '➕',
          type: 'vue-sfc',
          code: '<template>v2</template>'
        })

        expect(tool2.id).toBe(tool1.id)
        expect(tool2.createdAt).toBe(tool1.createdAt)
        expect(tool2.emoji).toBe('➕')
        expect(tool2.code).toBe('<template>v2</template>')
      })

      it('updates existing tool by id (supports renaming)', async () => {
        // Save initial tool
        const tool1 = await saveTool({
          name: 'Calculator',
          emoji: '🧮',
          type: 'vue-sfc',
          code: '<template>v1</template>'
        })

        // Store original mock implementation
        const originalGet = mockDB.get

        // Mock the db.get to return the tool by id
        mockDB.get = vi.fn((storeName, key) => {
          if (storeName === 'saved-tools' && key === tool1.id) {
            return Promise.resolve(tool1)
          }
          if (storeName === 'saved-tools') {
            return Promise.resolve(mockToolsStore[key] || null)
          }
          return Promise.resolve(mockAppDataStore[key] || null)
        })

        // Save with new name but same id (rename)
        const tool2 = await saveTool({
          id: tool1.id,
          name: 'Calc', // renamed
          emoji: '➕',
          type: 'vue-sfc',
          code: '<template>v2</template>'
        })

        expect(tool2.id).toBe(tool1.id)
        expect(tool2.name).toBe('Calc')
        expect(tool2.createdAt).toBe(tool1.createdAt)

        // Restore original mock
        mockDB.get = originalGet
      })
    })

    describe('getToolByName', () => {
      it('returns tool when found', async () => {
        const tool = {
          id: 'tool-1',
          name: 'Calculator',
          type: 'vue-sfc',
          code: '<template>...</template>'
        }
        mockToolsIndex.get.mockResolvedValueOnce(tool)

        const result = await getToolByName('Calculator')

        expect(result).toEqual(tool)
      })

      it('returns undefined when not found', async () => {
        mockToolsIndex.get.mockResolvedValueOnce(undefined)

        const result = await getToolByName('NonExistent')

        expect(result).toBeUndefined()
      })
    })

    describe('getAllTools', () => {
      it('returns all saved tools', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Calculator' }
        mockToolsStore['tool-2'] = { id: 'tool-2', name: 'Timer' }

        const result = await getAllTools()

        expect(result).toHaveLength(2)
        expect(result.map(t => t.name)).toContain('Calculator')
        expect(result.map(t => t.name)).toContain('Timer')
      })

      it('returns empty array when no tools', async () => {
        const result = await getAllTools()

        expect(result).toEqual([])
      })
    })

    describe('deleteTool (soft delete)', () => {
      it('soft deletes tool by setting deletedAt', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Calculator' }

        await deleteTool('tool-1')

        expect(mockToolsStore['tool-1'].deletedAt).toBeDefined()
        expect(mockDB.put).toHaveBeenCalled()
      })
    })

    describe('searchToolByQuery', () => {
      it('returns null when no tools exist', async () => {
        const result = await searchToolByQuery('calculator')
        expect(result).toBeNull()
      })

      it('finds tool by exact name match', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Calculator', sourcePrompt: 'build a calc' }

        const result = await searchToolByQuery('Calculator')

        expect(result).toBeDefined()
        expect(result.name).toBe('Calculator')
      })

      it('finds tool by partial name match', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Simple Calculator', sourcePrompt: '' }

        const result = await searchToolByQuery('build a calculator')

        expect(result).toBeDefined()
        expect(result.name).toBe('Simple Calculator')
      })

      it('finds tool by source prompt match', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Math Tool', sourcePrompt: 'build a calculator' }

        const result = await searchToolByQuery('build a calculator')

        expect(result).toBeDefined()
        expect(result.name).toBe('Math Tool')
      })

      it('returns null when no good match', async () => {
        mockToolsStore['tool-1'] = { id: 'tool-1', name: 'Timer', sourcePrompt: 'build a timer' }

        const result = await searchToolByQuery('build a completely different tool')

        expect(result).toBeNull()
      })
    })
  })
})
