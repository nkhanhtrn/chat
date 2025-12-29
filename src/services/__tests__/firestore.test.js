import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Reset modules before importing to ensure fresh state
beforeEach(() => {
  vi.resetModules()
})

// Mock firebase module
vi.mock('../firebase.js', () => ({
  getFirebaseDb: vi.fn(),
  getFirebaseAuth: vi.fn()
}))

// Mock firebase/firestore
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(),
  setDoc: vi.fn(),
  getDoc: vi.fn(),
  getDocs: vi.fn(),
  deleteDoc: vi.fn(),
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true })),
  collection: vi.fn(),
  writeBatch: vi.fn()
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn()
}))

import {
  syncChatStateToFirestore,
  loadChatStateFromFirestore,
  subscribeToChatState,
  deleteChatStateFromFirestore,
  saveUserSettings,
  loadUserSettings,
  flushSettings,
  invalidateSettingsCache,
  subscribeToUserSettings,
  unsubscribeAll,
  syncChatStateWithSubcollections,
  loadChatStateWithSubcollections,
  migrateToSubcollections
} from '../firestore.js'
import * as firebase from '../firebase.js'
import { doc, setDoc, getDoc, getDocs, onSnapshot, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

describe('firestore.js', () => {
  const mockUser = { uid: 'user123', email: 'test@example.com' }
  const mockDb = { type: 'firestore' }
  const mockAuth = { currentUser: null }
  const mockDocRef = { path: 'users/user123/chatData/state' }

  beforeEach(() => {
    vi.mocked(firebase.getFirebaseDb).mockReturnValue(mockDb)
    vi.mocked(firebase.getFirebaseAuth).mockReturnValue(mockAuth)
    vi.mocked(doc).mockReturnValue(mockDocRef)
    vi.mocked(setDoc).mockResolvedValue(undefined)
    vi.mocked(serverTimestamp).mockReturnValue({ _serverTimestamp: true })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('syncChatStateToFirestore', () => {
    const mockState = {
      messagesById: { msg1: { id: 'msg1', question: 'Test' } },
      chats: [{ id: 'chat1' }]
    }

    it('syncs state to Firestore when user is authenticated', async () => {
      mockAuth.currentUser = mockUser

      await syncChatStateToFirestore(mockState)

      expect(doc).toHaveBeenCalledWith(mockDb, 'users', mockUser.uid, 'chatData', 'state')
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          ...mockState,
          lastUpdated: expect.anything()
        }),
        { merge: true }
      )
    })

    it('skips sync when no user is authenticated', async () => {
      mockAuth.currentUser = null

      await syncChatStateToFirestore(mockState)

      expect(setDoc).not.toHaveBeenCalled()
    })

    it('throws error when Firestore fails', async () => {
      mockAuth.currentUser = mockUser
      vi.mocked(setDoc).mockRejectedValue(new Error('Firestore error'))

      await expect(syncChatStateToFirestore(mockState)).rejects.toThrow('Firestore error')
    })

    it('adds serverTimestamp to state', async () => {
      mockAuth.currentUser = mockUser

      await syncChatStateToFirestore(mockState)

      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          lastUpdated: { _serverTimestamp: true }
        }),
        { merge: true }
      )
    })
  })

  describe('loadChatStateFromFirestore', () => {
    const mockState = {
      messagesById: { msg1: { id: 'msg1' } },
      chats: [],
      lastUpdated: { seconds: 1234567890 }
    }

    it('waits for auth and loads state when user is authenticated', async () => {
      // Mock onAuthStateChanged to immediately resolve with user
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn() // unsubscribe function
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockState })
      })

      const result = await loadChatStateFromFirestore()

      expect(result).toEqual({
        messagesById: mockState.messagesById,
        chats: mockState.chats
      })
      expect(result.lastUpdated).toBeUndefined() // Should be removed
    })

    it('returns null when no user is authenticated', async () => {
      // Ensure currentUser is null so waitForAuth uses onAuthStateChanged
      mockAuth.currentUser = null

      // Reset mocks for this test
      vi.mocked(onAuthStateChanged).mockReset()
      vi.mocked(getDoc).mockReset()

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(null)
        return vi.fn()
      })

      const result = await loadChatStateFromFirestore()

      expect(result).toBeNull()
      expect(getDoc).not.toHaveBeenCalled()
    })

    it('returns null when document does not exist', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false
      })

      const result = await loadChatStateFromFirestore()

      expect(result).toBeNull()
    })

    it('returns null on Firestore error', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockRejectedValue(new Error('Network error'))

      const result = await loadChatStateFromFirestore()

      expect(result).toBeNull()
    })

    it('uses onAuthStateChanged to wait for auth', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockState })
      })

      await loadChatStateFromFirestore()

      // Should use onAuthStateChanged to ensure auth is ready
      expect(onAuthStateChanged).toHaveBeenCalled()
    })

    it('removes lastUpdated metadata from returned state', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          messagesById: {},
          chats: [],
          lastUpdated: { seconds: 1234567890 }
        })
      })

      const result = await loadChatStateFromFirestore()

      expect(result).not.toHaveProperty('lastUpdated')
    })
  })

  describe('subscribeToChatState', () => {
    const mockCallback = vi.fn()
    const mockUnsubscribe = vi.fn()

    it('subscribes to Firestore updates when user is authenticated', () => {
      mockAuth.currentUser = mockUser
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe)

      const unsubscribe = subscribeToChatState(mockCallback)

      expect(onSnapshot).toHaveBeenCalledWith(
        mockDocRef,
        expect.any(Function),
        expect.any(Function)
      )
      expect(unsubscribe).toBe(mockUnsubscribe)
    })

    it('returns no-op function when no user is authenticated', () => {
      mockAuth.currentUser = null

      const unsubscribe = subscribeToChatState(mockCallback)

      expect(onSnapshot).not.toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })

    it('calls callback with data when document changes', () => {
      mockAuth.currentUser = mockUser
      let snapshotCallback

      vi.mocked(onSnapshot).mockImplementation((ref, callback) => {
        snapshotCallback = callback
        return mockUnsubscribe
      })

      subscribeToChatState(mockCallback)

      // Simulate document update
      snapshotCallback({
        exists: () => true,
        data: () => ({
          messagesById: { msg1: { id: 'msg1' } },
          lastUpdated: { seconds: 123 }
        })
      })

      expect(mockCallback).toHaveBeenCalledWith({
        messagesById: { msg1: { id: 'msg1' } }
      })
    })

    it('does not call callback when document does not exist', () => {
      mockAuth.currentUser = mockUser
      let snapshotCallback

      vi.mocked(onSnapshot).mockImplementation((ref, callback) => {
        snapshotCallback = callback
        return mockUnsubscribe
      })

      subscribeToChatState(mockCallback)

      snapshotCallback({
        exists: () => false
      })

      expect(mockCallback).not.toHaveBeenCalled()
    })
  })

  describe('deleteChatStateFromFirestore', () => {
    it('deletes state when user is authenticated', async () => {
      mockAuth.currentUser = mockUser

      await deleteChatStateFromFirestore()

      expect(setDoc).toHaveBeenCalledWith(mockDocRef, {})
    })

    it('skips deletion when no user is authenticated', async () => {
      mockAuth.currentUser = null

      await deleteChatStateFromFirestore()

      expect(setDoc).not.toHaveBeenCalled()
    })

    it('throws error when Firestore fails', async () => {
      mockAuth.currentUser = mockUser
      vi.mocked(setDoc).mockRejectedValue(new Error('Delete failed'))

      await expect(deleteChatStateFromFirestore()).rejects.toThrow('Delete failed')
    })
  })

  // ============================================
  // NEW TESTS: User Settings with Caching & Debouncing
  // ============================================

  describe('saveUserSettings (debounced)', () => {
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }

    beforeEach(() => {
      vi.useFakeTimers()
      // Clear any pending debounce timers
      flushSettings()
      vi.mocked(setDoc).mockClear()
      // Mock doc to return settings path for settings calls
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('debounces multiple rapid saves into one Firestore write', async () => {
      mockAuth.currentUser = mockUser

      // Make 5 rapid settings changes
      saveUserSettings({ theme: 'dark' })
      saveUserSettings({ fontSize: 16 })
      saveUserSettings({ fontFamily: 'Arial' })
      saveUserSettings({ lineHeight: 1.5 })
      saveUserSettings({ contentWidth: 'wide' })

      // No Firestore write yet (debouncing)
      expect(setDoc).not.toHaveBeenCalled()

      // Advance past debounce timer (1000ms)
      await vi.advanceTimersByTimeAsync(1100)

      // Should have made exactly ONE Firestore call with merged settings
      expect(setDoc).toHaveBeenCalledTimes(1)
      expect(setDoc).toHaveBeenCalledWith(
        mockSettingsDocRef,
        expect.objectContaining({
          theme: 'dark',
          fontSize: 16,
          fontFamily: 'Arial',
          lineHeight: 1.5,
          contentWidth: 'wide'
        }),
        { merge: true }
      )
    })

    it('batches settings changes made within debounce window', async () => {
      mockAuth.currentUser = mockUser

      saveUserSettings({ theme: 'light' })

      // Advance 500ms (still within debounce window)
      await vi.advanceTimersByTimeAsync(500)

      // Add another setting
      saveUserSettings({ fontSize: 20 })

      // Advance another 500ms (still within new debounce window)
      await vi.advanceTimersByTimeAsync(500)

      // Still no write
      expect(setDoc).not.toHaveBeenCalled()

      // Advance past debounce
      await vi.advanceTimersByTimeAsync(600)

      // Should batch both settings
      expect(setDoc).toHaveBeenCalledTimes(1)
      expect(setDoc).toHaveBeenCalledWith(
        mockSettingsDocRef,
        expect.objectContaining({
          theme: 'light',
          fontSize: 20
        }),
        { merge: true }
      )
    })

    it('does not write to Firestore immediately - writes are debounced', () => {
      mockAuth.currentUser = mockUser

      saveUserSettings({ theme: 'sepia' })

      // Firestore write should NOT happen immediately
      expect(setDoc).not.toHaveBeenCalled()
    })
  })

  describe('flushSettings', () => {
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }

    beforeEach(() => {
      vi.useFakeTimers()
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('immediately flushes pending settings without waiting for debounce', async () => {
      mockAuth.currentUser = mockUser
      vi.mocked(setDoc).mockClear()

      saveUserSettings({ theme: 'dark' })
      saveUserSettings({ fontSize: 18 })

      // No write yet
      expect(setDoc).not.toHaveBeenCalled()

      // Force flush
      flushSettings()

      // Allow async flush to complete
      await vi.advanceTimersByTimeAsync(0)

      // Should write immediately
      expect(setDoc).toHaveBeenCalledTimes(1)
    })

    it('does nothing when no pending settings', async () => {
      mockAuth.currentUser = mockUser
      vi.mocked(setDoc).mockClear()

      // Flush with nothing pending
      flushSettings()
      await vi.advanceTimersByTimeAsync(0)

      expect(setDoc).not.toHaveBeenCalled()
    })
  })

  describe('loadUserSettings (cached)', () => {
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }
    const mockSettings = {
      theme: 'dark',
      fontSize: 16,
      lastUpdated: { seconds: 123 }
    }

    beforeEach(() => {
      // Invalidate cache before each test
      invalidateSettingsCache()
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    it('fetches from Firestore on first call', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockSettings })
      })

      const result = await loadUserSettings()

      expect(getDoc).toHaveBeenCalledWith(mockSettingsDocRef)
      expect(result).toEqual({ theme: 'dark', fontSize: 16 })
    })

    it('returns cached data on subsequent calls within TTL', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockSettings })
      })

      // First call - fetches from Firestore
      await loadUserSettings()
      expect(getDoc).toHaveBeenCalledTimes(1)

      // Second call - should use cache
      vi.mocked(getDoc).mockClear()
      const result = await loadUserSettings()

      expect(getDoc).not.toHaveBeenCalled()
      expect(result).toEqual({ theme: 'dark', fontSize: 16 })
    })

    it('bypasses cache when forceRefresh is true', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockSettings })
      })

      // First call - fetches from Firestore
      await loadUserSettings()
      vi.mocked(getDoc).mockClear()

      // Force refresh - should fetch again
      await loadUserSettings(true)

      expect(getDoc).toHaveBeenCalledTimes(1)
    })

    it('removes lastUpdated metadata from returned settings', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          theme: 'light',
          lastUpdated: { seconds: 999 }
        })
      })

      const result = await loadUserSettings()

      expect(result).not.toHaveProperty('lastUpdated')
    })

    it('does not call Firestore when not authenticated', async () => {
      // Invalidate cache first
      invalidateSettingsCache()

      mockAuth.currentUser = null
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(null)
        return vi.fn()
      })

      vi.mocked(getDoc).mockClear()

      // When not authenticated, getDoc should not be called
      await loadUserSettings(true)

      expect(getDoc).not.toHaveBeenCalled()
    })
  })

  describe('invalidateSettingsCache', () => {
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }

    beforeEach(() => {
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    it('forces next loadUserSettings to fetch from Firestore', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        queueMicrotask(() => callback(mockUser))
        return vi.fn()
      })
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ theme: 'dark' })
      })

      // First call - populates cache
      await loadUserSettings()
      vi.mocked(getDoc).mockClear()

      // Invalidate cache
      invalidateSettingsCache()

      // Next call should fetch from Firestore
      await loadUserSettings()
      expect(getDoc).toHaveBeenCalledTimes(1)
    })
  })

  describe('subscribeToUserSettings', () => {
    const mockCallback = vi.fn()
    const mockUnsubscribe = vi.fn()
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }

    beforeEach(() => {
      mockCallback.mockClear()
      mockUnsubscribe.mockClear()
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    it('subscribes to Firestore settings updates', () => {
      mockAuth.currentUser = mockUser
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe)

      subscribeToUserSettings(mockCallback)

      expect(onSnapshot).toHaveBeenCalledWith(
        mockSettingsDocRef,
        expect.any(Function),
        expect.any(Function)
      )
    })

    it('updates cache when subscription receives data', async () => {
      mockAuth.currentUser = mockUser
      let snapshotCallback

      vi.mocked(onSnapshot).mockImplementation((ref, callback) => {
        snapshotCallback = callback
        return mockUnsubscribe
      })

      subscribeToUserSettings(mockCallback)

      // Simulate incoming data from subscription
      snapshotCallback({
        exists: () => true,
        data: () => ({ theme: 'dark', fontSize: 20, lastUpdated: { seconds: 123 } })
      })

      expect(mockCallback).toHaveBeenCalledWith({ theme: 'dark', fontSize: 20 })

      // Cache should be updated - next load should use cache
      vi.mocked(getDoc).mockClear()
      const result = await loadUserSettings()
      expect(getDoc).not.toHaveBeenCalled()
      expect(result).toEqual({ theme: 'dark', fontSize: 20 })
    })

    it('returns unsubscribe function', () => {
      mockAuth.currentUser = mockUser
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe)

      const unsubscribe = subscribeToUserSettings(mockCallback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('unsubscribes from previous subscription when called again', () => {
      mockAuth.currentUser = mockUser
      const firstUnsubscribe = vi.fn()
      const secondUnsubscribe = vi.fn()

      vi.mocked(onSnapshot)
        .mockReturnValueOnce(firstUnsubscribe)
        .mockReturnValueOnce(secondUnsubscribe)

      subscribeToUserSettings(mockCallback)
      subscribeToUserSettings(mockCallback)

      expect(firstUnsubscribe).toHaveBeenCalled()
    })

    it('returns no-op when not authenticated', () => {
      mockAuth.currentUser = null

      const unsubscribe = subscribeToUserSettings(mockCallback)

      expect(onSnapshot).not.toHaveBeenCalled()
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('unsubscribeAll', () => {
    const mockUnsubscribe = vi.fn()
    const mockSettingsDocRef = { path: 'users/user123/settings/preferences' }

    beforeEach(() => {
      mockUnsubscribe.mockClear()
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('settings')) {
          return mockSettingsDocRef
        }
        return mockDocRef
      })
    })

    it('unsubscribes from all active subscriptions', () => {
      mockAuth.currentUser = mockUser
      vi.mocked(onSnapshot).mockReturnValue(mockUnsubscribe)

      subscribeToUserSettings(vi.fn())

      unsubscribeAll()

      expect(mockUnsubscribe).toHaveBeenCalled()
    })
  })

  // ============================================
  // NEW TESTS: Subcollection-based sync
  // ============================================

  describe('syncChatStateWithSubcollections', () => {
    const mockMetadataRef = { path: 'users/user123/chatData/metadata' }
    const mockMessageRef = { path: 'users/user123/chatData/messages/msg1' }
    const mockBatch = {
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn()
    }

    beforeEach(() => {
      vi.mocked(writeBatch).mockReturnValue(mockBatch)
      mockBatch.set.mockClear()
      mockBatch.delete.mockClear()
      mockBatch.commit.mockReset()
      mockBatch.commit.mockResolvedValue(undefined)
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        // Path: users/{uid}/chatData/metadata/messages/{messageId}
        // pathSegments = ['users', uid, 'chatData', 'metadata', 'messages', messageId]
        if (pathSegments.includes('messages')) {
          // Message document under metadata subcollection
          return { path: `users/user123/chatData/metadata/messages/${pathSegments[pathSegments.length - 1]}` }
        }
        if (pathSegments.includes('metadata')) {
          // Metadata document itself
          return mockMetadataRef
        }
        return mockDocRef
      })
    })

    it('syncs metadata and messages to Firestore', async () => {
      mockAuth.currentUser = mockUser
      const state = {
        messagesById: { msg1: { id: 'msg1', question: 'Test' } },
        chats: [{ id: 'chat1' }],
        currentModel: 'gpt-4'
      }

      await syncChatStateWithSubcollections(state)

      expect(writeBatch).toHaveBeenCalledWith(mockDb)
      expect(mockBatch.set).toHaveBeenCalledWith(
        mockMetadataRef,
        expect.objectContaining({
          chats: [{ id: 'chat1' }],
          currentModel: 'gpt-4',
          schemaVersion: 2
        })
      )
      expect(mockBatch.set).toHaveBeenCalledWith(
        expect.objectContaining({ path: 'users/user123/chatData/metadata/messages/msg1' }),
        { id: 'msg1', question: 'Test' }
      )
      expect(mockBatch.commit).toHaveBeenCalled()
    })

    it('only syncs changed messages when changedMessageIds is provided', async () => {
      mockAuth.currentUser = mockUser
      const state = {
        messagesById: {
          msg1: { id: 'msg1', question: 'Test1' },
          msg2: { id: 'msg2', question: 'Test2' },
          msg3: { id: 'msg3', question: 'Test3' }
        },
        chats: []
      }
      const changedIds = new Set(['msg2'])

      await syncChatStateWithSubcollections(state, changedIds)

      // Should only set msg2, not msg1 or msg3
      const messageSets = mockBatch.set.mock.calls.filter(
        call => call[0].path?.includes('messages')
      )
      expect(messageSets).toHaveLength(1)
      expect(messageSets[0][1]).toEqual({ id: 'msg2', question: 'Test2' })
    })

    it('deletes messages when deletedMessageIds is provided', async () => {
      mockAuth.currentUser = mockUser
      const state = {
        messagesById: { msg1: { id: 'msg1' } },
        chats: []
      }
      const deletedIds = new Set(['msg2', 'msg3'])

      await syncChatStateWithSubcollections(state, null, deletedIds)

      expect(mockBatch.delete).toHaveBeenCalledTimes(2)
    })

    it('skips sync when no user is authenticated', async () => {
      mockAuth.currentUser = null
      const state = { messagesById: {}, chats: [] }

      await syncChatStateWithSubcollections(state)

      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('throws error when batch commit fails', async () => {
      mockAuth.currentUser = mockUser
      mockBatch.commit.mockRejectedValue(new Error('Batch failed'))

      await expect(syncChatStateWithSubcollections({ messagesById: {}, chats: [] }))
        .rejects.toThrow('Batch failed')
    })

    it('excludes messagesById from metadata document', async () => {
      mockAuth.currentUser = mockUser
      const state = {
        messagesById: { msg1: { id: 'msg1' } },
        chats: [{ id: 'chat1' }]
      }

      await syncChatStateWithSubcollections(state)

      const metadataCall = mockBatch.set.mock.calls.find(
        call => call[0] === mockMetadataRef
      )
      expect(metadataCall[1]).not.toHaveProperty('messagesById')
      expect(metadataCall[1]).toHaveProperty('chats')
    })
  })

  describe('loadChatStateWithSubcollections', () => {
    const mockMetadataRef = { path: 'users/user123/chatData/metadata' }
    const mockMessagesRef = { path: 'users/user123/chatData/messages' }

    beforeEach(() => {
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        if (pathSegments.includes('metadata')) {
          return mockMetadataRef
        }
        if (pathSegments.includes('state')) {
          return mockDocRef
        }
        return mockDocRef
      })
      vi.mocked(collection).mockReturnValue(mockMessagesRef)
    })

    it('loads from subcollections when schemaVersion is 2', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          chats: [{ id: 'chat1' }],
          currentModel: 'gpt-4',
          schemaVersion: 2,
          lastUpdated: { seconds: 123 }
        })
      })

      const mockMessages = [
        { id: 'msg1', data: () => ({ id: 'msg1', question: 'Test1' }) },
        { id: 'msg2', data: () => ({ id: 'msg2', question: 'Test2' }) }
      ]
      vi.mocked(getDocs).mockResolvedValue({
        forEach: (cb) => mockMessages.forEach(cb)
      })

      const result = await loadChatStateWithSubcollections()

      expect(result).toEqual({
        chats: [{ id: 'chat1' }],
        currentModel: 'gpt-4',
        messagesById: {
          msg1: { id: 'msg1', question: 'Test1' },
          msg2: { id: 'msg2', question: 'Test2' }
        }
      })
      expect(result).not.toHaveProperty('schemaVersion')
      expect(result).not.toHaveProperty('lastUpdated')
    })

    it('falls back to legacy format when schemaVersion is not 2', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      // Metadata doesn't exist or doesn't have schemaVersion 2
      vi.mocked(getDoc).mockImplementation((ref) => {
        if (ref === mockMetadataRef) {
          return Promise.resolve({ exists: () => false })
        }
        // Legacy state document
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            messagesById: { msg1: { id: 'msg1' } },
            chats: [{ id: 'chat1' }],
            lastUpdated: { seconds: 123 }
          })
        })
      })

      const result = await loadChatStateWithSubcollections()

      expect(result).toEqual({
        messagesById: { msg1: { id: 'msg1' } },
        chats: [{ id: 'chat1' }]
      })
      expect(getDocs).not.toHaveBeenCalled()
    })

    it('returns null when no data exists', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({ exists: () => false })

      const result = await loadChatStateWithSubcollections()

      expect(result).toBeNull()
    })

    it('returns null when not authenticated', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(null)
        return vi.fn()
      })

      const result = await loadChatStateWithSubcollections()

      expect(result).toBeNull()
    })
  })

  describe('migrateToSubcollections', () => {
    const mockMetadataRef = { path: 'users/user123/chatData/metadata' }
    const mockLegacyRef = { path: 'users/user123/chatData/state' }
    const mockBatch = {
      set: vi.fn(),
      delete: vi.fn(),
      commit: vi.fn().mockResolvedValue(undefined)
    }

    beforeEach(() => {
      vi.mocked(writeBatch).mockReturnValue(mockBatch)
      mockBatch.set.mockClear()
      mockBatch.delete.mockClear()
      mockBatch.commit.mockClear()
      vi.mocked(doc).mockImplementation((db, ...pathSegments) => {
        // Path: users/{uid}/chatData/metadata/messages/{messageId}
        if (pathSegments.includes('messages')) {
          return { path: `users/user123/chatData/metadata/messages/${pathSegments[pathSegments.length - 1]}` }
        }
        if (pathSegments.includes('metadata')) {
          return mockMetadataRef
        }
        if (pathSegments.includes('state')) {
          return mockLegacyRef
        }
        return mockDocRef
      })
    })

    it('migrates legacy data to subcollections', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      // Metadata doesn't exist yet
      vi.mocked(getDoc).mockImplementation((ref) => {
        if (ref === mockMetadataRef) {
          return Promise.resolve({ exists: () => false })
        }
        // Legacy data exists
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            messagesById: {
              msg1: { id: 'msg1', question: 'Test1' },
              msg2: { id: 'msg2', question: 'Test2' }
            },
            chats: [{ id: 'chat1' }],
            currentModel: 'gpt-4',
            lastUpdated: { seconds: 123 }
          })
        })
      })

      const result = await migrateToSubcollections()

      expect(result).toBe(true)
      expect(mockBatch.set).toHaveBeenCalledWith(
        mockMetadataRef,
        expect.objectContaining({
          chats: [{ id: 'chat1' }],
          currentModel: 'gpt-4',
          schemaVersion: 2
        })
      )
      // Should set both messages
      expect(mockBatch.set).toHaveBeenCalledTimes(3) // metadata + 2 messages
      expect(mockBatch.commit).toHaveBeenCalled()
    })

    it('returns false when already migrated', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ schemaVersion: 2 })
      })

      const result = await migrateToSubcollections()

      expect(result).toBe(false)
      expect(writeBatch).not.toHaveBeenCalled()
    })

    it('returns false when no legacy data exists', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockResolvedValue({ exists: () => false })

      const result = await migrateToSubcollections()

      expect(result).toBe(false)
    })

    it('returns false when not authenticated', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(null)
        return vi.fn()
      })

      const result = await migrateToSubcollections()

      expect(result).toBe(false)
    })

    it('returns false when no messages to migrate', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      vi.mocked(getDoc).mockImplementation((ref) => {
        if (ref === mockMetadataRef) {
          return Promise.resolve({ exists: () => false })
        }
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            messagesById: {},
            chats: []
          })
        })
      })

      const result = await migrateToSubcollections()

      expect(result).toBe(false)
    })

    it('handles large migrations in batches', async () => {
      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        callback(mockUser)
        return vi.fn()
      })

      // Create 500 messages to trigger batching
      const messagesById = {}
      for (let i = 0; i < 500; i++) {
        messagesById[`msg${i}`] = { id: `msg${i}`, question: `Test${i}` }
      }

      vi.mocked(getDoc).mockImplementation((ref) => {
        if (ref === mockMetadataRef) {
          return Promise.resolve({ exists: () => false })
        }
        return Promise.resolve({
          exists: () => true,
          data: () => ({
            messagesById,
            chats: [{ id: 'chat1' }]
          })
        })
      })

      const result = await migrateToSubcollections()

      expect(result).toBe(true)
      // Should have created 2 batches (450 per batch + metadata in first)
      expect(writeBatch).toHaveBeenCalledTimes(2)
      expect(mockBatch.commit).toHaveBeenCalledTimes(2)
    })
  })

  describe('Tool Instance Data Sync', () => {
    beforeEach(() => {
      mockAuth.currentUser = mockUser
      vi.mocked(firebase.getFirebaseDb).mockReturnValue(mockDb)
    })

    it('should save tool instance data immediately using dot notation', async () => {
      const { saveToolInstanceDataImmediate } = await import('../firestore.js')

      await saveToolInstanceDataImmediate('session-123', 'tool-abc', { count: 5, items: [] })

      // Verify dot notation is used for nested field update
      expect(doc).toHaveBeenCalledWith(mockDb, 'users', mockUser.uid, 'studioSessions', 'session-123')
      expect(setDoc).toHaveBeenCalledWith(
        mockDocRef,
        expect.objectContaining({
          'toolInstanceData.tool-abc': { count: 5, items: [] }
        }),
        { merge: true }
      )
    })

    it('should not sync when no authenticated user', async () => {
      const { saveToolInstanceDataImmediate } = await import('../firestore.js')

      mockAuth.currentUser = null

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await saveToolInstanceDataImmediate('session-123', 'tool-abc', { count: 5 })

      expect(consoleSpy).toHaveBeenCalledWith('No authenticated user, skipping tool instance data cloud sync')
      expect(setDoc).not.toHaveBeenCalled()

      consoleSpy.mockRestore()
    })

    it('should handle Firestore errors gracefully', async () => {
      const { saveToolInstanceDataImmediate } = await import('../firestore.js')

      vi.mocked(setDoc).mockRejectedValue(new Error('Network error'))

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Should not throw, should log error
      await expect(saveToolInstanceDataImmediate('session-123', 'tool-abc', { count: 5 }))
        .resolves.toBeUndefined()

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to save tool instance data to Firestore:',
        expect.any(Error)
      )

      consoleSpy.mockRestore()
    })

    it('should restore tool instance data when loading sessions', async () => {
      const { loadStudioSessionsFromFirestore } = await import('../firestore.js')

      const mockSessionData = {
        toolInstanceData: {
          'tool-1': { count: 10 },
          'tool-2': { items: ['a', 'b', 'c'] }
        }
      }

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false
      })

      const mockQuerySnapshot = {
        forEach: (callback) => {
          // Simulate one session document
          callback({
            id: 'session-123',
            data: () => mockSessionData
          })
        }
      }

      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot)

      const localStorageSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {})

      await loadStudioSessionsFromFirestore()

      // Verify tool instance data was restored to localStorage
      expect(localStorageSpy).toHaveBeenCalledWith(
        'tool-instance-session-123-tool-1',
        JSON.stringify({ count: 10 })
      )
      expect(localStorageSpy).toHaveBeenCalledWith(
        'tool-instance-session-123-tool-2',
        JSON.stringify({ items: ['a', 'b', 'c'] })
      )

      localStorageSpy.mockRestore()
    })

    it('should handle missing tool instance data gracefully when loading', async () => {
      const { loadStudioSessionsFromFirestore } = await import('../firestore.js')

      const mockSessionData = {
        name: 'Session without tools'
      }

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false
      })

      const mockQuerySnapshot = {
        forEach: (callback) => {
          callback({
            id: 'session-456',
            data: () => mockSessionData
          })
        }
      }

      vi.mocked(getDocs).mockResolvedValue(mockQuerySnapshot)

      const localStorageSpy = vi.spyOn(localStorage, 'setItem').mockImplementation(() => {})

      // Should not throw when toolInstanceData is missing
      await expect(loadStudioSessionsFromFirestore()).resolves.not.toThrow()

      // Should not try to restore undefined tool data
      expect(localStorageSpy).not.toHaveBeenCalledWith('tool-instance-session-456')

      localStorageSpy.mockRestore()
    })
  })
})
