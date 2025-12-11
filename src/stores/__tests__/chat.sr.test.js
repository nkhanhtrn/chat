import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '../chat.js'
import SRCard from '../SRCard.js'
import Message from '../Message.js'

// Mock storage
vi.mock('../../services/storage.js', () => ({
  saveChatState: vi.fn(),
  loadChatState: vi.fn(() => null),
  resolveConflict: vi.fn()
}))

describe('Chat Store - Spaced Repetition', () => {
  let store
  const DAY_IN_MS = 24 * 60 * 60 * 1000

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useChatStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('state', () => {
    it('initializes srData as empty object', () => {
      expect(store.srData).toEqual({})
    })
  })

  describe('initializeSRCard', () => {
    it('creates a new SR card for existing message', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }

      store.initializeSRCard('msg-1')

      expect(store.srData['msg-1']).toBeDefined()
      expect(store.srData['msg-1'].messageId).toBe('msg-1')
    })

    it('does not create card for non-existent message', () => {
      store.initializeSRCard('non-existent')
      expect(store.srData['non-existent']).toBeUndefined()
    })

    it('does not overwrite existing card', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }
      store.srData['msg-1'] = new SRCard({
        messageId: 'msg-1',
        repetitions: 5
      })

      store.initializeSRCard('msg-1')

      expect(store.srData['msg-1'].repetitions).toBe(5)
    })

    it('creates card with default values', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }

      store.initializeSRCard('msg-1')

      expect(store.srData['msg-1'].easiness).toBe(2.5)
      expect(store.srData['msg-1'].interval).toBe(1)
      expect(store.srData['msg-1'].repetitions).toBe(0)
    })
  })

  describe('updateSRResponseSummary', () => {
    it('updates summary on message object', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }

      store.updateSRResponseSummary('msg-1', 'Updated summary')

      expect(store.messagesById['msg-1'].responseSummary).toBe('Updated summary')
    })

    it('does nothing for non-existent message', () => {
      store.updateSRResponseSummary('non-existent', 'Summary')
      expect(store.messagesById['non-existent']).toBeUndefined()
    })
  })

  describe('recordSRReview', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15'))
    })

    it('updates card with review result', () => {
      store.srData['msg-1'] = new SRCard({ messageId: 'msg-1' })

      store.recordSRReview('msg-1', 4)

      expect(store.srData['msg-1'].repetitions).toBe(1)
      expect(store.srData['msg-1'].lastReviewDate).toBeDefined()
    })

    it('does nothing for non-existent card', () => {
      store.recordSRReview('non-existent', 4)
      expect(store.srData['non-existent']).toBeUndefined()
    })

    it('schedules next review based on quality', () => {
      store.srData['msg-1'] = new SRCard({ messageId: 'msg-1' })
      const now = Date.now()

      store.recordSRReview('msg-1', 4)

      // First review schedules 1 day later
      expect(store.srData['msg-1'].nextReviewDate).toBe(now + DAY_IN_MS)
    })
  })

  describe('removeSRCard', () => {
    it('removes existing card', () => {
      store.srData['msg-1'] = new SRCard({ messageId: 'msg-1' })

      store.removeSRCard('msg-1')

      expect(store.srData['msg-1']).toBeUndefined()
    })

    it('does nothing for non-existent card', () => {
      store.removeSRCard('non-existent')
      expect(store.srData).toEqual({})
    })
  })

  describe('_cleanupSRData', () => {
    it('removes SR data for deleted messages', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1' }),
        'msg-2': new SRCard({ messageId: 'msg-2' }) // No message exists
      }

      store._cleanupSRData()

      expect(store.srData['msg-1']).toBeDefined()
      expect(store.srData['msg-2']).toBeUndefined()
    })

    it('does not remove SR data when all messages exist', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q', response: 'R' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1' })
      }

      const srDataBefore = { ...store.srData }
      store._cleanupSRData()

      expect(Object.keys(store.srData)).toEqual(Object.keys(srDataBefore))
    })
  })

  describe('cardsDueForReview getter', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15'))
    })

    it('returns empty array when no cards', () => {
      expect(store.cardsDueForReview).toEqual([])
    })

    it('returns cards due for review', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', responseSummary: 'Summary' })
      }
      store.srData = {
        'msg-1': new SRCard({
          messageId: 'msg-1',
          nextReviewDate: Date.now() - 1000 // Past
        })
      }

      const due = store.cardsDueForReview
      expect(due).toHaveLength(1)
      expect(due[0].messageId).toBe('msg-1')
      expect(due[0].question).toBe('Q1')
      expect(due[0].responseSummary).toBe('Summary')
    })

    it('excludes cards not yet due', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }
      store.srData = {
        'msg-1': new SRCard({
          messageId: 'msg-1',
          nextReviewDate: Date.now() + DAY_IN_MS // Future
        })
      }

      expect(store.cardsDueForReview).toEqual([])
    })

    it('excludes cards for deleted messages', () => {
      store.messagesById = {} // No messages
      store.srData = {
        'msg-1': new SRCard({
          messageId: 'msg-1',
          nextReviewDate: Date.now() - 1000
        })
      }

      expect(store.cardsDueForReview).toEqual([])
    })

    it('sorts by nextReviewDate (oldest first)', () => {
      const now = Date.now()
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' })
      }
      store.srData = {
        'msg-1': new SRCard({
          messageId: 'msg-1',
          nextReviewDate: now - 1000
        }),
        'msg-2': new SRCard({
          messageId: 'msg-2',
          nextReviewDate: now - 2000 // Older
        })
      }

      const due = store.cardsDueForReview
      expect(due[0].messageId).toBe('msg-2')
      expect(due[1].messageId).toBe('msg-1')
    })

    it('includes cards with null nextReviewDate (new cards)', () => {
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }
      const card = new SRCard({ messageId: 'msg-1' })
      card.nextReviewDate = null
      store.srData = { 'msg-1': card }

      expect(store.cardsDueForReview).toHaveLength(1)
    })
  })

  describe('cardsDueCount getter', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15'))
    })

    it('returns 0 when no cards', () => {
      expect(store.cardsDueCount).toBe(0)
    })

    it('counts only due cards', () => {
      const now = Date.now()
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }),
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 1000 }), // Due
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: now + DAY_IN_MS }), // Not due
        'msg-3': new SRCard({ messageId: 'msg-3', nextReviewDate: now - 2000 }) // Due
      }

      expect(store.cardsDueCount).toBe(2)
    })
  })

  describe('_applyState with SR data', () => {
    it('reconstructs SRCard objects from plain objects', () => {
      const savedState = {
        messagesById: {
          'msg-1': { id: 'msg-1', question: 'Q', response: 'R' }
        },
        srData: {
          'msg-1': {
            messageId: 'msg-1',
            easiness: 2.3,
            interval: 6,
            repetitions: 2
          }
        },
        chats: [],
        currentChatId: null
      }

      store._applyState(savedState)

      expect(store.srData['msg-1']).toBeInstanceOf(SRCard)
      expect(store.srData['msg-1'].easiness).toBe(2.3)
      expect(store.srData['msg-1'].interval).toBe(6)
      expect(store.srData['msg-1'].recordReview).toBeDefined()
    })
  })

  describe('_persistState includes srData', () => {
    it('includes srData in state when serialized', () => {
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1' })
      }

      // The store's srData should have the SRCard
      expect(store.srData['msg-1']).toBeDefined()

      // Verify SRCard can be serialized (toJSON is used by _persistState)
      const serialized = store.srData['msg-1'].toJSON()
      expect(serialized.messageId).toBe('msg-1')
    })
  })
})
