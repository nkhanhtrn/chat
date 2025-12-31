import { defineStore } from 'pinia'
import { loadBooksFromStorage, saveBookToStorage, deleteBookFromStorage, getOrDownloadBookFile } from '../services/bookStorage.js'
import { EpubRenderer } from '../services/epubRenderer.js'

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
    preloadingIds: new Set()
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
    }
  },

  actions: {
    /**
     * Initialize store from IndexedDB/Firestore
     * @returns {Promise<{hasConflict: boolean, state?: object}>}
     */
    async initializeStore() {
      if (this.isInitialized) {
        return { hasConflict: false }
      }

      this.isLoading = true
      this.error = null

      try {
        const result = await loadBooksFromStorage()

        if (result.hasConflict) {
          // Conflict detected - caller should handle
          return result
        }

        if (result.state && result.state.books) {
          this.books = result.state.books
        }

        this.isInitialized = true
        return { hasConflict: false }
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
      const book = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        lastReadAt: Date.now(),
        lastReadCfi: null,
        totalProgress: 0,
        deletedAt: null,
        ...bookData
      }

      this.books.push(book)
      await saveBookToStorage(book)

      return book
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

        await saveBookToStorage(book)
      }
    },

    /**
     * Delete a book
     * @param {string} bookId - Book ID
     */
    async deleteBook(bookId) {
      const index = this.books.findIndex(b => b.id === bookId)
      if (index !== -1) {
        this.books.splice(index, 1)
        await deleteBookFromStorage(bookId)

        // Clear current book if it was the deleted one
        if (this.currentBookId === bookId) {
          this.currentBookId = null
          this.currentCfi = null
        }
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
        await saveBookToStorage(book)
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
        const fileData = await getOrDownloadBookFile(bookId, book.storagePath)
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
    }
  }
})
