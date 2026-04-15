import { defineStore } from 'pinia'
import type { BookData, BookCreateParams } from '@/types/book'
import { Book } from '@/models/Book'
import { syncBookList, syncBookContent, saveBookList, saveBook, deleteBook as deleteBookFromIndexedDB, resolveBookListConflict } from '@/services/BookSyncService'
import { saveBookToFirestore, deleteBookFromFirestore, uploadBookFileToStorage } from '@/services/firestore/firestore-books'
import { getFirebaseAuth } from '@/services/firebase'
import { debugLog } from '@/utils/debug'

export interface PreloadedBookData {
  fileData: ArrayBuffer
  toc: unknown[]
}

export const useBooksStore = defineStore('books', {
  state: () => ({
    books: [] as BookData[],
    currentBookId: null as string | null,
    currentCfi: null as string | null,
    isLoading: false,
    error: null as string | null,
    isInitialized: false,
    preloadedBooks: {} as Record<string, PreloadedBookData>,
    preloadProgress: {} as Record<string, number>,
    preloadingIds: new Set<string>(),
    bookNotebooks: {} as Record<string, string>,
    lastCloudSyncAt: null as number | null,
    isCloudSyncing: false,
    syncConflicts: [] as unknown[],
  }),

  getters: {
    currentBook(state): BookData | null {
      return state.books.find(b => b.id === state.currentBookId) ?? null
    },

    booksSortedByDate(state): BookData[] {
      return [...state.books].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
    },

    booksSortedByTitle(state): BookData[] {
      return [...state.books].sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    },

    recentBooks(state): BookData[] {
      return [...state.books]
        .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        .slice(0, 5)
    },

    getBookById(state) {
      return (id: string): BookData | null => state.books.find(b => b.id === id) ?? null
    },

    isBookPreloaded(state) {
      return (id: string): boolean => !!state.preloadedBooks[id]
    },

    isBookPreloading(state) {
      return (id: string): boolean => state.preloadingIds.has(id)
    },

    getPreloadProgress(state) {
      return (id: string): number => state.preloadProgress[id] ?? 0
    },

    getBookNotebook(state) {
      return (bookId: string): string | null => state.bookNotebooks[bookId] ?? null
    },

    currentBookNotebook(state): string | null {
      if (!state.currentBookId) return null
      return state.bookNotebooks[state.currentBookId] ?? null
    },
  },

  actions: {
    async initializeStore(): Promise<{ hasConflict: boolean; conflicts?: unknown[] }> {
      if (this.isInitialized) return { hasConflict: false }

      this.isLoading = true
      this.error = null

      try {
        debugLog('[BooksStore] Initializing store')

        // Load book-notebook mapping from localStorage
        try {
          const localSaved = localStorage.getItem('bookNotebooks')
          if (localSaved) this.bookNotebooks = JSON.parse(localSaved)
        } catch (e) {
          console.warn('Failed to load bookNotebooks from localStorage:', e)
        }

        const listData = await syncBookList()
        this.books = (listData.books as BookData[]) ?? []
        this.lastCloudSyncAt = (listData.lastSyncedAt as number) ?? null
        this.isInitialized = true

        debugLog(`[BooksStore] Initialized: ${this.books.length} books`)

        return {
          hasConflict: (listData.hasConflict as boolean) ?? false,
          conflicts: listData.hasConflict ? [{ type: 'book-list', data: listData }] : [],
        }
      } catch (error) {
        console.error('[BooksStore] Failed to initialize:', error)
        this.error = (error as Error).message
        return { hasConflict: false }
      } finally {
        this.isLoading = false
      }
    },

    async loadBookContent(bookId: string): Promise<BookData> {
      try {
        const { book } = await syncBookContent(bookId) as { book: Record<string, unknown> }
        if (!book) throw new Error('Book not found')

        const index = this.books.findIndex(b => b.id === bookId)
        if (index !== -1) {
          this.books[index] = Book.toPlain(book as Partial<BookData>)
        }

        return this.books.find(b => b.id === bookId)!
      } catch (error) {
        console.error('[BooksStore] Failed to load book content:', error)
        throw error
      }
    },

    async resolveBookListConflict(choice: string, conflictData: Record<string, unknown>): Promise<void> {
      try {
        const result = await resolveBookListConflict(choice, conflictData)
        this.books = (result.books as BookData[]) ?? []
        this.lastCloudSyncAt = (result.lastSyncedAt as number) ?? null
        this.syncConflicts = []
      } catch (error) {
        console.error('[BooksStore] resolveBookListConflict error:', error)
        throw error
      }
    },

    async addBook(bookData: Record<string, unknown> & { fileData?: ArrayBuffer }): Promise<BookData> {
      const bookId = crypto.randomUUID()

      const auth = getFirebaseAuth()
      const user = auth?.currentUser
      const storagePath = user ? `users/${user.uid}/books/${bookId}/book.epub` : ''

      const { id: _bookDataId, ...bookDataOverrides } = bookData as Record<string, unknown>
      const book: BookData & { fileData?: ArrayBuffer } = {
        title: (bookData.title as string) ?? '',
        author: (bookData.author as string) ?? '',
        coverUrl: (bookData.coverUrl as string) ?? '',
        fileSize: (bookData.fileSize as number) ?? 0,
        fileInStorage: false,
        fileStoragePath: storagePath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        deletedAt: null,
        lastCfi: null,
        fileCachedAt: null,
        ...bookDataOverrides,
        id: bookId,
      }

      this.books.push(book)

      const { fileData, ...bookMetadata } = book

      await saveBook(Book.toPlain(bookMetadata))
      if (fileData) {
        const { BookStorage } = await import('@/services/BookStorage')
        await BookStorage.saveBookFile(book.id, fileData)
      }

      this.uploadBookFileToCloud(book.id, fileData, storagePath).catch(err => {
        console.warn('Failed to upload book file to cloud:', err)
        saveBookToFirestore(Book.toPlain(bookMetadata))
      })

      return book
    },

    async uploadBookFileToCloud(bookId: string, fileData: ArrayBuffer | undefined, _storagePath: string): Promise<void> {
      try {
        if (fileData) await uploadBookFileToStorage(bookId, fileData)

        const book = this.books.find(b => b.id === bookId)
        if (book) {
          book.fileInStorage = true
          book.updatedAt = Date.now()
          await saveBook(Book.toPlain(book))
          await saveBookToFirestore(Book.toPlain(book))
        }
      } catch (error) {
        console.error('[BooksStore] Failed to upload file:', error)
        throw error
      }
    },

    async updateReadingPosition(bookId: string, cfi: string, progress: number): Promise<void> {
      const book = this.books.find(b => b.id === bookId)
      if (!book) return

      book.lastCfi = cfi
      book.updatedAt = Date.now()

      await saveBook(Book.toPlain(book))
      saveBookToFirestore(Book.toPlain(book)).catch(err => {
        console.warn('Failed to upload reading position:', err)
      })
    },

    async deleteBook(bookId: string): Promise<void> {
      const index = this.books.findIndex(b => b.id === bookId)
      if (index === -1) return

      await deleteBookFromFirestore(bookId)

      this.books.splice(index, 1)
      await deleteBookFromIndexedDB(bookId)

      if (this.currentBookId === bookId) {
        this.currentBookId = null
        this.currentCfi = null
      }

      delete this.preloadedBooks[bookId]
    },

    setCurrentBook(bookId: string | null): void {
      this.currentBookId = bookId
    },

    async updateBook(bookId: string, updates: Partial<BookData>): Promise<void> {
      const book = this.books.find(b => b.id === bookId)
      if (!book) return

      Object.assign(book, updates, { updatedAt: Date.now() })
      await saveBook(Book.toPlain(book))
      saveBookToFirestore(Book.toPlain(book)).catch(err => {
        console.warn('Failed to upload book update to cloud:', err)
      })
    },

    async preloadBook(bookId: string, onProgress?: (progress: number) => void): Promise<PreloadedBookData> {
      if (this.preloadedBooks[bookId]) return this.preloadedBooks[bookId]

      this.preloadingIds.add(bookId)
      this.preloadProgress[bookId] = 0

      try {
        const book = this.getBookById(bookId)
        if (!book) throw new Error('Book not found')

        onProgress?.(10)

        const { BookStorage } = await import('@/services/BookStorage')
        const fileData = await BookStorage.getBookFile(bookId)
        onProgress?.(60)

        const { EpubRenderer } = await import('@/services/epubRenderer')
        const tempContainer = document.createElement('div')
        tempContainer.style.cssText = 'position: absolute; visibility: hidden; width: 0; height: 0; overflow: hidden;'
        document.body.appendChild(tempContainer)

        const tempRenderer = new EpubRenderer(tempContainer, fileData)
        await tempRenderer.initialize()
        onProgress?.(85)

        const toc = tempRenderer.getTableOfContents()
        tempRenderer.destroy()
        tempContainer.remove()
        onProgress?.(100)

        this.preloadedBooks[bookId] = { fileData, toc }
        return this.preloadedBooks[bookId]
      } finally {
        this.preloadingIds.delete(bookId)
      }
    },

    getPreloadedBook(bookId: string): PreloadedBookData | null {
      return this.preloadedBooks[bookId] ?? null
    },

    clearPreloadedBook(bookId: string): void {
      delete this.preloadedBooks[bookId]
      delete this.preloadProgress[bookId]
    },

    setBookNotebook(bookId: string, notebookId: string): void {
      this.bookNotebooks[bookId] = notebookId
      try {
        localStorage.setItem('bookNotebooks', JSON.stringify(this.bookNotebooks))
      } catch (e) {
        console.warn('Failed to save bookNotebooks to localStorage:', e)
      }
    },

    removeBookNotebook(bookId: string): void {
      delete this.bookNotebooks[bookId]
      try {
        localStorage.setItem('bookNotebooks', JSON.stringify(this.bookNotebooks))
      } catch (e) {
        console.warn('Failed to save bookNotebooks to localStorage:', e)
      }
    },

    async syncToCloud(force = false): Promise<{ synced: boolean; reason?: string }> {
      this.isCloudSyncing = true

      try {
        await saveBookList({ books: this.books, lastSyncedAt: Date.now() })

        const auth = getFirebaseAuth()
        if (!auth?.currentUser || !navigator.onLine) {
          this.lastCloudSyncAt = Date.now()
          return { synced: false, reason: 'offline' }
        }

        for (const book of this.books) {
          try {
            await saveBookToFirestore(Book.toPlain(book))
          } catch (error) {
            console.error('[BooksStore] Failed to sync book:', book.id, error)
          }
        }

        this.lastCloudSyncAt = Date.now()
        this.syncConflicts = []

        debugLog('[BooksStore] Cloud sync complete')
        return { synced: true }
      } catch (error) {
        console.error('[BooksStore] Cloud sync failed:', error)
        this.error = (error as Error).message
        throw error
      } finally {
        this.isCloudSyncing = false
      }
    },

    clearConflicts(): void {
      this.syncConflicts = []
    },
  },
})
