import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import SRCard from '../SRCard.js'

describe('SRCard', () => {
  const DAY_IN_MS = 24 * 60 * 60 * 1000

  describe('constructor', () => {
    it('creates a card with required messageId', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      expect(card.messageId).toBe('msg-1')
    })

    it('creates a card with default values', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      expect(card.easiness).toBe(2.5)
      expect(card.interval).toBe(1)
      expect(card.repetitions).toBe(0)
      expect(card.responseSummary).toBe('')
      expect(card.lastReviewDate).toBe(null)
      expect(card.nextReviewDate).toBeDefined()
    })

    it('creates a card with custom values', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        easiness: 2.0,
        interval: 6,
        repetitions: 2,
        nextReviewDate: 12345,
        lastReviewDate: 12340,
        responseSummary: 'Test summary'
      })
      expect(card.easiness).toBe(2.0)
      expect(card.interval).toBe(6)
      expect(card.repetitions).toBe(2)
      expect(card.nextReviewDate).toBe(12345)
      expect(card.lastReviewDate).toBe(12340)
      expect(card.responseSummary).toBe('Test summary')
    })

    it('sets nextReviewDate to now for new cards', () => {
      const before = Date.now()
      const card = new SRCard({ messageId: 'msg-1' })
      const after = Date.now()
      expect(card.nextReviewDate).toBeGreaterThanOrEqual(before)
      expect(card.nextReviewDate).toBeLessThanOrEqual(after)
    })
  })

  describe('isDue', () => {
    it('returns true for new cards', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      expect(card.isDue).toBe(true)
    })

    it('returns true when nextReviewDate is in the past', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        nextReviewDate: Date.now() - 1000
      })
      expect(card.isDue).toBe(true)
    })

    it('returns false when nextReviewDate is in the future', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        nextReviewDate: Date.now() + DAY_IN_MS
      })
      expect(card.isDue).toBe(false)
    })

    it('returns true when nextReviewDate is null', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      card.nextReviewDate = null
      expect(card.isDue).toBe(true)
    })
  })

  describe('daysUntilReview', () => {
    it('returns 0 for new cards', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      expect(card.daysUntilReview).toBeLessThanOrEqual(0)
    })

    it('returns positive number for future review', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        nextReviewDate: Date.now() + (2 * DAY_IN_MS)
      })
      expect(card.daysUntilReview).toBe(2)
    })

    it('returns negative number for overdue review', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        nextReviewDate: Date.now() - (2 * DAY_IN_MS)
      })
      expect(card.daysUntilReview).toBe(-2)
    })

    it('returns 0 when nextReviewDate is null', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      card.nextReviewDate = null
      expect(card.daysUntilReview).toBe(0)
    })
  })

  describe('recordReview - SM-2 algorithm', () => {
    let mockNow

    beforeEach(() => {
      mockNow = 1000000000000
      vi.useFakeTimers()
      vi.setSystemTime(mockNow)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    describe('failed reviews (quality < 3)', () => {
      it('resets progress on quality 0 (Again)', () => {
        const card = new SRCard({
          messageId: 'msg-1',
          repetitions: 5,
          interval: 30
        })
        card.recordReview(0)
        expect(card.repetitions).toBe(0)
        expect(card.interval).toBe(1)
      })

      it('resets progress on quality 2 (Hard)', () => {
        const card = new SRCard({
          messageId: 'msg-1',
          repetitions: 5,
          interval: 30
        })
        card.recordReview(2)
        expect(card.repetitions).toBe(0)
        expect(card.interval).toBe(1)
      })
    })

    describe('successful reviews (quality >= 3)', () => {
      it('sets interval to 1 on first successful review', () => {
        const card = new SRCard({ messageId: 'msg-1' })
        card.recordReview(4)
        expect(card.interval).toBe(1)
        expect(card.repetitions).toBe(1)
      })

      it('sets interval to 6 on second successful review', () => {
        const card = new SRCard({
          messageId: 'msg-1',
          repetitions: 1,
          interval: 1
        })
        card.recordReview(4)
        expect(card.interval).toBe(6)
        expect(card.repetitions).toBe(2)
      })

      it('multiplies interval by easiness on subsequent reviews', () => {
        const card = new SRCard({
          messageId: 'msg-1',
          repetitions: 2,
          interval: 6,
          easiness: 2.5
        })
        card.recordReview(4)
        expect(card.interval).toBe(15) // 6 * 2.5 = 15
        expect(card.repetitions).toBe(3)
      })
    })

    describe('easiness factor updates', () => {
      it('increases easiness for quality 5 (Easy)', () => {
        const card = new SRCard({ messageId: 'msg-1', easiness: 2.5 })
        card.recordReview(5)
        expect(card.easiness).toBeGreaterThan(2.5)
      })

      it('maintains easiness for quality 4 (Good)', () => {
        const card = new SRCard({ messageId: 'msg-1', easiness: 2.5 })
        card.recordReview(4)
        expect(card.easiness).toBeCloseTo(2.5, 1)
      })

      it('decreases easiness for quality 0 (Again)', () => {
        const card = new SRCard({ messageId: 'msg-1', easiness: 2.5 })
        card.recordReview(0)
        expect(card.easiness).toBeLessThan(2.5)
      })

      it('enforces minimum easiness of 1.3', () => {
        const card = new SRCard({ messageId: 'msg-1', easiness: 1.3 })
        card.recordReview(0)
        card.recordReview(0)
        card.recordReview(0)
        expect(card.easiness).toBeGreaterThanOrEqual(1.3)
      })
    })

    describe('date updates', () => {
      it('sets lastReviewDate to current time', () => {
        const card = new SRCard({ messageId: 'msg-1' })
        card.recordReview(4)
        expect(card.lastReviewDate).toBe(mockNow)
      })

      it('sets nextReviewDate based on interval', () => {
        const card = new SRCard({ messageId: 'msg-1' })
        card.recordReview(4) // First review: interval = 1
        expect(card.nextReviewDate).toBe(mockNow + DAY_IN_MS)
      })

      it('schedules 6 days out after second successful review', () => {
        const card = new SRCard({
          messageId: 'msg-1',
          repetitions: 1,
          interval: 1
        })
        card.recordReview(4)
        expect(card.nextReviewDate).toBe(mockNow + (6 * DAY_IN_MS))
      })
    })
  })

  describe('setResponseSummary', () => {
    it('updates the response summary', () => {
      const card = new SRCard({ messageId: 'msg-1' })
      card.setResponseSummary('New summary')
      expect(card.responseSummary).toBe('New summary')
    })
  })

  describe('toJSON', () => {
    it('serializes all properties', () => {
      const card = new SRCard({
        messageId: 'msg-1',
        easiness: 2.3,
        interval: 6,
        repetitions: 2,
        nextReviewDate: 12345,
        lastReviewDate: 12340,
        responseSummary: 'Summary'
      })
      const json = card.toJSON()
      expect(json).toEqual({
        messageId: 'msg-1',
        easiness: 2.3,
        interval: 6,
        repetitions: 2,
        nextReviewDate: 12345,
        lastReviewDate: 12340,
        responseSummary: 'Summary'
      })
    })

    it('can be used to recreate a card', () => {
      const original = new SRCard({
        messageId: 'msg-1',
        easiness: 2.3,
        interval: 6,
        repetitions: 2
      })
      const json = original.toJSON()
      const restored = new SRCard(json)
      expect(restored.messageId).toBe(original.messageId)
      expect(restored.easiness).toBe(original.easiness)
      expect(restored.interval).toBe(original.interval)
      expect(restored.repetitions).toBe(original.repetitions)
    })
  })

  describe('static DAY_IN_MS', () => {
    it('equals 24 hours in milliseconds', () => {
      expect(SRCard.DAY_IN_MS).toBe(86400000)
    })
  })
})
