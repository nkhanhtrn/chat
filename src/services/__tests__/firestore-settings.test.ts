import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetDoc = vi.fn().mockResolvedValue(undefined)
const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false })
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref')

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockGetFirebaseAuth = vi.fn().mockReturnValue({
  currentUser: { uid: 'test-user-123' },
})

vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}))

import { loadSettingsFromCloud, saveSettingsToCloud } from '../firestore/firestore-settings'

describe('firestore-settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFirebaseAuth.mockReturnValue({
      currentUser: { uid: 'test-user-123' },
    })
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockSetDoc.mockResolvedValue(undefined)
  })

  describe('saveSettingsToCloud', () => {
    it('writes settings to Firestore with merge', async () => {
      await saveSettingsToCloud({ theme: 'dark', fontSize: 18 })

      expect(mockDoc).toHaveBeenCalledWith(
        expect.anything(),
        'users',
        'test-user-123',
        'settings',
        'user-settings',
      )
      expect(mockSetDoc).toHaveBeenCalledWith(
        'mock-doc-ref',
        expect.objectContaining({ theme: 'dark', fontSize: 18, lastUpdated: expect.any(Number) }),
        { merge: true },
      )
    })

    it('returns early if no authenticated user', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)

      await saveSettingsToCloud({ theme: 'dark' })

      expect(mockSetDoc).not.toHaveBeenCalled()
    })

    it('handles Firestore write errors gracefully', async () => {
      mockSetDoc.mockRejectedValue(new Error('write failed'))

      await expect(saveSettingsToCloud({ theme: 'dark' })).resolves.toBeUndefined()
    })
  })

  describe('loadSettingsFromCloud', () => {
    it('returns settings when document exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ theme: 'dark', fontSize: 18, lastUpdated: 1234567890 }),
      })

      const result = await loadSettingsFromCloud()

      expect(result).toEqual({ theme: 'dark', fontSize: 18 })
    })

    it('strips lastUpdated from returned data', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => ({ theme: 'sepia', lastUpdated: 999 }),
      })

      const result = await loadSettingsFromCloud()

      expect(result).toEqual({ theme: 'sepia' })
      expect(result).not.toHaveProperty('lastUpdated')
    })

    it('returns null when document does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false })

      const result = await loadSettingsFromCloud()

      expect(result).toBeNull()
    })

    it('returns null if no authenticated user', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)

      const result = await loadSettingsFromCloud()

      expect(result).toBeNull()
      expect(mockGetDoc).not.toHaveBeenCalled()
    })

    it('returns null on Firestore read error', async () => {
      mockGetDoc.mockRejectedValue(new Error('read failed'))

      const result = await loadSettingsFromCloud()

      expect(result).toBeNull()
    })
  })
})
