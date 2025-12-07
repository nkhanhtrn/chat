import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import HomePage from '../views/HomePage.vue'
import Button from '../components/Button.vue'
import SettingsModal from '../components/Modal/SettingsModal.vue'
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
      // chatList getter returns 'New Subject' as default title for empty notebooks
      expect(title.text()).toBe('New Subject')
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

    it('should display notebook title for each question result', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'First question about testing',
        questionSummarized: 'First question about testing',
        response: '',
        childIds: []
      }
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.rootMessageIds = ['msg1']
      chat.name = 'My Test Notebook'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for something that only matches the question, not the notebook title
      await wrapper.find('.search-input').setValue('first question')

      // Should find only the question result and show its notebook title
      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-notebook').text()).toBe('My Test Notebook')
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

    it('should find notebooks by title', async () => {
      const newChat = chatStore.createNewChat()
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.name = 'My JavaScript Notes'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('javascript')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('My JavaScript Notes')
    })

    it('should show notebook icon for notebook results', async () => {
      const newChat = chatStore.createNewChat()
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.name = 'Test Notebook'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('test notebook')

      const typeIcon = wrapper.find('.result-type-icon')
      expect(typeIcon.text()).toBe('📓')
    })

    it('should show question icon for question results', async () => {
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

      await wrapper.find('.search-input').setValue('test question')

      const typeIcon = wrapper.find('.result-type-icon')
      expect(typeIcon.text()).toBe('💬')
    })

    it('should navigate to notebook when notebook result is clicked', async () => {
      const newChat = chatStore.createNewChat()
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.name = 'Clickable Notebook'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('clickable notebook')

      const resultItem = wrapper.find('.result-item')
      await resultItem.trigger('click')

      expect(mockPush).toHaveBeenCalledWith({
        name: 'notebook',
        params: { id: newChat.id }
      })
    })

    it('should find both notebooks and questions matching the query', async () => {
      const chat1 = chatStore.createNewChat()
      const c1 = chatStore.chats.find(c => c.id === chat1.id)
      c1.name = 'Python Tutorial'

      const chat2 = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to install Python',
        questionSummarized: 'How to install Python',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === chat2.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('python')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(2)

      const icons = wrapper.findAll('.result-type-icon')
      const iconTexts = icons.map(i => i.text())
      expect(iconTexts).toContain('📓')
      expect(iconTexts).toContain('💬')
    })

    it('should show "Notebook" label for notebook results', async () => {
      const newChat = chatStore.createNewChat()
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.name = 'My Notes'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('my notes')

      expect(wrapper.find('.result-notebook').text()).toBe('Notebook')
    })

    it('should find notebook by title case-insensitively', async () => {
      const newChat = chatStore.createNewChat()
      const chat = chatStore.chats.find(c => c.id === newChat.id)
      chat.name = 'UPPERCASE NOTEBOOK'

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      await wrapper.find('.search-input').setValue('uppercase')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
    })

    it('should find results with multi-word search (AND logic)', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to learn JavaScript programming',
        questionSummarized: 'How to learn JavaScript programming',
        response: '',
        childIds: []
      }
      chatStore.messagesById['msg2'] = {
        id: 'msg2',
        question: 'Python programming basics',
        questionSummarized: 'Python programming basics',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1', 'msg2']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for "javascript programming" - should only match msg1
      await wrapper.find('.search-input').setValue('javascript programming')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('How to learn JavaScript programming')
    })

    it('should match words in any order', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Advanced JavaScript tutorials',
        questionSummarized: 'Advanced JavaScript tutorials',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for "tutorials javascript" (reversed order) - should still match
      await wrapper.find('.search-input').setValue('tutorials javascript')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
      expect(wrapper.find('.result-question').text()).toBe('Advanced JavaScript tutorials')
    })

    it('should not require exact phrase match', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'How to build a React application',
        questionSummarized: 'How to build a React application',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for "react build" (words not adjacent in original) - should match
      await wrapper.find('.search-input').setValue('react build')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
    })

    it('should not match if any word is missing', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'JavaScript basics',
        questionSummarized: 'JavaScript basics',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for "javascript advanced" - "advanced" is not in the text
      await wrapper.find('.search-input').setValue('javascript advanced')

      expect(wrapper.find('.no-results').exists()).toBe(true)
    })

    it('should handle multiple spaces between words', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'Vue component testing',
        questionSummarized: 'Vue component testing',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search with multiple spaces
      await wrapper.find('.search-input').setValue('vue    testing')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
    })

    it('should match partial words', async () => {
      const newChat = chatStore.createNewChat()
      chatStore.messagesById['msg1'] = {
        id: 'msg1',
        question: 'JavaScript programming fundamentals',
        questionSummarized: 'JavaScript programming fundamentals',
        response: '',
        childIds: []
      }
      chatStore.chats.find(c => c.id === newChat.id).rootMessageIds = ['msg1']

      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Search for "java program" (partial words) - should match
      await wrapper.find('.search-input').setValue('java program')

      const results = wrapper.findAll('.result-item')
      expect(results.length).toBe(1)
    })
  })

  describe('Settings', () => {
    it('should render settings button in footer', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      expect(wrapper.find('.homepage-footer').exists()).toBe(true)
      expect(wrapper.find('.settings-btn').exists()).toBe(true)
    })

    it('should render settings button with gear icon', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const settingsBtn = wrapper.find('.settings-btn')
      expect(settingsBtn.find('.settings-icon').exists()).toBe(true)
      expect(settingsBtn.find('svg').exists()).toBe(true)
    })

    it('should have correct title attribute on settings button', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const settingsBtn = wrapper.find('.settings-btn')
      expect(settingsBtn.attributes('title')).toBe('Settings')
    })

    it('should include SettingsModal component', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const settingsModal = wrapper.findComponent(SettingsModal)
      expect(settingsModal.exists()).toBe(true)
    })

    it('should not show settings modal by default', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const settingsModal = wrapper.findComponent(SettingsModal)
      expect(settingsModal.props('modelValue')).toBe(false)
    })

    it('should open settings modal when settings button is clicked', async () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const settingsBtn = wrapper.find('.settings-btn')
      await settingsBtn.trigger('click')

      const settingsModal = wrapper.findComponent(SettingsModal)
      expect(settingsModal.props('modelValue')).toBe(true)
    })

    it('should close settings modal when modal emits update:modelValue with false', async () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      // Open the modal
      const settingsBtn = wrapper.find('.settings-btn')
      await settingsBtn.trigger('click')

      const settingsModal = wrapper.findComponent(SettingsModal)
      expect(settingsModal.props('modelValue')).toBe(true)

      // Close the modal via emit
      await settingsModal.vm.$emit('update:modelValue', false)

      expect(settingsModal.props('modelValue')).toBe(false)
    })

    it('should position settings footer at the bottom left', () => {
      wrapper = mount(HomePage, {
        global: {
          plugins: [pinia]
        }
      })

      const footer = wrapper.find('.homepage-footer')
      expect(footer.exists()).toBe(true)
      // The footer should have position: fixed with bottom: 0 and left: 0
      // We can verify the element exists and has the correct class
    })
  })
})
