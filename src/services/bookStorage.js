/**
 * Book storage facade
 * Provides convenience wrappers for BookStorage
 */

import { BookStorage } from './BookStorage.js'

export { BookStorage }

/**
 * Save a book (excludes fileData before saving)
 */
export const saveBookToStorage = async (book) => {
  const { fileData, ...bookMetadata } = book
  const plainBook = JSON.parse(JSON.stringify(bookMetadata))
  await BookStorage.saveBook(plainBook)
}

/**
 * Upload book (alias for saveBookToStorage)
 */
export const uploadBookToStorage = saveBookToStorage

/**
 * Save book file data
 */
export const saveBookFileToIDB = BookStorage.saveBookFile
