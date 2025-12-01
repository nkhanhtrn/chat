import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  syncChatStateToFirestore,
  loadChatStateFromFirestore,
  subscribeToChatState,
  deleteChatStateFromFirestore
} from '../firestore.js'
import * as firebase from '../firebase.js'

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
})
