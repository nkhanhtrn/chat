import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  signInUser,
  signOutUser,
  getCurrentUser,
  onAuthChange
} from '../auth.js'
import * as firebase from '../firebase.js'

// Mock firebase module
vi.mock('../firebase.js', () => ({
  getFirebaseAuth: vi.fn()
}))

// Mock firebase/auth
vi.mock('firebase/auth', () => ({
  signInWithEmailAndPassword: vi.fn(),
  createUserWithEmailAndPassword: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: vi.fn()
}))

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from 'firebase/auth'

describe('auth.js', () => {
  const mockUser = {
    uid: 'user123',
    email: 'test@example.com'
  }
  const mockAuth = { currentUser: null }

  beforeEach(() => {
    vi.mocked(firebase.getFirebaseAuth).mockReturnValue(mockAuth)
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('signInUser', () => {
    it('signs in user with email and password', async () => {
      vi.mocked(signInWithEmailAndPassword).mockResolvedValue({
        user: mockUser
      })

      const result = await signInUser('test@example.com', 'password123')

      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(
        mockAuth,
        'test@example.com',
        'password123'
      )
      expect(result).toEqual(mockUser)
    })

    it('throws error on invalid credentials', async () => {
      const authError = new Error('Invalid credentials')
      authError.code = 'auth/wrong-password'
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue(authError)

      await expect(signInUser('test@example.com', 'wrongpassword'))
        .rejects.toThrow('Invalid credentials')
    })

    it('throws error when user not found', async () => {
      const authError = new Error('User not found')
      authError.code = 'auth/user-not-found'
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue(authError)

      await expect(signInUser('unknown@example.com', 'password'))
        .rejects.toThrow('User not found')
    })

    it('throws error on network failure', async () => {
      const authError = new Error('Network error')
      authError.code = 'auth/network-request-failed'
      vi.mocked(signInWithEmailAndPassword).mockRejectedValue(authError)

      await expect(signInUser('test@example.com', 'password'))
        .rejects.toThrow('Network error')
    })
  })

  describe('signOutUser', () => {
    it('signs out the current user', async () => {
      vi.mocked(signOut).mockResolvedValue(undefined)

      await signOutUser()

      expect(signOut).toHaveBeenCalledWith(mockAuth)
    })

    it('throws error on sign out failure', async () => {
      vi.mocked(signOut).mockRejectedValue(new Error('Sign out failed'))

      await expect(signOutUser()).rejects.toThrow('Sign out failed')
    })
  })

  describe('getCurrentUser', () => {
    it('returns current user when authenticated', () => {
      mockAuth.currentUser = mockUser

      const result = getCurrentUser()

      expect(result).toEqual(mockUser)
    })

    it('returns null when not authenticated', () => {
      mockAuth.currentUser = null

      const result = getCurrentUser()

      expect(result).toBeNull()
    })
  })

  describe('onAuthChange', () => {
    it('subscribes to auth state changes', () => {
      const mockCallback = vi.fn()
      const mockUnsubscribe = vi.fn()
      vi.mocked(onAuthStateChanged).mockReturnValue(mockUnsubscribe)

      const unsubscribe = onAuthChange(mockCallback)

      expect(onAuthStateChanged).toHaveBeenCalledWith(mockAuth, mockCallback)
      expect(unsubscribe).toBe(mockUnsubscribe)
    })

    it('calls callback when user signs in', () => {
      const mockCallback = vi.fn()
      let authCallback

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        authCallback = callback
        return vi.fn()
      })

      onAuthChange(mockCallback)
      authCallback(mockUser)

      expect(mockCallback).toHaveBeenCalledWith(mockUser)
    })

    it('calls callback with null when user signs out', () => {
      const mockCallback = vi.fn()
      let authCallback

      vi.mocked(onAuthStateChanged).mockImplementation((auth, callback) => {
        authCallback = callback
        return vi.fn()
      })

      onAuthChange(mockCallback)
      authCallback(null)

      expect(mockCallback).toHaveBeenCalledWith(null)
    })
  })
})
