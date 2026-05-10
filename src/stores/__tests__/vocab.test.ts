import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVocabStore } from '../vocab'
import type { ReviewQuality } from '@/types/vocab'

describe('useVocabStore', () => {
  let store: ReturnType<typeof useVocabStore>
  let uuidCounter: number

  beforeEach(() => {
    uuidCounter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `test-uuid-${uuidCounter++}`)
    setActivePinia(createPinia())
    store = useVocabStore()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addVocabCard', () => {
    it('creates and stores a card', () => {
      const id = store.addVocabCard({ word: 'ephemeral', definition: 'short-lived', pronunciation: '/ɪˈfɛmərəl/' })
      expect(id).toBe('test-uuid-0')
      expect(store.vocabData[id]).toBeDefined()
      expect(store.vocabData[id].word).toBe('ephemeral')
      expect(store.vocabData[id].pronunciation).toBe('/ɪˈfɛmərəl/')
    })

    it('creates card with minimal params', () => {
      const id = store.addVocabCard({ word: 'test' })
      expect(store.vocabData[id].definition).toBe('')
      expect(store.vocabData[id].context).toBe('')
    })
  })

  describe('removeVocabCard', () => {
    it('removes a card by id', () => {
      const id = store.addVocabCard({ word: 'test' })
      store.removeVocabCard(id)
      expect(store.vocabData[id]).toBeUndefined()
    })

    it('is a no-op for nonexistent id', () => {
      store.removeVocabCard('nonexistent')
    })
  })

  describe('findVocabCardByWord', () => {
    it('finds card by exact word', () => {
      store.addVocabCard({ word: 'ephemeral' })
      const card = store.findVocabCardByWord('ephemeral')
      expect(card).not.toBeNull()
      expect(card!.word).toBe('ephemeral')
    })

    it('is case insensitive', () => {
      store.addVocabCard({ word: 'Ephemeral' })
      const card = store.findVocabCardByWord('EPHEMERAL')
      expect(card).not.toBeNull()
    })

    it('trims whitespace', () => {
      store.addVocabCard({ word: 'test' })
      const card = store.findVocabCardByWord('  test  ')
      expect(card).not.toBeNull()
    })

    it('returns null for missing word', () => {
      expect(store.findVocabCardByWord('nonexistent')).toBeNull()
    })
  })

  describe('getVocabCard', () => {
    it('returns card by id', () => {
      const id = store.addVocabCard({ word: 'test' })
      expect(store.getVocabCard(id)).not.toBeNull()
    })

    it('returns null for missing id', () => {
      expect(store.getVocabCard('missing')).toBeNull()
    })
  })

  describe('updateVocabDefinition', () => {
    it('updates definition', () => {
      const id = store.addVocabCard({ word: 'test' })
      store.updateVocabDefinition(id, 'new definition')
      expect(store.vocabData[id].definition).toBe('new definition')
    })
  })

  describe('appendToVocabDefinition', () => {
    it('appends to definition', () => {
      const id = store.addVocabCard({ word: 'test', definition: 'hello' })
      store.appendToVocabDefinition(id, ' world')
      expect(store.vocabData[id].definition).toBe('hello world')
    })
  })

  describe('recordVocabReview', () => {
    it('records review on card', () => {
      const id = store.addVocabCard({ word: 'test' })
      store.recordVocabReview(id, 4 as ReviewQuality)
      expect(store.vocabData[id].repetitions).toBe(1)
      expect(store.vocabData[id].lastReviewDate).not.toBeNull()
    })
  })

  describe('vocabCardsDueForReview', () => {
    it('returns cards that are due (nextReviewDate in the past)', () => {
      store.addVocabCard({ word: 'due-card' })
      const id2 = store.addVocabCard({ word: 'future-card' })
      store.vocabData[id2].nextReviewDate = Date.now() + 100000

      const due = store.vocabCardsDueForReview
      expect(due).toHaveLength(1)
      expect(due[0].word).toBe('due-card')
    })

    it('returns empty array when no cards due', () => {
      const id = store.addVocabCard({ word: 'future' })
      store.vocabData[id].nextReviewDate = Date.now() + 100000
      expect(store.vocabCardsDueForReview).toHaveLength(0)
    })
  })

  describe('vocabCardsDueCount', () => {
    it('counts due cards', () => {
      store.addVocabCard({ word: 'due1' })
      store.addVocabCard({ word: 'due2' })
      const id3 = store.addVocabCard({ word: 'future' })
      store.vocabData[id3].nextReviewDate = Date.now() + 100000

      expect(store.vocabCardsDueCount).toBe(2)
    })
  })

  describe('allVocabCards', () => {
    it('returns all cards sorted by createdAt desc', () => {
      const id1 = store.addVocabCard({ word: 'first' })
      store.vocabData[id1].createdAt = 1000
      const id2 = store.addVocabCard({ word: 'second' })
      store.vocabData[id2].createdAt = 2000

      const all = store.allVocabCards
      expect(all).toHaveLength(2)
      expect(all[0].word).toBe('second')
      expect(all[1].word).toBe('first')
    })
  })

  describe('_loadFromData', () => {
    it('reconstructs cards from plain data', () => {
      store._loadFromData({
        'card-1': {
          id: 'card-1',
          word: 'ephemeral',
          definition: 'short-lived',
          context: 'ephemeral beauty',
          pronunciation: '/ɪˈfɛmərəl/',
          messageId: null,
          highlightId: null,
          easiness: 2.5,
          interval: 1,
          repetitions: 0,
          nextReviewDate: Date.now(),
          lastReviewDate: null,
          createdAt: Date.now(),
        },
      })

      expect(Object.keys(store.vocabData)).toHaveLength(1)
      expect(store.vocabData['card-1'].word).toBe('ephemeral')
      expect(store.vocabData['card-1'].pronunciation).toBe('/ɪˈfɛmərəl/')
    })

    it('replaces existing data', () => {
      store.addVocabCard({ word: 'old' })
      store._loadFromData({
        'new-1': {
          id: 'new-1',
          word: 'new',
          definition: '',
          context: '',
          pronunciation: '',
          messageId: null,
          highlightId: null,
          easiness: 2.5,
          interval: 1,
          repetitions: 0,
          nextReviewDate: Date.now(),
          lastReviewDate: null,
          createdAt: Date.now(),
        },
      })

      expect(Object.keys(store.vocabData)).toHaveLength(1)
      expect(store.vocabData['new-1'].word).toBe('new')
    })

    it('handles empty data', () => {
      store.addVocabCard({ word: 'test' })
      store._loadFromData({})
      expect(Object.keys(store.vocabData)).toHaveLength(0)
    })
  })
})
