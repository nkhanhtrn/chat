import { defineStore } from 'pinia'
import { loadBooksFromStorage, saveBookToStorage, deleteBookFromStorage } from '../services/bookStorage.js'

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
    isInitialized: false
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
    }
  }
})
