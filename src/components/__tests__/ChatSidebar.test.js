import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import ChatSidebar from '../ChatSidebar.vue'
import { useChatStore } from '../../stores/chat.js'

// Mock vue-router at the module level
const mockRouterPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockRouterPush
  })
}))

// Mock the LLM API module to prevent real network calls from SettingsModal
vi.mock('../../services/api.js', () => ({
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
  fetchModels: vi.fn(() => Promise.resolve([
    { id: 'model-1', name: 'Test Model 1' }
  ]))
}))

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

    it('should always expand tree when clicking root item (never collapse)', async () => {
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

      // Click root item - should stay expanded (never collapse on click)
      await wrapper.find('.tree-item').trigger('click')
      expect(wrapper.find('.tree-children').exists()).toBe(true)

      // Click again - should still be expanded
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

      // Set store's currentMessageId so deleteChildMessage knows to navigate
      chatStore.currentMessageId = 'child1'

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

  describe('Notebook Rename', () => {
    it('should rename notebook via InlineEdit when currentChatId is set', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Original Title',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      chatStore.chats = [{
        id: 'chat1',
        title: 'Original Title',
        rootMessageIds: ['q1']
      }]
      chatStore.renameChat = vi.fn()

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Find the notebook title InlineEdit and trigger save
      const notebookTitleContainer = wrapper.find('.notebook-title-container')
      expect(notebookTitleContainer.exists()).toBe(true)

      const inlineEdit = notebookTitleContainer.findComponent({ name: 'InlineEdit' })
      expect(inlineEdit.exists()).toBe(true)

      // Trigger save event
      await inlineEdit.vm.$emit('save', 'New Notebook Title')

      expect(chatStore.renameChat).toHaveBeenCalledWith('chat1', 'New Notebook Title')
    })

    it('should not rename notebook when currentChatId is null', async () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: null }
      })

      chatStore.renameChat = vi.fn()

      // Notebook title container should not exist when no current chat
      const notebookTitleContainer = wrapper.find('.notebook-title-container')
      expect(notebookTitleContainer.exists()).toBe(false)
    })

    it('should display current notebook title in InlineEdit', () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'My Notebook',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const inlineEdit = wrapper.find('.notebook-title-container').findComponent({ name: 'InlineEdit' })
      expect(inlineEdit.props('modelValue')).toBe('My Notebook')
    })
  })

  describe('Drop Handler (Reordering)', () => {
    it('should move message to root level when position is "above"', async () => {
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

      chatStore.moveMessage = vi.fn()

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Find DraggableTreeItem and emit drop event with position 'above'
      const draggableItem = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await draggableItem.vm.$emit('drop', {
        messageId: 'q2',
        targetId: 'q1',
        position: 'above',
        targetIndex: 0
      })

      expect(chatStore.moveMessage).toHaveBeenCalledWith('q2', null, 0)
    })

    it('should move message as child when position is not "above"', async () => {
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

      chatStore.moveMessage = vi.fn()

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Find DraggableTreeItem and emit drop event with position 'inside'
      const draggableItem = wrapper.findComponent({ name: 'DraggableTreeItem' })
      await draggableItem.vm.$emit('drop', {
        messageId: 'q2',
        targetId: 'q1',
        position: 'inside',
        targetIndex: 0
      })

      expect(chatStore.moveMessage).toHaveBeenCalledWith('q2', 'q1', 0)
    })
  })

  describe('Move to Parent (Promoting Child)', () => {
    it('should move child message to grandparent when move-to-parent is emitted', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child', response: '', parentId: 'q1', childIds: ['grandchild1'] },
        { id: 'grandchild1', question: 'Grandchild', response: '', parentId: 'child1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      chatStore.moveMessage = vi.fn()

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'grandchild1' }
      })

      // Find MessageTree and emit move-to-parent event
      const messageTree = wrapper.findComponent({ name: 'MessageTree' })
      await messageTree.vm.$emit('move-to-parent', {
        messageId: 'grandchild1',
        newParentId: 'q1',
        newIndex: 1
      })

      expect(chatStore.moveMessage).toHaveBeenCalledWith('grandchild1', 'q1', 1)
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

  describe('Search Functionality', () => {
    it('should render search input when sidebar is expanded', () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      expect(wrapper.find('.search-input').exists()).toBe(true)
      expect(wrapper.find('.search-input').attributes('placeholder')).toBe('Search questions...')
    })

    it('should hide search input when sidebar is collapsed', async () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      await wrapper.find('.collapse-sidebar-button').trigger('click')

      expect(wrapper.find('.search-input').exists()).toBe(false)
    })

    it('should show search results when typing a query', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'How to use JavaScript', response: '' },
        { id: 'q2', question: 'Python basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'How to use JavaScript' },
          { id: 'q2', text: 'Python basics' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-results-container').exists()).toBe(true)
      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })

    it('should hide normal tree view when searching', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'How to use JavaScript', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'How to use JavaScript' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.root-messages-container').exists()).toBe(false)
      expect(wrapper.find('.search-results-container').exists()).toBe(true)
    })

    it('should search case-insensitively', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JAVASCRIPT basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JAVASCRIPT basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('javascript')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })

    it('should search through child questions', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Parent Question', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child about JavaScript', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Parent Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
      expect(wrapper.find('.search-result-question').text()).toBe('Child about JavaScript')
    })

    it('should display ancestor path for child results', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Parent Question', questionSummarized: 'Parent Question', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child about JavaScript', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Parent Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-result-path').exists()).toBe(true)
      expect(wrapper.find('.path-text').text()).toBe('Parent Question')
    })

    it('should display full ancestor path for deeply nested results', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Root', questionSummarized: 'Root', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Level 1', questionSummarized: 'Level 1', response: '', parentId: 'q1', childIds: ['child2'] },
        { id: 'child2', question: 'Deep JavaScript question', response: '', parentId: 'child1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Root' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      const pathTexts = wrapper.findAll('.path-text')
      expect(pathTexts).toHaveLength(2)
      expect(pathTexts[0].text()).toBe('Root')
      expect(pathTexts[1].text()).toBe('Level 1')
    })

    it('should not show ancestor path for root-level results', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JavaScript basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-result-path').exists()).toBe(false)
      expect(wrapper.find('.search-result-question').classes()).toContain('is-root')
    })

    it('should show "No questions found" when no results match', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Python basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Python basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-no-results').exists()).toBe(true)
      expect(wrapper.find('.search-no-results').text()).toBe('No questions found')
    })

    it('should emit select-question when clicking a search result', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JavaScript basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')
      await wrapper.find('.search-result-item').trigger('click')

      expect(wrapper.emitted('select-question')).toBeTruthy()
      expect(wrapper.emitted('select-question')[0][0]).toMatchObject({
        id: 'q1',
        chatId: 'chat1'
      })
    })

    it('should clear search and show tree when clicking a search result', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JavaScript basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')
      expect(wrapper.find('.search-results-container').exists()).toBe(true)

      await wrapper.find('.search-result-item').trigger('click')

      expect(wrapper.find('.search-input').element.value).toBe('')
      expect(wrapper.find('.search-results-container').exists()).toBe(false)
      expect(wrapper.find('.root-messages-container').exists()).toBe(true)
    })

    it('should show clear button when search has text', async () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      expect(wrapper.find('.search-clear-btn').exists()).toBe(false)

      await wrapper.find('.search-input').setValue('test')

      expect(wrapper.find('.search-clear-btn').exists()).toBe(true)
    })

    it('should clear search when clicking clear button', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('test')
      expect(wrapper.find('.search-results-container').exists()).toBe(true)

      await wrapper.find('.search-clear-btn').trigger('click')

      expect(wrapper.find('.search-input').element.value).toBe('')
      expect(wrapper.find('.search-results-container').exists()).toBe(false)
    })

    it('should clear search when pressing Escape', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('test')
      await wrapper.find('.search-input').trigger('keydown.escape')

      expect(wrapper.find('.search-input').element.value).toBe('')
    })

    it('should find multiple matching results', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript basics', response: '' },
        { id: 'q2', question: 'Advanced JavaScript', response: '' },
        { id: 'q3', question: 'Python tutorial', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'JavaScript basics' },
          { id: 'q2', text: 'Advanced JavaScript' },
          { id: 'q3', text: 'Python tutorial' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')

      expect(wrapper.find('.search-results-count').text()).toContain('2 results')
      expect(wrapper.findAll('.search-result-item')).toHaveLength(2)
    })

    it('should use questionSummarized if available for search', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Very long question text', questionSummarized: 'Short JS', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Short JS' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JS')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })

    it('should expand tree to selected search result', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Root', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'JavaScript child', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Root' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('JavaScript')
      await wrapper.find('.search-result-item').trigger('click')

      // After clicking, tree should be visible and expanded
      expect(wrapper.find('.tree-children').exists()).toBe(true)
    })

    it('should not show search results when query is only whitespace', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      await wrapper.find('.search-input').setValue('   ')

      expect(wrapper.find('.search-results-container').exists()).toBe(false)
      expect(wrapper.find('.root-messages-container').exists()).toBe(true)
    })

    it('should find results with multi-word search (AND logic)', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'How to learn JavaScript programming', response: '' },
        { id: 'q2', question: 'Python programming basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [
          { id: 'q1', text: 'How to learn JavaScript programming' },
          { id: 'q2', text: 'Python programming basics' }
        ]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search for "javascript programming" - should only match q1
      await wrapper.find('.search-input').setValue('javascript programming')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
      expect(wrapper.find('.search-result-question').text()).toBe('How to learn JavaScript programming')
    })

    it('should match words in any order', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Advanced JavaScript tutorials', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Advanced JavaScript tutorials' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search for "tutorials javascript" (reversed order) - should still match
      await wrapper.find('.search-input').setValue('tutorials javascript')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
      expect(wrapper.find('.search-result-question').text()).toBe('Advanced JavaScript tutorials')
    })

    it('should not require exact phrase match', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'How to build a React application', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'How to build a React application' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search for "react build" (words not adjacent in original) - should match
      await wrapper.find('.search-input').setValue('react build')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })

    it('should not match if any word is missing', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript basics', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JavaScript basics' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search for "javascript advanced" - "advanced" is not in the text
      await wrapper.find('.search-input').setValue('javascript advanced')

      expect(wrapper.find('.search-no-results').exists()).toBe(true)
    })

    it('should handle multiple spaces between words', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Vue component testing', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Vue component testing' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search with multiple spaces
      await wrapper.find('.search-input').setValue('vue    testing')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })

    it('should match partial words', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'JavaScript programming fundamentals', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'JavaScript programming fundamentals' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Search for "java program" (partial words) - should match
      await wrapper.find('.search-input').setValue('java program')

      expect(wrapper.find('.search-results-count').text()).toContain('1 result')
    })
  })

  describe('Drag and Drop to Notebooks Button', () => {
    let mockConfirm

    beforeEach(() => {
      // Clear mock router calls
      mockRouterPush.mockClear()

      // Mock window.confirm
      mockConfirm = vi.fn()
      global.confirm = mockConfirm
    })

    afterEach(() => {
      delete global.confirm
    })

    it('should add drop zone handlers to notebooks button', () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      expect(notebooksButton.exists()).toBe(true)

      // Check that the button element exists and can receive drag events
      // Vue's event handlers are in the vnode, not directly on the DOM element
      expect(notebooksButton.element).toBeDefined()
      expect(notebooksButton.element.className).toContain('back-home-button')
    })

    it('should highlight notebooks button when dragging over it', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')

      // Simulate drag start on a question to set draggedItem
      const treeItem = wrapper.find('.tree-item')
      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      // Simulate drag over notebooks button
      await notebooksButton.trigger('dragover', {
        dataTransfer: {
          dropEffect: 'move'
        }
      })

      // Button should have drop-target class
      expect(notebooksButton.classes()).toContain('drop-target')
    })

    it('should remove highlight when dragging leaves notebooks button', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      // Start drag
      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      // Drag over
      await notebooksButton.trigger('dragover', {
        dataTransfer: {
          dropEffect: 'move'
        }
      })

      expect(notebooksButton.classes()).toContain('drop-target')

      // Drag leave
      await notebooksButton.trigger('dragleave')

      expect(notebooksButton.classes()).not.toContain('drop-target')
    })

    it('should show modal when dropping question on notebooks button', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('visible')).toBe(false)

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      // Start drag
      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      // Drop on notebooks button
      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Modal should be shown
      expect(modal.props('visible')).toBe(true)
    })

    it('should not create new notebook if user cancels modal', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const initialChatCount = chatStore.chats.length

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Modal should be shown
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('visible')).toBe(true)

      // User cancels
      await modal.vm.$emit('cancel')

      // No new chat should be created
      expect(chatStore.chats.length).toBe(initialChatCount)
    })

    it('should move question to new notebook when user selects new notebook in modal', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '', childIds: [] }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // New chat should be created
      expect(chatStore.chats.length).toBe(2)

      // Question should be removed from old notebook
      expect(chatStore.chats[0].rootMessageIds).not.toContain('q1')

      // Question should be in new notebook
      expect(chatStore.chats[1].rootMessageIds).toContain('q1')
    })

    it('should move question tree with all children to new notebook', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Parent', response: '', childIds: ['child1', 'child2'] },
        { id: 'child1', question: 'Child 1', response: '', parentId: 'q1', childIds: [] },
        { id: 'child2', question: 'Child 2', response: '', parentId: 'q1', childIds: [] }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Parent' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // All messages should still exist in messagesById
      expect(chatStore.messagesById['q1']).toBeDefined()
      expect(chatStore.messagesById['child1']).toBeDefined()
      expect(chatStore.messagesById['child2']).toBeDefined()

      // Parent's childIds should remain intact
      expect(chatStore.messagesById['q1'].childIds).toEqual(['child1', 'child2'])

      // Children's parentId should still point to parent
      expect(chatStore.messagesById['child1'].parentId).toBe('q1')
      expect(chatStore.messagesById['child2'].parentId).toBe('q1')
    })

    it('should navigate to new notebook with moved question after selecting new in modal', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // Router should be called with question route
      await wrapper.vm.$nextTick()

      const newChatId = chatStore.chats[1].id
      expect(mockRouterPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: newChatId, questionId: 'q1' }
      })
    })

    it('should clear parentId when moving child question to new notebook', async () => {
      setupMessagesInStore([
        { id: 'parent', question: 'Parent', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child', response: '', parentId: 'parent', childIds: [] }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['parent']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['parent']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'parent', text: 'Parent' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      // Wait for tree to auto-expand to child
      await wrapper.vm.$nextTick()

      // Find all tree items - should have parent and child
      const treeItems = wrapper.findAll('.tree-item')
      expect(treeItems.length).toBeGreaterThanOrEqual(2)

      // The child item should be the second one (after parent)
      const childItem = treeItems.length > 1 ? treeItems[1] : treeItems[0]

      // Start drag on child
      await childItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // Child should have null parentId in new notebook
      expect(chatStore.messagesById['child1'].parentId).toBeNull()

      // Child should be removed from parent's childIds
      expect(chatStore.messagesById['parent'].childIds).not.toContain('child1')
    })

    it('should update current message and chat IDs after move', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.currentMessageId = 'someOtherId'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // Current message ID should be updated to moved question
      expect(chatStore.currentMessageId).toBe('q1')

      // Current chat ID should be updated to new chat
      const newChatId = chatStore.chats[1].id
      expect(chatStore.currentChatId).toBe(newChatId)
    })

    it('should name new notebook with questionSummarized when available', async () => {
      setupMessagesInStore([
        {
          id: 'q1',
          question: 'This is a very long question that should be summarized',
          questionSummarized: 'Short summary',
          response: ''
        }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Short summary' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // New notebook should use questionSummarized as name
      expect(chatStore.chats.length).toBe(2)
      expect(chatStore.chats[1].name).toBe('Short summary')
    })

    it('should name new notebook with question text when no questionSummarized exists', async () => {
      setupMessagesInStore([
        {
          id: 'q1',
          question: 'Test Question',
          response: ''
        }
      ])

      chatStore.chats = [{
        id: 'chat1',
        name: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // New chat should be created with the question text as fallback
      expect(chatStore.chats.length).toBe(2)
      expect(chatStore.chats[1].name).toBe('Test Question')
    })

    it('should not crash when dropping without draggedItem', async () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')

      // Drop without starting a drag first
      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Should not crash and modal should not be shown
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('visible')).toBe(false)
    })

    it('should persist state after moving question', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']
      chatStore._persistState = vi.fn()

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // User selects new notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // _persistState should be called
      expect(chatStore._persistState).toHaveBeenCalled()
    })
  })

  describe('Back Button (Previous Question)', () => {
    beforeEach(() => {
      mockRouterPush.mockClear()
    })

    it('should always render back button', () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      expect(wrapper.find('.back-button').exists()).toBe(true)
    })

    it('should be disabled when no previousLocation in store', () => {
      chatStore.previousLocation = null

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      const backButton = wrapper.find('.back-button')
      expect(backButton.classes()).toContain('disabled')
      expect(backButton.attributes('disabled')).toBeDefined()
    })

    it('should be enabled when previousLocation exists in store', () => {
      chatStore.previousLocation = { messageId: 'q1', chatId: 'chat1' }

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      const backButton = wrapper.find('.back-button')
      expect(backButton.classes()).not.toContain('disabled')
      expect(backButton.attributes('disabled')).toBeUndefined()
    })

    it('should navigate to previous question when back button clicked', async () => {
      chatStore.previousLocation = { messageId: 'q1', chatId: 'chat1' }

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat2' }
      })

      await wrapper.find('.back-button').trigger('click')

      expect(mockRouterPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: 'chat1', questionId: 'q1' }
      })
    })

    it('should clear previousLocation in store after clicking back', async () => {
      chatStore.previousLocation = { messageId: 'q1', chatId: 'chat1' }

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat2' }
      })

      await wrapper.find('.back-button').trigger('click')

      expect(chatStore.previousLocation).toBeNull()
    })

    it('should become disabled after clicking back', async () => {
      chatStore.previousLocation = { messageId: 'q1', chatId: 'chat1' }

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat2' }
      })

      await wrapper.find('.back-button').trigger('click')
      await wrapper.vm.$nextTick()

      const backButton = wrapper.find('.back-button')
      expect(backButton.classes()).toContain('disabled')
    })

    it('should not navigate when disabled', async () => {
      chatStore.previousLocation = null

      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: 'chat1' }
      })

      await wrapper.find('.back-button').trigger('click')

      expect(mockRouterPush).not.toHaveBeenCalled()
    })

    it('should set previousLocation when moving question to new notebook', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.currentMessageId = 'q1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Simulate dropping on notebooks button to show modal
      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Simulate selecting "New notebook" in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // previousLocation should be set in store
      expect(chatStore.previousLocation).toEqual({
        messageId: 'q1',
        chatId: 'chat1'
      })
    })

    it('should set previousLocation when moving question to existing notebook', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [
        { id: 'chat1', title: 'Chat 1', rootMessageIds: ['q1'] },
        { id: 'chat2', title: 'Chat 2', rootMessageIds: [] }
      ]
      chatStore.currentChatId = 'chat1'
      chatStore.currentMessageId = 'q1'
      chatStore.rootMessageIds = ['q1']

      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [{ id: 'q1', text: 'Test Question' }] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      // Simulate dropping on notebooks button to show modal
      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: {
          effectAllowed: 'move',
          setData: vi.fn()
        }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Simulate selecting existing notebook in modal
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-existing', { id: 'chat2', title: 'Chat 2' })

      // previousLocation should be set in store
      expect(chatStore.previousLocation).toEqual({
        messageId: 'q1',
        chatId: 'chat1'
      })
    })
  })

  describe('Move to Notebook Modal', () => {
    beforeEach(() => {
      mockRouterPush.mockClear()
    })

    it('should show modal when dropping question on notebooks button', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('visible')).toBe(false)

      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: { effectAllowed: 'move', setData: vi.fn() }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      expect(modal.props('visible')).toBe(true)
    })

    it('should close modal when cancel is emitted', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Open modal
      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: { effectAllowed: 'move', setData: vi.fn() }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('visible')).toBe(true)

      // Cancel
      await modal.vm.$emit('cancel')

      expect(modal.props('visible')).toBe(false)
    })

    it('should pass notebooks list to modal', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [{ id: 'q1', text: 'Test Question' }] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      expect(modal.props('notebooks')).toBeDefined()
      expect(modal.props('currentNotebookId')).toBe('chat1')
    })

    it('should move question to new notebook when select-new emitted', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [{
        id: 'chat1',
        title: 'Chat 1',
        rootMessageIds: ['q1']
      }]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Test Question' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Trigger modal
      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: { effectAllowed: 'move', setData: vi.fn() }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      const initialChatCount = chatStore.chats.length

      // Select new notebook
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-new')

      // New chat should be created
      expect(chatStore.chats.length).toBe(initialChatCount + 1)

      // Should navigate to new notebook
      expect(mockRouterPush).toHaveBeenCalledWith({
        name: 'question',
        params: expect.objectContaining({ questionId: 'q1' })
      })
    })

    it('should move question to existing notebook when select-existing emitted', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Test Question', response: '' }
      ])

      chatStore.chats = [
        { id: 'chat1', title: 'Chat 1', rootMessageIds: ['q1'] },
        { id: 'chat2', title: 'Chat 2', rootMessageIds: [] }
      ]
      chatStore.currentChatId = 'chat1'
      chatStore.rootMessageIds = ['q1']

      const chats = [
        { id: 'chat1', title: 'Chat 1', questions: [{ id: 'q1', text: 'Test Question' }] },
        { id: 'chat2', title: 'Chat 2', questions: [] }
      ]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1' }
      })

      // Trigger modal
      const notebooksButton = wrapper.find('.back-home-button')
      const treeItem = wrapper.find('.tree-item')

      await treeItem.trigger('dragstart', {
        dataTransfer: { effectAllowed: 'move', setData: vi.fn() }
      })

      await notebooksButton.trigger('drop', {
        dataTransfer: {},
        preventDefault: vi.fn()
      })

      // Select existing notebook
      const modal = wrapper.findComponent({ name: 'MoveToNotebookModal' })
      await modal.vm.$emit('select-existing', { id: 'chat2', title: 'Chat 2' })

      // Question should be moved to chat2
      expect(chatStore.chats[0].rootMessageIds).not.toContain('q1')
      expect(chatStore.chats[1].rootMessageIds).toContain('q1')

      // Should navigate to target notebook
      expect(mockRouterPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: 'chat2', questionId: 'q1' }
      })
    })
  })
})
