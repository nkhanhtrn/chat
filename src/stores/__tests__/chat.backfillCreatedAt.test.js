import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'

describe('useChatStore - backfillCreatedAt', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getMessagesWithoutCreatedAt', () => {
    it('returns empty array when all messages have createdAt', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', createdAt: 1700000000000 },
        msg2: { id: 'msg2', question: 'Q2', createdAt: 1700000001000 }
      }

      const result = chatStore.getMessagesWithoutCreatedAt()
      expect(result).toEqual([])
    })

    it('returns messages without createdAt', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', questionSummarized: 'Q1 sum', createdAt: 1700000000000 },
        msg2: { id: 'msg2', question: 'Q2', questionSummarized: 'Q2 sum' },
        msg3: { id: 'msg3', question: 'Q3' }
      }

      const result = chatStore.getMessagesWithoutCreatedAt()
      expect(result).toHaveLength(2)
      expect(result).toContainEqual({ id: 'msg2', question: 'Q2 sum' })
      expect(result).toContainEqual({ id: 'msg3', question: 'Q3' })
    })

    it('uses question when questionSummarized is not available', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Full question text' }
      }

      const result = chatStore.getMessagesWithoutCreatedAt()
      expect(result[0].question).toBe('Full question text')
    })

    it('prefers questionSummarized over question', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Full question', questionSummarized: 'Summary' }
      }

      const result = chatStore.getMessagesWithoutCreatedAt()
      expect(result[0].question).toBe('Summary')
    })

    it('returns empty array when no messages exist', () => {
      chatStore.messagesById = {}

      const result = chatStore.getMessagesWithoutCreatedAt()
      expect(result).toEqual([])
    })
  })

  describe('backfillCreatedAt', () => {
    it('returns early when all messages have createdAt', () => {
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1', createdAt: 1700000000000 },
        msg2: { id: 'msg2', question: 'Q2', createdAt: 1700000001000 }
      }

      const result = chatStore.backfillCreatedAt(3)

      expect(result.updated).toBe(0)
      expect(result.total).toBe(2)
    })

    it('backfills all messages without createdAt', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' },
        msg3: { id: 'msg3', question: 'Q3', createdAt: 1699999999000 }
      }

      const result = chatStore.backfillCreatedAt(3)

      expect(result.updated).toBe(2)
      expect(result.total).toBe(3)
      expect(chatStore.messagesById.msg1.createdAt).toBeDefined()
      expect(chatStore.messagesById.msg2.createdAt).toBeDefined()
      expect(chatStore.messagesById.msg3.createdAt).toBe(1699999999000) // unchanged
    })

    it('spreads messages across specified number of days', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' },
        msg3: { id: 'msg3', question: 'Q3' }
      }

      chatStore.backfillCreatedAt(3)

      const DAY_MS = 24 * 60 * 60 * 1000
      const startTime = fakeNow - (3 * DAY_MS)

      // All timestamps should be within the 3-day range
      for (const msg of Object.values(chatStore.messagesById)) {
        expect(msg.createdAt).toBeGreaterThanOrEqual(startTime - (2 * 60 * 60 * 1000)) // with random offset
        expect(msg.createdAt).toBeLessThanOrEqual(fakeNow + (2 * 60 * 60 * 1000))
      }
    })

    it('defaults to 3 days when no argument provided', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      chatStore.backfillCreatedAt()

      const DAY_MS = 24 * 60 * 60 * 1000
      const threeDaysAgo = fakeNow - (3 * DAY_MS)

      // Should be within 3-day range (with some tolerance for random offset)
      expect(chatStore.messagesById.msg1.createdAt).toBeGreaterThan(threeDaysAgo - (3 * 60 * 60 * 1000))
      expect(chatStore.messagesById.msg1.createdAt).toBeLessThanOrEqual(fakeNow)
    })

    it('handles single message correctly', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      const result = chatStore.backfillCreatedAt(3)

      expect(result.updated).toBe(1)
      expect(result.total).toBe(1)
      expect(chatStore.messagesById.msg1.createdAt).toBeDefined()
    })

    it('handles empty messagesById', () => {
      chatStore.messagesById = {}

      const result = chatStore.backfillCreatedAt(3)

      expect(result.updated).toBe(0)
      expect(result.total).toBe(0)
    })

    it('preserves existing createdAt values', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1700000000000)

      const existingTimestamp = 1600000000000
      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2', createdAt: existingTimestamp }
      }

      chatStore.backfillCreatedAt(3)

      expect(chatStore.messagesById.msg2.createdAt).toBe(existingTimestamp)
    })

    it('adds randomness to timestamps', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      // Create many messages to verify distribution
      const messages = {}
      for (let i = 0; i < 10; i++) {
        messages[`msg${i}`] = { id: `msg${i}`, question: `Q${i}` }
      }
      chatStore.messagesById = messages

      chatStore.backfillCreatedAt(3)

      // Collect all timestamps
      const timestamps = Object.values(chatStore.messagesById).map(m => m.createdAt)

      // Verify they're not all the same (randomness applied)
      const uniqueTimestamps = new Set(timestamps)
      expect(uniqueTimestamps.size).toBeGreaterThan(1)
    })

    it('calls _persistState after backfilling', () => {
      vi.useFakeTimers()
      vi.setSystemTime(1700000000000)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' }
      }

      const persistSpy = vi.spyOn(chatStore, '_persistState')

      chatStore.backfillCreatedAt(3)

      expect(persistSpy).toHaveBeenCalled()
    })

    it('can spread across different day ranges', () => {
      vi.useFakeTimers()
      const fakeNow = 1700000000000
      vi.setSystemTime(fakeNow)

      chatStore.messagesById = {
        msg1: { id: 'msg1', question: 'Q1' },
        msg2: { id: 'msg2', question: 'Q2' }
      }

      // Test with 1 day
      chatStore.backfillCreatedAt(1)

      const DAY_MS = 24 * 60 * 60 * 1000
      const oneDayAgo = fakeNow - DAY_MS

      for (const msg of Object.values(chatStore.messagesById)) {
        // Allow for ±2 hour randomness
        expect(msg.createdAt).toBeGreaterThan(oneDayAgo - (3 * 60 * 60 * 1000))
        expect(msg.createdAt).toBeLessThanOrEqual(fakeNow + (2 * 60 * 60 * 1000))
      }
    })
  })
})
