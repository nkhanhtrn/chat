import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { Book } from '../Book'

describe('Book', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates book with defaults', () => {
      const book = new Book()
      expect(book.id).toBe('test-uuid')
      expect(book.title).toBe('')
      expect(book.author).toBe('')
      expect(book.coverUrl).toBe('')
      expect(book.fileSize).toBe(0)
      expect(book.fileInStorage).toBe(false)
      expect(book.fileStoragePath).toBe('')
      expect(book.lastCfi).toBeNull()
      expect(book.fileCachedAt).toBeNull()
      expect(book.readingProgress).toBe(0)
      expect(book.fileType).toBe('epub')
      expect(book.lastPage).toBeNull()
      expect(book.totalPages).toBeNull()
    })

    it('accepts partial data', () => {
      const book = new Book({
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
      })
      expect(book.title).toBe('The Great Gatsby')
      expect(book.author).toBe('F. Scott Fitzgerald')
      expect(book.id).toBe('test-uuid')
    })

    it('accepts custom id', () => {
      const book = new Book({ id: 'custom-id' })
      expect(book.id).toBe('custom-id')
    })

    it('accepts pdf fileType with totalPages', () => {
      const book = new Book({ fileType: 'pdf', totalPages: 250 })
      expect(book.fileType).toBe('pdf')
      expect(book.totalPages).toBe(250)
      expect(book.lastPage).toBeNull()
    })

    it('sets timestamps', () => {
      const before = Date.now()
      const book = new Book()
      const after = Date.now()
      expect(book.createdAt).toBeGreaterThanOrEqual(before)
      expect(book.createdAt).toBeLessThanOrEqual(after)
      expect(book.updatedAt).toBe(book.createdAt)
    })
  })

  describe('toPlain', () => {
    it('returns BookData object', () => {
      const book = new Book({ title: 'Test', author: 'Author' })
      const plain = book.toPlain()
      expect(plain).toEqual({
        id: 'test-uuid',
        title: 'Test',
        author: 'Author',
        coverUrl: '',
        fileSize: 0,
        fileInStorage: false,
        fileStoragePath: '',
        createdAt: book.createdAt,
        updatedAt: book.updatedAt,
        lastCfi: null,
        fileCachedAt: null,
        readingProgress: 0,
        fileType: 'epub',
        lastPage: null,
        totalPages: null,
      })
    })
  })

  describe('static toPlain', () => {
    it('creates BookData from partial input', () => {
      const plain = Book.toPlain({ title: 'Hello' })
      expect(plain.title).toBe('Hello')
      expect(plain.id).toBe('test-uuid')
    })
  })

  describe('static fromPlain', () => {
    it('creates Book instance from data', () => {
      const book = Book.fromPlain({ title: 'Test', author: 'Auth' })
      expect(book).toBeInstanceOf(Book)
      expect(book.title).toBe('Test')
      expect(book.author).toBe('Auth')
    })
  })

  describe('touch', () => {
    it('updates updatedAt and returns plain data', () => {
      const book = new Book()
      const originalUpdatedAt = book.updatedAt
      // Advance time slightly
      vi.spyOn(Date, 'now').mockReturnValue(originalUpdatedAt + 1000)
      const plain = book.touch()
      expect(book.updatedAt).toBe(originalUpdatedAt + 1000)
      expect(plain.updatedAt).toBe(originalUpdatedAt + 1000)
    })
  })
})
