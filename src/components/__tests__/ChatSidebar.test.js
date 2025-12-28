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
  ])),
  initProvider: vi.fn(() => Promise.resolve()),
  sendChatMessage: vi.fn(),
  sendChatMessageForFeature: vi.fn(),
  FeatureType: {
    QUESTION: 'question',
    DEEP_DIVE: 'deep_dive',
    SUMMARY: 'summary',
    EXPLAIN: 'explain',
    DICTIONARY: 'dictionary',
    SR_SUMMARY: 'sr_summary'
  }
}))

// Mock firestore to prevent real network calls
vi.mock('../../services/firestore.js', () => ({
  loadUserSettings: vi.fn(() => Promise.resolve(null)),
  saveUserSettings: vi.fn(() => Promise.resolve()),
  syncChatStateToFirestore: vi.fn(() => Promise.resolve()),
  loadChatStateFromFirestore: vi.fn(() => Promise.resolve(null)),
  subscribeToChatState: vi.fn(() => () => {}),
  deleteChatStateFromFirestore: vi.fn(() => Promise.resolve()),
  subscribeToUserSettings: vi.fn(() => () => {})
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

    // Mock window.confirm to always return true for delete confirmations
    window.confirm = vi.fn(() => true)
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

  describe('Overview Header', () => {
    it('should display overview header item with notebook title', () => {
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

      const overviewHeader = wrapper.find('.overview-header-item')
      expect(overviewHeader.exists()).toBe(true)
      expect(overviewHeader.find('.overview-text').text()).toBe('My Notebook')
    })

    it('should not display overview header item when no current chat', () => {
      wrapper = mount(ChatSidebar, {
        props: { chats: [], currentChatId: null }
      })

      const overviewHeader = wrapper.find('.overview-header-item')
      expect(overviewHeader.exists()).toBe(false)
    })

    it('should navigate to overview when clicking header item', async () => {
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

      const overviewHeader = wrapper.find('.overview-header-item')
      await overviewHeader.trigger('click')

      expect(mockRouterPush).toHaveBeenCalledWith({
        name: 'notebook',
        params: { id: 'chat1' }
      })
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

      // Wait for Vue to process the nextTick in handleSearchResultClick
      await wrapper.vm.$nextTick()

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


  describe('Delete Confirmation', () => {
    it('should show confirmation when deleting question with children', async () => {
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

      // Click q1's delete button
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[0].trigger('click')

      // Confirm should have been called
      expect(window.confirm).toHaveBeenCalledWith(
        'This question has custom content. Are you sure you want to delete it?'
      )
    })

    it('should show confirmation when deleting question with custom content', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', customContent: [
          { id: 'note1', type: 'note', text: 'A note' }
        ] }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[0].trigger('click')

      expect(window.confirm).toHaveBeenCalledWith(
        'This question has custom content. Are you sure you want to delete it?'
      )
    })

    it('should not show confirmation when deleting question without children or custom content', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      window.confirm.mockClear()

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[0].trigger('click')

      // Confirm should NOT have been called
      expect(window.confirm).not.toHaveBeenCalled()
    })

    it('should not delete when user cancels confirmation', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      // Make confirm return false (user cancels)
      window.confirm.mockReturnValueOnce(false)

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'q1' }
      })

      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[0].trigger('click')

      // Question should still exist
      expect(chatStore.messagesById['q1']).toBeDefined()
      expect(chatStore.messagesById['child1']).toBeDefined()
    })

    it('should delete when user confirms', async () => {
      setupMessagesInStore([
        { id: 'q1', question: 'Question 1', response: '', childIds: ['child1'] },
        { id: 'child1', question: 'Child Question', response: '', parentId: 'q1' }
      ])

      const chats = [{
        id: 'chat1',
        title: 'Chat 1',
        questions: [{ id: 'q1', text: 'Question 1' }]
      }]

      // Make confirm return true (user confirms)
      window.confirm.mockReturnValueOnce(true)

      wrapper = mount(ChatSidebar, {
        props: { chats, currentChatId: 'chat1', currentMessageId: 'child1' }
      })

      // Delete child1
      const deleteButtons = wrapper.findAll('.delete-button')
      await deleteButtons[1].trigger('click')

      // Child should be deleted
      expect(chatStore.messagesById['child1']).toBeUndefined()
    })
  })
})
