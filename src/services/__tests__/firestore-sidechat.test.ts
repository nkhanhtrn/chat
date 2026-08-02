import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetDoc = vi.fn()
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref')
const mockDeleteDoc = vi.fn()
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] })
const mockGetDoc = vi.fn().mockResolvedValue({ exists: () => false })

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: vi.fn().mockReturnValue('mock-col-ref'),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  getDoc: (...args: unknown[]) => mockGetDoc(...args),
}))

const mockGetFirebaseAuth = vi.fn().mockReturnValue({ currentUser: { uid: 'test-user-123' } })
vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}))

import {
  saveSideChatScope,
  loadSideChatScope,
  loadAllSideChatScopes,
  deleteSideChatScope,
  type SideChatScopeData,
} from '../firestore/firestore-sidechat'
import type { SideChatMessage } from '@/stores/sideChat'

function makeMessage(overrides: Partial<SideChatMessage> = {}): SideChatMessage {
  return { id: 'm1', role: 'user', content: 'hi', ...overrides }
}

function makeScope(overrides: Partial<SideChatScopeData> = {}): SideChatScopeData {
  return {
    messages: [makeMessage()],
    sessionId: 'sess-1',
    lastUpdated: 100,
    ...overrides,
  }
}

describe('firestore-sidechat', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFirebaseAuth.mockReturnValue({ currentUser: { uid: 'test-user-123' } })
    mockGetDoc.mockResolvedValue({ exists: () => false })
    mockGetDocs.mockResolvedValue({ docs: [] })
  })

  describe('saveSideChatScope', () => {
    it('writes to users/{uid}/side-chat/{scopeId}', async () => {
      await saveSideChatScope('book-abc', makeScope())

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'test-user-123', 'side-chat', 'book-abc')
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({ sessionId: 'sess-1' }))
    })

    it('returns early when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      await saveSideChatScope('global', makeScope())
      expect(mockSetDoc).not.toHaveBeenCalled()
    })
  })

  describe('loadSideChatScope', () => {
    it('returns the stored scope when the doc exists', async () => {
      mockGetDoc.mockResolvedValue({
        exists: () => true,
        data: () => makeScope({ sessionId: 'sess-x' }),
      })

      const result = await loadSideChatScope('global')
      expect(result?.sessionId).toBe('sess-x')
    })

    it('returns null when the doc does not exist', async () => {
      mockGetDoc.mockResolvedValue({ exists: () => false })
      expect(await loadSideChatScope('global')).toBeNull()
    })

    it('returns null when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      expect(await loadSideChatScope('global')).toBeNull()
    })

    it('returns null on error', async () => {
      mockGetDoc.mockRejectedValue(new Error('network'))
      expect(await loadSideChatScope('global')).toBeNull()
    })
  })

  describe('loadAllSideChatScopes', () => {
    it('maps cloud docs to a scope record keyed by id', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'global', data: () => ({ messages: [], sessionId: 'g' }) },
          { id: 'book-1', data: () => ({ messages: [], sessionId: 'b1' }) },
        ],
      })

      const result = await loadAllSideChatScopes()
      expect(Object.keys(result)).toEqual(['global', 'book-1'])
      expect(result['global'].sessionId).toBe('g')
      expect(result['book-1'].sessionId).toBe('b1')
    })

    it('returns empty record when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      expect(await loadAllSideChatScopes()).toEqual({})
    })

    it('returns empty record on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('network'))
      expect(await loadAllSideChatScopes()).toEqual({})
    })
  })

  describe('deleteSideChatScope', () => {
    it('deletes the scope document', async () => {
      await deleteSideChatScope('book-abc')
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref')
    })

    it('returns early when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      await deleteSideChatScope('book-abc')
      expect(mockDeleteDoc).not.toHaveBeenCalled()
    })

    it('swallows errors', async () => {
      mockDeleteDoc.mockRejectedValueOnce(new Error('network'))
      await expect(deleteSideChatScope('book-abc')).resolves.toBeUndefined()
    })
  })
})
