import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useVocabulary } from '../useVocabulary'
import type { ReviewQuality } from '@/types/vocab'

describe('useVocabulary', () => {
  let uuidCounter: number

  beforeEach(() => {
    uuidCounter = 0
    vi.spyOn(crypto, 'randomUUID').mockImplementation(() => `test-uuid-${uuidCounter++}`)
    setActivePinia(createPinia())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('addVocabCard', () => {
    it('adds card and returns id', () => {
      const { addVocabCard, totalVocabCount } = useVocabulary()
      const id = addVocabCard({ word: 'ephemeral', definition: 'short-lived', pronunciation: '/ɪˈfɛmərəl/' })
      expect(id).toBe('test-uuid-0')
      expect(totalVocabCount.value).toBe(1)
    })

    it('stores pronunciation', () => {
      const { addVocabCard, findByWord } = useVocabulary()
      addVocabCard({ word: 'ephemeral', pronunciation: '/ɪˈfɛmərəl/' })
      const card = findByWord('ephemeral')
      expect(card?.pronunciation).toBe('/ɪˈfɛmərəl/')
    })
  })

  describe('findByWord', () => {
    it('returns null when word not found', () => {
      const { findByWord } = useVocabulary()
      expect(findByWord('nonexistent')).toBeNull()
    })

    it('finds existing word case insensitively', () => {
      const { addVocabCard, findByWord } = useVocabulary()
      addVocabCard({ word: 'Ephemeral' })
      expect(findByWord('ephemeral')).not.toBeNull()
    })
  })

  describe('wordExists', () => {
    it('returns true for existing word', () => {
      const { addVocabCard, wordExists } = useVocabulary()
      addVocabCard({ word: 'test' })
      expect(wordExists('test')).toBe(true)
    })

    it('returns false for missing word', () => {
      const { wordExists } = useVocabulary()
      expect(wordExists('missing')).toBe(false)
    })
  })

  describe('removeCard', () => {
    it('removes card by id', () => {
      const { addVocabCard, removeCard, totalVocabCount } = useVocabulary()
      const id = addVocabCard({ word: 'test' })
      expect(totalVocabCount.value).toBe(1)
      removeCard(id)
      expect(totalVocabCount.value).toBe(0)
    })
  })

  describe('getCard', () => {
    it('returns card by id', () => {
      const { addVocabCard, getCard } = useVocabulary()
      const id = addVocabCard({ word: 'test' })
      expect(getCard(id)?.word).toBe('test')
    })
  })

  describe('updateDefinition', () => {
    it('updates definition on card', () => {
      const { addVocabCard, updateDefinition, getCard } = useVocabulary()
      const id = addVocabCard({ word: 'test' })
      updateDefinition(id, 'updated')
      expect(getCard(id)?.definition).toBe('updated')
    })
  })

  describe('recordReview', () => {
    it('records SM-2 review on card', () => {
      const { addVocabCard, recordReview, getCard } = useVocabulary()
      const id = addVocabCard({ word: 'test' })
      recordReview(id, 4 as ReviewQuality)
      const card = getCard(id)
      expect(card?.repetitions).toBe(1)
      expect(card?.lastReviewDate).not.toBeNull()
    })
  })

  describe('allVocabCards', () => {
    it('returns all cards sorted by createdAt desc', () => {
      const { addVocabCard, allVocabCards } = useVocabulary()
      const nowSpy = vi.spyOn(Date, 'now')
      addVocabCard({ word: 'first' })
      nowSpy.mockReturnValue(Date.now() + 1)
      addVocabCard({ word: 'second' })

      const cards = allVocabCards.value
      expect(cards).toHaveLength(2)
      expect(cards[0].word).toBe('second')
    })
  })

  describe('vocabCardsDue', () => {
    it('returns only due cards', () => {
      const { addVocabCard, vocabCardsDue, getCard } = useVocabulary()
      addVocabCard({ word: 'due' })
      const id2 = addVocabCard({ word: 'future' })
      const card = getCard(id2)
      if (card) card.nextReviewDate = Date.now() + 100000

      expect(vocabCardsDue.value).toHaveLength(1)
      expect(vocabCardsDue.value[0].word).toBe('due')
    })
  })

  describe('vocabDueCount', () => {
    it('counts due cards', () => {
      const { addVocabCard, vocabDueCount } = useVocabulary()
      addVocabCard({ word: 'due' })
      expect(vocabDueCount.value).toBe(1)
    })
  })
})
