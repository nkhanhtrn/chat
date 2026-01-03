import { defineStore } from 'pinia'
import { debugLog } from '../utils/debug.js'
import { BookStorage } from '../services/BookStorage.js'
import { EpubRenderer } from '../services/epubRenderer.js'
import { Book } from '../models/Book.js'
import { getFirebaseAuth } from '../services/firebase.js'
import {
  syncBooksWithCloud,
  saveBookToFirestore,
  deleteBookFromFirestore,
  uploadBookFileToStorage
} from '../services/firestore/firestore-books.js'

export const useBooksStore = defineStore('books', {
  state: () => ({
    // Array of book objects
    books: [],

    // Current book being read
    currentBookId: null,

    // Current reading position (CFI)
    currentCfi: null,

    // UI state
    isLoading: false,
    error: null,

    // Initialization state
    isInitialized: false,

    // Preloaded book data (bookId -> { fileData, toc, tocString })
    preloadedBooks: {},

    // Preloading progress (bookId -> 0-100)
    preloadProgress: {},

    // Books currently being preloaded
    preloadingIds: new Set(),

    // Book to notebook mapping: { bookId: notebookId }
    bookNotebooks: {},

    // Cloud sync state
    lastCloudSyncAt: null,
    isCloudSyncing: false,
    syncConflicts: []
  }),

  getters: {
    // Get current book object
    currentBook: (state) => {
      return state.books.find(b => b.id === state.currentBookId) || null
    },

    // Books sorted by last read date (newest first)
    booksSortedByDate: (state) => {
      return [...state.books].sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
    },

    // Books sorted by title alphabetically
    booksSortedByTitle: (state) => {
      return [...state.books].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
    },

    // Recently read books (top 5)
    recentBooks: (state) => {
      return [...state.books]
        .sort((a, b) => (b.lastReadAt || 0) - (a.lastReadAt || 0))
        .slice(0, 5)
    },

    // Get book by ID
    getBookById: (state) => (id) => {
      return state.books.find(b => b.id === id) || null
    },

    // Check if a book is preloaded
    isBookPreloaded: (state) => (id) => {
      return !!state.preloadedBooks[id]
    },

    // Check if a book is currently preloading
    isBookPreloading: (state) => (id) => {
      return state.preloadingIds.has(id)
    },

    // Get preload progress for a book
    getPreloadProgress: (state) => (id) => {
      return state.preloadProgress[id] || 0
    },

    // Get notebook ID for a book
    getBookNotebook: (state) => (bookId) => {
      return state.bookNotebooks[bookId] || null
    },

    // Get current book's notebook ID
    currentBookNotebook: (state) => {
      if (!state.currentBookId) return null
      return state.bookNotebooks[state.currentBookId] || null
    },

    // Check if any books need sync
    needsCloudSync: (state) => {
      if (!state.lastCloudSyncAt) return false
      return state.books.some(book =>
        !state.lastCloudSyncAt || book.updatedAt > state.lastCloudSyncAt
      )
    },

    // Get books with sync status badges
    booksWithSyncStatus: (state) => {
      return state.books.map(book => ({
        ...book,
        needsSync: !state.lastCloudSyncAt || book.updatedAt > state.lastCloudSyncAt,
        isSynced: state.lastCloudSyncAt && book.updatedAt <= state.lastCloudSyncAt
      }))
    }
  },

  actions: {
    /**
     * Initialize store from IndexedDB
     * @returns {Promise<{hasConflict: boolean, conflicts?: Array}>}
     */
    async initializeStore() {
      if (this.isInitialized) {
        return { hasConflict: false }
      }

      this.isLoading = true
      this.error = null

      try {
        // Load from IndexedDB (fast, local)
        const books = await BookStorage.loadBooks()
        this.books = books

        // Load book-notebook mapping from localStorage
        try {
          const localSaved = localStorage.getItem('bookNotebooks')
          debugLog('[books.initialize] Reading bookNotebooks from localStorage:', localSaved ? 'found' : 'not found')
          if (localSaved) {
            this.bookNotebooks = JSON.parse(localSaved)
          }
        } catch (e) {
          console.warn('Failed to load bookNotebooks from localStorage:', e)
        }

        this.isInitialized = true

        // Sync with cloud in background (don't block UI)
        this.syncToCloud().catch(syncError => {
          console.warn('Background cloud sync failed:', syncError)
        })

        return {
          hasConflict: false,
          conflicts: []
        }
      } catch (error) {
        console.error('Failed to initialize books store:', error)
        this.error = error.message
        return { hasConflict: false }
      } finally {
        this.isLoading = false
      }
    },

    /**
     * Add a new book
     * @param {Object} bookData - Book metadata and file data
     * @returns {Promise<Object>} The created book
     */
    async addBook(bookData) {
      const bookId = crypto.randomUUID()

      // Set storage path before upload (so sync knows upload is in progress)
      const auth = getFirebaseAuth()
      const user = auth?.currentUser
      const storagePath = user ? `users/${user.uid}/books/${bookId}/book.epub` : ''

      const book = {
        id: bookId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastReadAt: Date.now(),
        lastReadCfi: null,
        totalProgress: 0,
        deletedAt: null,
        fileInStorage: false,
        fileStoragePath: storagePath,
        ...bookData
      }

      console.log('[addBook] Creating book:', {
        id: book.id,
        title: book.title,
        hasFileData: !!book.fileData,
        fileSize: book.fileData?.byteLength
      })

      this.books.push(book)

      // Extract fileData from metadata for separate storage
      const { fileData, ...bookMetadata } = book

      // Save to IndexedDB - convert to plain object (no Proxy)
      console.log('[addBook] Saving to IndexedDB...')
      await BookStorage.saveBook(Book.toPlain(bookMetadata))

      console.log('[addBook] Saving file to IndexedDB...')
      await BookStorage.saveBookFile(book.id, fileData)

      console.log('[addBook] ✓ Book saved locally')

      // Upload file to Firebase Storage and update metadata
      this.uploadBookFileToCloud(book.id, fileData, storagePath).catch(err => {
        console.warn('Failed to upload book file to cloud:', err)
        // Still save metadata to Firestore even if file upload fails
        saveBookToFirestore(Book.toPlain(bookMetadata))
      })

      return book
    },

    /**
     * Upload book file to Firebase Storage and update metadata
     * @param {string} bookId - Book ID
     * @param {ArrayBuffer} fileData - File data to upload
     * @param {string} storagePath - Storage path (pre-generated)
     * @returns {Promise<void>}
     */
    async uploadBookFileToCloud(bookId, fileData, storagePath) {
      try {
        await uploadBookFileToStorage(bookId, fileData)

        // Update book with fileInStorage=true and save to Firestore
        const book = this.books.find(b => b.id === bookId)
        if (book) {
          book.fileInStorage = true
          book.updatedAt = Date.now()

          await BookStorage.saveBook(Book.toPlain(book))
          await saveBookToFirestore(Book.toPlain(book))
        }

        debugLog('[uploadBookFileToCloud] Upload complete:', storagePath)
      } catch (error) {
        console.error('[uploadBookFileToCloud] Failed to upload file:', error)
        throw error
      }
    },

    /**
     * Update reading position for a book
     * @param {string} bookId - Book ID
     * @param {string} cfi - CFI position
     * @param {number} progress - Progress (0-1)
     */
    async updateReadingPosition(bookId, cfi, progress) {
      const book = this.books.find(b => b.id === bookId)
      if (book) {
        book.lastReadCfi = cfi
        book.totalProgress = progress
        book.lastReadAt = Date.now()
        book.updatedAt = Date.now()

        await BookStorage.saveBook(Book.toPlain(book))

        // Upload to cloud (page turn is discrete action, no debounce needed)
        saveBookToFirestore(Book.toPlain(book)).catch(err => {
          console.warn('Failed to upload reading position:', err)
        })
      }
    },

    /**
     * Delete a book
     * @param {string} bookId - Book ID
     */
    async deleteBook(bookId) {
      const index = this.books.findIndex(b => b.id === bookId)
      if (index !== -1) {
        const book = this.books[index]

        // Mark as deleted in cloud first (before removing from local)
        await deleteBookFromFirestore(bookId)

        // Then delete locally
        this.books.splice(index, 1)
        await BookStorage.deleteBook(bookId)

        // Clear current book if it was the deleted one
        if (this.currentBookId === bookId) {
          this.currentBookId = null
          this.currentCfi = null
        }

        // Clear preloaded book
        delete this.preloadedBooks[bookId]
      }
    },

    /**
     * Set current book for reading
     * @param {string} bookId - Book ID
     */
    setCurrentBook(bookId) {
      this.currentBookId = bookId
    },

    /**
     * Update a book's data
     * @param {string} bookId - Book ID
     * @param {Object} updates - Fields to update
     */
    async updateBook(bookId, updates) {
      const book = this.books.find(b => b.id === bookId)
      if (book) {
        Object.assign(book, updates, { updatedAt: Date.now() })
        await BookStorage.saveBook(Book.toPlain(book))

        // Upload to cloud directly (not bidirectional sync)
        saveBookToFirestore(Book.toPlain(book)).catch(err => {
          console.warn('Failed to upload book update to cloud:', err)
        })
      }
    },

    /**
     * Preload a book (download file and extract TOC)
     * @param {string} bookId - Book ID
     * @param {Function} onProgress - Progress callback (progress) => void
     * @returns {Promise<{ fileData, toc }>}
     */
    async preloadBook(bookId, onProgress = null) {
      // Return cached if already preloaded
      if (this.preloadedBooks[bookId]) {
        return this.preloadedBooks[bookId]
      }

      // Mark as preloading
      this.preloadingIds.add(bookId)
      this.preloadProgress[bookId] = 0

      try {
        const book = this.getBookById(bookId)
        if (!book) {
          throw new Error('Book not found')
        }

        onProgress?.(10)

        // Get or download book file
        const fileData = await BookStorage.getBookFile(bookId)
        onProgress?.(60)

        // Create a temporary container for TOC extraction
        const tempContainer = document.createElement('div')
        tempContainer.style.cssText = 'position: absolute; visibility: hidden; width: 0; height: 0; overflow: hidden;'
        document.body.appendChild(tempContainer)

        // Initialize temporary renderer to get TOC
        const tempRenderer = new EpubRenderer(tempContainer, fileData)
        await tempRenderer.initialize()
        onProgress?.(85)

        // Get table of contents
        const toc = tempRenderer.getTableOfContents()

        // Clean up temporary renderer and container
        tempRenderer.destroy()
        tempContainer.remove()
        onProgress?.(100)

        // Store preloaded data (file data + TOC, renderer will be created by viewer)
        this.preloadedBooks[bookId] = {
          fileData,
          toc
        }

        return this.preloadedBooks[bookId]
      } finally {
        // Clear preloading state
        this.preloadingIds.delete(bookId)
        // Keep the progress at 100 to show completion
      }
    },

    /**
     * Get preloaded book data
     * @param {string} bookId - Book ID
     * @returns {{ fileData, toc } | null}
     */
    getPreloadedBook(bookId) {
      return this.preloadedBooks[bookId] || null
    },

    /**
     * Clear preloaded book data (call after viewer takes over)
     * @param {string} bookId - Book ID
     */
    clearPreloadedBook(bookId) {
      delete this.preloadedBooks[bookId]
      delete this.preloadProgress[bookId]
    },

    /**
     * Set or update the notebook associated with a book
     * @param {string} bookId - Book ID
     * @param {string} notebookId - Notebook/Chat ID
     */
    setBookNotebook(bookId, notebookId) {
      this.bookNotebooks[bookId] = notebookId
      // Persist to localStorage
      try {
        debugLog('[books.setBookNotebook] Writing bookNotebooks to localStorage:', { bookId, notebookId })
        localStorage.setItem('bookNotebooks', JSON.stringify(this.bookNotebooks))
      } catch (e) {
        console.warn('Failed to save bookNotebooks to localStorage:', e)
      }
    },

    /**
     * Remove the notebook association for a book
     * @param {string} bookId - Book ID
     */
    removeBookNotebook(bookId) {
      delete this.bookNotebooks[bookId]
      try {
        debugLog('[books.removeBookNotebook] Writing bookNotebooks to localStorage:', { bookId })
        localStorage.setItem('bookNotebooks', JSON.stringify(this.bookNotebooks))
      } catch (e) {
        console.warn('Failed to save bookNotebooks to localStorage:', e)
      }
    },

    // ============================================
    // Cloud Sync Actions
    // ============================================

    /**
     * Sync to cloud
     * @param {boolean} force - If true, sync immediately
     * @returns {Promise<Object>} Sync result
     */
    async syncToCloud(force = false) {
      this.isCloudSyncing = true

      try {
        const result = await syncBooksWithCloud(this.books)

        // Save merged state to IndexedDB BEFORE making reactive
        for (const book of result.mergedBooks) {
          await BookStorage.saveBook(Book.toPlain(book))
        }

        // Update with merged books (after saving)
        this.books = result.mergedBooks

        this.lastCloudSyncAt = Date.now()
        this.syncConflicts = result.conflicts || []

        debugLog('[books.syncToCloud] Sync complete:', result)
        return result
      } catch (error) {
        console.error('Cloud sync failed:', error)
        this.error = error.message
        throw error
      } finally {
        this.isCloudSyncing = false
      }
    },

    /**
     * Clear all sync conflicts
     */
    clearConflicts() {
      this.syncConflicts = []
    },

    /**
     * Resolve a specific sync conflict
     * @param {string} bookId - Book ID with conflict
     * @param {string} choice - 'local' | 'cloud' | 'merge'
     */
    async resolveConflict(bookId, choice) {
      // Placeholder for conflict resolution
      this.syncConflicts = this.syncConflicts.filter(c => c.bookId !== bookId)

      // Re-sync after resolution
      await this.syncToCloud(true)
    }
  }
})
