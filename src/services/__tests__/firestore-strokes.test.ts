import { describe, it, expect, beforeEach, vi } from 'vitest'

const mockSetDoc = vi.fn()
const mockDoc = vi.fn().mockReturnValue('mock-doc-ref')
const mockDeleteDoc = vi.fn()
const mockGetDocs = vi.fn().mockResolvedValue({ docs: [] })
const mockWriteBatch = vi.fn()

vi.mock('firebase/firestore', () => ({
  getFirestore: vi.fn().mockReturnValue({}),
  doc: (...args: unknown[]) => mockDoc(...args),
  setDoc: (...args: unknown[]) => mockSetDoc(...args),
  deleteDoc: (...args: unknown[]) => mockDeleteDoc(...args),
  collection: vi.fn().mockReturnValue('mock-col-ref'),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  writeBatch: (...args: unknown[]) => mockWriteBatch(...args),
}))

const mockGetFirebaseAuth = vi.fn().mockReturnValue({ currentUser: { uid: 'test-user-123' } })
vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: (...args: unknown[]) => mockGetFirebaseAuth(...args),
}))

import { saveStrokeToFirestore, deleteStrokeFromFirestore, loadStrokesForBook, wipeStrokesForBook } from '../firestore/firestore-strokes'
import type { Stroke } from '@/types/stroke'

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 'stroke-1',
    bookId: 'book-123',
    page: 1,
    tool: 'pen',
    colorIndex: 0,
    points: [{ x: 1, y: 2 }],
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('firestore-strokes', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetFirebaseAuth.mockReturnValue({ currentUser: { uid: 'test-user-123' } })
    mockWriteBatch.mockReturnValue({ delete: vi.fn(), commit: vi.fn().mockResolvedValue(undefined) })
    mockGetDocs.mockResolvedValue({ docs: [] })
  })

  describe('saveStrokeToFirestore', () => {
    it('writes to users/{uid}/books/{bookId}/strokes/{id}', async () => {
      await saveStrokeToFirestore('book-123', makeStroke({ id: 'stroke-1' }))

      expect(mockDoc).toHaveBeenCalledWith(expect.anything(), 'users', 'test-user-123', 'books', 'book-123', 'strokes', 'stroke-1')
      expect(mockSetDoc).toHaveBeenCalledWith('mock-doc-ref', expect.objectContaining({ id: 'stroke-1' }))
    })

    it('returns early when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      await saveStrokeToFirestore('book-123', makeStroke())
      expect(mockSetDoc).not.toHaveBeenCalled()
    })
  })

  describe('deleteStrokeFromFirestore', () => {
    it('deletes the stroke document', async () => {
      await deleteStrokeFromFirestore('book-123', 'stroke-1')
      expect(mockDeleteDoc).toHaveBeenCalledWith('mock-doc-ref')
    })

    it('returns early when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      await deleteStrokeFromFirestore('book-123', 'stroke-1')
      expect(mockDeleteDoc).not.toHaveBeenCalled()
    })
  })

  describe('loadStrokesForBook', () => {
    it('maps cloud docs to strokes with their id', async () => {
      mockGetDocs.mockResolvedValue({
        docs: [
          { id: 'a', data: () => ({ bookId: 'book-123', tool: 'pen' }) },
          { id: 'b', data: () => ({ bookId: 'book-123', tool: 'rect' }) },
        ],
      })

      const result = await loadStrokesForBook('book-123')

      expect(result).toHaveLength(2)
      expect(result[0].id).toBe('a')
      expect(result[1].id).toBe('b')
    })

    it('returns empty array when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      expect(await loadStrokesForBook('book-123')).toEqual([])
    })

    it('returns empty array on error', async () => {
      mockGetDocs.mockRejectedValue(new Error('network'))
      expect(await loadStrokesForBook('book-123')).toEqual([])
    })
  })

  describe('wipeStrokesForBook', () => {
    it('batches deletes for all stroke docs', async () => {
      const batchDelete = vi.fn()
      const batchCommit = vi.fn().mockResolvedValue(undefined)
      mockWriteBatch.mockReturnValue({ delete: batchDelete, commit: batchCommit })
      const refA = {}; const refB = {}
      mockGetDocs.mockResolvedValue({ docs: [{ ref: refA }, { ref: refB }] })

      await wipeStrokesForBook('book-123')

      expect(batchDelete).toHaveBeenCalledTimes(2)
      expect(batchCommit).toHaveBeenCalled()
    })

    it('skips the batch when there are no strokes', async () => {
      mockGetDocs.mockResolvedValue({ docs: [] })
      await wipeStrokesForBook('book-123')
      expect(mockWriteBatch).not.toHaveBeenCalled()
    })

    it('returns early when not authenticated', async () => {
      mockGetFirebaseAuth.mockReturnValue({ currentUser: null } as any)
      await wipeStrokesForBook('book-123')
      expect(mockGetDocs).not.toHaveBeenCalled()
    })
  })
})
