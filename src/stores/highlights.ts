import { defineStore } from 'pinia'
import type { EpubHighlight, EpubHighlightDraft } from '@/types/highlight'
import { HighlightStorage } from '@/services/HighlightStorage'
import {
  saveHighlightToFirestore,
  deleteHighlightFromFirestore,
  loadHighlightsForBook,
} from '@/services/firestore/firestore-highlights'

export const useHighlightsStore = defineStore('highlights', {
  state: () => ({
    byBook: {} as Record<string, EpubHighlight[]>,
    loadedBooks: {} as Record<string, boolean>,
    loadingBooks: {} as Record<string, boolean>,
  }),

  getters: {
    forBook(state) {
      return (bookId: string): EpubHighlight[] => state.byBook[bookId] ?? []
    },
    findByCfi(state) {
      return (bookId: string, cfiRange: string): EpubHighlight | undefined =>
        (state.byBook[bookId] ?? []).find(h => h.cfiRange === cfiRange)
    },
  },

  actions: {
    async loadForBook(bookId: string): Promise<void> {
      if (this.loadedBooks[bookId] || this.loadingBooks[bookId]) return
      this.loadingBooks[bookId] = true
      try {
        const [local, cloud] = await Promise.all([
          HighlightStorage.getHighlights(bookId).catch(() => [] as EpubHighlight[]),
          loadHighlightsForBook(bookId),
        ])

        const merged = new Map<string, EpubHighlight>()
        const byUpdated = (a: EpubHighlight, b: EpubHighlight) => (a.updatedAt ?? 0) - (b.updatedAt ?? 0)
        ;[...local, ...cloud].sort(byUpdated).forEach(h => merged.set(h.id, h))

        this.byBook[bookId] = [...merged.values()]
        this.loadedBooks[bookId] = true

        const localIds = new Set(local.map(h => h.id))
        cloud.forEach(h => {
          if (!localIds.has(h.id)) HighlightStorage.saveHighlight(h).catch(() => {})
        })
      } finally {
        this.loadingBooks[bookId] = false
      }
    },

    async add(bookId: string, draft: EpubHighlightDraft): Promise<EpubHighlight> {
      const now = Date.now()
      const highlight: EpubHighlight = {
        id: crypto.randomUUID(),
        bookId,
        cfiRange: draft.cfiRange,
        text: draft.text,
        context: draft.context,
        colorIndex: draft.colorIndex,
        note: draft.note,
        createdAt: now,
        updatedAt: now,
      }
      if (!this.byBook[bookId]) this.byBook[bookId] = []
      this.byBook[bookId].push(highlight)
      await HighlightStorage.saveHighlight(highlight)
      saveHighlightToFirestore(bookId, highlight).catch(err => {
        console.warn('[highlights] cloud save failed:', err)
      })
      return highlight
    },

    async update(bookId: string, highlightId: string, updates: Partial<EpubHighlight>): Promise<void> {
      const list = this.byBook[bookId]
      if (!list) return
      const idx = list.findIndex(h => h.id === highlightId)
      if (idx === -1) return
      const updated = { ...list[idx], ...updates, updatedAt: Date.now() }
      this.byBook[bookId][idx] = updated
      await HighlightStorage.saveHighlight(updated)
      saveHighlightToFirestore(bookId, updated).catch(err => {
        console.warn('[highlights] cloud update failed:', err)
      })
    },

    async remove(bookId: string, highlightId: string): Promise<void> {
      const list = this.byBook[bookId]
      if (list) {
        const hl = list.find(h => h.id === highlightId)
        this.byBook[bookId] = list.filter(h => h.id !== highlightId)
        await HighlightStorage.deleteHighlight(highlightId)
        if (hl) {
          deleteHighlightFromFirestore(bookId, highlightId).catch(err => {
            console.warn('[highlights] cloud delete failed:', err)
          })
        }
      }
    },

    clearBook(bookId: string): void {
      delete this.byBook[bookId]
      delete this.loadedBooks[bookId]
      delete this.loadingBooks[bookId]
    },
  },
})
