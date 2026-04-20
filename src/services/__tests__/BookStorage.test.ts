import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock the IndexedDB dependency — factory must be self-contained (hoisted)
vi.mock('@/services/sync/IndexedDBService', () => {
  const mockDb = {
    put: vi.fn(),
    get: vi.fn(),
    delete: vi.fn(),
    objectStoreNames: {
      contains: vi.fn().mockReturnValue(true),
    },
  }
  return { getDB: vi.fn().mockResolvedValue(mockDb) }
})

// Import after mock
import { BookStorage } from '../BookStorage'
import { getDB } from '@/services/sync/IndexedDBService'

function getMockDb() {
  return (getDB as ReturnType<typeof vi.fn>).mockResolvedValue.__mockDb
}

describe('BookStorage', () => {
  let mockDb: ReturnType<typeof getDB> extends Promise<infer T> ? T : never

  beforeEach(async () => {
    mockDb = await getDB()
    vi.clearAllMocks()
    // Restore objectStoreNames.contains to return true after clearAllMocks
    mockDb.objectStoreNames.contains.mockReturnValue(true)
  })

  describe('saveBookFile', () => {
    it('saves file data to IndexedDB with bookId as key', async () => {
      const bookId = 'book-123'
      const fileData = new ArrayBuffer(8)

      await BookStorage.saveBookFile(bookId, fileData)

      expect(mockDb.put).toHaveBeenCalledWith('book-files', fileData, bookId)
    })

    it('warns and returns if book-files store is not available', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await BookStorage.saveBookFile('book-123', new ArrayBuffer(8))

      expect(mockDb.put).not.toHaveBeenCalled()
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('book-files store not available'),
      )
      warnSpy.mockRestore()
    })
  })

  describe('getBookFile', () => {
    it('returns file data when found', async () => {
      const fileData = new ArrayBuffer(16)
      mockDb.get.mockResolvedValue(fileData)

      const result = await BookStorage.getBookFile('book-123')

      expect(result).toBe(fileData)
      expect(mockDb.get).toHaveBeenCalledWith('book-files', 'book-123')
    })

    it('throws when book-files store is not available', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)

      await expect(BookStorage.getBookFile('book-123')).rejects.toThrow(
        'book-files store not available',
      )
    })

    it('throws when file not found', async () => {
      mockDb.get.mockResolvedValue(undefined)

      await expect(BookStorage.getBookFile('book-123')).rejects.toThrow(
        'file not found for book book-123',
      )
    })
  })

  describe('deleteBookFile', () => {
    it('deletes file from IndexedDB', async () => {
      await BookStorage.deleteBookFile('book-123')

      expect(mockDb.delete).toHaveBeenCalledWith('book-files', 'book-123')
    })

    it('does nothing if store is not available', async () => {
      mockDb.objectStoreNames.contains.mockReturnValue(false)

      await BookStorage.deleteBookFile('book-123')

      expect(mockDb.delete).not.toHaveBeenCalled()
    })
  })
})
