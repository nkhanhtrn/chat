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
    }),
    useRoute: () => ({
      name: 'calendar',
      params: {}
    })
  }
})

// Mock AppLayout to avoid route dependency issues
vi.mock('../components/AppLayout.vue', () => ({
  default: {
    name: 'AppLayout',
    template: '<div class="calendar-page"><slot /></div>',
    props: ['storageKey']
  }
}))

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

  describe('date picker', () => {
    it('does not show date picker dropdown by default', () => {
      const wrapper = mountCalendarPage()
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
    })

    it('shows date picker dropdown when clicking month title', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(true)
    })

    it('hides date picker dropdown when clicking month title again', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(true)
      await wrapper.find('.month-title').trigger('click')
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
    })

    it('renders month select with all 12 months', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')

      const monthSelect = wrapper.findAll('.date-select')[0]
      const options = monthSelect.findAll('option')
      expect(options).toHaveLength(12)
      expect(options[0].text()).toBe('January')
      expect(options[11].text()).toBe('December')
    })

    it('renders year select with available years', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')

      const yearSelect = wrapper.findAll('.date-select')[1]
      const options = yearSelect.findAll('option')
      // Should have at least current year
      expect(options.length).toBeGreaterThanOrEqual(1)

      const currentYear = new Date().getFullYear()
      const yearValues = options.map(opt => parseInt(opt.element.value))
      expect(yearValues).toContain(currentYear)
    })

    it('includes years from message data in year select', async () => {
      // Create a message from 2020
      const oldDate = new Date(2020, 5, 15).getTime()

      const wrapper = mountCalendarPage((store) => {
        store.chats = [{ id: 'chat-1', name: 'Test', rootMessageIds: ['msg-1'] }]
        store.messagesById = {
          'msg-1': new Message({ id: 'msg-1', question: 'Q1', response: 'R1', createdAt: oldDate })
        }
      })

      await wrapper.find('.month-title').trigger('click')

      const yearSelect = wrapper.findAll('.date-select')[1]
      const options = yearSelect.findAll('option')
      const yearValues = options.map(opt => parseInt(opt.element.value))
      expect(yearValues).toContain(2020)
    })

    it('navigates to selected month/year when clicking Go', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')

      // Select January (index 0) and current year
      const monthSelect = wrapper.findAll('.date-select')[0]
      const yearSelect = wrapper.findAll('.date-select')[1]
      const currentYear = new Date().getFullYear()

      await monthSelect.setValue('0')
      await yearSelect.setValue(String(currentYear))

      // Click Go button
      await wrapper.find('.date-picker-apply').trigger('click')

      // Should now show January of current year
      const monthTitle = wrapper.find('.month-title').text()
      expect(monthTitle).toContain('January')
      expect(monthTitle).toContain(String(currentYear))

      // Dropdown should be closed
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
    })

    it('syncs selects with current date when opening picker', async () => {
      const wrapper = mountCalendarPage()
      const now = new Date()

      await wrapper.find('.month-title').trigger('click')

      const monthSelect = wrapper.findAll('.date-select')[0]
      const yearSelect = wrapper.findAll('.date-select')[1]

      expect(parseInt(monthSelect.element.value)).toBe(now.getMonth())
      expect(parseInt(yearSelect.element.value)).toBe(now.getFullYear())
    })

    it('renders Today button in date picker', async () => {
      const wrapper = mountCalendarPage()
      await wrapper.find('.month-title').trigger('click')

      const todayBtn = wrapper.find('.today-btn')
      expect(todayBtn.exists()).toBe(true)
      expect(todayBtn.text()).toBe('Today')
    })

    it('navigates to current month when clicking Today button', async () => {
      const wrapper = mountCalendarPage()
      const now = new Date()
      const expectedMonth = new Date(now.getFullYear(), now.getMonth(), 1)
        .toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

      // Navigate to a different month first
      await wrapper.findAll('.month-nav-btn')[0].trigger('click')
      await wrapper.findAll('.month-nav-btn')[0].trigger('click')

      // Open date picker and click Today
      await wrapper.find('.month-title').trigger('click')
      await wrapper.find('.today-btn').trigger('click')

      // Should show current month
      expect(wrapper.find('.month-title').text()).toBe(expectedMonth)

      // Dropdown should be closed
      expect(wrapper.find('.date-picker-dropdown').exists()).toBe(false)
    })

    it('shows dropdown icon in month title', () => {
      const wrapper = mountCalendarPage()
      expect(wrapper.find('.dropdown-icon').exists()).toBe(true)
    })

    it('adds open class to dropdown icon when picker is open', async () => {
      const wrapper = mountCalendarPage()

      expect(wrapper.find('.dropdown-icon').classes()).not.toContain('open')

      await wrapper.find('.month-title').trigger('click')

      expect(wrapper.find('.dropdown-icon').classes()).toContain('open')
    })
  })
})
