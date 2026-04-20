import { defineStore } from 'pinia'
import type { BookData, BookCreateParams } from '@/types/book'
import { syncBookList, syncBookContent, saveBookList, saveBook, deleteBook as deleteBookFromIndexedDB, resolveBookListConflict } from '@/services/BookSyncService'
import { saveBookToFirestore, deleteBookFromFirestore, uploadBookFileToStorage } from '@/services/firestore/firestore-books'
import { getFirebaseAuth } from '@/services/firebase'
import { debugLog } from '@/utils/debug'

export interface PreloadedBookData {
  fileData: ArrayBuffer
  toc: unknown[]
}

function compressCover(coverData: ArrayBuffer, maxSize = 400, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    const blob = new Blob([coverData])
    const url = URL.createObjectURL(blob)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height))
      const w = Math.round(img.width * scale)
      const h = Math.round(img.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      resolve('')
    }
    img.src = url
  })
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
    uploadProgress: {} as Record<string, number>,
    uploadingIds: new Set<string>(),
    downloadProgress: {} as Record<string, number>,
    downloadingIds: new Set<string>(),
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

    isBookUploading(state) {
      return (id: string): boolean => state.uploadingIds.has(id)
    },

    getUploadProgress(state) {
      return (id: string): number => state.uploadProgress[id] ?? 0
    },

    isBookDownloading(state) {
      return (id: string): boolean => state.downloadingIds.has(id)
    },

    getDownloadProgress(state) {
      return (id: string): number => state.downloadProgress[id] ?? 0
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
        const { book } = await syncBookContent(bookId)
        if (!book) throw new Error('Book not found')

        const index = this.books.findIndex(b => b.id === bookId)
        if (index !== -1) {
          this.books[index] = book
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

    async addBook(bookData: Partial<BookData> & { fileData?: ArrayBuffer; coverData?: ArrayBuffer | null }): Promise<BookData> {
      const bookId = crypto.randomUUID()

      const auth = getFirebaseAuth()
      const user = auth?.currentUser
      const fileType = (bookData.fileType as 'epub' | 'pdf') ?? 'epub'
      const extension = fileType === 'pdf' ? 'pdf' : 'epub'
      const storagePath = user ? `users/${user.uid}/books/${bookId}/book.${extension}` : ''

      const { fileData, coverData, ...metadataOverrides } = bookData

      // Compress cover to a small base64 data URL for Firestore storage
      let localCoverUrl = ''
      if (coverData) {
        localCoverUrl = await compressCover(coverData)
        console.log('[CoverDebug] addBook compressCover result:', {
          bookId,
          coverDataSize: coverData.byteLength,
          coverUrlLength: localCoverUrl.length,
          coverUrlPrefix: localCoverUrl.substring(0, 40),
        })
      } else {
        console.log('[CoverDebug] addBook no coverData for', bookId)
      }

      const book: BookData & { fileData?: ArrayBuffer } = {
        id: bookId,
        title: bookData.title ?? '',
        author: bookData.author ?? '',
        coverUrl: localCoverUrl,
        fileSize: bookData.fileSize ?? 0,
        fileInStorage: false,
        fileStoragePath: storagePath,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastCfi: null,
        fileCachedAt: null,
        readingProgress: 0,
        fileType,
        lastPage: null,
        totalPages: bookData.totalPages ?? null,
        ...metadataOverrides,
      }

      // Start upload tracking before the card renders
      this.uploadingIds.add(bookId)
      this.uploadProgress[bookId] = 0

      this.books.push(book)

      const { fileData: _fd, ...bookMetadata } = book

      try {
        this.uploadProgress[bookId] = 0.1
        await saveBook(bookMetadata)
        this.uploadProgress[bookId] = 0.2

        await this.uploadBookFileToCloud(book.id, fileData, storagePath)
      } catch (error) {
        // Remove the partial book on failure
        await this.deleteBook(bookId)
        throw error
      }

      return book
    },

    async uploadBookFileToCloud(bookId: string, fileData: ArrayBuffer | undefined, _storagePath: string): Promise<void> {
      try {
        if (fileData) {
          const book = this.books.find(b => b.id === bookId)
          const fileType = (book?.fileType as 'epub' | 'pdf') ?? 'epub'
          await uploadBookFileToStorage(bookId, fileData, (progress) => {
            // Map 0-1 upload progress to 0.2-0.9 range
            this.uploadProgress[bookId] = 0.2 + progress * 0.7
          }, fileType)
        }

        const book = this.books.find(b => b.id === bookId)
        if (book) {
          book.fileInStorage = true
          book.updatedAt = Date.now()
          await saveBook(book)
          console.log('[CoverDebug] uploadBookFileToCloud before saveBookToFirestore:', {
            bookId,
            hasCoverUrl: !!book.coverUrl,
            coverUrlLength: book.coverUrl?.length ?? 0,
            coverUrlPrefix: book.coverUrl?.substring(0, 30),
          })
          await saveBookToFirestore(book)
        }

        this.uploadProgress[bookId] = 1
      } finally {
        setTimeout(() => {
          this.uploadingIds.delete(bookId)
          delete this.uploadProgress[bookId]
        }, 800)
      }
    },

    async updateReadingPosition(bookId: string, cfi: string, progress: number): Promise<void> {
      const book = this.books.find(b => b.id === bookId)
      if (!book) return

      book.lastCfi = cfi
      book.readingProgress = Math.round(progress * 100)
      book.updatedAt = Date.now()

      await saveBook(book)
      saveBookToFirestore(book).catch(err => {
        console.warn('Failed to upload reading position:', err)
      })
    },

    async updatePdfReadingPosition(bookId: string, page: number, progress: number): Promise<void> {
      const book = this.books.find(b => b.id === bookId)
      if (!book) return

      book.lastPage = page
      book.readingProgress = Math.round(progress * 100)
      book.updatedAt = Date.now()

      await saveBook(book)
      saveBookToFirestore(book).catch(err => {
        console.warn('Failed to upload PDF reading position:', err)
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

      // Clean up cached cover and file
      try {
        const { BookStorage } = await import('@/services/BookStorage')
        await BookStorage.deleteBookFile(bookId)
      } catch {}
    },

    setCurrentBook(bookId: string | null): void {
      this.currentBookId = bookId
    },

    async updateBook(bookId: string, updates: Partial<BookData>): Promise<void> {
      const book = this.books.find(b => b.id === bookId)
      if (!book) return

      Object.assign(book, updates, { updatedAt: Date.now() })
      await saveBook(book)
      saveBookToFirestore(book).catch(err => {
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

        let fileData: ArrayBuffer | null = null

        // Try IndexedDB cache first
        try {
          const { BookStorage } = await import('@/services/BookStorage')
          fileData = await BookStorage.getBookFile(bookId)
        } catch {}

        // Fall back to cloud download
        if (!fileData) {
          try {
            const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
            fileData = await downloadBookFileFromStorage(bookId)
            if (fileData) {
              const { BookStorage } = await import('@/services/BookStorage')
              await BookStorage.saveBookFile(bookId, fileData)
            }
          } catch {}
        }

        if (!fileData) throw new Error('Book file not found locally or in cloud')

        onProgress?.(60)

        const fileType = (book.fileType as 'epub' | 'pdf') ?? 'epub'
        let toc: unknown[] = []

        if (fileType === 'pdf') {
          const { extractPdfToc } = await import('@/services/pdfRenderer')
          toc = await extractPdfToc(fileData)
          onProgress?.(100)
        } else {
          const { EpubRenderer } = await import('@/services/epubRenderer')
          const tempContainer = document.createElement('div')
          tempContainer.style.cssText = 'position: absolute; visibility: hidden; width: 0; height: 0; overflow: hidden;'
          document.body.appendChild(tempContainer)

          const tempRenderer = new EpubRenderer(tempContainer, fileData)
          await tempRenderer.initialize()
          onProgress?.(85)

          toc = tempRenderer.getTableOfContents()
          tempRenderer.destroy()
          tempContainer.remove()
          onProgress?.(100)
        }

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
            await saveBookToFirestore(book)
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
