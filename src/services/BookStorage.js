/**
 * BookStorage - Centralized storage for books
 *
 * Responsibilities:
 * - Manage book metadata in IndexedDB
 * - Manage book file data (cached EPUB files) in IndexedDB
 * - Handle ArrayBuffer/Uint8Array conversion for file data
 * - Provide clean API for book storage operations
 *
 * Storage:
 * - IndexedDB: books store with book.id as key
 * - File data stored alongside book metadata
 */

import { debugLog } from '../utils/debug.js'
import { getDB } from './indexedDB.js'
import {
  downloadBookFileFromStorage,
  deleteBookFileFromStorage
} from './firestore/firestore-books.js'

const BOOKS_STORE = 'books'

/**
 * Cloud sync state management
 */
class BookSyncState {
  constructor() {
    this.lastSyncAt = null
    this.isSyncing = false
    this.pendingSync = false
    this.conflicts = []
    this.listeners = new Set()
  }

  getState() {
    return {
      lastSyncAt: this.lastSyncAt,
      isSyncing: this.isSyncing,
      pendingSync: this.pendingSync,
      conflicts: [...this.conflicts]
    }
  }

  setState(updates) {
    Object.assign(this, updates)
    this.notifyListeners()
  }

  clearConflicts() {
    this.conflicts = []
    this.notifyListeners()
  }

  subscribe(listener) {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  notifyListeners() {
    for (const listener of this.listeners) {
      listener(this.getState())
    }
  }
}

// Global sync state instance
const syncState = new BookSyncState()

/**
 * Storage errors
 */
export class StorageError extends Error {
  constructor(message, key, cause) {
    super(message)
    this.name = 'StorageError'
    this.key = key
    this.cause = cause
  }
}

/**
 * BookStorage class - handles all book storage
 */
export class BookStorage {
  /**
   * Save a book to IndexedDB (upsert by id)
   * Preserves existing fileData if not present in the update
   * @param {Object} book - The book to save
   * @param {boolean} skipCloudSync - If true, skip triggering cloud sync
   * @returns {Promise<void>}
   */
  static async saveBook(book, skipCloudSync = false) {
    const db = await getDB()
    debugLog('[BookStorage.saveBook] Writing book:', book.id)

    // If this update doesn't include fileData, preserve existing fileData
    if (!book.fileData) {
      const existing = await db.get(BOOKS_STORE, book.id)
      if (existing?.fileData) {
        book.fileData = existing.fileData
        book.fileCachedAt = existing.fileCachedAt
      }
    }

    await db.put(BOOKS_STORE, book)

    // Mark that cloud sync is needed (if not skipped)
    if (!skipCloudSync) {
      syncState.setState({ pendingSync: true })
    }
  }

  /**
   * Load all books from IndexedDB
   * @returns {Promise<Array>} Array of books (excluding deleted ones)
   */
  static async loadBooks() {
    const db = await getDB()
    const all = await db.getAll(BOOKS_STORE)
    const books = all.filter(b => !b.deletedAt)
    debugLog('[BookStorage.loadBooks] Reading books:', books.length, 'found')
    return books
  }

  /**
   * Get a single book by ID from IndexedDB
   * @param {string} id - The book ID
   * @returns {Promise<Object|null>} The book or null if not found
   */
  static async getBook(id) {
    const db = await getDB()
    return await db.get(BOOKS_STORE, id)
  }

  /**
   * Delete a book from IndexedDB
   * @param {string} id - The book ID
   * @returns {Promise<void>}
   */
  static async deleteBook(id) {
    const db = await getDB()
    await db.delete(BOOKS_STORE, id)
  }

  /**
   * Get book file data (ArrayBuffer) from IndexedDB
   * The file data is stored alongside the book metadata
   * Falls back to Firebase Storage if not found locally and book has fileInStorage flag
   * @param {string} id - The book ID
   * @returns {Promise<ArrayBuffer|null>} The file data or null if not found
   */
  static async getBookFile(id) {
    const db = await getDB()
    const book = await db.get(BOOKS_STORE, id)

    if (!book) {
      return null
    }

    // Check if we have cached file data locally
    if (book.fileData) {
      const fileData = book.fileData

      // Handle cases where IndexedDB returns Uint8Array instead of ArrayBuffer
      let result = fileData
      if (fileData instanceof Uint8Array) {
        result = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
      } else if (!(fileData instanceof ArrayBuffer) && fileData?.buffer instanceof ArrayBuffer) {
        result = fileData.buffer
      }

      return result
    }

    // No local file - check if book has file in cloud storage
    if (book.fileInStorage && book.fileStoragePath) {
      debugLog('[BookStorage.getBookFile] Downloading from cloud:', book.fileStoragePath)

      try {
        const fileData = await downloadBookFileFromStorage(book.fileStoragePath)

        // Cache the downloaded file in IndexedDB
        await BookStorage.saveBookFile(id, fileData, true)

        debugLog('[BookStorage.getBookFile] File downloaded and cached')
        return fileData
      } catch (error) {
        console.error('[BookStorage.getBookFile] Failed to download from cloud:', error)
        return null
      }
    }

    return null
  }

  /**
   * Save book file data to IndexedDB
   * @param {string} id - The book ID
   * @param {ArrayBuffer} fileData - The file data to cache
   * @param {boolean} skipCloudSync - If true, skip triggering cloud sync
   * @returns {Promise<void>}
   * @throws {Error} If book not found
   */
  static async saveBookFile(id, fileData, skipCloudSync = false) {
    const db = await getDB()
    const book = await db.get(BOOKS_STORE, id)
    if (book) {
      book.fileData = fileData
      book.fileCachedAt = Date.now()
      await db.put(BOOKS_STORE, book)

      // Mark that cloud sync is needed (if not skipped)
      if (!skipCloudSync) {
        syncState.setState({ pendingSync: true })
      }
    } else {
      throw new Error(`Book ${id} not found in IndexedDB - cannot cache file data. Was the book record saved first?`)
    }
  }

  /**
   * Delete all book file data (cached EPUB files) from IndexedDB
   * This removes the fileData property from all books while keeping the book metadata
   * @returns {Promise<{deletedCount: number, totalSize: number}>}
   */
  static async deleteAllBookFiles() {
    const db = await getDB()
    const books = await db.getAll(BOOKS_STORE)

    let deletedCount = 0
    let totalSize = 0

    for (const book of books) {
      if (book.fileData) {
        // Calculate size before deleting
        const size = book.fileData.byteLength || 0
        totalSize += size

        // Remove file data and cache timestamp
        delete book.fileData
        delete book.fileCachedAt

        // Update the book record
        await db.put(BOOKS_STORE, book)
        deletedCount++
      }
    }

    return { deletedCount, totalSize }
  }

  // ============================================
  // Cloud Sync State Management
  // ============================================

  /**
   * Get the current sync state
   * @returns {Object} { lastSyncAt, isSyncing, pendingSync, conflicts }
   */
  static getSyncState() {
    return syncState.getState()
  }

  /**
   * Subscribe to sync state changes
   * @param {Function} listener - Callback function that receives sync state
   * @returns {Function} Unsubscribe function
   */
  static subscribeToSyncState(listener) {
    return syncState.subscribe(listener)
  }

  /**
   * Update sync state (for internal use by firestore sync)
   * @param {Object} updates - State updates to apply
   */
  static _updateSyncState(updates) {
    syncState.setState(updates)
  }

  /**
   * Clear all conflicts from sync state
   */
  static clearConflicts() {
    syncState.clearConflicts()
  }

  /**
   * Mark sync as complete
   * @param {Object} result - Sync result { mergedBooks, fromCloud, toUpload, conflicts }
   */
  static _markSyncComplete(result) {
    syncState.setState({
      lastSyncAt: Date.now(),
      isSyncing: false,
      pendingSync: false,
      conflicts: result.conflicts || []
    })
  }
}

export default BookStorage
