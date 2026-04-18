import { defineStore } from 'pinia'
import type { BookData, BookCreateParams } from '@/types/book'
import { syncBookList, syncBookContent, saveBookList, saveBook, deleteBook as deleteBookFromIndexedDB, resolveBookListConflict } from '@/services/BookSyncService'
import { saveBookToFirestore, deleteBookFromFirestore, uploadBookFileToStorage, uploadCoverImage } from '@/services/firestore/firestore-books'
import { getFirebaseAuth } from '@/services/firebase'
import { debugLog } from '@/utils/debug'

export interface PreloadedBookData {
  fileData: ArrayBuffer
  toc: unknown[]
}

function arrayBufferToDataUrl(buf: ArrayBuffer, type = 'image/jpeg'): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return `data:${type};base64,${btoa(binary)}`
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

        // Resolve covers from IndexedDB cache (non-blocking)
        this.resolveCachedCovers().catch(err => {
          console.warn('[BooksStore] Failed to resolve cached covers:', err)
        })

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
      const storagePath = user ? `users/${user.uid}/books/${bookId}/book.epub` : ''

      const { fileData, coverData, ...metadataOverrides } = bookData

      // Convert cover bytes to data URL for immediate local display
      let localCoverUrl = ''
      if (coverData) {
        try {
          const blob = new Blob([coverData], { type: 'image/jpeg' })
          localCoverUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
        } catch {}
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

        await this.uploadBookFileToCloud(book.id, fileData, storagePath, coverData)
      } catch (error) {
        // Remove the partial book on failure
        await this.deleteBook(bookId)
        throw error
      }

      return book
    },

    async uploadBookFileToCloud(bookId: string, fileData: ArrayBuffer | undefined, _storagePath: string, coverData?: ArrayBuffer | null): Promise<void> {
      try {
        if (fileData) {
          await uploadBookFileToStorage(bookId, fileData, (progress) => {
            // Map 0-1 upload progress to 0.2-0.85 range (reserving space for cover + metadata)
            this.uploadProgress[bookId] = 0.2 + progress * 0.65
          })
        }

        // Upload cover image to Storage and get a download URL, also cache locally
        const book = this.books.find(b => b.id === bookId)
        if (book && coverData) {
          this.uploadProgress[bookId] = 0.9
          const coverUrl = await uploadCoverImage(bookId, coverData)
          if (coverUrl) {
            book.coverUrl = coverUrl
          }
          // Cache cover in IndexedDB for fast loading
          try {
            const { BookStorage } = await import('@/services/BookStorage')
            await BookStorage.saveCoverImage(bookId, coverData)
          } catch {}
        }

        if (book) {
          book.fileInStorage = true
          book.updatedAt = Date.now()
          await saveBook(book)
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
        await Promise.all([
          BookStorage.deleteCoverImage(bookId),
          BookStorage.deleteBookFile(bookId),
        ])
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

    /** Replace remote coverUrl with cached data URL, downloading if needed */
    async resolveCachedCovers(): Promise<void> {
      const { BookStorage } = await import('@/services/BookStorage')
      const uid = getFirebaseAuth()?.currentUser?.uid

      for (const book of this.books) {
        if (!book.id) continue

        // Check IndexedDB cache first — covers may exist in cache even if
        // coverUrl was stripped when the book came from Firestore
        try {
          const cached = await BookStorage.getCoverImage(book.id)
          if (cached && cached.byteLength > 100) {
            book.coverUrl = arrayBufferToDataUrl(cached)
            continue
          }
        } catch {}

        // No cache — if there's a remote coverUrl, download and cache it
        if (book.coverUrl?.startsWith('https://')) {
          try {
            const resp = await fetch(book.coverUrl)
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer()
              if (arrayBuf.byteLength > 100) {
                await BookStorage.saveCoverImage(book.id, arrayBuf).catch(() => {})
                book.coverUrl = arrayBufferToDataUrl(arrayBuf)
              } else {
                book.coverUrl = ''
              }
            }
          } catch {}
        } else if (!book.coverUrl && uid) {
          // coverUrl was stripped by Firestore — try to fetch from the known Storage path
          try {
            const { getStorage, ref, getDownloadURL } = await import('firebase/storage')
            const storage = getStorage()
            const coverRef = ref(storage, `users/${uid}/books/${book.id}/cover.jpg`)
            const downloadUrl = await getDownloadURL(coverRef)
            const resp = await fetch(downloadUrl)
            if (resp.ok) {
              const arrayBuf = await resp.arrayBuffer()
              if (arrayBuf.byteLength > 100) {
                await BookStorage.saveCoverImage(book.id, arrayBuf).catch(() => {})
                book.coverUrl = arrayBufferToDataUrl(arrayBuf)
              }
            }
          } catch {}
        }
      }
    },
  },
})
