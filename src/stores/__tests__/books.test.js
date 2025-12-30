import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useBooksStore } from '../books.js'

// Mock bookStorage
vi.mock('../../services/bookStorage.js', () => ({
  loadBooksFromStorage: vi.fn(() => Promise.resolve({ hasConflict: false, state: { books: [] } })),
  saveBookToStorage: vi.fn(() => Promise.resolve()),
  deleteBookFromStorage: vi.fn(() => Promise.resolve())
}))

describe('books store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('has correct default state', () => {
      const store = useBooksStore()

      expect(store.books).toEqual([])
      expect(store.currentBookId).toBeNull()
      expect(store.currentCfi).toBeNull()
      expect(store.isLoading).toBe(false)
      expect(store.error).toBeNull()
      expect(store.isInitialized).toBe(false)
    })
  })

  describe('getters', () => {
    it('currentBook returns current book object', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Book 1' },
        { id: 'book-2', title: 'Book 2' }
      ]
      store.currentBookId = 'book-2'

      expect(store.currentBook).toEqual({ id: 'book-2', title: 'Book 2' })
    })

    it('currentBook returns null if book not found', () => {
      const store = useBooksStore()
      store.books = [{ id: 'book-1', title: 'Book 1' }]
      store.currentBookId = 'book-2'

      expect(store.currentBook).toBeNull()
    })

    it('currentBook returns null when no book selected', () => {
      const store = useBooksStore()
      store.books = [{ id: 'book-1', title: 'Book 1' }]
      store.currentBookId = null

      expect(store.currentBook).toBeNull()
    })

    it('booksSortedByDate sorts by lastReadAt descending', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Book 1', lastReadAt: 1000 },
        { id: 'book-2', title: 'Book 2', lastReadAt: 3000 },
        { id: 'book-3', title: 'Book 3', lastReadAt: 2000 }
      ]

      const sorted = store.booksSortedByDate

      expect(sorted[0].id).toBe('book-2')
      expect(sorted[1].id).toBe('book-3')
      expect(sorted[2].id).toBe('book-1')
    })

    it('booksSortedByDate handles books without lastReadAt', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Book 1', lastReadAt: 1000 },
        { id: 'book-2', title: 'Book 2' },
        { id: 'book-3', title: 'Book 3', lastReadAt: 2000 }
      ]

      const sorted = store.booksSortedByDate

      expect(sorted[0].id).toBe('book-3')
      expect(sorted[2].id).toBe('book-2') // No lastReadAt
    })

    it('booksSortedByTitle sorts alphabetically', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Charlie' },
        { id: 'book-2', title: 'Alpha' },
        { id: 'book-3', title: 'Bravo' }
      ]

      const sorted = store.booksSortedByTitle

      expect(sorted[0].title).toBe('Alpha')
      expect(sorted[1].title).toBe('Bravo')
      expect(sorted[2].title).toBe('Charlie')
    })

    it('recentBooks returns top 5 recently read books', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Book 1', lastReadAt: 1000 },
        { id: 'book-2', title: 'Book 2', lastReadAt: 5000 },
        { id: 'book-3', title: 'Book 3', lastReadAt: 4000 },
        { id: 'book-4', title: 'Book 4', lastReadAt: 3000 },
        { id: 'book-5', title: 'Book 5', lastReadAt: 2000 },
        { id: 'book-6', title: 'Book 6', lastReadAt: 6000 }
      ]

      const recent = store.recentBooks

      expect(recent).toHaveLength(5)
      expect(recent[0].id).toBe('book-6')  // 6000
      expect(recent[1].id).toBe('book-2')  // 5000
      expect(recent[2].id).toBe('book-3')  // 4000
      expect(recent[3].id).toBe('book-4')  // 3000
      expect(recent[4].id).toBe('book-5')  // 2000
    })

    it('getBookById returns book by ID', () => {
      const store = useBooksStore()
      store.books = [
        { id: 'book-1', title: 'Book 1' },
        { id: 'book-2', title: 'Book 2' }
      ]

      expect(store.getBookById('book-2')).toEqual({ id: 'book-2', title: 'Book 2' })
    })

    it('getBookById returns null if not found', () => {
      const store = useBooksStore()
      store.books = [{ id: 'book-1', title: 'Book 1' }]

      expect(store.getBookById('book-2')).toBeNull()
    })
  })

  describe('actions', () => {
    describe('initializeStore', () => {
      it('initializes store from storage', async () => {
        const { loadBooksFromStorage } = await import('../../services/bookStorage.js')
        loadBooksFromStorage.mockResolvedValue({
          hasConflict: false,
          state: {
            books: [
              { id: 'book-1', title: 'Book 1' },
              { id: 'book-2', title: 'Book 2' }
            ]
          }
        })

        const store = useBooksStore()
        const result = await store.initializeStore()

        expect(store.books).toHaveLength(2)
        expect(store.isInitialized).toBe(true)
        expect(result.hasConflict).toBe(false)
      })

      it('returns conflict if detected', async () => {
        const { loadBooksFromStorage } = await import('../../services/bookStorage.js')
        loadBooksFromStorage.mockResolvedValue({
          hasConflict: true,
          localData: {},
          cloudData: {}
        })

        const store = useBooksStore()
        const result = await store.initializeStore()

        expect(result.hasConflict).toBe(true)
      })

      it('does not re-initialize if already initialized', async () => {
        const { loadBooksFromStorage } = await import('../../services/bookStorage.js')

        const store = useBooksStore()
        store.isInitialized = true

        await store.initializeStore()

        expect(loadBooksFromStorage).not.toHaveBeenCalled()
      })

      it('handles errors gracefully', async () => {
        const { loadBooksFromStorage } = await import('../../services/bookStorage.js')
        loadBooksFromStorage.mockRejectedValue(new Error('Load failed'))

        const store = useBooksStore()
        await store.initializeStore()

        expect(store.error).toBe('Load failed')
        expect(store.isLoading).toBe(false)
      })
    })

    describe('addBook', () => {
      it('adds new book with generated ID', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()

        const book = await store.addBook({
          title: 'New Book',
          author: 'Test Author'
        })

        expect(book.id).toBeDefined()
        expect(book.title).toBe('New Book')
        expect(book.author).toBe('Test Author')
        expect(book.createdAt).toBeDefined()
        expect(book.lastReadAt).toBeDefined()
        expect(book.updatedAt).toBeDefined()
        expect(book.lastReadCfi).toBeNull()
        expect(book.totalProgress).toBe(0)
        expect(book.deletedAt).toBeNull()
        expect(store.books).toHaveLength(1)
        expect(store.books[0].id).toBe(book.id)
        expect(saveBookToStorage).toHaveBeenCalledWith(book)
      })

      it('adds fileData if provided', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()

        const fileData = new ArrayBuffer(1024)
        const book = await store.addBook({
          title: 'New Book',
          fileData
        })

        expect(book.fileData).toBe(fileData)
      })
    })

    describe('updateReadingPosition', () => {
      it('updates reading position for book', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [{ id: 'book-1', title: 'Book 1' }]

        await store.updateReadingPosition('book-1', 'epubcfi(/6/8)', 0.5)

        expect(store.books[0].lastReadCfi).toBe('epubcfi(/6/8)')
        expect(store.books[0].totalProgress).toBe(0.5)
        expect(store.books[0].lastReadAt).toBeDefined()
        expect(saveBookToStorage).toHaveBeenCalledWith(store.books[0])
      })

      it('does nothing if book not found', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()

        await store.updateReadingPosition('nonexistent', 'epubcfi(/6/8)', 0.5)

        expect(saveBookToStorage).not.toHaveBeenCalled()
      })
    })

    describe('deleteBook', () => {
      it('deletes book from store and storage', async () => {
        const { deleteBookFromStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [
          { id: 'book-1', title: 'Book 1' },
          { id: 'book-2', title: 'Book 2' }
        ]
        store.currentBookId = 'book-1'

        await store.deleteBook('book-1')

        expect(store.books).toHaveLength(1)
        expect(store.books[0].id).toBe('book-2')
        expect(store.currentBookId).toBeNull()
        expect(deleteBookFromStorage).toHaveBeenCalledWith('book-1')
      })

      it('clears current book if deleting current book', async () => {
        const { deleteBookFromStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [{ id: 'book-1', title: 'Book 1' }]
        store.currentBookId = 'book-1'
        store.currentCfi = 'epubcfi(/6/4)'

        await store.deleteBook('book-1')

        expect(store.currentBookId).toBeNull()
        expect(store.currentCfi).toBeNull()
      })

      it('does not clear current book if deleting different book', async () => {
        const { deleteBookFromStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [
          { id: 'book-1', title: 'Book 1' },
          { id: 'book-2', title: 'Book 2' }
        ]
        store.currentBookId = 'book-1'

        await store.deleteBook('book-2')

        expect(store.currentBookId).toBe('book-1')
      })
    })

    describe('setCurrentBook', () => {
      it('sets current book ID', () => {
        const store = useBooksStore()

        store.setCurrentBook('book-123')

        expect(store.currentBookId).toBe('book-123')
      })
    })

    describe('updateBook', () => {
      it('updates book fields', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [{ id: 'book-1', title: 'Book 1' }]

        await store.updateBook('book-1', { title: 'Updated Title' })

        expect(store.books[0].title).toBe('Updated Title')
        expect(store.books[0].updatedAt).toBeDefined()
        expect(saveBookToStorage).toHaveBeenCalledWith(store.books[0])
      })

      it('handles multiple field updates', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()
        store.books = [{ id: 'book-1', title: 'Book 1' }]

        await store.updateBook('book-1', {
          title: 'Updated',
          author: 'Updated Author',
          coverUrl: 'new-cover'
        })

        expect(store.books[0].title).toBe('Updated')
        expect(store.books[0].author).toBe('Updated Author')
        expect(store.books[0].coverUrl).toBe('new-cover')
      })

      it('does nothing if book not found', async () => {
        const { saveBookToStorage } = await import('../../services/bookStorage.js')
        const store = useBooksStore()

        await store.updateBook('nonexistent', { title: 'Updated' })

        expect(saveBookToStorage).not.toHaveBeenCalled()
      })
    })
  })
})
