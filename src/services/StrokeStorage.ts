import { getDB } from './sync/IndexedDBService'
import type { Stroke } from '@/types/stroke'

const STROKES_STORE = 'strokes'

export const StrokeStorage = {
  async saveStroke(stroke: Stroke): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STROKES_STORE)) {
      console.warn('[StrokeStorage] strokes store not available')
      return
    }
    await db.put(STROKES_STORE, stroke)
  },

  async deleteStroke(id: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STROKES_STORE)) return
    await db.delete(STROKES_STORE, id)
  },

  async getStrokes(bookId: string): Promise<Stroke[]> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STROKES_STORE)) return []
    try {
      return await db.getAllFromIndex(STROKES_STORE, 'bookId', bookId)
    } catch {
      const all: Stroke[] = await db.getAll(STROKES_STORE)
      return all.filter(s => s.bookId === bookId)
    }
  },

  async wipeBook(bookId: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(STROKES_STORE)) return
    const tx = db.transaction(STROKES_STORE, 'readwrite')
    const index = tx.store.index('bookId')
    let cursor = await index.openCursor(bookId)
    while (cursor) {
      await cursor.delete()
      cursor = await cursor.continue()
    }
    await tx.done
  },
}
