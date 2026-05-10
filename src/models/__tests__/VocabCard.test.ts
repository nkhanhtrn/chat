import { describe, it, expect, vi, beforeEach } from 'vitest'
import { VocabCard } from '../VocabCard'
import type { ReviewQuality } from '@/types/vocab'

describe('VocabCard', () => {
  beforeEach(() => {
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('test-uuid')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('creates card with required word', () => {
      const card = new VocabCard({ word: 'ephemeral' })
      expect(card.word).toBe('ephemeral')
      expect(card.id).toBe('test-uuid')
      expect(card.definition).toBe('')
      expect(card.context).toBe('')
      expect(card.pronunciation).toBe('')
    })

    it('accepts all fields', () => {
      const card = new VocabCard({
        id: 'custom-id',
        word: 'ephemeral',
        definition: 'lasting for a short time',
        context: 'The ephemeral beauty of cherry blossoms',
        pronunciation: '/ɪˈfɛmərəl/',
        easiness: 3.0,
        interval: 6,
        repetitions: 2,
      })
      expect(card.id).toBe('custom-id')
      expect(card.definition).toBe('lasting for a short time')
      expect(card.pronunciation).toBe('/ɪˈfɛmərəl/')
      expect(card.easiness).toBe(3.0)
      expect(card.interval).toBe(6)
      expect(card.repetitions).toBe(2)
    })

    it('uses defaults for optional fields', () => {
      const card = new VocabCard({ word: 'test' })
      expect(card.easiness).toBe(2.5)
      expect(card.interval).toBe(1)
      expect(card.repetitions).toBe(0)
      expect(card.messageId).toBeNull()
      expect(card.highlightId).toBeNull()
    })
  })

  describe('isDue', () => {
    it('is due when nextReviewDate is null', () => {
      const card = new VocabCard({ word: 'test', nextReviewDate: null as any })
      expect(card.isDue).toBe(true)
    })

    it('is due when nextReviewDate is in the past', () => {
      const card = new VocabCard({ word: 'test', nextReviewDate: Date.now() - 1000 })
      expect(card.isDue).toBe(true)
    })

    it('is not due when nextReviewDate is in the future', () => {
      const card = new VocabCard({ word: 'test', nextReviewDate: Date.now() + 100000 })
      expect(card.isDue).toBe(false)
    })
  })

  describe('daysUntilReview', () => {
    it('returns 0 when nextReviewDate is null', () => {
      const card = new VocabCard({ word: 'test', nextReviewDate: null as any })
      expect(card.daysUntilReview).toBe(0)
    })

    it('calculates days correctly', () => {
      const threeDays = 3 * 24 * 60 * 60 * 1000
      const card = new VocabCard({ word: 'test', nextReviewDate: Date.now() + threeDays })
      expect(card.daysUntilReview).toBe(3)
    })
  })

  describe('recordReview', () => {
    it('resets repetitions and interval on quality < 3', () => {
      const card = new VocabCard({ word: 'test', repetitions: 5, interval: 10 })
      card.recordReview(1 as ReviewQuality)
      expect(card.repetitions).toBe(0)
      expect(card.interval).toBe(1)
    })

    it('sets interval to 1 on first successful review (repetitions=0)', () => {
      const card = new VocabCard({ word: 'test', repetitions: 0 })
      card.recordReview(4 as ReviewQuality)
      expect(card.interval).toBe(1)
      expect(card.repetitions).toBe(1)
    })

    it('sets interval to 6 on second successful review (repetitions=1)', () => {
      const card = new VocabCard({ word: 'test', repetitions: 1 })
      card.recordReview(4 as ReviewQuality)
      expect(card.interval).toBe(6)
      expect(card.repetitions).toBe(2)
    })

    it('multiplies interval by easiness on subsequent reviews', () => {
      const card = new VocabCard({ word: 'test', repetitions: 3, easiness: 2.5, interval: 6 })
      card.recordReview(4 as ReviewQuality)
      expect(card.interval).toBe(15) // Math.round(6 * 2.5)
      expect(card.repetitions).toBe(4)
    })

    it('updates easiness with minimum of 1.3', () => {
      const card = new VocabCard({ word: 'test', easiness: 1.3 })
      card.recordReview(0 as ReviewQuality)
      expect(card.easiness).toBe(1.3)
    })

    it('updates nextReviewDate and lastReviewDate', () => {
      const before = Date.now()
      const card = new VocabCard({ word: 'test' })
      card.recordReview(4 as ReviewQuality)
      const after = Date.now()

      expect(card.lastReviewDate).toBeGreaterThanOrEqual(before)
      expect(card.lastReviewDate).toBeLessThanOrEqual(after)
      expect(card.nextReviewDate).toBe(card.lastReviewDate! + card.interval * 24 * 60 * 60 * 1000)
    })
  })

  describe('updateDefinition', () => {
    it('updates the definition', () => {
      const card = new VocabCard({ word: 'test' })
      card.updateDefinition('new definition')
      expect(card.definition).toBe('new definition')
    })
  })

  describe('toJSON', () => {
    it('returns plain object with all fields', () => {
      const card = new VocabCard({
        id: 'test-id',
        word: 'ephemeral',
        definition: 'short-lived',
        context: 'ephemeral beauty',
        pronunciation: '/ɪˈfɛmərəl/',
      })
      const json = card.toJSON()
      expect(json).toEqual({
        id: 'test-id',
        word: 'ephemeral',
        definition: 'short-lived',
        context: 'ephemeral beauty',
        pronunciation: '/ɪˈfɛmərəl/',
        messageId: null,
        highlightId: null,
        easiness: 2.5,
        interval: 1,
        repetitions: 0,
        nextReviewDate: card.nextReviewDate,
        lastReviewDate: null,
        createdAt: card.createdAt,
      })
    })

    it('produces serializable output', () => {
      const card = new VocabCard({ word: 'test' })
      const json = JSON.stringify(card.toJSON())
      expect(() => JSON.parse(json)).not.toThrow()
    })
  })
})
