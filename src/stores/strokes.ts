import { defineStore } from 'pinia'
import type { Stroke, StrokeDraft } from '@/types/stroke'
import { StrokeStorage } from '@/services/StrokeStorage'
import { saveStrokeToFirestore, deleteStrokeFromFirestore, loadStrokesForBook } from '@/services/firestore/firestore-strokes'

export const useStrokesStore = defineStore('strokes', {
  state: () => ({
    byBook: {} as Record<string, Stroke[]>,
    loadedBooks: {} as Record<string, boolean>,
    loadingBooks: {} as Record<string, boolean>,
  }),

  getters: {
    forPage(state) {
      return (bookId: string, page: number): Stroke[] =>
        (state.byBook[bookId] ?? []).filter(s => s.page === page)
    },
  },

  actions: {
    async loadForBook(bookId: string): Promise<void> {
      if (this.loadedBooks[bookId] || this.loadingBooks[bookId]) return
      this.loadingBooks[bookId] = true
      try {
        const [local, cloud] = await Promise.all([
          StrokeStorage.getStrokes(bookId).catch(() => [] as Stroke[]),
          loadStrokesForBook(bookId),
        ])

        const merged = new Map<string, Stroke>()
        const byUpdated = (a: Stroke, b: Stroke) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
        ;[...local, ...cloud].sort(byUpdated).forEach(s => merged.set(s.id, s))

        this.byBook[bookId] = [...merged.values()]
        this.loadedBooks[bookId] = true

        // Backfill local cache with any cloud-only strokes
        const localIds = new Set(local.map(s => s.id))
        cloud.forEach(s => {
          if (!localIds.has(s.id)) StrokeStorage.saveStroke(s).catch(() => {})
        })
      } finally {
        this.loadingBooks[bookId] = false
      }
    },

    async add(bookId: string, draft: StrokeDraft): Promise<Stroke> {
      const now = Date.now()
      const stroke: Stroke = {
        id: draft.id,
        bookId,
        page: draft.page,
        tool: draft.tool,
        colorIndex: draft.colorIndex,
        width: draft.width,
        points: draft.points,
        createdAt: now,
        updatedAt: now,
      }
      if (!this.byBook[bookId]) this.byBook[bookId] = []
      this.byBook[bookId].push(stroke)
      await StrokeStorage.saveStroke(stroke)
      saveStrokeToFirestore(bookId, stroke).catch(err => {
        console.warn('[strokes] cloud save failed:', err)
      })
      return stroke
    },

    async remove(bookId: string, strokeId: string): Promise<void> {
      const list = this.byBook[bookId]
      if (list) this.byBook[bookId] = list.filter(s => s.id !== strokeId)
      await StrokeStorage.deleteStroke(strokeId)
      deleteStrokeFromFirestore(bookId, strokeId).catch(err => {
        console.warn('[strokes] cloud delete failed:', err)
      })
    },

    async removeLastOnPage(bookId: string, page: number): Promise<void> {
      const onPage = (this.byBook[bookId] ?? []).filter(s => s.page === page)
      if (onPage.length === 0) return
      const last = onPage.reduce((a, b) => ((a.createdAt ?? 0) > (b.createdAt ?? 0) ? a : b))
      await this.remove(bookId, last.id)
    },

    clearBook(bookId: string): void {
      delete this.byBook[bookId]
      delete this.loadedBooks[bookId]
      delete this.loadingBooks[bookId]
    },
  },
})
