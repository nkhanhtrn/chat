import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/services/sync/IndexedDBService', () => {
  const mockDb = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getAllFromIndex: vi.fn().mockResolvedValue([]),
    objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
    transaction: vi.fn(),
  }
  return { getDB: vi.fn().mockResolvedValue(mockDb) }
})

import { StrokeStorage } from '../StrokeStorage'
import { getDB } from '@/services/sync/IndexedDBService'
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

describe('StrokeStorage', () => {
  let mockDb: any

  beforeEach(async () => {
    mockDb = await getDB()
    vi.clearAllMocks()
    mockDb.objectStoreNames.contains.mockReturnValue(true)
    mockDb.getAllFromIndex.mockResolvedValue([])
    mockDb.getAll.mockResolvedValue([])
  })

  describe('saveStroke', () => {
    it('puts the stroke into the strokes store', async () => {
      const stroke = makeStroke()
      await StrokeStorage.saveStroke(stroke)
      expect(mockDb.put).toHaveBeenCalledWith('strokes', stroke)
    })

    it('warns and skips when the store is unavailable', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await StrokeStorage.saveStroke(makeStroke())
      expect(mockDb.put).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('strokes store not available'))
      warnSpy.mockRestore()
    })
  })

  describe('deleteStroke', () => {
    it('deletes by id', async () => {
      await StrokeStorage.deleteStroke('stroke-1')
      expect(mockDb.delete).toHaveBeenCalledWith('strokes', 'stroke-1')
    })

    it('is a no-op when the store is unavailable', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      await StrokeStorage.deleteStroke('stroke-1')
      expect(mockDb.delete).not.toHaveBeenCalled()
    })
  })

  describe('getStrokes', () => {
    it('queries by bookId via the index', async () => {
      const strokes = [makeStroke({ id: 'a' })]
      mockDb.getAllFromIndex.mockResolvedValue(strokes)

      const result = await StrokeStorage.getStrokes('book-123')

      expect(mockDb.getAllFromIndex).toHaveBeenCalledWith('strokes', 'bookId', 'book-123')
      expect(result).toBe(strokes)
    })

    it('falls back to getAll + filter when the index query fails', async () => {
      const all = [makeStroke({ id: 'a', bookId: 'book-123' }), makeStroke({ id: 'b', bookId: 'other' })]
      mockDb.getAllFromIndex.mockRejectedValue(new Error('no index'))
      mockDb.getAll.mockResolvedValue(all)

      const result = await StrokeStorage.getStrokes('book-123')

      expect(result.map(s => s.id)).toEqual(['a'])
    })

    it('returns empty array when the store is unavailable', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      const result = await StrokeStorage.getStrokes('book-123')
      expect(result).toEqual([])
    })
  })

  describe('wipeBook', () => {
    it('walks the bookId index cursor and deletes each record', async () => {
      const cursor = { delete: vi.fn().mockResolvedValue(undefined), continue: vi.fn().mockResolvedValue(null) }
      mockDb.transaction.mockReturnValue({
        store: { index: vi.fn().mockReturnValue({ openCursor: vi.fn().mockResolvedValue(cursor) }) },
        done: Promise.resolve(),
      })

      await StrokeStorage.wipeBook('book-123')

      expect(cursor.delete).toHaveBeenCalled()
      expect(cursor.continue).toHaveBeenCalled()
    })

    it('is a no-op when the store is unavailable', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      await StrokeStorage.wipeBook('book-123')
      expect(mockDb.transaction).not.toHaveBeenCalled()
    })
  })
})
