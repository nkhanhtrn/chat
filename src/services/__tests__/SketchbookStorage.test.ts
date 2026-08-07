import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('@/services/sync/IndexedDBService', () => {
  const mockDb = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    getAll: vi.fn().mockResolvedValue([]),
    getAllFromIndex: vi.fn().mockResolvedValue([]),
    objectStoreNames: { contains: vi.fn().mockReturnValue(true) },
  }
  return { getDB: vi.fn().mockResolvedValue(mockDb), SKETCHBOOKS_STORE: 'sketchbooks' }
})

import { SketchbookStorage } from '../SketchbookStorage'
import { getDB } from '@/services/sync/IndexedDBService'
import type { Sketchbook } from '@/types/sketchbook'

function makeSketchbook(overrides: Partial<Sketchbook> = {}): Sketchbook {
  return {
    id: 'sb-1',
    title: 'My Sketch',
    pageCount: 1,
    createdAt: 100,
    updatedAt: 100,
    ...overrides,
  }
}

describe('SketchbookStorage', () => {
  let mockDb: any

  beforeEach(async () => {
    mockDb = await getDB()
    vi.clearAllMocks()
    mockDb.objectStoreNames.contains.mockReturnValue(true)
    mockDb.getAllFromIndex.mockResolvedValue([])
    mockDb.getAll.mockResolvedValue([])
  })

  describe('save', () => {
    it('puts the sketchbook into the sketchbooks store', async () => {
      const sb = makeSketchbook()
      await SketchbookStorage.save(sb)
      expect(mockDb.put).toHaveBeenCalledWith('sketchbooks', sb)
    })

    it('throws when the store is unavailable (no silent data loss)', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      await expect(SketchbookStorage.save(makeSketchbook())).rejects.toThrow('store not available')
      expect(mockDb.put).not.toHaveBeenCalled()
    })
  })

  describe('get', () => {
    it('reads by id', async () => {
      const sb = makeSketchbook()
      mockDb.get.mockResolvedValue(sb)
      const result = await SketchbookStorage.get('sb-1')
      expect(mockDb.get).toHaveBeenCalledWith('sketchbooks', 'sb-1')
      expect(result).toEqual(sb)
    })
  })

  describe('getAll', () => {
    it('queries via the createdAt index', async () => {
      const list = [makeSketchbook({ id: 'a' }), makeSketchbook({ id: 'b' })]
      mockDb.getAllFromIndex.mockResolvedValue(list)
      const result = await SketchbookStorage.getAll()
      expect(mockDb.getAllFromIndex).toHaveBeenCalledWith('sketchbooks', 'createdAt')
      expect(result).toBe(list)
    })

    it('falls back to getAll when the index query fails', async () => {
      const list = [makeSketchbook({ id: 'a' })]
      mockDb.getAllFromIndex.mockRejectedValue(new Error('no index'))
      mockDb.getAll.mockResolvedValue(list)
      const result = await SketchbookStorage.getAll()
      expect(result).toBe(list)
    })
  })

  describe('delete', () => {
    it('deletes by id', async () => {
      await SketchbookStorage.delete('sb-1')
      expect(mockDb.delete).toHaveBeenCalledWith('sketchbooks', 'sb-1')
    })
  })
})
