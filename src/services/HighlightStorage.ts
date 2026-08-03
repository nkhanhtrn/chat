import { getDB } from './sync/IndexedDBService'
import type { EpubHighlight } from '@/types/highlight'

const HIGHLIGHTS_STORE = 'highlights'

export const HighlightStorage = {
  async saveHighlight(highlight: EpubHighlight): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(HIGHLIGHTS_STORE)) {
      console.warn('[HighlightStorage] highlights store not available')
      return
    }
    await db.put(HIGHLIGHTS_STORE, highlight)
  },

  async deleteHighlight(id: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(HIGHLIGHTS_STORE)) return
    await db.delete(HIGHLIGHTS_STORE, id)
  },

  async getHighlights(bookId: string): Promise<EpubHighlight[]> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(HIGHLIGHTS_STORE)) return []
    try {
      return await db.getAllFromIndex(HIGHLIGHTS_STORE, 'bookId', bookId)
    } catch {
      const all: EpubHighlight[] = await db.getAll(HIGHLIGHTS_STORE)
      return all.filter(h => h.bookId === bookId)
    }
  },

  async wipeBook(bookId: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(HIGHLIGHTS_STORE)) return
    const tx = db.transaction(HIGHLIGHTS_STORE, 'readwrite')
    const index = tx.store.index('bookId')
    let cursor = await index.openCursor(bookId)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
    await tx.done
  },
}
