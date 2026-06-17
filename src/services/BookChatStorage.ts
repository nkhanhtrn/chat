import { getDB } from './sync/IndexedDBService'
import type { BookChatMessage } from '@/stores/bookChat'

const STORE = 'app-data'
const key = (bookId: string) => `book-chat-${bookId}`

export const BookChatStorage = {
  async saveBookChat(bookId: string, messages: BookChatMessage[]): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STORE)) {
      console.warn('[BookChatStorage] app-data store not available')
      return
    }
    await db.put(STORE, messages, key(bookId))
  },

  async getBookChat(bookId: string): Promise<BookChatMessage[] | null> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STORE)) return null
    const data = await db.get(STORE, key(bookId))
    return (data as BookChatMessage[] | undefined) ?? null
  },

  async deleteBookChat(bookId: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STORE)) return
    await db.delete(STORE, key(bookId))
  },
}
