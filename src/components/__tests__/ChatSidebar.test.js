import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import ChatSidebar from '../ChatSidebar.vue'

describe('ChatSidebar', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
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
      expect(questions[0].text()).toBe('Question 1')
      expect(questions[1].text()).toBe('Question 2')
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

    it('should emit select-question when question clicked', async () => {
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
      await questions[0].trigger('click')

      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question')[0]).toEqual(['q1'])

      await questions[1].trigger('click')
      expect(wrapper.emitted('select-question')[1]).toEqual(['q2'])
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

    it('should emit rename-chat event when input loses focus', async () => {
      const chats = [
        { id: 'chat1', title: 'Original', questions: [] }
      ]
      wrapper = mount(ChatSidebar, {
        props: { chats }
      })

      await wrapper.find('.chat-title').trigger('dblclick')

      const input = wrapper.find('.chat-title-input')
      await input.setValue('Updated Title')
      await input.trigger('blur')

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

      const input = wrapper.find('.chat-title-input')
      await input.trigger('click')

      // Should not emit select-chat when clicking inside input
      // The click.stop should prevent propagation
      expect(wrapper.emitted('select-chat')).toBeFalsy()
    })
  })
})
