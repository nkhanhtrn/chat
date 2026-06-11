import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock all external service dependencies
vi.mock('@/services/BookSyncService', () => ({
  syncBookList: vi.fn().mockResolvedValue({ books: [], lastSyncedAt: null, hasConflict: false }),
  syncBookContent: vi.fn().mockResolvedValue({ book: null }),
  saveBookList: vi.fn().mockResolvedValue(undefined),
  saveBook: vi.fn().mockResolvedValue(undefined),
  deleteBook: vi.fn().mockResolvedValue(undefined),
  resolveBookListConflict: vi.fn().mockResolvedValue({ books: [], lastSyncedAt: null }),
}))

vi.mock('@/services/firestore/firestore-books', () => ({
  saveBookToFirestore: vi.fn().mockResolvedValue(undefined),
  deleteBookFromFirestore: vi.fn().mockResolvedValue(undefined),
  uploadBookFileToStorage: vi.fn().mockResolvedValue(undefined),
  downloadBookFileFromStorage: vi.fn().mockResolvedValue(null),
}))

vi.mock('@/services/firebase', () => ({
  getFirebaseAuth: vi.fn().mockReturnValue({
    currentUser: { uid: 'test-user-123' },
  }),
}))

vi.mock('@/services/BookStorage', () => ({
  BookStorage: {
    getBookFile: vi.fn().mockRejectedValue(new Error('not found')),
    saveBookFile: vi.fn().mockResolvedValue(undefined),
    deleteBookFile: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/epubRenderer', () => ({
  EpubRenderer: vi.fn().mockImplementation(function () {
    this.initialize = vi.fn().mockResolvedValue(undefined)
    this.getTableOfContents = vi.fn().mockReturnValue([])
    this.destroy = vi.fn()
  }),
}))

vi.mock('@/services/pdfRenderer', () => ({
  PdfRenderer: vi.fn(),
  extractPdfInfo: vi.fn().mockResolvedValue({
    title: 'PDF Title',
    author: 'PDF Author',
    coverData: null,
    totalPages: 100,
  }),
  extractPdfToc: vi.fn().mockResolvedValue([]),
}))

import { useBooksStore } from '@/stores/books'
import type { BookData } from '@/types/book'

function makeBook(overrides: Partial<BookData> = {}): BookData {
  return {
    id: 'book-123',
    title: 'Test Book',
    author: 'Test Author',
    coverUrl: '',
    fileSize: 1024,
    fileInStorage: true,
    fileStoragePath: 'users/test-user-123/books/book-123/book.epub',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    lastCfi: null,
    fileCachedAt: null,
    readingProgress: 0,
    fileType: 'epub',
    lastPage: null,
    totalPages: null,
    category: 'book',
    meta: null,
    ...overrides,
  }
}

function makePaper(overrides: Partial<BookData> = {}): BookData {
  return makeBook({
    id: 'paper-123',
    title: 'Test Paper',
    author: 'Researcher',
    fileType: 'pdf',
    category: 'paper',
    meta: {
      doi: '10.1000/test',
      journal: 'Nature',
      year: 2024,
      abstract: 'Test abstract',
      keywords: ['ml', 'physics'],
      bibtex: '@article{test, ...}',
      citationCount: 10,
      language: null,
    },
    ...overrides,
  })
}

describe('useBooksStore', () => {
  let store: ReturnType<typeof useBooksStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useBooksStore()
    vi.clearAllMocks()
  })

  // ── Getters ──

  describe('getBookById', () => {
    it('returns book by id', () => {
      const book = makeBook({ id: 'abc' })
      store.books.push(book)

      expect(store.getBookById('abc')).toEqual(book)
    })

    it('returns null for unknown id', () => {
      expect(store.getBookById('unknown')).toBeNull()
    })
  })

  describe('currentBook', () => {
    it('returns null when no current book set', () => {
      expect(store.currentBook).toBeNull()
    })

    it('returns the current book', () => {
      const book = makeBook({ id: 'abc' })
      store.books.push(book)
      store.currentBookId = 'abc'

      expect(store.currentBook).toEqual(book)
    })
  })

  describe('booksSortedByDate', () => {
    it('sorts books by updatedAt descending', () => {
      store.books.push(
        makeBook({ id: '1', updatedAt: 1000 }),
        makeBook({ id: '2', updatedAt: 3000 }),
        makeBook({ id: '3', updatedAt: 2000 }),
      )

      const sorted = store.booksSortedByDate
      expect(sorted.map(b => b.id)).toEqual(['2', '3', '1'])
    })
  })

  describe('booksSortedByTitle', () => {
    it('sorts books alphabetically by title', () => {
      store.books.push(
        makeBook({ id: '1', title: 'Zebra' }),
        makeBook({ id: '2', title: 'Apple' }),
        makeBook({ id: '3', title: 'Mango' }),
      )

      const sorted = store.booksSortedByTitle
      expect(sorted.map(b => b.title)).toEqual(['Apple', 'Mango', 'Zebra'])
    })
  })

  describe('recentBooks', () => {
    it('returns at most 5 recent books sorted by date', () => {
      for (let i = 0; i < 8; i++) {
        store.books.push(makeBook({ id: String(i), updatedAt: i * 100 }))
      }

      const recent = store.recentBooks
      expect(recent).toHaveLength(5)
      expect(recent[0].id).toBe('7') // most recent
    })
  })

  describe('isBookPreloaded', () => {
    it('returns false when not preloaded', () => {
      expect(store.isBookPreloaded('book-123')).toBe(false)
    })

    it('returns true after preloading', () => {
      store.preloadedBooks['book-123'] = { fileData: new ArrayBuffer(8), toc: [] }
      expect(store.isBookPreloaded('book-123')).toBe(true)
    })
  })

  // ── Actions ──

  describe('setCurrentBook', () => {
    it('sets the current book id', () => {
      store.setCurrentBook('abc')
      expect(store.currentBookId).toBe('abc')
    })

    it('clears the current book with null', () => {
      store.currentBookId = 'abc'
      store.setCurrentBook(null)
      expect(store.currentBookId).toBeNull()
    })
  })

  describe('updateReadingPosition', () => {
    it('updates cfi and progress on the book', async () => {
      const book = makeBook({ id: 'book-123', lastCfi: null, readingProgress: 0 })
      store.books.push(book)

      await store.updateReadingPosition('book-123', 'epubcfi(/6/4!/4/2)', 0.42)

      expect(book.lastCfi).toBe('epubcfi(/6/4!/4/2)')
      expect(book.readingProgress).toBe(42)
    })

    it('calls saveBook locally', async () => {
      const { saveBook } = await import('@/services/BookSyncService')
      store.books.push(makeBook({ id: 'book-123' }))

      await store.updateReadingPosition('book-123', 'cfi', 0.1)

      expect(saveBook).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'book-123', lastCfi: 'cfi', readingProgress: 10 }),
      )
    })

    it('calls saveBookToFirestore (fire-and-forget)', async () => {
      const { saveBookToFirestore } = await import('@/services/firestore/firestore-books')
      store.books.push(makeBook({ id: 'book-123' }))

      await store.updateReadingPosition('book-123', 'cfi', 0.5)

      // saveBookToFirestore is called as fire-and-forget (not awaited)
      // Give microtask queue a tick
      await new Promise(resolve => setTimeout(resolve, 0))
      expect(saveBookToFirestore).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'book-123' }),
      )
    })

    it('does nothing if book not found', async () => {
      const { saveBook } = await import('@/services/BookSyncService')

      await store.updateReadingPosition('nonexistent', 'cfi', 0.5)

      expect(saveBook).not.toHaveBeenCalled()
    })
  })

  describe('updatePdfReadingPosition', () => {
    it('updates page and progress on a PDF book', async () => {
      const book = makeBook({ id: 'book-123', fileType: 'pdf', lastPage: null, readingProgress: 0 })
      store.books.push(book)

      await store.updatePdfReadingPosition('book-123', 42, 0.42)

      expect(book.lastPage).toBe(42)
      expect(book.readingProgress).toBe(42)
    })

    it('calls saveBook locally', async () => {
      const { saveBook } = await import('@/services/BookSyncService')
      store.books.push(makeBook({ id: 'book-123', fileType: 'pdf' }))

      await store.updatePdfReadingPosition('book-123', 10, 0.1)

      expect(saveBook).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'book-123', lastPage: 10, readingProgress: 10 }),
      )
    })

    it('does nothing if book not found', async () => {
      const { saveBook } = await import('@/services/BookSyncService')

      await store.updatePdfReadingPosition('nonexistent', 5, 0.5)

      expect(saveBook).not.toHaveBeenCalled()
    })

    it('updates updatedAt timestamp', async () => {
      const originalUpdatedAt = 1000
      const book = makeBook({ id: 'book-123', fileType: 'pdf', updatedAt: originalUpdatedAt })
      store.books.push(book)

      await store.updatePdfReadingPosition('book-123', 5, 0.5)

      expect(book.updatedAt).toBeGreaterThan(originalUpdatedAt)
    })
  })

  describe('updatedAt drives sort-by-last-opened', () => {
    it('EPUB position update changes sort order', async () => {
      store.books.push(
        makeBook({ id: 'older', title: 'Older Book', updatedAt: 1000 }),
        makeBook({ id: 'newer', title: 'Newer Book', updatedAt: 2000 }),
      )

      // "older" is read, bumping its updatedAt
      await store.updateReadingPosition('older', 'epubcfi(/6/4)', 0.5)

      const sorted = store.booksSortedByDate
      expect(sorted[0].id).toBe('older')
    })

    it('PDF position update changes sort order', async () => {
      store.books.push(
        makeBook({ id: 'older', title: 'Older Book', updatedAt: 1000, fileType: 'pdf' }),
        makeBook({ id: 'newer', title: 'Newer Book', updatedAt: 2000, fileType: 'pdf' }),
      )

      // "older" is read, bumping its updatedAt
      await store.updatePdfReadingPosition('older', 10, 0.3)

      const sorted = store.booksSortedByDate
      expect(sorted[0].id).toBe('older')
    })
  })

  describe('updateBook', () => {
    it('updates book fields and saves', async () => {
      const { saveBook } = await import('@/services/BookSyncService')
      const book = makeBook({ id: 'book-123', title: 'Old Title' })
      store.books.push(book)

      await store.updateBook('book-123', { title: 'New Title' })

      expect(book.title).toBe('New Title')
      expect(saveBook).toHaveBeenCalled()
    })
  })

  describe('deleteBook', () => {
    it('removes book from store', async () => {
      store.books.push(makeBook({ id: 'book-123' }))

      await store.deleteBook('book-123')

      expect(store.books).toHaveLength(0)
    })

    it('clears currentBookId if deleting the current book', async () => {
      store.books.push(makeBook({ id: 'book-123' }))
      store.currentBookId = 'book-123'

      await store.deleteBook('book-123')

      expect(store.currentBookId).toBeNull()
    })

    it('clears preloaded data for the book', async () => {
      store.books.push(makeBook({ id: 'book-123' }))
      store.preloadedBooks['book-123'] = { fileData: new ArrayBuffer(8), toc: [] }

      await store.deleteBook('book-123')

      expect(store.preloadedBooks['book-123']).toBeUndefined()
    })

    it('does nothing if book not found', async () => {
      await store.deleteBook('nonexistent')

      expect(store.books).toHaveLength(0)
    })
  })

  describe('getPreloadedBook / clearPreloadedBook', () => {
    it('returns null for non-preloaded book', () => {
      expect(store.getPreloadedBook('book-123')).toBeNull()
    })

    it('returns preloaded data', () => {
      const data = { fileData: new ArrayBuffer(16), toc: [] }
      store.preloadedBooks['book-123'] = data

      expect(store.getPreloadedBook('book-123')).toEqual(data)
    })

    it('clears preloaded data', () => {
      store.preloadedBooks['book-123'] = { fileData: new ArrayBuffer(8), toc: [] }
      store.preloadProgress['book-123'] = 100

      store.clearPreloadedBook('book-123')

      expect(store.preloadedBooks['book-123']).toBeUndefined()
      expect(store.preloadProgress['book-123']).toBeUndefined()
    })
  })

  describe('preloadBook (tier 1/2/3 file loading)', () => {
    it('returns existing preload if already cached (tier 0)', async () => {
      const existing = { fileData: new ArrayBuffer(8), toc: [] }
      store.preloadedBooks['book-123'] = existing
      store.books.push(makeBook({ id: 'book-123' }))

      const result = await store.preloadBook('book-123')

      expect(result).toEqual(existing)
    })

    it('loads from IndexedDB cache (tier 2) when available', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const cachedFile = new ArrayBuffer(100)
      vi.mocked(BookStorage.getBookFile).mockResolvedValue(cachedFile)
      store.books.push(makeBook({ id: 'book-123' }))

      const result = await store.preloadBook('book-123')

      expect(BookStorage.getBookFile).toHaveBeenCalledWith('book-123')
      expect(result.fileData).toBe(cachedFile)
    })

    it('falls back to cloud download (tier 3) when IndexedDB misses', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
      const cloudFile = new ArrayBuffer(200)
      vi.mocked(BookStorage.getBookFile).mockRejectedValue(new Error('not found'))
      vi.mocked(downloadBookFileFromStorage).mockResolvedValue(cloudFile)
      store.books.push(makeBook({ id: 'book-123' }))

      const result = await store.preloadBook('book-123')

      expect(downloadBookFileFromStorage).toHaveBeenCalledWith('book-123')
      expect(result.fileData).toBe(cloudFile)
    })

    it('caches cloud-downloaded file to IndexedDB (tier 3 → tier 2)', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
      const cloudFile = new ArrayBuffer(300)
      vi.mocked(BookStorage.getBookFile).mockRejectedValue(new Error('not found'))
      vi.mocked(downloadBookFileFromStorage).mockResolvedValue(cloudFile)
      store.books.push(makeBook({ id: 'book-123' }))

      await store.preloadBook('book-123')

      expect(BookStorage.saveBookFile).toHaveBeenCalledWith('book-123', cloudFile)
    })

    it('throws if file not found in any tier', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
      vi.mocked(BookStorage.getBookFile).mockRejectedValue(new Error('not found'))
      vi.mocked(downloadBookFileFromStorage).mockResolvedValue(null)
      store.books.push(makeBook({ id: 'book-123' }))

      await expect(store.preloadBook('book-123')).rejects.toThrow('Book file not found')
    })

    it('cleans up preloadingIds in finally block', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      vi.mocked(BookStorage.getBookFile).mockRejectedValue(new Error('not found'))
      store.books.push(makeBook({ id: 'book-123' }))

      try {
        await store.preloadBook('book-123')
      } catch {}

      expect(store.preloadingIds.has('book-123')).toBe(false)
    })

    it('throws if book not found in store', async () => {
      await expect(store.preloadBook('nonexistent')).rejects.toThrow('Book not found')
    })
  })

  describe('setBookNotebook / removeBookNotebook', () => {
    it('associates a notebook with a book', () => {
      store.setBookNotebook('book-123', 'notebook-456')
      expect(store.getBookNotebook('book-123')).toBe('notebook-456')
    })

    it('removes the association', () => {
      store.setBookNotebook('book-123', 'notebook-456')
      store.removeBookNotebook('book-123')
      expect(store.getBookNotebook('book-123')).toBeNull()
    })
  })

  describe('addBook (PDF)', () => {
    it('creates book with pdf fileType and correct storage path', async () => {
      await store.addBook({
        title: 'Test PDF',
        author: 'Author',
        fileSize: 2048,
        fileData: new ArrayBuffer(8),
        coverData: null,
        fileType: 'pdf',
        totalPages: 50,
      })

      const book = store.books.find(b => b.title === 'Test PDF')
      expect(book).toBeDefined()
      expect(book!.fileType).toBe('pdf')
      expect(book!.fileStoragePath).toContain('book.pdf')
      expect(book!.totalPages).toBe(50)
      expect(book!.lastPage).toBeNull()
    })

    it('creates book with epub fileType and correct storage path', async () => {
      await store.addBook({
        title: 'Test EPUB',
        author: 'Author',
        fileSize: 2048,
        fileData: new ArrayBuffer(8),
        coverData: null,
        fileType: 'epub',
      })

      const book = store.books.find(b => b.title === 'Test EPUB')
      expect(book).toBeDefined()
      expect(book!.fileType).toBe('epub')
      expect(book!.fileStoragePath).toContain('book.epub')
    })

    it('defaults to epub fileType when not specified', async () => {
      await store.addBook({
        title: 'Default Format',
        fileSize: 1024,
        fileData: new ArrayBuffer(8),
      })

      const book = store.books.find(b => b.title === 'Default Format')
      expect(book!.fileType).toBe('epub')
      expect(book!.fileStoragePath).toContain('book.epub')
    })
  })

  describe('preloadBook (PDF)', () => {
    it('uses extractPdfToc for PDF books', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const { extractPdfToc } = await import('@/services/pdfRenderer')
      const mockToc = [{ id: '1', label: 'Chapter', href: 'page:1', subitems: [] }]
      vi.mocked(BookStorage.getBookFile).mockResolvedValue(new ArrayBuffer(100))
      vi.mocked(extractPdfToc).mockResolvedValue(mockToc as any[])
      store.books.push(makeBook({ id: 'book-123', fileType: 'pdf' }))

      const result = await store.preloadBook('book-123')

      expect(extractPdfToc).toHaveBeenCalled()
      expect(result.toc).toEqual(mockToc)
    })
  })

  describe('papers getters', () => {
    describe('papers', () => {
      it('returns only items with category paper', () => {
        store.books.push(
          makeBook({ id: 'b1', title: 'Book' }),
          makePaper({ id: 'p1', title: 'Paper 1' }),
          makePaper({ id: 'p2', title: 'Paper 2' }),
        )

        expect(store.papers).toHaveLength(2)
        expect(store.papers.map(b => b.id)).toEqual(['p1', 'p2'])
      })

      it('returns empty array when no papers', () => {
        store.books.push(makeBook({ id: 'b1' }))

        expect(store.papers).toHaveLength(0)
      })

      it('treats items without category as books', () => {
        store.books.push(
          makeBook({ id: 'b1', category: undefined as any }),
        )

        expect(store.papers).toHaveLength(0)
      })
    })

    describe('papersSortedByDate', () => {
      it('sorts papers by updatedAt descending', () => {
        store.books.push(
          makePaper({ id: 'p1', updatedAt: 1000 }),
          makePaper({ id: 'p2', updatedAt: 3000 }),
          makePaper({ id: 'p3', updatedAt: 2000 }),
        )

        const sorted = store.papersSortedByDate
        expect(sorted.map(b => b.id)).toEqual(['p2', 'p3', 'p1'])
      })

      it('excludes books from the result', () => {
        store.books.push(
          makeBook({ id: 'b1', updatedAt: 5000 }),
          makePaper({ id: 'p1', updatedAt: 1000 }),
        )

        const sorted = store.papersSortedByDate
        expect(sorted).toHaveLength(1)
        expect(sorted[0].id).toBe('p1')
      })
    })

    describe('getPaperById', () => {
      it('returns paper by id', () => {
        store.books.push(makePaper({ id: 'p1' }))

        expect(store.getPaperById('p1')).toBeDefined()
        expect(store.getPaperById('p1')!.category).toBe('paper')
      })

      it('returns null for book id', () => {
        store.books.push(makeBook({ id: 'b1' }))

        expect(store.getPaperById('b1')).toBeNull()
      })

      it('returns null for unknown id', () => {
        expect(store.getPaperById('unknown')).toBeNull()
      })
    })

    describe('allKeywords', () => {
      it('collects unique keywords from all papers', () => {
        store.books.push(
          makePaper({
            id: 'p1',
            meta: { doi: null, journal: null, year: null, abstract: null, keywords: ['ml', 'nlp'], bibtex: null, citationCount: null, language: null },
          }),
          makePaper({
            id: 'p2',
            meta: { doi: null, journal: null, year: null, abstract: null, keywords: ['nlp', 'cv'], bibtex: null, citationCount: null, language: null },
          }),
        )

        expect(store.allKeywords).toEqual(['cv', 'ml', 'nlp'])
      })

      it('returns empty array when no papers have keywords', () => {
        store.books.push(makeBook({ id: 'b1' }))

        expect(store.allKeywords).toEqual([])
      })

      it('ignores empty string keywords', () => {
        store.books.push(
          makePaper({
            id: 'p1',
            meta: { doi: null, journal: null, year: null, abstract: null, keywords: ['ml', ''], bibtex: null, citationCount: null, language: null },
          }),
        )

        expect(store.allKeywords).toEqual(['ml'])
      })

      it('handles papers with null meta', () => {
        store.books.push(
          makePaper({ id: 'p1', meta: null }),
          makeBook({ id: 'b1' }),
        )

        expect(store.allKeywords).toEqual([])
      })
    })
  })

  describe('addBook (paper)', () => {
    it('creates a paper with category and meta', async () => {
      const meta = {
        doi: '10.1234/test',
        journal: 'Nature',
        year: 2024,
        abstract: 'Test abstract',
        keywords: ['physics'],
        bibtex: '@article{key, ...}',
        citationCount: null,
        language: null,
      }
      await store.addBook({
        title: 'Test Paper',
        author: 'Researcher',
        fileSize: 2048,
        fileData: new ArrayBuffer(8),
        coverData: null,
        fileType: 'pdf',
        category: 'paper',
        meta,
      })

      const paper = store.books.find(b => b.title === 'Test Paper')
      expect(paper).toBeDefined()
      expect(paper!.category).toBe('paper')
      expect(paper!.meta).toEqual(meta)
      expect(paper!.fileType).toBe('pdf')
      expect(paper!.fileStoragePath).toContain('book.pdf')
    })

    it('caches file to IndexedDB after upload', async () => {
      const { BookStorage } = await import('@/services/BookStorage')
      const fileData = new ArrayBuffer(16)

      await store.addBook({
        title: 'Cached Paper',
        fileSize: 16,
        fileData,
        fileType: 'pdf',
        category: 'paper',
        meta: {
          doi: null, journal: null, year: null, abstract: null,
          keywords: [], bibtex: null, citationCount: null, language: null,
        },
      })

      expect(BookStorage.saveBookFile).toHaveBeenCalledWith(
        expect.any(String),
        fileData,
      )
    })

    it('defaults category to book when not specified', async () => {
      await store.addBook({
        title: 'Regular Book',
        fileSize: 1024,
        fileData: new ArrayBuffer(8),
      })

      const book = store.books.find(b => b.title === 'Regular Book')
      expect(book!.category).toBe('book')
      expect(book!.meta).toBeNull()
    })

    it('defaults meta to null when not specified', async () => {
      await store.addBook({
        title: 'No Meta',
        fileSize: 1024,
        fileData: new ArrayBuffer(8),
        category: 'paper',
      })

      const book = store.books.find(b => b.title === 'No Meta')
      expect(book!.meta).toBeNull()
    })
  })

  describe('updateBook (paper metadata)', () => {
    it('updates meta on a paper', async () => {
      const paper = makePaper({ id: 'p1' })
      store.books.push(paper)

      const newMeta = {
        doi: '10.9999/updated',
        journal: 'Science',
        year: 2025,
        abstract: 'Updated abstract',
        keywords: ['ml', 'updated'],
        bibtex: '@article{updated}',
        citationCount: 99,
        language: null,
      }
      await store.updateBook('p1', { meta: newMeta })

      expect(paper.meta).toEqual(newMeta)
    })

    it('updates title and author on a paper', async () => {
      const paper = makePaper({ id: 'p1', title: 'Old Title' })
      store.books.push(paper)

      await store.updateBook('p1', { title: 'New Title', author: 'New Author' })

      expect(paper.title).toBe('New Title')
      expect(paper.author).toBe('New Author')
    })
  })
})
