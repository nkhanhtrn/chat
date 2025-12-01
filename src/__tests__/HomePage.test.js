import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomePage from '../views/HomePage.vue'
import Button from '../components/Button.vue'
import { useChatStore } from '../stores/chat.js'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', () => ({
  useRouter: () => ({
    push: mockPush
  })
}))

describe('HomePage', () => {
  let wrapper
  let pinia
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    // Clear localStorage before each test to ensure fresh store state
    localStorage.clear()
    mockPush.mockClear()
    // Create a fresh pinia instance for each test
    pinia = createPinia()
    setActivePinia(pinia)
    // Get a fresh store instance
    chatStore = useChatStore(pinia)
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    localStorage.clear()
    vi.unstubAllGlobals()
  })

  describe('Initial Rendering', () => {
    it('should render the homepage container', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.homepage').exists()).toBe(true)
    })

    it('should render the header with title', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.homepage-header').exists()).toBe(true)
      expect(wrapper.find('.homepage-header h1').text()).toBe('My Notebooks')
    })

    it('should render the New Notebook button using Button component', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const button = wrapper.findComponent(Button)
      expect(button.exists()).toBe(true)
      expect(button.props('variant')).toBe('primary')
      expect(button.text()).toContain('New Notebook')
    })

    it('should render notebooks grid', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.notebooks-grid').exists()).toBe(true)
    })
  })

  describe('Empty State', () => {
    it('should show empty state when no notebooks exist', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(true)
      expect(wrapper.find('.empty-state p').text()).toContain('No notebooks yet')
    })

    it('should show empty hint message', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.empty-hint').exists()).toBe(true)
      expect(wrapper.find('.empty-hint').text()).toContain('Create your first notebook')
    })
  })

  describe('Creating New Notebook', () => {
    it('should create new notebook and navigate when button is clicked', async () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const button = wrapper.findComponent(Button)
      await button.trigger('click')

      expect(mockPush).toHaveBeenCalledTimes(1)
      expect(mockPush).toHaveBeenCalledWith({
        name: 'notebook',
        params: { id: expect.any(String) }
      })
    })

    it('should add notebook to store when created', async () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const initialCount = chatStore.chats.length

      const button = wrapper.findComponent(Button)
      await button.trigger('click')

      expect(chatStore.chats.length).toBe(initialCount + 1)
    })
  })

  describe('Displaying Notebooks', () => {
    it('should display notebook cards when notebooks exist', async () => {
      // Create some notebooks
      chatStore.createNewChat()
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const cards = wrapper.findAll('.notebook-card')
      expect(cards.length).toBe(2)
    })

    it('should hide empty state when notebooks exist', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })

    it('should display notebook title', async () => {
      const newChat = chatStore.createNewChat()
      // Set a title by adding a root message
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        questionSummarized: 'Test Title',
        response: ''
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await flushPromises()

      const title = wrapper.find('.notebook-title')
      expect(title.exists()).toBe(true)
    })

    it('should display question count for each notebook', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const meta = wrapper.find('.notebook-meta')
      expect(meta.exists()).toBe(true)
      expect(meta.text()).toContain('question')
    })
  })

  describe('Opening Notebooks', () => {
    it('should navigate to notebook when card is clicked', async () => {
      const newChat = chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const card = wrapper.find('.notebook-card')
      await card.trigger('click')

      expect(mockPush).toHaveBeenCalledWith({
        name: 'notebook',
        params: { id: newChat.id }
      })
    })

    it('should switch to the correct chat when opening notebook', async () => {
      const chat1 = chatStore.createNewChat()
      chatStore.createNewChat() // chat2

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Click on first notebook card
      const cards = wrapper.findAll('.notebook-card')
      await cards[0].trigger('click')

      // Should switch to the clicked chat (first one in the list)
      expect(chatStore.currentChatId).toBe(chat1.id)
    })
  })

  describe('Deleting Notebooks', () => {
    it('should show delete button on notebook card', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.delete-btn').exists()).toBe(true)
    })

    it('should delete notebook when delete button is clicked and confirmed', async () => {
      // Create two chats so we can test actual deletion
      // (if only one chat exists, deleting it creates a new one)
      chatStore.createNewChat()
      chatStore.createNewChat()
      const initialCount = chatStore.chats.length
      const firstChatId = chatStore.chats[0].id

      // Mock window.confirm (happy-dom doesn't have it by default)
      window.confirm = vi.fn(() => true)

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const deleteBtn = wrapper.find('.delete-btn')
      await deleteBtn.trigger('click')

      expect(window.confirm).toHaveBeenCalled()
      // First chat should be deleted
      expect(chatStore.chats.find(c => c.id === firstChatId)).toBeUndefined()
      expect(chatStore.chats.length).toBe(initialCount - 1)
    })

    it('should not delete notebook when delete is cancelled', async () => {
      chatStore.createNewChat()
      const initialCount = chatStore.chats.length

      // Mock confirm to return false
      vi.stubGlobal('confirm', vi.fn(() => false))

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const deleteBtn = wrapper.find('.delete-btn')
      await deleteBtn.trigger('click')

      expect(chatStore.chats.length).toBe(initialCount)
    })

    it('should not navigate when delete button is clicked', async () => {
      chatStore.createNewChat()

      vi.stubGlobal('confirm', vi.fn(() => true))

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      mockPush.mockClear()

      const deleteBtn = wrapper.find('.delete-btn')
      await deleteBtn.trigger('click')

      // Should not navigate when deleting
      expect(mockPush).not.toHaveBeenCalled()
    })
  })

  describe('Notebook Card Display', () => {
    it('should display notebook icon', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.notebook-icon').exists()).toBe(true)
    })

    it('should show default title for notebooks without questions', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const title = wrapper.find('.notebook-title')
      // chatList getter returns 'New Chat' as default title for empty notebooks
      expect(title.text()).toBe('New Chat')
    })
  })

  describe('Search Functionality', () => {
    it('should render search input', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.search-input').exists()).toBe(true)
      expect(wrapper.find('.search-input').attributes('placeholder')).toBe('Search questions...')
    })

    it('should show notebooks grid when search is empty', () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.notebooks-grid').exists()).toBe(true)
      expect(wrapper.find('.search-results').exists()).toBe(false)
    })

    it('should show search results when typing in search', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to learn JavaScript',
        questionSummarized: 'How to learn JavaScript',
        response: 'Start with the basics...',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const searchInput = wrapper.find('.search-input')
      await searchInput.setValue('javascript')

      expect(wrapper.find('.search-results').exists()).toBe(true)
      expect(wrapper.find('.notebooks-grid').exists()).toBe(false)
    })

    it('should find matching questions (case-insensitive)', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to learn JavaScript',
        questionSummarized: 'How to learn JavaScript',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('JAVASCRIPT')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('How to learn JavaScript')
    })

    it('should show no results message when no matches found', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to learn JavaScript',
        questionSummarized: 'How to learn JavaScript',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('python')

      expect(wrapper.find('.no-results').exists()).toBe(true)
      expect(wrapper.find('.no-results').text()).toContain('python')
    })

    it('should display result count', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'JavaScript basics',
        questionSummarized: 'JavaScript basics',
        response: '',
        childIds: []
      }
      chatStore.messagesById['msg2'] = {
        id: 'msg2',
        question: 'Advanced JavaScript',
        questionSummarized: 'Advanced JavaScript',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1', 'msg2']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('javascript')

      expect(wrapper.find('.result-count').text()).toBe('(2)')
    })

    it('should display notebook title for each result', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'First question about testing',
        questionSummarized: 'First question about testing',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('testing')

      expect(wrapper.find('.result-notebook').text()).toBe('First question about testing')
    })

    it('should search child questions in the tree', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Parent question',
        questionSummarized: 'Parent question',
        response: '',
        childIds: ['msg2']
      }
      chatStore.messagesById['msg2'] = {
        id: 'msg2',
        question: 'Child question about recursion',
        questionSummarized: 'Child question about recursion',
        response: '',
        parentId: 'msg1',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('recursion')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('Child question about recursion')
    })

    it('should search deeply nested child questions', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Root question',
        questionSummarized: 'Root question',
        response: '',
        childIds: ['msg2']
      }
      chatStore.messagesById['msg2'] = {
        id: 'msg2',
        question: 'Level 1 child',
        questionSummarized: 'Level 1 child',
        response: '',
        parentId: 'msg1',
        childIds: ['msg3']
      }
      chatStore.messagesById['msg3'] = {
        id: 'msg3',
        question: 'Deeply nested question',
        questionSummarized: 'Deeply nested question',
        response: '',
        parentId: 'msg2',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('deeply nested')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('Deeply nested question')
    })

    it('should search across multiple notebooks', async () => {
      const chat1 = chatStore.createNewChat()
      const chat2 = chatStore.createNewChat()

      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Vue testing guide',
        questionSummarized: 'Vue testing guide',
        response: '',
        childIds: []
      }
      chatStore.messagesById['msg2'] = {
        id: 'msg2',
        question: 'React testing patterns',
        questionSummarized: 'React testing patterns',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat1.id).rootMessageIds = ['msg1']
      chatStore.chats.find(c => c.id === chat2.id).rootMessageIds = ['msg2']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('testing')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(2)
    })

    it('should navigate to question when result is clicked', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Clickable question',
        questionSummarized: 'Clickable question',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('clickable')

      const resultItem = wrapper.find('.result-item')
      await resultItem.trigger('click')

      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: newChat.id, questionId: 'msg1' }
      })
    })

    it('should switch to correct chat when navigating to result', async () => {
      // Create chat1 and add a message to it
      const chat1 = chatStore.createNewChat()
      chatStore.messagesById['msg0'] = {
        id: 'msg0',
        question: 'First notebook question',
        questionSummarized: 'First notebook question',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat1.id).rootMessageIds = ['msg0']
      chatStore.rootMessageIds = ['msg0'] // sync current chat

      // Create chat2 and add a message to it
      const chat2 = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Second notebook unique',
        questionSummarized: 'Second notebook unique',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat2.id).rootMessageIds = ['msg1']
      chatStore.rootMessageIds = ['msg1'] // sync current chat

      // Switch back to chat1
      chatStore.switchToChat(chat1.id)

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(chatStore.currentChatId).toBe(chat1.id)

      await wrapper.find('.search-input').setValue('unique')
      await flushPromises()

      const resultItems = wrapper.findAll('.result-item')
      expect(resultItems.length).toBe(1)
      await resultItems[0].trigger('click')

      expect(chatStore.currentChatId).toBe(chat2.id)
    })

    it('should clear search results when input is cleared', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Test question',
        questionSummarized: 'Test question',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Type search query
      await wrapper.find('.search-input').setValue('test')
      expect(wrapper.find('.search-results').exists()).toBe(true)

      // Clear search
      await wrapper.find('.search-input').setValue('')
      expect(wrapper.find('.search-results').exists()).toBe(false)
      expect(wrapper.find('.notebooks-grid').exists()).toBe(true)
    })

    it('should not show search results for whitespace-only queries', async () => {
      chatStore.createNewChat()

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('   ')

      expect(wrapper.find('.search-results').exists()).toBe(false)
      expect(wrapper.find('.notebooks-grid').exists()).toBe(true)
    })
  })
})
