import { defineStore } from 'pinia'
import type { Sketchbook } from '@/types/sketchbook'
import { sketchbookKey } from '@/types/sketchbook'
import { SketchbookStorage } from '@/services/SketchbookStorage'
import { StrokeStorage } from '@/services/StrokeStorage'
import { useStrokesStore } from '@/stores/strokes'

export const useSketchbooksStore = defineStore('sketchbooks', {
  state: () => ({
    list: [] as Sketchbook[],
    loaded: false,
  }),

  getters: {
    sorted(state): Sketchbook[] {
      return [...state.list].sort((a, b) => b.updatedAt - a.updatedAt)
    },
    getById(state) {
      return (id: string): Sketchbook | undefined => state.list.find(s => s.id === id)
    },
  },

  actions: {
    async load(): Promise<void> {
      if (this.loaded) return
      try {
        this.list = await SketchbookStorage.getAll()
      } catch (err) {
        console.warn('[sketchbooks] load failed:', err)
        this.list = []
      }
      this.loaded = true
    },

    async create(title = 'Untitled'): Promise<Sketchbook> {
      const now = Date.now()
      const sketchbook: Sketchbook = {
        id: crypto.randomUUID(),
        title,
        pageCount: 1,
        createdAt: now,
        updatedAt: now,
      }
      // Persist FIRST — only update in-memory state once the write succeeds,
      // so a failed save doesn't create a phantom sketchbook that vanishes on refresh.
      await SketchbookStorage.save(sketchbook)
      this.list.push(sketchbook)
      return sketchbook
    },

    async rename(id: string, title: string): Promise<void> {
      const sb = this.list.find(s => s.id === id)
      if (!sb) return
      sb.title = title || 'Untitled'
      sb.updatedAt = Date.now()
      await SketchbookStorage.save(sb)
    },

    /** Ensures pageCount is at least `page` (e.g. when navigating to a new page). */
    async ensurePageCount(id: string, page: number): Promise<void> {
      const sb = this.list.find(s => s.id === id)
      if (!sb) return
      if (page > sb.pageCount) {
        sb.pageCount = page
        sb.updatedAt = Date.now()
        await SketchbookStorage.save(sb)
      }
    },

    async setPageCount(id: string, count: number): Promise<void> {
      const sb = this.list.find(s => s.id === id)
      if (!sb) return
      sb.pageCount = count
      sb.updatedAt = Date.now()
      await SketchbookStorage.save(sb)
    },

    touch(id: string): void {
      const sb = this.list.find(s => s.id === id)
      if (sb) sb.updatedAt = Date.now()
    },

    persist(id: string): Promise<void> {
      const sb = this.list.find(s => s.id === id)
      if (!sb) return Promise.resolve()
      return SketchbookStorage.save(sb)
    },

    async remove(id: string): Promise<void> {
      this.list = this.list.filter(s => s.id !== id)
      await SketchbookStorage.delete(id)
      // Cascade: wipe all strokes for this sketchbook (local + memory)
      const key = sketchbookKey(id)
      const strokesStore = useStrokesStore()
      strokesStore.clearBook(key)
      await StrokeStorage.wipeBook(key).catch(() => {})
    },
  },
})
