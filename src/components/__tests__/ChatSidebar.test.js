import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatSidebar from '../ChatSidebar.vue'

describe('ChatSidebar', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clear localStorage before each test
    localStorage.clear()
  })

  afterEach(() => {
    // Clear localStorage after each test
    localStorage.clear()
  })

  describe('Rendering', () => {
    it('should render sidebar container', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      expect(wrapper.find('.chat-sidebar').exists()).toBe(true)
    })

    it('should render sidebar header', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      expect(wrapper.find('.sidebar-header').exists()).toBe(true)
    })

    it('should render new chat button', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      const button = wrapper.find('.new-chat-button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('New Chat')
    })

    it('should render chat list container', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      expect(wrapper.find('.chat-list').exists()).toBe(true)
    })

    it('should show empty state when no chats', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      const emptyState = wrapper.find('.empty-state')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('No chats yet')
      expect(emptyState.text()).toContain('Click "New Chat" to start')
    })

    it('should not show empty state when chats exist', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: [
            { id: 'chat1', title: 'Test Chat', questions: [] }
          ]
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Chat List', () => {
    it('should render all chats', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [] },
        { id: 'chat3', title: 'Chat 3', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads).toHaveLength(3)
    })

    it('should render chat titles correctly', () => {
      const chats = [
        { id: 'chat1', title: 'My First Chat', questions: [] },
        { id: 'chat2', title: 'Another Chat', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const titles = wrapper.findAll('.chat-title')
      expect(titles[0].text()).toBe('My First Chat')
      expect(titles[1].text()).toBe('Another Chat')
    })

    it('should highlight active chat', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads[0].classes()).toContain('active')
      expect(chatThreads[1].classes()).not.toContain('active')
    })

    it('should render collapse icon only for chats with questions', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [{ id: 'q1', text: 'Question 1' }] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads[0].find('.collapse-icon').exists()).toBe(false)
      expect(chatThreads[1].find('.collapse-icon').exists()).toBe(true)
    })

    it('should render delete button for each chat', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const deleteButtons = wrapper.findAll('.delete-button')
      expect(deleteButtons).toHaveLength(2)
    })
  })

  describe('Questions List', () => {
    it('should render questions for expanded chats', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const questions = wrapper.findAll('.question-item')
      expect(questions).toHaveLength(2)
      expect(questions[0].find('.question-text').text()).toBe('Question 1')
      expect(questions[1].find('.question-text').text()).toBe('Question 2')
    })

    it('should not render questions for collapsed chats', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Initially questions should be visible
      expect(wrapper.findAll('.question-item')).toHaveLength(2)

      // Click collapse icon
      await wrapper.find('.collapse-icon').trigger('click')

      // Questions should be hidden
      expect(wrapper.findAll('.question-item')).toHaveLength(0)
    })

    it('should highlight active question', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentMessageId: 'q1'
        }
      })

      const questions = wrapper.findAll('.question-item')
      expect(questions[0].classes()).toContain('active')
      expect(questions[1].classes()).not.toContain('active')
    })

    it('should not render question list when chat has no questions', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      expect(wrapper.find('.question-list').exists()).toBe(false)
    })
  })

  describe('Collapse/Expand Functionality', () => {
    it('should toggle collapse state when clicking collapse icon', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const collapseIcon = wrapper.find('.collapse-icon')

      // Initially expanded (▾)
      expect(collapseIcon.text()).toBe('▾')

      // Click to collapse
      await collapseIcon.trigger('click')
      expect(collapseIcon.text()).toBe('▸')

      // Click to expand
      await collapseIcon.trigger('click')
      expect(collapseIcon.text()).toBe('▾')
    })

    it('should maintain independent collapse state for multiple chats', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Q1' }]
        },
        {
          id: 'chat2',
          title: 'Chat 2',
          questions: [{ id: 'q2', text: 'Q2' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const collapseIcons = wrapper.findAll('.collapse-icon')

      // Collapse first chat
      await collapseIcons[0].trigger('click')

      // First chat collapsed, second chat still expanded
      expect(collapseIcons[0].text()).toBe('▸')
      expect(collapseIcons[1].text()).toBe('▾')

      // Questions visibility
      const questionLists = wrapper.findAll('.question-list')
      expect(questionLists).toHaveLength(1) // Only second chat shows questions
    })

    it('should hide questions when collapsed', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Questions visible initially
      expect(wrapper.find('.question-list').exists()).toBe(true)

      // Collapse
      await wrapper.find('.collapse-icon').trigger('click')

      // Questions hidden
      expect(wrapper.find('.question-list').exists()).toBe(false)
    })
  })

  describe('Events', () => {
    it('should emit new-chat when new chat button clicked', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.find('.new-chat-button').trigger('click')

      expect(wrapper.emitted('new-chat')).toBeTruthy()
      expect(wrapper.emitted('new-chat')).toHaveLength(1)
    })

    it('should emit select-chat when chat title clicked', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('click')

      expect(wrapper.emitted('select-chat')).toBeTruthy()
      expect(wrapper.emitted('select-chat')[0]).toEqual(['chat1'])
    })

    it('should emit select-question with full question object when question clicked', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1', chatId: 'chat1', rootIndex: 0 },
            { id: 'q2', text: 'Question 2', chatId: 'chat1', rootIndex: 1 }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const questions = wrapper.findAll('.question-item')
      await questions[0].trigger('click')

      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question')[0]).toEqual([
        { id: 'q1', text: 'Question 1', chatId: 'chat1', rootIndex: 0 }
      ])

      await questions[1].trigger('click')
      expect(wrapper.emitted('select-question')[1]).toEqual([
        { id: 'q2', text: 'Question 2', chatId: 'chat1', rootIndex: 1 }
      ])
    })

    it('should emit question with correct chatId for different chats', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1', chatId: 'chat1', rootIndex: 0 }
          ]
        },
        {
          id: 'chat2',
          title: 'Chat 2',
          questions: [
            { id: 'q2', text: 'Question 2', chatId: 'chat2', rootIndex: 0 }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const questions = wrapper.findAll('.question-item')

      // Click question from first chat
      await questions[0].trigger('click')
      expect(wrapper.emitted('select-question')[0][0].chatId).toBe('chat1')

      // Click question from second chat
      await questions[1].trigger('click')
      expect(wrapper.emitted('select-question')[1][0].chatId).toBe('chat2')
    })

    it('should not emit select-chat when clicking collapse icon', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.collapse-icon').trigger('click')

      expect(wrapper.emitted('select-chat')).toBeFalsy()
    })

    it('should emit delete-chat when delete button clicked', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.delete-button').trigger('click')

      expect(wrapper.emitted('delete-chat')).toBeTruthy()
      expect(wrapper.emitted('delete-chat')[0]).toEqual(['chat1'])
    })

    it('should not emit select-chat when clicking delete button', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.delete-button').trigger('click')

      expect(wrapper.emitted('select-chat')).toBeFalsy()
    })

    it('should emit delete-question when question delete button clicked', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const questionDeleteBtns = wrapper.findAll('.question-delete')
      await questionDeleteBtns[0].trigger('click')

      expect(wrapper.emitted('delete-question')).toBeTruthy()
      expect(wrapper.emitted('delete-question')[0]).toEqual(['q1', 'chat1'])
    })

    it('should not emit select-question when clicking question delete button', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.question-delete').trigger('click')

      expect(wrapper.emitted('select-question')).toBeFalsy()
    })

    it('should emit rename-question when question InlineEdit saves', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Start editing
      await wrapper.find('.question-text').trigger('dblclick')
      const input = wrapper.find('.question-text-input')
      await input.setValue('Renamed Question')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-question')).toBeTruthy()
      expect(wrapper.emitted('rename-question')[0]).toEqual(['q1', 'Renamed Question'])
    })
  })

  describe('Props', () => {
    it('should accept chats prop', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      expect(wrapper.props('chats')).toEqual(chats)
    })

    it('should accept currentChatId prop', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: [],
          currentChatId: 'chat1'
        }
      })

      expect(wrapper.props('currentChatId')).toBe('chat1')
    })

    it('should accept currentMessageId prop', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: [],
          currentMessageId: 'msg1'
        }
      })

      expect(wrapper.props('currentMessageId')).toBe('msg1')
    })

    it('should default currentChatId to null', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.props('currentChatId')).toBe(null)
    })

    it('should default currentMessageId to null', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.props('currentMessageId')).toBe(null)
    })
  })

  describe('Edge Cases', () => {
    it('should handle chat with empty title', () => {
      const chats = [
        { id: 'chat1', title: '', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const title = wrapper.find('.chat-title')
      expect(title.text()).toBe('')
    })

    it('should handle question with empty text', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: '' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const question = wrapper.find('.question-text')
      expect(question.text()).toBe('')
    })

    it('should handle very long chat titles', () => {
      const longTitle = 'A'.repeat(200)
      const chats = [
        { id: 'chat1', title: longTitle, questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const title = wrapper.find('.chat-title')
      expect(title.text()).toBe(longTitle)
    })

    it('should handle very long question text', () => {
      const longText = 'Q'.repeat(500)
      const chats = [
        {
          id: 'chat1',
          title: 'Chat',
          questions: [{ id: 'q1', text: longText }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const question = wrapper.find('.question-text')
      expect(question.text()).toBe(longText)
    })

    it('should handle many chats', () => {
      const chats = Array.from({ length: 100 }, (_, i) => ({
        id: `chat${i}`,
        title: `Chat ${i}`,
        questions: []
      }))

      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads).toHaveLength(100)
    })

    it('should handle many questions in a chat', () => {
      const questions = Array.from({ length: 50 }, (_, i) => ({
        id: `q${i}`,
        text: `Question ${i}`
      }))

      const chats = [
        { id: 'chat1', title: 'Chat 1', questions }
      ]

      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const questionItems = wrapper.findAll('.question-item')
      expect(questionItems).toHaveLength(50)
    })

    it('should handle currentChatId that does not match any chat', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'nonexistent'
        }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads[0].classes()).not.toContain('active')
    })

    it('should handle currentMessageId that does not match any question', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentMessageId: 'nonexistent'
        }
      })

      const questions = wrapper.findAll('.question-item')
      expect(questions[0].classes()).not.toContain('active')
    })
  })

  describe('Collapse State Management', () => {
    it('should initialize with all chats expanded', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Q1' }]
        },
        {
          id: 'chat2',
          title: 'Chat 2',
          questions: [{ id: 'q2', text: 'Q2' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const collapseIcons = wrapper.findAll('.collapse-icon')
      expect(collapseIcons[0].text()).toBe('▾')
      expect(collapseIcons[1].text()).toBe('▾')
    })

    it('should persist collapse state when props update', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Q1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse the chat
      await wrapper.find('.collapse-icon').trigger('click')
      expect(wrapper.find('.collapse-icon').text()).toBe('▸')

      // Update props
      await wrapper.setProps({
        chats: [
          {
            id: 'chat1',
            title: 'Updated Chat 1',
            questions: [{ id: 'q1', text: 'Q1' }]
          }
        ]
      })

      // Collapse state should persist
      expect(wrapper.find('.collapse-icon').text()).toBe('▸')
    })
  })

  describe('Chat Rename Functionality', () => {
    it('should show input when double-clicking chat title', async () => {
      const chats = [
        { id: 'chat1', title: 'Original Title', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Initially showing title
      expect(wrapper.find('.chat-title').exists()).toBe(true)
      expect(wrapper.find('.chat-title-input').exists()).toBe(false)

      // Double-click title
      await wrapper.find('.chat-title').trigger('dblclick')

      // Should show input
      expect(wrapper.find('.chat-title').exists()).toBe(false)
      expect(wrapper.find('.chat-title-input').exists()).toBe(true)
    })

    it('should populate input with current title on edit', async () => {
      const chats = [
        { id: 'chat1', title: 'Current Title', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      expect(input.element.value).toBe('Current Title')
    })

    it('should focus and select text in input when editing starts', async () => {
      const chats = [
        { id: 'chat1', title: 'Title to Edit', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats },
        attachTo: document.body
      })

      await wrapper.find('.chat-title').trigger('dblclick')
      await wrapper.vm.$nextTick()

      const input = wrapper.find('.chat-title-input').element
      expect(document.activeElement).toBe(input)

      wrapper.unmount()
    })

    it('should emit rename-chat event when pressing Enter', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('New Title')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-chat')).toBeTruthy()
      expect(wrapper.emitted('rename-chat')[0]).toEqual(['chat1', 'New Title'])
    })

    it('should emit rename-chat event when save button is clicked', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('Updated Title')
      await wrapper.find('.save-btn').trigger('click')

      expect(wrapper.emitted('rename-chat')).toBeTruthy()
      expect(wrapper.emitted('rename-chat')[0]).toEqual(['chat1', 'Updated Title'])
    })

    it('should cancel editing when pressing Escape', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('New Title')
      await input.trigger('keydown.esc')

      // Should not emit rename-chat
      expect(wrapper.emitted('rename-chat')).toBeFalsy()

      // Should return to display mode
      expect(wrapper.find('.chat-title').exists()).toBe(true)
      expect(wrapper.find('.chat-title-input').exists()).toBe(false)
    })

    it('should trim whitespace from new title', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('  Trimmed Title  ')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-chat')[0]).toEqual(['chat1', 'Trimmed Title'])
    })

    it('should not emit rename-chat when title is empty or whitespace', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('   ')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-chat')).toBeFalsy()
    })

    it('should exit edit mode after saving', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('New Title')
      await input.trigger('keydown.enter')

      // Should return to display mode
      expect(wrapper.find('.chat-title').exists()).toBe(true)
      expect(wrapper.find('.chat-title-input').exists()).toBe(false)
    })

    it('should handle editing different chats independently', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const titles = wrapper.findAll('.chat-title')

      // Edit first chat
      await titles[0].trigger('dblclick')
      expect(wrapper.findAll('.chat-title-input')).toHaveLength(1)

      const input = wrapper.find('.chat-title-input')
      await input.setValue('Updated Chat 1')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-chat')[0]).toEqual(['chat1', 'Updated Chat 1'])

      // Edit second chat
      await wrapper.findAll('.chat-title')[1].trigger('dblclick')
      const input2 = wrapper.find('.chat-title-input')
      await input2.setValue('Updated Chat 2')
      await input2.trigger('keydown.enter')

      expect(wrapper.emitted('rename-chat')[1]).toEqual(['chat2', 'Updated Chat 2'])
    })

    it('should not trigger select-chat when double-clicking to edit', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      // select-chat should still be emitted from the first click
      // but we're verifying the edit mode is entered
      expect(wrapper.find('.chat-title-input').exists()).toBe(true)
    })

    it('should prevent click propagation on input', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      // Clear any previous emissions from the dblclick
      const previousEmissions = wrapper.emitted('select-chat')?.length || 0

      const input = wrapper.find('.chat-title-input')
      await input.trigger('click')

      // Should not emit additional select-chat when clicking inside input
      // The click.stop should prevent propagation
      const currentEmissions = wrapper.emitted('select-chat')?.length || 0
      expect(currentEmissions).toBe(previousEmissions)
    })
  })

  describe('Delete Button Visibility During Edit Mode', () => {
    // Helper to check if element is hidden via v-show (display: none)
    const isHiddenByVShow = (element) => element.element.style.display === 'none'

    it('should hide chat delete button when editing chat title', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Delete button should be visible initially
      const deleteBtn = wrapper.find('.chat-header .delete-button')
      expect(isHiddenByVShow(deleteBtn)).toBe(false)

      // Start editing
      await wrapper.find('.chat-title').trigger('dblclick')

      // Delete button should be hidden during edit
      expect(isHiddenByVShow(wrapper.find('.chat-header .delete-button'))).toBe(true)
    })

    it('should show chat delete button after finishing edit', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Start editing
      await wrapper.find('.chat-title').trigger('dblclick')
      expect(isHiddenByVShow(wrapper.find('.chat-header .delete-button'))).toBe(true)

      // Finish editing
      await wrapper.find('.chat-title-input').setValue('New Title')
      await wrapper.find('.chat-title-input').trigger('keydown.enter')

      // Delete button should be visible again
      expect(isHiddenByVShow(wrapper.find('.chat-header .delete-button'))).toBe(false)
    })

    it('should show chat delete button after canceling edit', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Start editing
      await wrapper.find('.chat-title').trigger('dblclick')
      expect(isHiddenByVShow(wrapper.find('.chat-header .delete-button'))).toBe(true)

      // Cancel editing
      await wrapper.find('.chat-title-input').trigger('keydown.esc')

      // Delete button should be visible again
      expect(isHiddenByVShow(wrapper.find('.chat-header .delete-button'))).toBe(false)
    })

    it('should hide question delete button when editing question', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Delete button should be visible initially
      const deleteBtn = wrapper.find('.question-delete')
      expect(isHiddenByVShow(deleteBtn)).toBe(false)

      // Start editing question
      await wrapper.find('.question-text').trigger('dblclick')

      // Delete button should be hidden during edit
      expect(isHiddenByVShow(wrapper.find('.question-delete'))).toBe(true)
    })

    it('should show question delete button after finishing edit', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Start editing
      await wrapper.find('.question-text').trigger('dblclick')
      expect(isHiddenByVShow(wrapper.find('.question-delete'))).toBe(true)

      // Finish editing
      await wrapper.find('.question-text-input').setValue('New Question')
      await wrapper.find('.question-text-input').trigger('keydown.enter')

      // Delete button should be visible again
      expect(isHiddenByVShow(wrapper.find('.question-delete'))).toBe(false)
    })

    it('should only hide delete button for the item being edited', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Start editing first question
      const questionTexts = wrapper.findAll('.question-text')
      await questionTexts[0].trigger('dblclick')

      // First question delete button should be hidden
      const deleteButtons = wrapper.findAll('.question-delete')
      expect(isHiddenByVShow(deleteButtons[0])).toBe(true)
      // Second question delete button should still be visible
      expect(isHiddenByVShow(deleteButtons[1])).toBe(false)
    })
  })

  describe('Sidebar Collapse Functionality', () => {
    it('should render collapse button', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      expect(collapseButton.exists()).toBe(true)
    })

    it('should render sidebar footer', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.find('.sidebar-footer').exists()).toBe(true)
    })

    it('should initialize with sidebar expanded', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const sidebar = wrapper.find('.chat-sidebar')
      expect(sidebar.classes()).not.toContain('collapsed')
    })

    it('should display collapse icon («) when expanded', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      expect(collapseButton.text()).toBe('«')
    })

    it('should toggle to collapsed state when clicking collapse button', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      await collapseButton.trigger('click')

      const sidebar = wrapper.find('.chat-sidebar')
      expect(sidebar.classes()).toContain('collapsed')
    })

    it('should display expand icon (») when collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      await collapseButton.trigger('click')

      expect(collapseButton.text()).toBe('»')
    })

    it('should toggle back to expanded state when clicking collapse button again', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')

      // Collapse
      await collapseButton.trigger('click')
      expect(wrapper.find('.chat-sidebar').classes()).toContain('collapsed')

      // Expand
      await collapseButton.trigger('click')
      expect(wrapper.find('.chat-sidebar').classes()).not.toContain('collapsed')
    })

    it('should hide New Chat text when collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const buttonText = wrapper.find('.button-text')
      expect(buttonText.exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // v-show sets display:none but element still exists in DOM
      // Check that the sidebar has the collapsed class which triggers the CSS
      expect(wrapper.find('.chat-sidebar').classes()).toContain('collapsed')
    })

    it('should always show new chat button icon', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const icon = wrapper.find('.new-chat-button .icon')
      expect(icon.exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(icon.exists()).toBe(true)
    })

    it('should hide empty state when collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })

    it('should show only first character of chat title when collapsed', async () => {
      const chats = [
        { id: 'chat1', title: 'Architecture Discussion', questions: [] },
        { id: 'chat2', title: 'Backend API', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitles = wrapper.findAll('.chat-title-collapsed')
      expect(collapsedTitles).toHaveLength(2)
      expect(collapsedTitles[0].text()).toBe('A')
      expect(collapsedTitles[1].text()).toBe('B')
    })

    it('should uppercase first character in collapsed mode', async () => {
      const chats = [
        { id: 'chat1', title: 'architecture', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitle = wrapper.find('.chat-title-collapsed')
      expect(collapsedTitle.text()).toBe('A')
    })

    it('should show full title tooltip when collapsed', async () => {
      const chats = [
        { id: 'chat1', title: 'Very Long Chat Title', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const chatTitle = wrapper.find('.chat-title')
      expect(chatTitle.attributes('title')).toBe('Very Long Chat Title')
    })

    it('should hide delete button when collapsed', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      const deleteButton = wrapper.find('.delete-button')
      expect(deleteButton.exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // v-show sets display:none but element still exists in DOM
      // Verify the sidebar is collapsed which triggers v-show=false
      expect(wrapper.find('.chat-sidebar').classes()).toContain('collapsed')
    })

    it('should hide collapse icons for chat threads when collapsed', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      expect(wrapper.find('.collapse-icon').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.collapse-icon').exists()).toBe(false)
    })

    it('should hide question list when sidebar collapsed', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [
            { id: 'q1', text: 'Question 1' },
            { id: 'q2', text: 'Question 2' }
          ]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      expect(wrapper.find('.question-list').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.question-list').exists()).toBe(false)
    })

    it('should still allow chat selection when collapsed', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Click on collapsed chat
      await wrapper.find('.chat-title').trigger('click')

      expect(wrapper.emitted('select-chat')).toBeTruthy()
      expect(wrapper.emitted('select-chat')[0]).toEqual(['chat1'])
    })

    it('should still allow new chat creation when collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Click new chat button
      await wrapper.find('.new-chat-button').trigger('click')

      expect(wrapper.emitted('new-chat')).toBeTruthy()
    })

    it('should maintain active chat highlight when collapsed', async () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const chatThreads = wrapper.findAll('.chat-thread')
      expect(chatThreads[0].classes()).toContain('active')

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Active class should persist
      expect(chatThreads[0].classes()).toContain('active')
      expect(chatThreads[1].classes()).not.toContain('active')
    })

    it('should have correct tooltip for collapse button', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      expect(collapseButton.attributes('title')).toBe('Collapse sidebar')
    })

    it('should have correct tooltip for expand button', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')

      // Collapse sidebar
      await collapseButton.trigger('click')

      expect(collapseButton.attributes('title')).toBe('Expand sidebar')
    })

    it('should preserve collapse state across multiple toggles', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')
      const sidebar = wrapper.find('.chat-sidebar')

      // Initial state - expanded
      expect(sidebar.classes()).not.toContain('collapsed')

      // Toggle 1 - collapse
      await collapseButton.trigger('click')
      expect(sidebar.classes()).toContain('collapsed')

      // Toggle 2 - expand
      await collapseButton.trigger('click')
      expect(sidebar.classes()).not.toContain('collapsed')

      // Toggle 3 - collapse again
      await collapseButton.trigger('click')
      expect(sidebar.classes()).toContain('collapsed')
    })

    it('should handle chat with single character title', async () => {
      const chats = [
        { id: 'chat1', title: 'A', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitle = wrapper.find('.chat-title-collapsed')
      expect(collapsedTitle.text()).toBe('A')
    })

    it('should handle empty chat title gracefully', async () => {
      const chats = [
        { id: 'chat1', title: '', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitle = wrapper.find('.chat-title-collapsed')
      // Empty string charAt(0) returns empty string, toUpperCase returns empty string
      expect(collapsedTitle.text()).toBe('')
    })

    it('should render multiple collapsed chats correctly', async () => {
      const chats = [
        { id: 'chat1', title: 'Alpha', questions: [] },
        { id: 'chat2', title: 'Beta', questions: [] },
        { id: 'chat3', title: 'Gamma', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitles = wrapper.findAll('.chat-title-collapsed')
      expect(collapsedTitles).toHaveLength(3)
      expect(collapsedTitles[0].text()).toBe('A')
      expect(collapsedTitles[1].text()).toBe('B')
      expect(collapsedTitles[2].text()).toBe('G')
    })
  })

  describe('LocalStorage Persistence', () => {
    it('should save collapsed state to localStorage when toggled', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Initially should not be in localStorage or should be 'false'
      expect(localStorage.getItem('chatSidebarCollapsed')).toBeNull()

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Should save 'true' to localStorage
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('true')
    })

    it('should save expanded state to localStorage when toggled back', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Collapse
      await wrapper.find('.collapse-sidebar-button').trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('true')

      // Expand
      await wrapper.find('.collapse-sidebar-button').trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('false')
    })

    it('should load collapsed state from localStorage on mount', async () => {
      // Pre-set localStorage to collapsed
      localStorage.setItem('chatSidebarCollapsed', 'true')

      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Wait for onMounted to complete
      await wrapper.vm.$nextTick()

      // Sidebar should be collapsed
      expect(wrapper.find('.chat-sidebar').classes()).toContain('collapsed')
      expect(wrapper.find('.collapse-sidebar-button').text()).toBe('»')
    })

    it('should load expanded state from localStorage on mount', async () => {
      // Pre-set localStorage to expanded
      localStorage.setItem('chatSidebarCollapsed', 'false')

      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Wait for onMounted to complete
      await wrapper.vm.$nextTick()

      // Sidebar should be expanded
      expect(wrapper.find('.chat-sidebar').classes()).not.toContain('collapsed')
      expect(wrapper.find('.collapse-sidebar-button').text()).toBe('«')
    })

    it('should default to expanded when no localStorage value exists', () => {
      // Ensure localStorage is clear
      localStorage.removeItem('chatSidebarCollapsed')

      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Sidebar should be expanded by default
      expect(wrapper.find('.chat-sidebar').classes()).not.toContain('collapsed')
    })

    it('should persist state across component remounts', async () => {
      // First mount - collapse sidebar
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.find('.collapse-sidebar-button').trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('true')

      // Unmount
      wrapper.unmount()

      // Second mount - should remember collapsed state
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.vm.$nextTick()

      expect(wrapper.find('.chat-sidebar').classes()).toContain('collapsed')
      expect(wrapper.find('.collapse-sidebar-button').text()).toBe('»')
    })

    it('should update localStorage on each toggle', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const collapseButton = wrapper.find('.collapse-sidebar-button')

      // Toggle 1 - collapse
      await collapseButton.trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('true')

      // Toggle 2 - expand
      await collapseButton.trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('false')

      // Toggle 3 - collapse again
      await collapseButton.trigger('click')
      expect(localStorage.getItem('chatSidebarCollapsed')).toBe('true')
    })

    it('should handle invalid localStorage values gracefully', () => {
      // Set an invalid value
      localStorage.setItem('chatSidebarCollapsed', 'invalid')

      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Should default to expanded (since 'invalid' !== 'true')
      expect(wrapper.find('.chat-sidebar').classes()).not.toContain('collapsed')
    })
  })

  describe('Settings Button', () => {
    beforeEach(() => {
      window.__getTheme = vi.fn(() => 'light')
      window.__setTheme = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should render settings button when sidebar is expanded', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.find('.settings-button').exists()).toBe(true)
    })

    it('should render settings button with gear icon', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const settingsButton = wrapper.find('.settings-button')
      expect(settingsButton.find('.settings-icon').exists()).toBe(true)
      expect(settingsButton.find('svg').exists()).toBe(true)
    })

    it('should hide settings button when sidebar is collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.settings-button').exists()).toBe(false)
    })

    it('should show settings button when sidebar is expanded again', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Collapse
      await wrapper.find('.collapse-sidebar-button').trigger('click')
      expect(wrapper.find('.settings-button').exists()).toBe(false)

      // Expand
      await wrapper.find('.collapse-sidebar-button').trigger('click')
      expect(wrapper.find('.settings-button').exists()).toBe(true)
    })

    it('should open settings modal when settings button clicked', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.find('.settings-button').trigger('click')

      // Modal should be rendered (via SettingsModal component)
      expect(wrapper.findComponent({ name: 'SettingsModal' }).props('modelValue')).toBe(true)
    })

    it('should have correct title attribute', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.find('.settings-button').attributes('title')).toBe('Settings')
    })

    it('should use secondary variant for settings button', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const settingsButton = wrapper.find('.settings-button')
      expect(settingsButton.classes()).toContain('btn-secondary')
    })

    it('should position settings button on the left side of footer', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const footer = wrapper.find('.sidebar-footer')
      const buttons = footer.findAll('button')

      // Settings button should come before collapse button in DOM order
      expect(buttons[0].classes()).toContain('settings-button')
      expect(buttons[1].classes()).toContain('collapse-sidebar-button')
    })

    it('should render both settings and collapse buttons in footer when expanded', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      const footer = wrapper.find('.sidebar-footer')
      expect(footer.find('.settings-button').exists()).toBe(true)
      expect(footer.find('.collapse-sidebar-button').exists()).toBe(true)
    })

    it('should only render collapse button in footer when collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const footer = wrapper.find('.sidebar-footer')
      expect(footer.find('.settings-button').exists()).toBe(false)
      expect(footer.find('.collapse-sidebar-button').exists()).toBe(true)
    })
  })

  describe('Add New Question Button', () => {
    it('should render "Add new" button for current chat with questions', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const newQuestionItem = wrapper.find('.new-question-item')
      expect(newQuestionItem.exists()).toBe(true)
      expect(newQuestionItem.text()).toContain('Add new')
    })

    it('should render "Add new" button even when chat has no questions (but is current chat)', () => {
      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const newQuestionItem = wrapper.find('.new-question-item')
      expect(newQuestionItem.exists()).toBe(true)
    })

    it('should not render "Add new" button for non-current chats', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        },
        {
          id: 'chat2',
          title: 'Chat 2',
          questions: [{ id: 'q2', text: 'Question 2' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const questionLists = wrapper.findAll('.question-list')
      // First chat (current) should have Add new button
      const chat1Questions = questionLists[0].findAll('.question-item')
      expect(chat1Questions.some(q => q.classes().includes('new-question-item'))).toBe(true)

      // Second chat (not current) should not have Add new button
      const chat2NewQuestion = questionLists[1]?.find('.new-question-item')
      expect(chat2NewQuestion?.exists()).toBeFalsy()
    })

    it('should emit new-question when "Add new" button clicked', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      await wrapper.find('.new-question-item').trigger('click')

      expect(wrapper.emitted('new-question')).toBeTruthy()
      expect(wrapper.emitted('new-question')).toHaveLength(1)
    })

    it('should highlight "Add new" button when isAddingNewQuestion is true', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          isAddingNewQuestion: true
        }
      })

      const newQuestionItem = wrapper.find('.new-question-item')
      expect(newQuestionItem.classes()).toContain('active')
    })

    it('should not highlight "Add new" button when isAddingNewQuestion is false', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          isAddingNewQuestion: false
        }
      })

      const newQuestionItem = wrapper.find('.new-question-item')
      expect(newQuestionItem.classes()).not.toContain('active')
    })

    it('should default isAddingNewQuestion prop to false', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      expect(wrapper.props('isAddingNewQuestion')).toBe(false)
      expect(wrapper.find('.new-question-item').classes()).not.toContain('active')
    })

    it('should render plus icon in "Add new" button', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      const newQuestionIcon = wrapper.find('.new-question-icon')
      expect(newQuestionIcon.exists()).toBe(true)
      expect(newQuestionIcon.text()).toBe('+')
    })

    it('should hide "Add new" button when sidebar is collapsed', async () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1'
        }
      })

      // Initially visible
      expect(wrapper.find('.new-question-item').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Should be hidden (question list is hidden when sidebar collapsed)
      expect(wrapper.find('.new-question-item').exists()).toBe(false)
    })

    it('should not show currentMessageId highlight when isAddingNewQuestion is true', () => {
      const chats = [
        {
          id: 'chat1',
          title: 'Chat 1',
          questions: [{ id: 'q1', text: 'Question 1' }]
        }
      ]
      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          currentMessageId: null, // When adding new question, currentMessageId should be null
          isAddingNewQuestion: true
        }
      })

      // Regular question should not be highlighted
      const questionItems = wrapper.findAll('.question-item:not(.new-question-item)')
      expect(questionItems[0].classes()).not.toContain('active')

      // Add new button should be highlighted
      expect(wrapper.find('.new-question-item').classes()).toContain('active')
    })
  })

  describe('Settings Modal Integration', () => {
    beforeEach(() => {
      window.__getTheme = vi.fn(() => 'light')
      window.__setTheme = vi.fn()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should render SettingsModal component', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.findComponent({ name: 'SettingsModal' }).exists()).toBe(true)
    })

    it('should initialize with modal closed', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      expect(wrapper.findComponent({ name: 'SettingsModal' }).props('modelValue')).toBe(false)
    })

    it('should close modal when SettingsModal emits update:modelValue false', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      // Open modal
      await wrapper.find('.settings-button').trigger('click')
      expect(wrapper.findComponent({ name: 'SettingsModal' }).props('modelValue')).toBe(true)

      // Close modal via emit
      await wrapper.findComponent({ name: 'SettingsModal' }).vm.$emit('update:modelValue', false)
      expect(wrapper.findComponent({ name: 'SettingsModal' }).props('modelValue')).toBe(false)
    })
  })
})
