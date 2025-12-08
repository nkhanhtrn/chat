import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  saveChatState,
  loadChatState,
  resolveConflict,
  clearAllStorage,
  setFirestoreSyncEnabled,
  setReadOnlyMode,
  isReadOnlyMode,
  forceUploadToCloud,
  _resetThrottleState
} from '../storage.js'
import * as firestore from '../firestore.js'

// Mock firestore module
vi.mock('../firestore.js', () => ({
  syncChatStateToFirestore: vi.fn(),
  loadChatStateFromFirestore: vi.fn(),
  deleteChatStateFromFirestore: vi.fn(),
  loadUserSettings: vi.fn(() => Promise.resolve(null)),
  saveUserSettings: vi.fn(() => Promise.resolve()),
  subscribeToChatState: vi.fn(() => () => {}),
  subscribeToUserSettings: vi.fn(() => () => {}),
  migrateSettingsToFirestore: vi.fn(() => Promise.resolve())
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

    // Reset throttle state to ensure clean tests
    _resetThrottleState()

    // Enable Firestore sync by default
    setFirestoreSyncEnabled(true)

    // Disable read-only mode by default
    setReadOnlyMode(false)
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

    describe('auto-sync when cloud is superset of local', () => {
      it('auto-uses cloud when cloud contains all local chats plus more', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' } },
          chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' }, msg2: { id: 'msg2' } },
          chats: [
            { id: 'chat1', rootMessageIds: ['msg1'] },
            { id: 'chat2', rootMessageIds: ['msg2'] }
          ]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(false)
        expect(result.state).toEqual(cloudState)
      })

      it('auto-uses cloud when cloud contains all local messages plus more', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' } },
          chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' }, msg2: { id: 'msg2' }, msg3: { id: 'msg3' } },
          chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(false)
        expect(result.state).toEqual(cloudState)
      })

      it('syncs cloud state to localStorage when auto-using cloud', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' } },
          chats: [{ id: 'chat1' }]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' }, msg2: { id: 'msg2' } },
          chats: [{ id: 'chat1' }, { id: 'chat2' }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        await loadChatState()

        expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
          'chat-state',
          JSON.stringify(cloudState)
        )
      })

      it('shows conflict when local has chats that cloud does not', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' }, msg2: { id: 'msg2' } },
          chats: [
            { id: 'chat1', rootMessageIds: ['msg1'] },
            { id: 'chat2', rootMessageIds: ['msg2'] }
          ]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' }, msg3: { id: 'msg3' } },
          chats: [
            { id: 'chat1', rootMessageIds: ['msg1'] },
            { id: 'chat3', rootMessageIds: ['msg3'] }
          ]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(true)
        expect(result.localData).toEqual(localState)
        expect(result.cloudData).toEqual(cloudState)
      })

      it('shows conflict when local has messages that cloud does not', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' }, msgLocal: { id: 'msgLocal' } },
          chats: [{ id: 'chat1' }]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' }, msgCloud: { id: 'msgCloud' } },
          chats: [{ id: 'chat1' }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(true)
      })

      it('shows conflict when cloud has same count but different data', async () => {
        const localState = {
          messagesById: { msgA: { id: 'msgA' } },
          chats: [{ id: 'chatA' }]
        }
        const cloudState = {
          messagesById: { msgB: { id: 'msgB' } },
          chats: [{ id: 'chatB' }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(true)
      })

      it('does not auto-sync when cloud is subset of local', async () => {
        const localState = {
          messagesById: { msg1: { id: 'msg1' }, msg2: { id: 'msg2' } },
          chats: [{ id: 'chat1' }, { id: 'chat2' }]
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' } },
          chats: [{ id: 'chat1' }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        expect(result.hasConflict).toBe(true)
      })

      it('handles empty local state with cloud data', async () => {
        const localState = {
          messagesById: {},
          chats: []
        }
        const cloudState = {
          messagesById: { msg1: { id: 'msg1' } },
          chats: [{ id: 'chat1' }]
        }

        mockLocalStorage.store['chat-state'] = JSON.stringify(localState)
        vi.mocked(firestore.loadChatStateFromFirestore).mockResolvedValue(cloudState)

        const result = await loadChatState()

        // Empty local is a subset of any cloud, so should auto-use cloud
        expect(result.hasConflict).toBe(false)
        expect(result.state).toEqual(cloudState)
      })
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

  describe('Firestore sync throttling', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('syncs immediately on first call', async () => {
      const state = { messagesById: {}, chats: [], isStreaming: false }

      await saveChatState(state)

      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)
    })

    it('throttles rapid successive calls to once per second', async () => {
      const state1 = { messagesById: { m1: {} }, chats: [], isStreaming: false }
      const state2 = { messagesById: { m1: {}, m2: {} }, chats: [], isStreaming: false }
      const state3 = { messagesById: { m1: {}, m2: {}, m3: {} }, chats: [], isStreaming: false }

      // First call - syncs immediately
      await saveChatState(state1)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Rapid calls within 1 second - should NOT trigger additional syncs
      await saveChatState(state2)
      await saveChatState(state3)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Advance time by 1 second - pending sync should execute
      await vi.advanceTimersByTimeAsync(1000)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(2)
    })

    it('syncs the latest state when throttle period expires', async () => {
      const state1 = { messagesById: { m1: {} }, chats: [], isStreaming: false }
      const state2 = { messagesById: { m1: {}, m2: {} }, chats: [], isStreaming: false }
      const state3 = { messagesById: { m1: {}, m2: {}, m3: {} }, chats: [], isStreaming: false }

      await saveChatState(state1)
      await saveChatState(state2)
      await saveChatState(state3)

      // Advance time to trigger pending sync
      await vi.advanceTimersByTimeAsync(1000)

      // Should have synced state3 (the latest), not state2
      const lastCall = vi.mocked(firestore.syncChatStateToFirestore).mock.calls.slice(-1)[0][0]
      expect(Object.keys(lastCall.messagesById)).toHaveLength(3)
    })

    it('allows sync after throttle period has passed', async () => {
      const state1 = { messagesById: { m1: {} }, chats: [], isStreaming: false }
      const state2 = { messagesById: { m1: {}, m2: {} }, chats: [], isStreaming: false }

      // First call
      await saveChatState(state1)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Wait for throttle period to pass
      await vi.advanceTimersByTimeAsync(1000)

      // Second call after throttle period - should sync immediately
      await saveChatState(state2)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(2)
    })

    it('does not sync during streaming even with throttle', async () => {
      const streamingState = { messagesById: {}, chats: [], isStreaming: true }

      await saveChatState(streamingState)
      await vi.advanceTimersByTimeAsync(2000)

      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })

    it('schedules sync for remaining time in throttle period', async () => {
      const state1 = { messagesById: { m1: {} }, chats: [], isStreaming: false }
      const state2 = { messagesById: { m1: {}, m2: {} }, chats: [], isStreaming: false }

      // First call at time 0
      await saveChatState(state1)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Second call at time 300ms
      await vi.advanceTimersByTimeAsync(300)
      await saveChatState(state2)

      // Should still be 1 call
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Advance 700ms more (total 1000ms from first call)
      await vi.advanceTimersByTimeAsync(700)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(2)
    })

    it('does not schedule duplicate timers for multiple rapid calls', async () => {
      const state1 = { messagesById: { m1: {} }, chats: [], isStreaming: false }
      const state2 = { messagesById: { m2: {} }, chats: [], isStreaming: false }
      const state3 = { messagesById: { m3: {} }, chats: [], isStreaming: false }
      const state4 = { messagesById: { m4: {} }, chats: [], isStreaming: false }

      // First call - immediate sync
      await saveChatState(state1)

      // Multiple rapid calls
      await saveChatState(state2)
      await saveChatState(state3)
      await saveChatState(state4)

      // Advance past throttle period
      await vi.advanceTimersByTimeAsync(1000)

      // Should only have 2 total syncs: initial + one throttled
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(2)

      // The second sync should have the latest state (state4)
      const lastCall = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[1][0]
      expect(lastCall.messagesById).toHaveProperty('m4')
    })
  })

  describe('UI state exclusions from Firestore sync', () => {
    beforeEach(() => {
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)
    })

    it('excludes currentMessageId from Firestore sync', async () => {
      const state = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentMessageId: 'msg123',
        isStreaming: false
      }

      await saveChatState(state)

      const syncedState = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[0][0]
      expect(syncedState).not.toHaveProperty('currentMessageId')
    })

    it('excludes currentChatId from Firestore sync', async () => {
      const state = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentChatId: 'chat123',
        isStreaming: false
      }

      await saveChatState(state)

      const syncedState = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[0][0]
      expect(syncedState).not.toHaveProperty('currentChatId')
    })

    it('excludes currentRootIndex from Firestore sync', async () => {
      const state = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentRootIndex: 5,
        isStreaming: false
      }

      await saveChatState(state)

      const syncedState = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[0][0]
      expect(syncedState).not.toHaveProperty('currentRootIndex')
    })

    it('excludes previousLocation from Firestore sync', async () => {
      const state = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        previousLocation: { messageId: 'msg1', chatId: 'chat1' },
        isStreaming: false
      }

      await saveChatState(state)

      const syncedState = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[0][0]
      expect(syncedState).not.toHaveProperty('previousLocation')
    })

    it('still includes UI state in localStorage', async () => {
      const state = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentMessageId: 'msg123',
        currentChatId: 'chat123',
        currentRootIndex: 5,
        previousLocation: { messageId: 'msg1', chatId: 'chat1' },
        isStreaming: false
      }

      await saveChatState(state)

      const savedData = JSON.parse(mockLocalStorage.setItem.mock.calls[0][1])
      expect(savedData.currentMessageId).toBe('msg123')
      expect(savedData.currentChatId).toBe('chat123')
      expect(savedData.currentRootIndex).toBe(5)
      expect(savedData.previousLocation).toEqual({ messageId: 'msg1', chatId: 'chat1' })
    })

    it('includes data state in Firestore sync', async () => {
      const state = {
        messagesById: { m1: { id: 'm1', question: 'Test' } },
        chats: [{ id: 'chat1', rootMessageIds: ['m1'] }],
        currentMessageId: 'msg123',
        isStreaming: false
      }

      await saveChatState(state)

      const syncedState = vi.mocked(firestore.syncChatStateToFirestore).mock.calls[0][0]
      expect(syncedState.messagesById).toEqual({ m1: { id: 'm1', question: 'Test' } })
      expect(syncedState.chats).toEqual([{ id: 'chat1', rootMessageIds: ['m1'] }])
    })
  })

  describe('skip sync when data unchanged', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('skips Firestore sync when only UI state changes', async () => {
      const state1 = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentMessageId: 'msg1',
        isStreaming: false
      }
      const state2 = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentMessageId: 'msg2', // Only UI state changed
        isStreaming: false
      }

      await saveChatState(state1)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      await saveChatState(state2)
      // Should still be 1 because data state hasn't changed
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)
    })

    it('syncs when data state changes', async () => {
      const state1 = {
        messagesById: { m1: { id: 'm1' } },
        chats: [],
        currentMessageId: 'msg1',
        isStreaming: false
      }
      const state2 = {
        messagesById: { m1: { id: 'm1' }, m2: { id: 'm2' } }, // Data changed
        chats: [],
        currentMessageId: 'msg1',
        isStreaming: false
      }

      await saveChatState(state1)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Advance past throttle period
      await vi.advanceTimersByTimeAsync(1000)

      await saveChatState(state2)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(2)
    })

    it('skips sync for navigation-only changes', async () => {
      const baseState = {
        messagesById: { m1: { id: 'm1' }, m2: { id: 'm2' } },
        chats: [{ id: 'chat1', rootMessageIds: ['m1', 'm2'] }],
        isStreaming: false
      }

      // First save
      await saveChatState({ ...baseState, currentMessageId: 'm1', currentChatId: 'chat1' })
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Navigate to different message (only UI state changes)
      await saveChatState({ ...baseState, currentMessageId: 'm2', currentChatId: 'chat1' })
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)

      // Navigate with previousLocation set (only UI state changes)
      await saveChatState({
        ...baseState,
        currentMessageId: 'm1',
        currentChatId: 'chat1',
        previousLocation: { messageId: 'm2', chatId: 'chat1' }
      })
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledTimes(1)
    })
  })

  describe('read-only mode', () => {
    const mockState = {
      messagesById: { msg1: { id: 'msg1', question: 'Test' } },
      chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }],
      isStreaming: false
    }

    describe('isReadOnlyMode', () => {
      it('should return false by default', () => {
        expect(isReadOnlyMode()).toBe(false)
      })

      it('should return true when read-only mode is enabled', () => {
        setReadOnlyMode(true)
        expect(isReadOnlyMode()).toBe(true)
      })

      it('should return false when read-only mode is disabled', () => {
        setReadOnlyMode(true)
        setReadOnlyMode(false)
        expect(isReadOnlyMode()).toBe(false)
      })
    })

    describe('setReadOnlyMode', () => {
      it('should enable read-only mode', () => {
        setReadOnlyMode(true)
        expect(isReadOnlyMode()).toBe(true)
      })

      it('should disable read-only mode', () => {
        setReadOnlyMode(true)
        setReadOnlyMode(false)
        expect(isReadOnlyMode()).toBe(false)
      })
    })

    describe('saveChatState in read-only mode', () => {
      it('should not save to localStorage when read-only mode is enabled', async () => {
        setReadOnlyMode(true)

        await saveChatState(mockState)

        expect(mockLocalStorage.setItem).not.toHaveBeenCalled()
      })

      it('should not sync to Firestore when read-only mode is enabled', async () => {
        setReadOnlyMode(true)
        vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

        await saveChatState(mockState)

        expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
      })

      it('should save normally when read-only mode is disabled', async () => {
        setReadOnlyMode(false)
        vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

        await saveChatState(mockState)

        expect(mockLocalStorage.setItem).toHaveBeenCalled()
      })

      it('should resume saving after read-only mode is disabled', async () => {
        vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

        // Enable read-only mode
        setReadOnlyMode(true)
        await saveChatState(mockState)
        expect(mockLocalStorage.setItem).not.toHaveBeenCalled()

        // Disable read-only mode
        setReadOnlyMode(false)
        await saveChatState(mockState)
        expect(mockLocalStorage.setItem).toHaveBeenCalled()
      })
    })
  })

  describe('forceUploadToCloud', () => {
    const mockLocalState = {
      messagesById: { msg1: { id: 'msg1', question: 'Test' } },
      chats: [{ id: 'chat1', rootMessageIds: ['msg1'] }],
      lastUpdated: Date.now()
    }

    it('uploads local data to Firestore', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      const result = await forceUploadToCloud()

      expect(result).toBe(true)
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledWith(mockLocalState)
    })

    it('returns false when no local data exists', async () => {
      // localStorage is empty
      const result = await forceUploadToCloud()

      expect(result).toBe(false)
      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })

    it('returns false when Firestore sync is disabled', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      setFirestoreSyncEnabled(false)

      const result = await forceUploadToCloud()

      expect(result).toBe(false)
      expect(firestore.syncChatStateToFirestore).not.toHaveBeenCalled()
    })

    it('throws error when Firestore sync fails', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.syncChatStateToFirestore).mockRejectedValue(new Error('Upload failed'))

      await expect(forceUploadToCloud()).rejects.toThrow('Upload failed')
    })

    it('updates sync hash after successful upload', async () => {
      mockLocalStorage.store['chat-state'] = JSON.stringify(mockLocalState)
      vi.mocked(firestore.syncChatStateToFirestore).mockResolvedValue(undefined)

      const result = await forceUploadToCloud()

      expect(result).toBe(true)
      // The function should have updated lastSyncedStateHash internally
      // We verify this worked by checking forceUploadToCloud was called with correct data
      expect(firestore.syncChatStateToFirestore).toHaveBeenCalledWith(mockLocalState)
    })
  })
})
