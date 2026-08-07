import { getDB } from './sync/IndexedDBService'
import { SKETCHBOOKS_STORE } from './sync/IndexedDBService'
import type { Sketchbook } from '@/types/sketchbook'

export const SketchbookStorage = {
  async save(sketchbook: Sketchbook): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(SKETCHBOOKS_STORE)) {
      throw new Error('[SketchbookStorage] "sketchbooks" store not available — DB upgrade may be blocked. Close other tabs and refresh.')
    }
    const raw = JSON.parse(JSON.stringify(sketchbook)) as Sketchbook
    await db.put(SKETCHBOOKS_STORE, raw)
  },

  async get(id: string): Promise<Sketchbook | undefined> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(SKETCHBOOKS_STORE)) return undefined
    return db.get(SKETCHBOOKS_STORE, id)
  },

  async getAll(): Promise<Sketchbook[]> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(SKETCHBOOKS_STORE)) {
      console.error('[SketchbookStorage] "sketchbooks" store not available — DB upgrade may be blocked.')
      return []
    }
    try {
      return await db.getAllFromIndex(SKETCHBOOKS_STORE, 'createdAt')
    } catch {
      const all: Sketchbook[] = await db.getAll(SKETCHBOOKS_STORE)
      return all
    }
  },

  async delete(id: string): Promise<void> {
    const db = await getDB()
    if (!db.objectStoreNames?.contains(SKETCHBOOKS_STORE)) return
    await db.delete(SKETCHBOOKS_STORE, id)
  },
}
