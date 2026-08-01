import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@/services/StrokeStorage', () => ({
  StrokeStorage: {
    saveStroke: vi.fn().mockResolvedValue(undefined),
    deleteStroke: vi.fn().mockResolvedValue(undefined),
    getStrokes: vi.fn().mockResolvedValue([]),
    wipeBook: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('@/services/firestore/firestore-strokes', () => ({
  saveStrokeToFirestore: vi.fn().mockResolvedValue(undefined),
  deleteStrokeFromFirestore: vi.fn().mockResolvedValue(undefined),
  loadStrokesForBook: vi.fn().mockResolvedValue([]),
}))

import { useStrokesStore } from '@/stores/strokes'
import { StrokeStorage } from '@/services/StrokeStorage'
import { loadStrokesForBook, saveStrokeToFirestore, deleteStrokeFromFirestore } from '@/services/firestore/firestore-strokes'
import type { Stroke, StrokeDraft } from '@/types/stroke'

function makeDraft(overrides: Partial<StrokeDraft> = {}): StrokeDraft {
  return {
    id: 'stroke-1',
    page: 1,
    tool: 'pen',
    colorIndex: 0,
    points: [{ x: 1, y: 2 }, { x: 3, y: 4 }],
    ...overrides,
  }
}

function makeStroke(overrides: Partial<Stroke> = {}): Stroke {
  return {
    id: 'stroke-1',
    bookId: 'book-123',
    page: 1,
    tool: 'pen',
    colorIndex: 0,
    points: [{ x: 1, y: 2 }],
    createdAt: 1000,
    updatedAt: 1000,
    ...overrides,
  }
}

describe('useStrokesStore', () => {
  let store: ReturnType<typeof useStrokesStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useStrokesStore()
    vi.clearAllMocks()
  })

  describe('forPage getter', () => {
    it('returns strokes filtered by page', () => {
      store.byBook['book-123'] = [
        makeStroke({ id: 's1', page: 1 }),
        makeStroke({ id: 's2', page: 2 }),
        makeStroke({ id: 's3', page: 1 }),
      ]

      expect(store.forPage('book-123', 1).map(s => s.id)).toEqual(['s1', 's3'])
    })

    it('returns empty array for unknown book', () => {
      expect(store.forPage('unknown', 1)).toEqual([])
    })
  })

  describe('loadForBook', () => {
    it('merges local and cloud strokes by id', async () => {
      vi.mocked(StrokeStorage.getStrokes).mockResolvedValue([
        makeStroke({ id: 'a', updatedAt: 100 }),
      ])
      vi.mocked(loadStrokesForBook).mockResolvedValue([
        makeStroke({ id: 'a', updatedAt: 500 }),
        makeStroke({ id: 'b', updatedAt: 200 }),
      ])

      await store.loadForBook('book-123')

      const ids = store.byBook['book-123'].map(s => s.id).sort()
      expect(ids).toEqual(['a', 'b'])
      // cloud wins on conflicting id (later updatedAt)
      expect(store.byBook['book-123'].find(s => s.id === 'a')!.updatedAt).toBe(500)
    })

    it('backfills local cache with cloud-only strokes', async () => {
      vi.mocked(StrokeStorage.getStrokes).mockResolvedValue([])
      vi.mocked(loadStrokesForBook).mockResolvedValue([
        makeStroke({ id: 'cloud-only', updatedAt: 1 }),
      ])

      await store.loadForBook('book-123')

      expect(StrokeStorage.saveStroke).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'cloud-only' }),
      )
    })

    it('does not reload once loaded', async () => {
      vi.mocked(StrokeStorage.getStrokes).mockResolvedValue([])
      await store.loadForBook('book-123')
      await store.loadForBook('book-123')

      expect(StrokeStorage.getStrokes).toHaveBeenCalledTimes(1)
    })
  })

  describe('add', () => {
    it('creates a stroke from a draft and persists it', async () => {
      const stroke = await store.add('book-123', makeDraft({ id: 'new-1' }))

      expect(stroke.id).toBe('new-1')
      expect(stroke.bookId).toBe('book-123')
      expect(store.byBook['book-123']).toHaveLength(1)
      expect(StrokeStorage.saveStroke).toHaveBeenCalledWith(expect.objectContaining({ id: 'new-1', bookId: 'book-123' }))
      expect(saveStrokeToFirestore).toHaveBeenCalledWith('book-123', expect.objectContaining({ id: 'new-1' }))
    })
  })

  describe('remove', () => {
    it('removes a stroke by id and persists deletion', async () => {
      store.byBook['book-123'] = [makeStroke({ id: 's1' }), makeStroke({ id: 's2' })]

      await store.remove('book-123', 's1')

      expect(store.byBook['book-123'].map(s => s.id)).toEqual(['s2'])
      expect(StrokeStorage.deleteStroke).toHaveBeenCalledWith('s1')
      expect(deleteStrokeFromFirestore).toHaveBeenCalledWith('book-123', 's1')
    })
  })

  describe('removeLastOnPage', () => {
    it('removes the newest stroke on the page', async () => {
      store.byBook['book-123'] = [
        makeStroke({ id: 'old', page: 1, createdAt: 100 }),
        makeStroke({ id: 'new', page: 1, createdAt: 900 }),
        makeStroke({ id: 'other-page', page: 2, createdAt: 9999 }),
      ]

      await store.removeLastOnPage('book-123', 1)

      expect(store.byBook['book-123'].map(s => s.id)).toEqual(['old', 'other-page'])
    })

    it('is a no-op when the page has no strokes', async () => {
      store.byBook['book-123'] = []
      await store.removeLastOnPage('book-123', 1)
      expect(StrokeStorage.deleteStroke).not.toHaveBeenCalled()
    })
  })

  describe('clearBook', () => {
    it('clears cached strokes for a book', async () => {
      await store.add('book-123', makeDraft())
      expect(store.byBook['book-123']).toHaveLength(1)

      store.clearBook('book-123')

      expect(store.byBook['book-123']).toBeUndefined()
    })
  })
})
