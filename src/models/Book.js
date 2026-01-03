/**
 * Book data model with serialization helpers
 * Handles conversion between Vue reactive objects and plain objects for IndexedDB
 */
export class Book {
  /**
   * Create a new Book instance
   * @param {Object} data - Book data
   */
  constructor(data = {}) {
    this.id = data.id || crypto.randomUUID()
    this.title = data.title || ''
    this.author = data.author || ''
    this.coverUrl = data.coverUrl || ''
    this.fileSize = data.fileSize || 0
    this.fileInStorage = data.fileInStorage || false
    this.fileStoragePath = data.fileStoragePath || ''
    this.createdAt = data.createdAt || Date.now()
    this.updatedAt = data.updatedAt || Date.now()
    this.deletedAt = data.deletedAt || null
    this.lastCfi = data.lastCfi || null
    this.fileCachedAt = data.fileCachedAt || null
  }

  /**
   * Convert to plain object for IndexedDB storage
   * @returns {Object} Plain object (not a Proxy)
   */
  toPlain() {
    return {
      id: this.id,
      title: this.title,
      author: this.author,
      coverUrl: this.coverUrl,
      fileSize: this.fileSize,
      fileInStorage: this.fileInStorage,
      fileStoragePath: this.fileStoragePath,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
      lastCfi: this.lastCfi,
      fileCachedAt: this.fileCachedAt
    }
  }

  /**
   * Create a plain object from any object (handles Vue Proxies)
   * @param {Object} bookData - Book data (could be a Proxy)
   * @returns {Object} Plain object for storage
   */
  static toPlain(bookData) {
    return new Book(bookData).toPlain()
  }

  /**
   * Extract plain metadata from a book (excludes fileData)
   * @param {Object} book - Book object (could be a Proxy)
   * @returns {Object} Plain metadata object
   */
  static extractMetadata(book) {
    const { fileData, fileDataArrayBuffer, ...metadata } = book
    return Book.toPlain(metadata)
  }

  /**
   * Create a Book instance from plain data
   * @param {Object} data - Plain object data
   * @returns {Book} Book instance
   */
  static fromPlain(data) {
    return new Book(data)
  }

  /**
   * Update the updatedAt timestamp
   */
  touch() {
    this.updatedAt = Date.now()
    return this.toPlain()
  }
}
