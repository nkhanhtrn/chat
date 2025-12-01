import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveChatState,
  loadChatState,
  resolveConflict,
  clearAllStorage,
  setFirestoreSyncEnabled
} from '../storage.js'
import * as firestore from '../firestore.js'

// Mock firestore module
vi.mock('../firestore.js', () => ({
  syncChatStateToFirestore: vi.fn(),
  loadChatStateFromFirestore: vi.fn(),
  deleteChatStateFromFirestore: vi.fn()
}))

describe('storage.js', () => {
  const mockLocalStorage = {
    store: {},
    getItem: vi.fn((key) => mockLocalStorage.store[key] || null),
    setItem: vi.fn((key, value) => { mockLocalStorage.store[key] = value }),
    removeItem: vi.fn((key) => { delete mockLocalStorage.store[key] }),
    clear: vi.fn(() => { mockLocalStorage.store = {} })
  }

  beforeEach(() => {
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

    // Reset firestore mocks
    vi.mocked(firestore.syncChatStateToFirestore).mockReset()
    vi.mocked(firestore.loadChatStateFromFirestore).mockReset()
    vi.mocked(firestore.deleteChatStateFromFirestore).mockReset()

    // Enable Firestore sync by default
    setFirestoreSyncEnabled(true)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('saveChatState', () => {
    const mockState = {
      messagesById: { msg1: { id: 'msg1', question: 'Test' } },
      chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }],
      isStreaming: false
    }

    it('saves state to localStorage with timestamp', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await saveChatState(mockState)

      expect(mockLocalStorage.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
      expect(savedData.messagesById).toEqual(mockState.messagesById)
      expect(savedData.chats).toEqual(mockState.chats)
      expect(savedData.lastUpdated).toBeDefined()
      expect(typeof savedData.lastUpdated).toBe('number')
    })

    it('syncs to Firestore when not streaming', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await saveChatState(mockState)

      expect(firestore.syncChatStateToFirestore).toHaveBeenCalled()
    })

    it('skips Firestore sync when streaming', async () => {
      const streamingState = { ...mockState, isStreaming: true }

      await saveChatState(streamingState)

      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })

    it('still saves to localStorage when Firestore sync fails', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockRejectedValue(new Error('Firestore error'))

      await saveChatState(mockState)

      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })

    it('skips Firestore sync when disabled', async () => {
      setFirestoreSyncEnabled(false)

      await saveChatState(mockState)

      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })

    it('serializes Message objects to plain objects', async () => {
      const stateWithClass = {
        messagesById: {
          msg1: {
            id: 'msg1',
            question: 'Test',
            toJSON: () => ({ id: 'msg1', question: 'Test' })
          }
        },
        chats: [],
        isStreaming: false
      }

      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await saveChatState(stateWithClass)

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
      expect(savedData.messagesById.msg1).not.toHaveProperty('toJSON')
    })
  })

  describe('loadChatState', () => {
    const mockLocalState = {
      messagesById: { msg1: { id: 'msg1', question: 'Local' } },
      chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }],
      lastUpdated: 1000
    }

    const mockCloudState = {
      messagesById: { msg2: { id: 'msg2', question: 'Cloud' } },
      chats: [{ id: 'chat2', rootMessageIds: ['msg2'] }],
      lastUpdated: 2000
    }

    it('returns cloud state when no conflict', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(mockLocalState)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(false)
      expect(result.state).toEqual(mockLocalState)
    })

    it('returns local state when cloud is unavailable', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(null)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(false)
      expect(result.state).toEqual(mockLocalState)
    })

    it('returns null state when both are empty', async () => {
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(null)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(false)
      expect(result.state).toBeNull()
    })

    it('detects conflict when chat counts differ', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(mockCloudState)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(true)
      expect(result.localData).toEqual(mockLocalState)
      expect(result.cloudData).toEqual(mockCloudState)
    })

    it('detects conflict when message counts differ', async () => {
      const localWithMoreMessages = {
        ...mockLocalState,
        messagesById: {
          msg1: { id: 'msg1' },
          msg2: { id: 'msg2' }
        }
      }
      const cloudWithFewerMessages = {
        ...mockLocalState,
        messagesById: { msg1: { id: 'msg1' } }
      }

      mockLocalStorage.store['chat-state'] = JSON.stringify(localWithMoreMessages)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudWithFewerMessages)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(true)
    })

    it('detects conflict when message IDs differ', async () => {
      const localState = {
        messagesById: { msgA: { id: 'msgA' } },
        chats: []
      }
      const cloudState = {
        messagesById: { msgB: { id: 'msgB' } },
        chats: []
      }

      mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(true)
    })

    it('no conflict when data is identical', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(mockLocalState)

      const result = await loadChatState()

      expect(result.hasConflict).toBe(false)
    })

    it('syncs cloud state to localStorage when no conflict', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(mockLocalState)

      await loadChatState()

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chat-state',
        JSON.stringify(mockLocalState)
      )
    })

    it('handles Firestore load error gracefully', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.loadChatStateFromFirestore).mockRejectedValue(new Error('Network error'))

      const result = await loadChatState()

      expect(result.hasConflict).toBe(false)
      expect(result.state).toEqual(mockLocalState)
    })

    it('skips Firestore when sync is disabled', async () => {
      setFirestoreSyncEnabled(false)
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)

      const result = await loadChatState()

      expect(firestore.loadChatStateFromFirestore).not.toHaveBeenCalled()
      expect(result.state).toEqual(mockLocalState)
    })
  })

  describe('resolveConflict', () => {
    const mockLocalData = {
      messagesById: { msg1: { id: 'msg1', question: 'Local' } },
      chats: [{ id: 'chat1' }],
      lastUpdated: 1000
    }

    const mockCloudData = {
      messagesById: { msg2: { id: 'msg2', question: 'Cloud' } },
      chats: [{ id: 'chat2' }],
      lastUpdated: 2000
    }

    it('resolves with local data when chosen', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      const result = await resolveConflict('local', mockLocalData, mockCloudData)

      expect(result).toEqual(mockLocalData)
    })

    it('resolves with cloud data when chosen', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      const result = await resolveConflict('cloud', mockLocalData, mockCloudData)

      expect(result).toEqual(mockCloudData)
    })

    it('saves chosen state to localStorage', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await resolveConflict('local', mockLocalData, mockCloudData)

      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'chat-state',
        JSON.stringify(mockLocalData)
      )
    })

    it('syncs chosen state to Firestore', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await resolveConflict('cloud', mockLocalData, mockCloudData)

      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledWith(mockCloudData)
    })

    it('handles Firestore sync failure gracefully', async () => {
      vi.mocked(firestore.syncChatStateToFirestore).mockRejectedValue(new Error('Sync failed'))

      const result = await resolveConflict('local', mockLocalData, mockCloudData)

      expect(result).toEqual(mockLocalData)
      expect(mockLocalStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('clearAllStorage', () => {
    it('clears localStorage', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify({ data: 'test' })

      await clearAllStorage()

      expect(mockLocalStorage.removeItem).toHaveBeenCalledWith('chat-state')
    })

    it('clears Firestore when sync is enabled', async () => {
      vi.mocked(firestore.deleteChatStateFromFirestore).mockResolvedValue(undefined)

      await clearAllStorage()

      expect(firestore.deleteChatStateFromFirestore).toHaveBeenCalled()
    })

    it('skips Firestore when sync is disabled', async () => {
      setFirestoreSyncEnabled(false)

      await clearAllStorage()

      expect(firestore.deleteChatStateFromFirestore).not.toHaveBeenCalled()
    })

    it('handles Firestore clear failure gracefully', async () => {
      vi.mocked(firestore.deleteChatStateFromFirestore).mockRejectedValue(new Error('Delete failed'))

      await expect(clearAllStorage()).resolves.not.toThrow()
      expect(mockLocalStorage.removeItem).toHaveBeenCalled()
    })
  })

  describe('setFirestoreSyncEnabled', () => {
    it('enables Firestore sync', async () => {
      setFirestoreSyncEnabled(true)
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      await saveChatState({ messagesById: {}, chats: [], isStreaming: false })

      expect(firestore.syncChatStateToFirestore).toHaveBeenCalled()
    })

    it('disables Firestore sync', async () => {
      setFirestoreSyncEnabled(false)

      await saveChatState({ messagesById: {}, chats: [], isStreaming: false })

      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })
  })
})
