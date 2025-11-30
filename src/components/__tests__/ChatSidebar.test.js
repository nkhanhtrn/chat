import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatSidebar from '../ChatSidebar.vue'
import { useChatStore } from '../../stores/chat.js'

describe('ChatSidebar', () => {
  let wrapper
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clear localStorage before each test
    localStorage.clear()

    // Setup pinia
    setActivePinia(createPinia())
    chatStore = useChatStore()
  })

  afterEach(() => {
    // Clear localStorage after each test
    localStorage.clear()
  })

  // Helper to create mock chat data
  const createMockChats = (chatsConfig) => {
    return chatsConfig.map(config => ({
      id: config.id,
      title: config.title,
      questions: config.questions || []
    }))
  }

  // Helper to setup messages in store
  const setupMessagesInStore = (messages) => {
    const Message = require('../../stores/Message.js').default
    messages.forEach(msg => {
      chatStore.messagesById[msg.id] = new Message(msg)
    })
  }

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

    it('should render back home button', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      const button = wrapper.find('.back-home-button')
      expect(button.exists()).toBe(true)
      expect(button.text()).toContain('Notebooks')
    })

    it('should render chat list container', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })
      expect(wrapper.find('.chat-list').exists()).toBe(true)
    })

    it('should show empty state when no questions', () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: [{ id: 'chat1', title: 'Chat', questions: [] }],
          currentChatId: 'chat1'
        }
      })
      const emptyState = wrapper.find('.empty-state')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('No questions yet')
    })

    it('should not show empty state when questions exist', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      wrapper = mount(ChatSidebar, {
        props: {
          chats: [{
            id: 'chat1',
            title: 'Test Chat',
            questions: [{ id: 'q1', text: 'Question 1' }]
          }],
          currentChatId: 'chat1'
        }
      })
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Root Messages List', () => {
    it('should render all root messages', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' },
        { id: 'q2', question: 'Question 2', response: '' },
        { id: 'q3', question: 'Question 3', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' },
          { id: 'q3', text: 'Question 3' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const rootItems = wrapper.findAll('.tree-item-container')
      expect(rootItems).toHaveLength(3)
    })

    it('should render root message titles correctly', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'My First Question', response: '' },
        { id: 'q2', question: 'Another Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'My First Question' },
          { id: 'q2', text: 'Another Question' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const titles = wrapper.findAll('.tree-item-text')
      expect(titles[0].text()).toBe('My First Question')
      expect(titles[1].text()).toBe('Another Question')
    })

    it('should highlight current root message', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' },
        { id: 'q2', question: 'Question 2', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          currentMessageId: 'q1'
        }
      })

      const rootHeaders = wrapper.findAll('.root-header')
      expect(rootHeaders[0].classes()).toContain('is-current-root')
      expect(rootHeaders[1].classes()).not.toContain('is-current-root')
    })

    it('should render delete button for each root message', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' },
        { id: 'q2', question: 'Question 2', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const deleteButtons = wrapper.findAll('.root-header .delete-button')
      expect(deleteButtons).toHaveLength(2)
    })
  })

  describe('Tree Expansion', () => {
    it('should render children tree for root messages with children when expanded', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' },
        { id: 'q2', question: 'Question 2', response: '', childIds: [] }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // q1 should have children tree (auto-expanded because currentMessageId is q1)
      const childrenTrees = wrapper.findAll('.tree-children')
      expect(childrenTrees.length).toBeGreaterThanOrEqual(1)
    })

    it('should toggle tree expansion when clicking root item', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Initially expanded (because currentMessageId is in this tree)
      expect(wrapper.find('.tree-children').exists()).toBe(true)

      // Click root item to collapse
      await wrapper.find('.tree-item').trigger('click')
      expect(wrapper.find('.tree-children').exists()).toBe(false)

      // Click again to expand
      await wrapper.find('.tree-item').trigger('click')
      expect(wrapper.find('.tree-children').exists()).toBe(true)
    })

    it('should auto-expand tree when current message is a child', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          currentMessageId: 'child1'
        }
      })

      // Tree should be auto-expanded
      expect(wrapper.find('.tree-children').exists()).toBe(true)
    })
  })

  describe('Events', () => {
    it('should emit back-home when back home button clicked', async () => {
      wrapper = mount(ChatSidebar, {
        props: {
          chats: []
        }
      })

      await wrapper.find('.back-home-button').trigger('click')

      expect(wrapper.emitted('back-home')).toBeTruthy()
      expect(wrapper.emitted('back-home')).toHaveLength(1)
    })

    it('should emit select-question when root message clicked', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1', chatId: 'chat1', rootIndex: 0 }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.tree-item').trigger('click')

      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question')[0][0]).toEqual(
        expect.objectContaining({ id: 'q1' })
      )
    })

    it('should emit delete-question when delete button clicked', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.delete-button').trigger('click')

      expect(wrapper.emitted('delete-question')).toBeTruthy()
      expect(wrapper.emitted('delete-question')[0]).toEqual(['q1', 'chat1'])
    })

    it('should emit rename-question when InlineEdit saves', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Start editing by double-clicking tree item text
      await wrapper.find('.tree-item-text').trigger('dblclick')
      const input = wrapper.find('.inline-edit-input')
      await input.setValue('Renamed Question')
      await input.trigger('keydown.enter')

      expect(wrapper.emitted('rename-question')).toBeTruthy()
      expect(wrapper.emitted('rename-question')[0]).toEqual(['q1', 'Renamed Question'])
    })

    it('should emit new-question when add new button clicked', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.new-question-button').trigger('click')

      expect(wrapper.emitted('new-question')).toBeTruthy()
      expect(wrapper.emitted('new-question')).toHaveLength(1)
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

    it('should show only first character of title when collapsed', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Architecture Discussion', response: '' },
        { id: 'q2', question: 'Backend API', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Architecture Discussion' },
          { id: 'q2', text: 'Backend API' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      const collapsedTitles = wrapper.findAll('.root-title-collapsed')
      expect(collapsedTitles).toHaveLength(2)
      expect(collapsedTitles[0].text()).toBe('A')
      expect(collapsedTitles[1].text()).toBe('B')
    })

    it('should hide children tree when sidebar collapsed', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      expect(wrapper.find('.tree-children').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.tree-children').exists()).toBe(false)
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
  })

  describe('Add New Question Button', () => {
    it('should render "Add new question" button when there are root messages', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const newQuestionButton = wrapper.find('.new-question-button')
      expect(newQuestionButton.exists()).toBe(true)
      expect(newQuestionButton.text()).toContain('Add new question')
    })

    it('should highlight "Add new" button when isAddingNewQuestion is true', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          isAddingNewQuestion: true
        }
      })

      const newQuestionButton = wrapper.find('.new-question-button')
      expect(newQuestionButton.classes()).toContain('active')
    })

    it('should hide "Add new" button when sidebar is collapsed', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Initially visible
      expect(wrapper.find('.new-question-button').exists()).toBe(true)

      // Collapse sidebar
      await wrapper.find('.collapse-sidebar-button').trigger('click')

      // Should be hidden
      expect(wrapper.find('.new-question-button').exists()).toBe(false)
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
  })

  describe('Child Message Inline Edit and Delete', () => {
    it('should pass editable prop to MessageTree when sidebar is expanded', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      expect(messageTree.props('editable')).toBe(true)
    })

    it('should pass showDeleteButton prop to MessageTree when sidebar is expanded', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      expect(messageTree.props('showDeleteButton')).toBe(true)
    })

    it('should render delete button for child messages', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Should have delete buttons for both root and child
      const deleteButtons = wrapper.findAll('.delete-button')
      expect(deleteButtons.length).toBeGreaterThanOrEqual(2)
    })

    it('should delete child message when delete button is clicked', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Find the child's delete button (second delete button)
      const deleteButtons = wrapper.findAll('.delete-button')
      expect(deleteButtons.length).toBe(2)

      // Click the child's delete button
      await deleteButtons[1].trigger('click')

      // Child should be removed from store
      expect(chatStore.messagesById['child1']).toBeUndefined()
      // Parent's childIds should be updated
      expect(chatStore.messagesById['q1'].childIds).not.toContain('child1')
    })

    it('should emit rename-question when child is renamed via inline edit', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Find child's text and double-click to start editing
      const treeItemTexts = wrapper.findAll('.tree-item-text')
      expect(treeItemTexts.length).toBeGreaterThanOrEqual(2)

      // Double-click the child's text (second one)
      await treeItemTexts[1].trigger('dblclick')

      // Find input in the child tree item
      const inputs = wrapper.findAll('.inline-edit-input')
      expect(inputs.length).toBe(1)

      await inputs[0].setValue('Renamed Child')
      await inputs[0].trigger('keydown.enter')

      expect(wrapper.emitted('rename-question')).toBeTruthy()
      expect(wrapper.emitted('rename-question')[0]).toEqual(['child1', 'Renamed Child'])
    })

    it('should navigate to parent when deleting current child message', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      // Find the child's delete button (second delete button)
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[1].trigger('click')

      // Should emit select-question to navigate to parent
      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question').pop()[0]).toEqual({ id: 'q1' })
    })

    it('should remove questionLinks pointing to deleted child message', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' },
        { id: 'q2', question: 'Question 2', response: '', customContent: [
          { id: 'link1', type: 'questionLink', targetMessageId: 'child1' }
        ] }
      ])
      // Add linkedFrom after setup (since Message class doesn't include it in constructor)
      chatStore.messagesById['child1'].linkedFrom = [
        { sourceMessageId: 'q2', linkId: 'link1' }
      ]

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Find and click the child's delete button
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[1].trigger('click')

      // Child should be deleted
      expect(chatStore.messagesById['child1']).toBeUndefined()
      // QuestionLink in q2 should be removed
      expect(chatStore.messagesById['q2'].customContent).toEqual([])
    })

    it('should remove questionLinks pointing to descendants of deleted child', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child', response: '', parentId: 'q1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' },
        { id: 'q2', question: 'Question 2', response: '', customContent: [
          { id: 'link1', type: 'questionLink', targetMessageId: 'grandchild1' }
        ] }
      ])
      // Add linkedFrom after setup
      chatStore.messagesById['grandchild1'].linkedFrom = [
        { sourceMessageId: 'q2', linkId: 'link1' }
      ]

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'Question 1' },
          { id: 'q2', text: 'Question 2' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      // Delete child1 (which also deletes grandchild1)
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[1].trigger('click')

      // Both should be deleted
      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['grandchild1']).toBeUndefined()
      // QuestionLink to grandchild1 in q2 should be removed
      expect(chatStore.messagesById['q2'].customContent).toEqual([])
    })

    it('should delete child and all its descendants', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      // Click child1's delete button
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[1].trigger('click')

      // Both child1 and grandchild1 should be deleted
      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['grandchild1']).toBeUndefined()
      // q1 should still exist with empty childIds
      expect(chatStore.messagesById['q1']).toBeDefined()
      expect(chatStore.messagesById['q1'].childIds).toEqual([])
    })
  })

  describe('Edge Cases', () => {
    it('should handle root message with empty question', () => {
      setupMessagesInStore([
        { id: 'q1', question: '', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: '' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const title = wrapper.find('.tree-item-text')
      expect(title.text()).toBe('')
    })

    it('should handle currentMessageId that does not match any message', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: {
          chats,
          currentChatId: 'chat1',
          currentMessageId: 'nonexistent'
        }
      })

      const rootHeaders = wrapper.findAll('.root-header')
      expect(rootHeaders[0].classes()).not.toContain('is-current-root')
    })
  })
})
