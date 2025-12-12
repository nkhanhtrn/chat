import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import CalendarDayModal from '../CalendarDayModal.vue'
import Modal from '../Modal.vue'

describe('CalendarDayModal', () => {
  const mockQuestions = [
    {
      id: 'msg-1',
      question: 'What is Vue?',
      createdAt: new Date('2024-01-15T10:30:00').getTime(),
      chatId: 'chat-1',
      chatName: 'Web Development'
    },
    {
      id: 'msg-2',
      question: 'What is Pinia?',
      createdAt: new Date('2024-01-15T14:45:00').getTime(),
      chatId: 'chat-1',
      chatName: 'Web Development'
    },
    {
      id: 'msg-3',
      question: 'What is Python?',
      createdAt: new Date('2024-01-15T09:00:00').getTime(),
      chatId: 'chat-2',
      chatName: 'Programming Basics'
    }
  ]

  // Use explicit date constructor to avoid timezone issues
  const testDate = new Date(2024, 0, 15, 12, 0, 0) // Jan 15, 2024 at noon local time

  const mountModal = (props = {}) => {
    return mount(CalendarDayModal, {
      props: {
        visible: true,
        date: testDate,
        questions: mockQuestions,
        ...props
      },
      global: {
        stubs: {
          Modal: {
            template: `
              <div v-if="visible" class="modal-stub">
                <div class="modal-title">{{ title }}</div>
                <slot></slot>
              </div>
            `,
            props: ['visible', 'title', 'size']
          }
        }
      }
    })
  }

  describe('rendering', () => {
    it('renders when visible is true', () => {
      const wrapper = mountModal()
      expect(wrapper.find('.modal-stub').exists()).toBe(true)
    })

    it('does not render when visible is false', () => {
      const wrapper = mountModal({ visible: false })
      expect(wrapper.find('.modal-stub').exists()).toBe(false)
    })

    it('displays formatted date as title', () => {
      const wrapper = mountModal()
      // Monday, January 15, 2024 (testDate is local time)
      const title = wrapper.find('.modal-title').text()
      expect(title).toContain('January')
      expect(title).toContain('15')
      expect(title).toContain('2024')
      expect(title).toContain('Monday')
    })

  })

  describe('grouping questions by notebook', () => {
    it('groups questions by notebook', () => {
      const wrapper = mountModal()
      const groups = wrapper.findAll('.notebook-group')
      expect(groups).toHaveLength(2) // Two different notebooks
    })

    it('displays notebook names as group headers', () => {
      const wrapper = mountModal()
      const headers = wrapper.findAll('.notebook-name')
      const headerTexts = headers.map(h => h.text())
      expect(headerTexts).toContain('Web Development')
      expect(headerTexts).toContain('Programming Basics')
    })

    it('sorts groups alphabetically by notebook name', () => {
      const wrapper = mountModal()
      const headers = wrapper.findAll('.notebook-name')
      expect(headers[0].text()).toBe('Programming Basics')
      expect(headers[1].text()).toBe('Web Development')
    })

    it('displays notebook icon in header', () => {
      const wrapper = mountModal()
      const icons = wrapper.findAll('.notebook-icon')
      expect(icons).toHaveLength(2)
    })

    it('displays question count per notebook', () => {
      const wrapper = mountModal()
      const counts = wrapper.findAll('.notebook-count')
      expect(counts).toHaveLength(2)
      // Programming Basics has 1 question, Web Development has 2
      expect(counts[0].text()).toBe('1')
      expect(counts[1].text()).toBe('2')
    })

    it('displays collapse icon in header', () => {
      const wrapper = mountModal()
      const icons = wrapper.findAll('.collapse-icon')
      expect(icons).toHaveLength(2)
      // Default state is expanded (▼)
      expect(icons[0].text()).toBe('▼')
    })
  })

  describe('question list', () => {
    it('displays all questions', () => {
      const wrapper = mountModal()
      const items = wrapper.findAll('.question-item')
      expect(items).toHaveLength(3)
    })

    it('displays question text', () => {
      const wrapper = mountModal()
      const questionTexts = wrapper.findAll('.question-text')
      const texts = questionTexts.map(q => q.text())
      expect(texts).toContain('What is Vue?')
      expect(texts).toContain('What is Pinia?')
      expect(texts).toContain('What is Python?')
    })

    it('displays formatted time for each question', () => {
      const wrapper = mountModal()
      const times = wrapper.findAll('.question-time')
      expect(times.length).toBe(3)
      // Times should be formatted (e.g., "10:30 AM")
      times.forEach(time => {
        expect(time.text()).toMatch(/\d{1,2}:\d{2}/)
      })
    })

    it('sorts questions within each group by time', () => {
      const wrapper = mountModal()
      // Find the Web Development group (has 2 questions)
      const groups = wrapper.findAll('.notebook-group')
      const webDevGroup = groups.find(g => g.find('.notebook-name').text() === 'Web Development')

      const questionItems = webDevGroup.findAll('.question-item')
      const times = questionItems.map(item => item.find('.question-time').text())

      // 10:30 AM should come before 2:45 PM
      expect(times[0]).toContain('10')
      expect(times[1]).toContain('2') // 14:45 = 2:45 PM
    })
  })

  describe('empty state', () => {
    it('shows no questions message when questions array is empty', () => {
      const wrapper = mountModal({ questions: [] })
      expect(wrapper.find('.no-questions').exists()).toBe(true)
      expect(wrapper.text()).toContain('No questions on this day')
    })

    it('does not show no questions message when there are questions', () => {
      const wrapper = mountModal()
      expect(wrapper.find('.no-questions').exists()).toBe(false)
    })
  })

  describe('collapsible notebooks', () => {
    it('all notebooks are expanded by default', () => {
      const wrapper = mountModal()
      const questionLists = wrapper.findAll('.question-list')
      expect(questionLists).toHaveLength(2)
      // All question lists should be visible
      questionLists.forEach(list => {
        expect(list.isVisible()).toBe(true)
      })
    })

    it('collapses notebook when clicking header', async () => {
      const wrapper = mountModal()
      const firstHeader = wrapper.find('.notebook-header')

      await firstHeader.trigger('click')

      // Collapse icon should change to ▶
      expect(firstHeader.find('.collapse-icon').text()).toBe('▶')

      // Question list should be hidden (v-show sets display: none)
      const questionLists = wrapper.findAll('.question-list')
      expect(questionLists[0].attributes('style')).toContain('display: none')
      expect(questionLists[1].attributes('style')).toBeUndefined() // Second should still be visible
    })

    it('expands collapsed notebook when clicking header again', async () => {
      const wrapper = mountModal()
      const firstHeader = wrapper.find('.notebook-header')

      // Collapse
      await firstHeader.trigger('click')
      expect(firstHeader.find('.collapse-icon').text()).toBe('▶')

      // Expand
      await firstHeader.trigger('click')
      expect(firstHeader.find('.collapse-icon').text()).toBe('▼')

      const questionLists = wrapper.findAll('.question-list')
      expect(questionLists[0].isVisible()).toBe(true)
    })

    it('maintains independent collapse state for each notebook', async () => {
      const wrapper = mountModal()
      const headers = wrapper.findAll('.notebook-header')

      // Collapse first notebook
      await headers[0].trigger('click')

      // Collapse second notebook
      await headers[1].trigger('click')

      // Both should be collapsed
      expect(headers[0].find('.collapse-icon').text()).toBe('▶')
      expect(headers[1].find('.collapse-icon').text()).toBe('▶')

      // Expand first notebook
      await headers[0].trigger('click')

      // First should be expanded, second still collapsed
      expect(headers[0].find('.collapse-icon').text()).toBe('▼')
      expect(headers[1].find('.collapse-icon').text()).toBe('▶')
    })
  })

  describe('click interactions', () => {
    it('emits open-question event when clicking a question', async () => {
      const wrapper = mountModal()

      await wrapper.find('.question-item').trigger('click')

      expect(wrapper.emitted('open-question')).toBeTruthy()
      expect(wrapper.emitted('open-question')[0][0]).toEqual({
        chatId: 'chat-2', // Programming Basics is first alphabetically
        questionId: 'msg-3'
      })
    })

    it('emits close event when modal is closed', async () => {
      const wrapper = mount(CalendarDayModal, {
        props: {
          visible: true,
          date: testDate,
          questions: mockQuestions
        },
        global: {
          components: { Modal }
        }
      })

      // The Modal component should emit close
      await wrapper.findComponent(Modal).vm.$emit('close')

      expect(wrapper.emitted('close')).toBeTruthy()
    })
  })

  describe('date formatting', () => {
    it('formats date with full weekday name', () => {
      // Use explicit date constructor to avoid timezone issues
      const mondayDate = new Date(2024, 0, 15, 12, 0, 0) // Monday, Jan 15, 2024 at noon
      const wrapper = mountModal({ date: mondayDate })
      expect(wrapper.find('.modal-title').text()).toContain('Monday')
    })

    it('handles null date gracefully', () => {
      const wrapper = mountModal({ date: null })
      expect(wrapper.find('.modal-title').text()).toBe('')
    })
  })

  describe('time formatting', () => {
    it('formats morning time correctly', () => {
      const morningQuestion = [{
        id: 'msg-1',
        question: 'Morning Q',
        createdAt: new Date('2024-01-15T09:30:00').getTime(),
        chatId: 'chat-1',
        chatName: 'Test'
      }]

      const wrapper = mountModal({ questions: morningQuestion })
      const time = wrapper.find('.question-time').text()
      expect(time).toMatch(/9:30/)
    })

    it('formats afternoon time correctly', () => {
      const afternoonQuestion = [{
        id: 'msg-1',
        question: 'Afternoon Q',
        createdAt: new Date('2024-01-15T15:45:00').getTime(),
        chatId: 'chat-1',
        chatName: 'Test'
      }]

      const wrapper = mountModal({ questions: afternoonQuestion })
      const time = wrapper.find('.question-time').text()
      expect(time).toMatch(/3:45/)
    })

    it('handles missing createdAt gracefully', () => {
      const questionWithoutTime = [{
        id: 'msg-1',
        question: 'No time Q',
        createdAt: null,
        chatId: 'chat-1',
        chatName: 'Test'
      }]

      const wrapper = mountModal({ questions: questionWithoutTime })
      const time = wrapper.find('.question-time').text()
      expect(time).toBe('')
    })
  })
})
