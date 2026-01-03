import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BookStorage } from '../BookStorage.js'

// Mock BookStorage
vi.mock('../BookStorage.js', () => ({
  BookStorage: {
    saveBook: vi.fn(() => Promise.resolve()),
    loadBooks: vi.fn(() => Promise.resolve([])),
    deleteBook: vi.fn(() => Promise.resolve()),
    getBookFile: vi.fn(() => Promise.resolve(null)),
    saveBookFile: vi.fn(() => Promise.resolve())
  }
}))

describe('BookStorage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('saveBook', () => {
    it('saves book metadata', async () => {
      const book = {
        id: 'book-123',
        title: 'Test Book',
        author: 'Test Author'
      }

      await BookStorage.saveBook(book)

      expect(BookStorage.saveBook).toHaveBeenCalledWith(book)
    })
  })

  describe('loadBooks', () => {
    it('loads books from storage', async () => {
      const books = [
        { id: 'book-1', title: 'Book 1' }
      ]
      vi.mocked(BookStorage.loadBooks).mockResolvedValue(books)

      const result = await BookStorage.loadBooks()

      expect(result).toEqual(books)
    })
  })

  describe('deleteBook', () => {
    it('deletes book from storage', async () => {
      await BookStorage.deleteBook('book-123')

      expect(BookStorage.deleteBook).toHaveBeenCalledWith('book-123')
    })
  })

  describe('getBookFile', () => {
    it('returns cached file', async () => {
      const cachedBuffer = new ArrayBuffer(1024)
      vi.mocked(BookStorage.getBookFile).mockResolvedValue(cachedBuffer)

      const result = await BookStorage.getBookFile('book-123')

      expect(result).toBe(cachedBuffer)
    })

    it('returns null when not cached', async () => {
      vi.mocked(BookStorage.getBookFile).mockResolvedValue(null)

      const result = await BookStorage.getBookFile('book-123')

      expect(result).toBeNull()
    })
  })

  describe('saveBookFile', () => {
    it('saves file data', async () => {
      const fileData = new ArrayBuffer(2048)

      await BookStorage.saveBookFile('book-123', fileData)

      expect(BookStorage.saveBookFile).toHaveBeenCalledWith('book-123', fileData)
    })
  })
})
