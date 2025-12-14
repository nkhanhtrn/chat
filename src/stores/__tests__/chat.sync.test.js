import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import * as storage from '../../services/storage.js'
import Message from '../Message.js'

// Mock storage module
vi.mock('../../services/storage.js', () => ({
  loadChatState: vi.fn(),
  saveChatState: vi.fn(),
  resolveConflict: vi.fn()
}))

describe('useChatStore - Sync functionality', () => {
  let store

  const mockSavedState = {
    messagesById: {
      msg1: { id: 'msg1', question: 'Test question', response: 'Test response', parentId: null, childIds: [] }
    },
    rootMessageIds: ['msg1'],
    currentMessageId: 'msg1',
    currentRootIndex: 0,
    currentModel: 'gpt-4',
    chats: [{ id: 'chat1', name: 'Test Chat', rootMessageIds: ['msg1'] }],
    currentChatId: 'chat1'
  }

  const mockLocalData = {
    ...mockSavedState,
    lastUpdated: 1000
  }

  const mockCloudData = {
    messagesById: {
      msg2: { id: 'msg2', question: 'Cloud question', response: 'Cloud response', parentId: null, childIds: [] }
    },
    rootMessageIds: ['msg2'],
    currentMessageId: 'msg2',
    currentRootIndex: 0,
    currentModel: 'gpt-4',
    chats: [{ id: 'chat2', name: 'Cloud Chat', rootMessageIds: ['msg2'] }],
    currentChatId: 'chat2',
    lastUpdated: 2000
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('initializeStore', () => {
    it('initializes with saved state when no conflict', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })

      store = useChatStore()
      const result = await store.initializeStore()

      expect(result.hasConflict).toBe(false)
      expect(store.isInitialized).toBe(true)
      expect(store.messagesById.msg1).toBeInstanceOf(Message)
      expect(store.chats).toHaveLength(1)
      expect(store.currentChatId).toBe('chat1')
    })

    it('returns conflict info when conflict detected', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: true,
        localData: mockLocalData,
        cloudData: mockCloudData
      })

      store = useChatStore()
      const result = await store.initializeStore()

      expect(result.hasConflict).toBe(true)
      expect(result.localData).toEqual(mockLocalData)
      expect(result.cloudData).toEqual(mockCloudData)
      expect(store.isInitialized).toBe(false)
    })

    it('uses default state when no saved state', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: null
      })

      store = useChatStore()
      await store.initializeStore()

      expect(store.isInitialized).toBe(true)
      expect(Object.keys(store.messagesById)).toHaveLength(0)
      expect(store.chats).toHaveLength(0)
    })

    it('handles initialization error gracefully', async () => {
      vi.mocked(storage.loadChatState).mockRejectedValue(new Error('Load failed'))

      store = useChatStore()
      const result = await store.initializeStore()

      expect(result.hasConflict).toBe(false)
      expect(store.isInitialized).toBe(true)
    })

    it('prevents re-initialization', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })

      store = useChatStore()
      await store.initializeStore()

      // Try to initialize again
      const result = await store.initializeStore()

      expect(storage.loadChatState).toHaveBeenCalledTimes(1)
      expect(result.hasConflict).toBe(false)
    })

    it('reconstructs Message objects from plain objects', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })

      store = useChatStore()
      await store.initializeStore()

      const message = store.messagesById.msg1
      expect(message).toBeInstanceOf(Message)
      expect(message.id).toBe('msg1')
      expect(message.question).toBe('Test question')
      expect(message.response).toBe('Test response')
    })

    it('restores all state properties', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })

      store = useChatStore()
      await store.initializeStore()

      expect(store.rootMessageIds).toEqual(['msg1'])
      expect(store.currentMessageId).toBe('msg1')
      expect(store.currentRootIndex).toBe(0)
      expect(store.currentModel).toBe('gpt-4')
      expect(store.chats).toEqual(mockSavedState.chats)
      expect(store.currentChatId).toBe('chat1')
    })
  })

  describe('resolveConflict', () => {
    beforeEach(async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: true,
        localData: mockLocalData,
        cloudData: mockCloudData
      })

      store = useChatStore()
      await store.initializeStore()
    })

    it('applies local data when "local" is chosen', async () => {
      vi.mocked(storage.resolveConflict).mockResolvedValue(mockLocalData)

      await store.resolveConflict('local', mockLocalData, mockCloudData)

      expect(storage.resolveConflict).toHaveBeenCalledWith('local', mockLocalData, mockCloudData)
      expect(store.messagesById.msg1).toBeInstanceOf(Message)
      expect(store.currentChatId).toBe('chat1')
      expect(store.isInitialized).toBe(true)
    })

    it('applies cloud data when "cloud" is chosen', async () => {
      vi.mocked(storage.resolveConflict).mockResolvedValue(mockCloudData)

      await store.resolveConflict('cloud', mockLocalData, mockCloudData)

      expect(storage.resolveConflict).toHaveBeenCalledWith('cloud', mockLocalData, mockCloudData)
      expect(store.messagesById.msg2).toBeInstanceOf(Message)
      expect(store.currentChatId).toBe('chat2')
      expect(store.isInitialized).toBe(true)
    })

    it('marks store as initialized after resolution', async () => {
      vi.mocked(storage.resolveConflict).mockResolvedValue(mockLocalData)

      expect(store.isInitialized).toBe(false)

      await store.resolveConflict('local', mockLocalData, mockCloudData)

      expect(store.isInitialized).toBe(true)
    })
  })

  describe('_applyState', () => {
    beforeEach(() => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: null
      })
    })

    it('applies state with Message reconstruction', async () => {
      store = useChatStore()
      await store.initializeStore()

      store._applyState(mockSavedState)

      expect(store.messagesById.msg1).toBeInstanceOf(Message)
      expect(store.messagesById.msg1.question).toBe('Test question')
    })

    it('handles empty messagesById', async () => {
      store = useChatStore()
      await store.initializeStore()

      store._applyState({
        messagesById: {},
        rootMessageIds: [],
        chats: [],
        currentChatId: null
      })

      expect(Object.keys(store.messagesById)).toHaveLength(0)
    })

    it('handles undefined optional properties', async () => {
      store = useChatStore()
      await store.initializeStore()

      store._applyState({
        messagesById: {}
      })

      expect(store.rootMessageIds).toEqual([])
      expect(store.currentMessageId).toBeNull()
      expect(store.currentRootIndex).toBe(0)
      expect(store.currentModel).toBeNull()
      expect(store.chats).toEqual([])
      expect(store.currentChatId).toBeNull()
    })

    it('preserves Message class properties after reconstruction', async () => {
      store = useChatStore()
      await store.initializeStore()

      const stateWithChild = {
        messagesById: {
          msg1: { id: 'msg1', question: 'Parent', response: 'Response', parentId: null, childIds: ['msg2'] },
          msg2: { id: 'msg2', question: 'Child', response: 'Child response', parentId: 'msg1', childIds: [] }
        },
        rootMessageIds: ['msg1'],
        chats: []
      }

      store._applyState(stateWithChild)

      const parentMessage = store.messagesById.msg1
      expect(parentMessage).toBeInstanceOf(Message)
      expect(parentMessage.childIds).toContain('msg2')

      // Test that setter works (addNewChild is a setter, not a method)
      parentMessage.addNewChild = 'msg3'
      expect(parentMessage.childIds).toContain('msg3')
    })
  })

  describe('_persistState', () => {
    it('calls saveChatState with current state', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })
      vi.mocked(storage.saveChatState).mockResolvedValue(undefined)

      store = useChatStore()
      await store.initializeStore()

      store._persistState()

      expect(storage.saveChatState).toHaveBeenCalledWith(
        expect.objectContaining({
          messagesById: expect.any(Object),
          rootMessageIds: expect.any(Array),
          chats: expect.any(Array)
        })
      )
    })

    it('includes all necessary state properties', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })
      vi.mocked(storage.saveChatState).mockResolvedValue(undefined)

      store = useChatStore()
      await store.initializeStore()
      store._persistState()

      const savedState = vi.mocked(storage.saveChatState).mock.calls[0][0]
      expect(savedState).toHaveProperty('messagesById')
      expect(savedState).toHaveProperty('rootMessageIds')
      expect(savedState).toHaveProperty('currentMessageId')
      expect(savedState).toHaveProperty('currentRootIndex')
      expect(savedState).toHaveProperty('currentModel')
      expect(savedState).toHaveProperty('chats')
      expect(savedState).toHaveProperty('currentChatId')
      expect(savedState).toHaveProperty('isStreaming')
    })

    it('includes isStreaming state for Firestore sync control', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })
      vi.mocked(storage.saveChatState).mockResolvedValue(undefined)

      store = useChatStore()
      await store.initializeStore()

      // Test when not streaming
      store._persistState()
      let savedState = vi.mocked(storage.saveChatState).mock.calls[0][0]
      expect(savedState.isStreaming).toBe(false)

      // Test when streaming
      // Note: _syncAllMessagesToSR() may have called _persistState() during initializeStore()
      // We need to track the call count to use the correct indices
      const callsBeforeStreaming = vi.mocked(storage.saveChatState).mock.calls.length
      store.startStreaming('test-msg-id')
      store._persistState()
      savedState = vi.mocked(storage.saveChatState).mock.calls[callsBeforeStreaming][0]
      expect(savedState.isStreaming).toBe(true)

      // Test after stopping streaming
      const callsAfterStreaming = vi.mocked(storage.saveChatState).mock.calls.length
      store.stopStreaming()
      store._persistState()
      savedState = vi.mocked(storage.saveChatState).mock.calls[callsAfterStreaming][0]
      expect(savedState.isStreaming).toBe(false)
    })
  })

  describe('isInitialized state', () => {
    it('starts as false', () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: null
      })

      store = useChatStore()

      expect(store.isInitialized).toBe(false)
    })

    it('becomes true after successful initialization', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: false,
        state: mockSavedState
      })

      store = useChatStore()
      await store.initializeStore()

      expect(store.isInitialized).toBe(true)
    })

    it('stays false during conflict until resolved', async () => {
      vi.mocked(storage.loadChatState).mockResolvedValue({
        hasConflict: true,
        localData: mockLocalData,
        cloudData: mockCloudData
      })

      store = useChatStore()
      await store.initializeStore()

      expect(store.isInitialized).toBe(false)

      vi.mocked(storage.resolveConflict).mockResolvedValue(mockLocalData)
      await store.resolveConflict('local', mockLocalData, mockCloudData)

      expect(store.isInitialized).toBe(true)
    })
  })
})
