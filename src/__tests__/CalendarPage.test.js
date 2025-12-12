import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import CalendarPage from '../views/CalendarPage.vue'
import { useChatStore } from '../stores/chat.js'
import Message from '../stores/Message.js'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush
    })
  }
})

describe('CalendarPage', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
  })

  const mountCalendarPage = (storeSetup = () => {}) => {
    const store = useChatStore()
    storeSetup(store)

    return mount(CalendarPage, {
      global: {
        stubs: {
          CalendarDayModal: {
            template: `
              <div v-if="visible" class="modal-stub">
                <div class="modal-date">{{ date }}</div>
                <div class="modal-questions">{{ questions.length }} questions</div>
              </div>
            `,
            props: ['visible', 'date', 'questions'],
            emits: ['close', 'open-question']
          }
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders calendar header with title', () => {
      const wrapper = mountCalendarPage()
      expect(wrapper.find('.calendar-header h1').text()).toBe('Activity Calendar')
    })

    it('renders month navigation buttons', () => {
      const wrapper = mountCalendarPage()
      expect(wrapper.findAll('.month-nav-btn')).toHaveLength(2)
    })

    it('renders weekday headers', () => {
      const wrapper = mountCalendarPage()
      const headers = wrapper.findAll('.weekday-header')
      expect(headers).toHaveLength(7)
      expect(headers[0].text()).toBe('Sun')
      expect(headers[6].text()).toBe('Sat')
    })

    it('renders calendar grid with days', () => {
      const wrapper = mountCalendarPage()
      const days = wrapper.findAll('.calendar-day')
      // Should have at least 28 days (minimum for a month) plus empty cells
      expect(days.length).toBeGreaterThanOrEqual(28)
    })

    it('displays current month and year', () => {
      const wrapper = mountCalendarPage()
      const monthTitle = wrapper.find('.month-title').text()
      const now = new Date()
      const expectedMonth = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      expect(monthTitle).toBe(expectedMonth)
    })
  })

  describe('month navigation', () => {
    it('navigates to previous month when clicking left arrow', async () => {
      const wrapper = mountCalendarPage()
      const now = new Date()
      const expectedPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      await wrapper.findAll('.month-nav-btn')[0].trigger('click')

      expect(wrapper.find('.month-title').text()).toBe(expectedPrevMonth)
    })

    it('navigates to next month when clicking right arrow', async () => {
      const wrapper = mountCalendarPage()
      const now = new Date()
      const expectedNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      await wrapper.findAll('.month-nav-btn')[1].trigger('click')

      expect(wrapper.find('.month-title').text()).toBe(expectedNextMonth)
    })
  })

  describe('question counts', () => {
    it('shows question count badge for days with questions', () => {
      const today = new Date()
      const todayTimestamp = today.getTime()

      const wrapper = mountCalendarPage((store) => {
        const chatId = 'chat-1'
        const msgId = 'msg-1'
        store.chats = [{ id: chatId, name: 'Test Notebook', rootMessageIds: [msgId] }]
        store.messagesById = {
          [msgId]: new Message({
            id: msgId,
            question: 'Test question',
            response: 'Test response',
            createdAt: todayTimestamp
          })
        }
      })

      const daysWithQuestions = wrapper.findAll('.calendar-day.has-questions')
      expect(daysWithQuestions.length).toBeGreaterThanOrEqual(1)

      const badge = daysWithQuestions[0].find('.question-count')
      expect(badge.exists()).toBe(true)
      expect(badge.text()).toBe('1')
    })

    it('does not show badge for days without questions', () => {
      const wrapper = mountCalendarPage()
      const daysWithoutQuestions = wrapper.findAll('.calendar-day:not(.has-questions):not(.empty)')

      daysWithoutQuestions.forEach(day => {
        expect(day.find('.question-count').exists()).toBe(false)
      })
    })

    it('counts multiple questions on the same day', () => {
      const today = new Date()
      const todayTimestamp = today.getTime()

      const wrapper = mountCalendarPage((store) => {
        const chatId = 'chat-1'
        store.chats = [{ id: chatId, name: 'Test Notebook', rootMessageIds: ['msg-1', 'msg-2', 'msg-3'] }]
        store.messagesById = {
          'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', createdAt: todayTimestamp }),
          'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2', createdAt: todayTimestamp }),
          'msg-3': new Message({ id: 'msg-3', question: 'Q3', response: 'R3', createdAt: todayTimestamp })
        }
      })

      const dayWithQuestions = wrapper.find('.calendar-day.has-questions')
      expect(dayWithQuestions.find('.question-count').text()).toBe('3')
    })

    it('counts questions from multiple notebooks', () => {
      const today = new Date()
      const todayTimestamp = today.getTime()

      const wrapper = mountCalendarPage((store) => {
        store.chats = [
          { id: 'chat-1', name: 'Notebook 1', rootMessageIds: ['msg-1'] },
          { id: 'chat-2', name: 'Notebook 2', rootMessageIds: ['msg-2'] }
        ]
        store.messagesById = {
          'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', createdAt: todayTimestamp }),
          'msg-2': new Message({ id: 'msg-2', question: 'Q2', response: 'R2', createdAt: todayTimestamp })
        }
      })

      const dayWithQuestions = wrapper.find('.calendar-day.has-questions')
      expect(dayWithQuestions.find('.question-count').text()).toBe('2')
    })

    it('includes child messages in count', () => {
      const today = new Date()
      const todayTimestamp = today.getTime()

      const wrapper = mountCalendarPage((store) => {
        store.chats = [{ id: 'chat-1', name: 'Test', rootMessageIds: ['msg-1'] }]
        store.messagesById = {
          'msg-1': new Message({
            id: 'msg-1',
            question: 'Parent',
            response: 'R1',
            createdAt: todayTimestamp,
            childIds: ['msg-2']
          }),
          'msg-2': new Message({
            id: 'msg-2',
            question: 'Child',
            response: 'R2',
            createdAt: todayTimestamp,
            parentId: 'msg-1'
          })
        }
      })

      const dayWithQuestions = wrapper.find('.calendar-day.has-questions')
      expect(dayWithQuestions.find('.question-count').text()).toBe('2')
    })
  })

  describe('today highlight', () => {
    it('highlights today with special class', () => {
      const wrapper = mountCalendarPage()
      const today = wrapper.find('.calendar-day.today')
      expect(today.exists()).toBe(true)
    })
  })

  describe('day click interaction', () => {
    it('does not open modal when clicking day without questions', async () => {
      const wrapper = mountCalendarPage()

      const emptyDay = wrapper.find('.calendar-day:not(.has-questions):not(.empty)')
      await emptyDay.trigger('click')

      expect(wrapper.find('.modal-stub').exists()).toBe(false)
    })

    it('opens modal when clicking day with questions', async () => {
      const today = new Date()
      const todayTimestamp = today.getTime()

      const wrapper = mountCalendarPage((store) => {
        store.chats = [{ id: 'chat-1', name: 'Test', rootMessageIds: ['msg-1'] }]
        store.messagesById = {
          'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', createdAt: todayTimestamp })
        }
      })

      const dayWithQuestions = wrapper.find('.calendar-day.has-questions')
      await dayWithQuestions.trigger('click')

      expect(wrapper.find('.modal-stub').exists()).toBe(true)
    })
  })

  describe('back navigation', () => {
    it('navigates to home when clicking back button', async () => {
      const wrapper = mountCalendarPage()

      await wrapper.find('.nav-btn').trigger('click')

      expect(mockPush).toHaveBeenCalledWith({ name: 'home' })
    })
  })

  describe('empty calendar days', () => {
    it('renders empty cells before first day of month', () => {
      const wrapper = mountCalendarPage()
      const emptyDays = wrapper.findAll('.calendar-day.empty')
      // Empty days should exist (depends on which day of week the month starts)
      // We just check that empty days don't have a day number
      emptyDays.forEach(day => {
        expect(day.find('.day-number').exists()).toBe(false)
      })
    })
  })
})
