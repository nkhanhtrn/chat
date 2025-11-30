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
})
