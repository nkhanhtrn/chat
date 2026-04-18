import { getDB } from './sync/IndexedDBService'

const BOOK_FILES_STORE = 'book-files'
const BOOK_COVERS_STORE = 'book-covers'

export const BookStorage = {
  async saveBookFile(bookId: string, fileData: ArrayBuffer): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_FILES_STORE)) {
      console.warn('[BookStorage] book-files store not available')
      return
    }
    await db.put(BOOK_FILES_STORE, fileData, bookId)
  },

  async getBookFile(bookId: string): Promise<ArrayBuffer> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_FILES_STORE)) {
      throw new Error('BookStorage: book-files store not available')
    }
    const data = await db.get(BOOK_FILES_STORE, bookId)
    if (!data) throw new Error(`BookStorage: file not found for book ${bookId}`)
    return data as ArrayBuffer
  },

  async deleteBookFile(bookId: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_FILES_STORE)) return
    await db.delete(BOOK_FILES_STORE, bookId)
  },

  async saveCoverImage(bookId: string, coverData: ArrayBuffer): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_COVERS_STORE)) {
      console.warn('[BookStorage] book-covers store not available')
      return
    }
    await db.put(BOOK_COVERS_STORE, coverData, bookId)
  },

  async getCoverImage(bookId: string): Promise<ArrayBuffer | null> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_COVERS_STORE)) return null
    const data = await db.get(BOOK_COVERS_STORE, bookId)
    return (data as ArrayBuffer) ?? null
  },

  async deleteCoverImage(bookId: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(BOOK_COVERS_STORE)) return
    await db.delete(BOOK_COVERS_STORE, bookId)
  },
}
