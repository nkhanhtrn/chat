import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import DevToolbar from '../DevToolbar.vue'
import { useChatStore } from '../../stores/chat.js'
import SRCard from '../../stores/SRCard.js'
import Message from '../../stores/Message.js'

// Mock storage
vi.mock('../../services/storage.js', () => ({
  saveChatState: vi.fn(),
  loadChatState: vi.fn(() => null),
  clearAllStorage: vi.fn(),
  resolveConflict: vi.fn()
}))

// Mock the composable
vi.mock('../../composables/useSpacedRepetition.js', () => ({
  useSpacedRepetition: () => ({
    uninitializedCount: { value: 0 },
    initializeAllExisting: vi.fn(),
    getMissingSummaryCountInNotebook: vi.fn(() => 0),
    generateSummariesForNotebook: vi.fn(),
    getSummaryCountInNotebook: vi.fn(() => 0),
    clearSummariesInNotebook: vi.fn()
  })
}))

describe('DevToolbar', () => {
  let wrapper
  let store

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useChatStore()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    vi.useRealTimers()
  })

  const mountComponent = (options = {}) => {
    return mount(DevToolbar, {
      global: {
        provide: {
          triggerStaleDataBanner: vi.fn()
        },
        stubs: {
          Button: {
            template: '<button :disabled="disabled" @click="$emit(\'click\')"><slot /></button>',
            props: ['disabled', 'variant', 'title']
          }
        }
      },
      ...options
    })
  }

  describe('Shuffle Due Button', () => {
    it('renders shuffle due button', () => {
      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))
      expect(shuffleButton).toBeDefined()
    })

    it('shows count of due cards in button text', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: Date.now() - 1000 }),
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: Date.now() - 2000 })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))
      expect(shuffleButton.text()).toContain('(2)')
    })

    it('is disabled when no cards are due', () => {
      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))
      expect(shuffleButton.attributes('disabled')).toBeDefined()
    })

    it('is enabled when cards are due', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: Date.now() - 1000 })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))
      expect(shuffleButton.attributes('disabled')).toBeUndefined()
    })

    it('shuffles due cards when clicked', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }),
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 3000 }),
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: now - 2000 }),
        'msg-3': new SRCard({ messageId: 'msg-3', nextReviewDate: now - 1000 })
      }

      // Store original dates
      const originalDates = {
        'msg-1': store.srData['msg-1'].nextReviewDate,
        'msg-2': store.srData['msg-2'].nextReviewDate,
        'msg-3': store.srData['msg-3'].nextReviewDate
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // Check that nextReviewDate values have changed
      const newDates = {
        'msg-1': store.srData['msg-1'].nextReviewDate,
        'msg-2': store.srData['msg-2'].nextReviewDate,
        'msg-3': store.srData['msg-3'].nextReviewDate
      }

      // All dates should be different from original (they get reassigned)
      const datesChanged = Object.keys(originalDates).some(
        id => originalDates[id] !== newDates[id]
      )
      expect(datesChanged).toBe(true)

      // All new dates should be in the past (due)
      Object.values(newDates).forEach(date => {
        expect(date).toBeLessThanOrEqual(now)
      })
    })

    it('only shuffles cards due today, not future cards', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()
      const DAY_IN_MS = 24 * 60 * 60 * 1000

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 1000 }), // Due today
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: now + DAY_IN_MS * 2 }) // Future
      }

      const futureDate = store.srData['msg-2'].nextReviewDate

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // Future card should not be modified
      expect(store.srData['msg-2'].nextReviewDate).toBe(futureDate)
    })

    it('assigns unique timestamps to shuffled cards', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' }),
        'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 3000 }),
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: now - 2000 }),
        'msg-3': new SRCard({ messageId: 'msg-3', nextReviewDate: now - 1000 })
      }

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // All dates should be unique
      const dates = Object.values(store.srData).map(card => card.nextReviewDate)
      const uniqueDates = new Set(dates)
      expect(uniqueDates.size).toBe(dates.length)
    })

    it('includes cards due later today', async () => {
      vi.useFakeTimers()
      // Set time to noon
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()

      // Create a card due at 11pm today (still today but in the future)
      const elevenPmToday = new Date('2024-01-15T23:00:00').getTime()

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' }),
        'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 1000 }), // Due now
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: elevenPmToday }) // Due later today
      }

      const originalDate1 = store.srData['msg-1'].nextReviewDate
      const originalDate2 = store.srData['msg-2'].nextReviewDate

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // Both cards should have been shuffled (dates changed)
      const bothChanged =
        store.srData['msg-1'].nextReviewDate !== originalDate1 ||
        store.srData['msg-2'].nextReviewDate !== originalDate2
      expect(bothChanged).toBe(true)
    })

    it('does nothing when there are no due cards', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const DAY_IN_MS = 24 * 60 * 60 * 1000

      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: Date.now() + DAY_IN_MS * 2 })
      }

      const originalDate = store.srData['msg-1'].nextReviewDate

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // Card should not be modified
      expect(store.srData['msg-1'].nextReviewDate).toBe(originalDate)
    })

    it('skips cards for deleted messages', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15T12:00:00'))
      const now = Date.now()

      // Only msg-1 exists in messagesById
      store.messagesById = {
        'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1' })
      }
      // But srData has both msg-1 and msg-2 (orphaned)
      store.srData = {
        'msg-1': new SRCard({ messageId: 'msg-1', nextReviewDate: now - 1000 }),
        'msg-2': new SRCard({ messageId: 'msg-2', nextReviewDate: now - 2000 })
      }

      const orphanedDate = store.srData['msg-2'].nextReviewDate

      wrapper = mountComponent()
      const buttons = wrapper.findAll('button')
      const shuffleButton = buttons.find(btn => btn.text().includes('Shuffle Due'))

      await shuffleButton.trigger('click')

      // Orphaned card should not be modified
      expect(store.srData['msg-2'].nextReviewDate).toBe(orphanedDate)
    })
  })
})
