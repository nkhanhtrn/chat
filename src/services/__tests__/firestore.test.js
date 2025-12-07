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
  onSnapshot: vi.fn(),
  serverTimestamp: vi.fn(() => ({ _serverTimestamp: true }))
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
  unsubscribeAll
} from '../firestore.js'
import * as firebase from '../firebase.js'
import { doc, setDoc, getDoc, onSnapshot, serverTimestamp } from 'firebase/firestore'
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

    it('uses currentUser if already authenticated', async () => {
      mockAuth.currentUser = mockUser

      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockState })
      })

      await loadChatStateFromFirestore()

      // Should not wait for onAuthStateChanged
      expect(onAuthStateChanged).not.toHaveBeenCalled()
    })

    it('removes lastUpdated metadata from returned state', async () => {
      mockAuth.currentUser = mockUser

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
      mockAuth.currentUser = mockUser
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({ ...mockSettings })
      })

      const result = await loadUserSettings()

      expect(getDoc).toHaveBeenCalledWith(mockSettingsDocRef)
      expect(result).toEqual({ theme: 'dark', fontSize: 16 })
    })

    it('returns cached data on subsequent calls within TTL', async () => {
      mockAuth.currentUser = mockUser
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
      mockAuth.currentUser = mockUser
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
      mockAuth.currentUser = mockUser
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
      mockAuth.currentUser = mockUser
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
})
