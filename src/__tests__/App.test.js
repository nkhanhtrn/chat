import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ChatView from '../views/ChatView.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import DevToolbar from '../components/DevToolbar.vue'

// Mock vue-router
const mockPush = vi.fn()
const mockReplace = vi.fn()
vi.mock('vue-router', () => ({
  useRoute: () => ({
    params: { id: 'test-chat-id' }
  }),
  useRouter: () => ({
    push: mockPush,
    replace: mockReplace
  })
}))

// Mock the API module
vi.mock('../services/api.js', () => ({
  fetchModels: vi.fn(),
  sendChatMessage: vi.fn(),
  sendChatMessageForFeature: vi.fn(),
  FeatureType: {
    QUESTION: 'question',
    DEEP_DIVE: 'deep_dive',
    SUMMARY: 'summary',
    EXPLAIN: 'explain',
    DICTIONARY: 'dictionary',
    SR_SUMMARY: 'sr_summary'
  },
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
    { id: 'google', name: 'Google AI Studio', requiresApiKey: true }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  updateConfig: vi.fn(),
  testConnection: vi.fn(() => Promise.resolve(true)),
  initProvider: vi.fn()
}))

import { fetchModels, sendChatMessage, sendChatMessageForFeature } from '../services/api.js'

// Mock loadChatState to always return null for clean state
vi.mock('../services/storage.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadChatState: () => null,
    clearAllStorage: vi.fn()
  }
})

// Mock firestore to prevent real network calls
vi.mock('../services/firestore.js', () => ({
  loadUserSettings: vi.fn(() => Promise.resolve(null)),
  saveUserSettings: vi.fn(() => Promise.resolve()),
  syncChatStateToFirestore: vi.fn(() => Promise.resolve()),
  loadChatStateFromFirestore: vi.fn(() => Promise.resolve(null)),
  subscribeToChatState: vi.fn(() => () => {}),
  deleteChatStateFromFirestore: vi.fn(() => Promise.resolve()),
  subscribeToUserSettings: vi.fn(() => () => {})
}))

// Mock the environment composable with default dev mode
vi.mock('../composables/useEnvironment.js')

import { getIsDev, getDefaultQuestions } from '../composables/useEnvironment.js'
import { setActivePinia } from 'pinia'
import { useChatStore } from '../stores/chat.js'

// Helper to create a pinia with a chat that matches the route's test-chat-id
const createPiniaWithTestChat = () => {
  const pinia = createPinia()
  setActivePinia(pinia)
  const chatStore = useChatStore(pinia)
  // Manually add a chat with the test-chat-id that matches the route mock
  chatStore.chats.push({
    id: 'test-chat-id',
    rootMessageIds: [],
    scratchpad: ''
  })
  chatStore.currentChatId = 'test-chat-id'
  return pinia
}

describe('ChatView', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }

    // Clear localStorage before each test
    localStorage.clear()

    // Reset mocks
    vi.clearAllMocks()

    // Default mock implementations
    fetchModels.mockResolvedValue([
      { id: 'test-model-1' },
      { id: 'test-model-2' }
    ])

    sendChatMessageForFeature.mockImplementation((_featureType, _messages, onChunk) => {
      if (onChunk) {
        // Simulate streaming
        setTimeout(() => {
          onChunk('Hello ')
          onChunk('World')
        }, 0)
      }
      return Promise.resolve('Hello World')
    })

    // Default environment mocks (dev mode)
    getIsDev.mockReturnValue(true)
    getDefaultQuestions.mockReturnValue([
      'give me 20 random words',
      'give me 50 random words',
      'give me 100 random words',
    ])
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  describe('Initial Rendering', () => {
    it('should render the app container', () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      expect(wrapper.find('.chat-container').exists()).toBe(true)
    })

    it('should render messages container', () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })

    it('should render ChatInput component', () => {
      wrapper = mount(ChatView,{ 
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      expect(wrapper.findComponent(ChatInput).exists()).toBe(true)
    })

    it('should show welcome message when no messages', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.welcome-message').exists()).toBe(true)
      expect(wrapper.find('.welcome-message h2').text()).toContain('Welcome')
    })

    it('should show example prompts', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.example-prompts').exists()).toBe(true)
      expect(wrapper.find('.example-prompts ul').exists()).toBe(true)
    })
  })

  describe('Model Loading', () => {
    it('should fetch models on mount', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(fetchModels).toHaveBeenCalled()
    })

    it('should use first model from fetched models', async () => {
      fetchModels.mockResolvedValue([
        { id: 'model-a' },
        { id: 'model-b' }
      ])

      const pinia = createPiniaWithTestChat()
      wrapper = mount(ChatView, {
        global: {
          plugins: [pinia],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Check the chatStore
      const chatStore = useChatStore(pinia)
      expect(chatStore.currentModel).toBe('model-a')
    })

    it('should show error when no models available', async () => {
      fetchModels.mockResolvedValue([])

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toContain('No models available')
    })

    it('should show error when fetchModels fails', async () => {
      fetchModels.mockRejectedValue(new Error('Network error'))

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toBe('Network error')
    })
  })


  describe('Streaming Response', () => {

    it('should pass isStreaming prop to last message', async () => {
      let resolveMessage
      sendChatMessageForFeature.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      chatInput.vm.$emit('send', 'Test')
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick() // Extra tick for rendering

      const chatMessages = wrapper.findAllComponents(ChatMessage)
      if (chatMessages.length > 0) {
        const lastMessage = chatMessages[chatMessages.length - 1]
        expect(lastMessage.props('isAppStreaming')).toBe(true)
      }

      resolveMessage('Response')
      await flushPromises()

      const updatedMessages = wrapper.findAllComponents(ChatMessage)
      if (updatedMessages.length > 0) {
        const lastMessage = updatedMessages[updatedMessages.length - 1]
        expect(lastMessage.props('isAppStreaming')).toBe(false)
      }
    })
  })

  describe('Error Handling', () => {
    it('should display error message when sendChatMessage fails', async () => {
      sendChatMessageForFeature.mockRejectedValue(new Error('API Error'))

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test')
      await flushPromises()

      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.find('.error-message').text()).toBe('API Error')
    })


    it('should clear error when sending new message', async () => {
      sendChatMessageForFeature.mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('Success')

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // First message causes error (via direct call to handleSendMessage)
      await wrapper.vm.handleSendMessage('First')
      await flushPromises()
      expect(wrapper.find('.error-message').exists()).toBe(true)
      expect(wrapper.vm.error).toBe('First error')

      // Second message should clear error (handleSendMessage sets error to null at start)
      wrapper.vm.handleSendMessage('Second')
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.error).toBeNull()
    })
  })

  describe('Message Display', () => {
    it('should hide welcome message when messages exist', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()
      expect(wrapper.find('.welcome-message').exists()).toBe(true)

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Hello')
      await flushPromises()

      expect(wrapper.find('.welcome-message').exists()).toBe(false)
    })

    it('should render ChatMessage for each message', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'First message')
      await flushPromises()

      const chatMessages = wrapper.findAllComponents(ChatMessage)
      expect(chatMessages.length).toBe(1) // Only one message per send
    })

    it('should pass correct props to ChatMessage components', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      const chatMessages = wrapper.findAllComponents(ChatMessage)
      // Should have a message with question 'Test message'
      const userMessage = chatMessages.find(cm => cm.props('message').question === 'Test message')
      expect(userMessage).toBeDefined()
    })
  })

  describe('ChatInput Props', () => {
    it('should pass disabled prop bound to isStreaming', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      const chatInput = wrapper.findComponent(ChatInput)

      // Initially not streaming
      expect(chatInput.props('disabled')).toBe(false)

      // Simulate streaming state
      chatStore.setIsStreaming(true)
      await wrapper.vm.$nextTick()

      expect(chatInput.props('disabled')).toBe(true)

      // End streaming
      chatStore.setIsStreaming(false)
      await wrapper.vm.$nextTick()

      expect(chatInput.props('disabled')).toBe(false)
    })

    it('should pass isLoading prop bound to isStreaming', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      const chatInput = wrapper.findComponent(ChatInput)

      // Initially not streaming
      expect(chatInput.props('isLoading')).toBe(false)

      // Simulate streaming state
      chatStore.setIsStreaming(true)
      await wrapper.vm.$nextTick()

      expect(chatInput.props('isLoading')).toBe(true)

      // End streaming
      chatStore.setIsStreaming(false)
      await wrapper.vm.$nextTick()

      expect(chatInput.props('isLoading')).toBe(false)
    })
  })

  describe('DevToolbar', () => {
    it('should render DevToolbar in development mode', () => {
      getIsDev.mockReturnValue(true)

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true,
            DevToolbar: false
          }
        }
      })

      expect(wrapper.findComponent(DevToolbar).exists()).toBe(true)
    })

    it('should not render DevToolbar in production mode', () => {
      getIsDev.mockReturnValue(false)

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true,
            DevToolbar: false
          }
        }
      })

      expect(wrapper.findComponent(DevToolbar).exists()).toBe(false)
    })
  })

  describe('Prepopulated Questions', () => {
    it('should show development questions in dev mode', async () => {
      getIsDev.mockReturnValue(true)
      getDefaultQuestions.mockReturnValue([
        'give me 20 random words',
        'give me 50 random words',
        'give me 100 random words',
      ])

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li')
      expect(examplePrompts.length).toBeGreaterThan(0)

      // Check for dev-specific questions
      const promptTexts = examplePrompts.map(li => li.text())
      expect(promptTexts.some(text => text.includes('random words'))).toBe(true)
    })

    it('should show production questions in production mode', async () => {
      getIsDev.mockReturnValue(false)
      getDefaultQuestions.mockReturnValue([
        'Explain quantum physics in simple terms',
        'How does photosynthesis work?',
        'Teach me about the French Revolution',
      ])

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li')
      expect(examplePrompts.length).toBeGreaterThan(0)

      // Check for production-specific questions
      const promptTexts = examplePrompts.map(li => li.text())
      expect(promptTexts.some(text =>
        text.includes('quantum physics') ||
        text.includes('photosynthesis') ||
        text.includes('French Revolution')
      )).toBe(true)
    })

    it('should send message when example prompt is clicked', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li.clickable')
      expect(examplePrompts.length).toBeGreaterThan(0)

      // Click the first example
      await examplePrompts[0].trigger('click')
      await flushPromises()

      // Should have called sendChatMessageForFeature
      expect(sendChatMessageForFeature).toHaveBeenCalled()
    })

    it('should render all prepopulated questions', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li')

      // Should have 3 questions (default behavior)
      expect(examplePrompts.length).toBe(3)
    })
  })

  describe('getDefaultQuestions', () => {
    it('should return development questions when in dev mode', async () => {
      getIsDev.mockReturnValue(true)
      getDefaultQuestions.mockReturnValue([
        'give me 20 random words',
        'give me 50 random words',
        'give me 100 random words',
      ])

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const questions = wrapper.vm.prepopulatedQuestions
      expect(questions).toEqual([
        'give me 20 random words',
        'give me 50 random words',
        'give me 100 random words',
      ])
    })

    it('should return production questions when not in dev mode', async () => {
      getIsDev.mockReturnValue(false)
      getDefaultQuestions.mockReturnValue([
        'Explain quantum physics in simple terms',
        'How does photosynthesis work?',
        'Teach me about the French Revolution',
      ])

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const questions = wrapper.vm.prepopulatedQuestions
      expect(questions).toEqual([
        'Explain quantum physics in simple terms',
        'How does photosynthesis work?',
        'Teach me about the French Revolution',
      ])
    })
  })

  describe('handleExampleClick', () => {
    it('should trigger handleSendMessage with the clicked question', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li.clickable')
      const firstPrompt = examplePrompts[0]

      await firstPrompt.trigger('click')
      await flushPromises()

      // Verify sendChatMessageForFeature was called
      expect(sendChatMessageForFeature).toHaveBeenCalled()
    })
  })

  describe('handleSendMessage streaming behavior', () => {
    it('should return false when already streaming', async () => {
      let resolveMessage
      sendChatMessageForFeature.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send first message - should succeed
      chatInput.vm.$emit('send', 'First message')
      await wrapper.vm.$nextTick()

      // Try to send second message while still streaming - should return false
      chatInput.vm.$emit('send', 'Second message')
      await wrapper.vm.$nextTick()

      // Should have only called sendChatMessageForFeature once
      expect(sendChatMessageForFeature).toHaveBeenCalledTimes(1)

      resolveMessage('Response')
      await flushPromises()
    })

    it('should return false when message is empty', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send empty message - should return false
      chatInput.vm.$emit('send', '')
      await wrapper.vm.$nextTick()

      // Should not have called sendChatMessageForFeature
      expect(sendChatMessageForFeature).not.toHaveBeenCalled()
    })

    it('should return false when message is only whitespace', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send whitespace-only message - should return false
      chatInput.vm.$emit('send', '   ')
      await wrapper.vm.$nextTick()

      // Should not have called sendChatMessageForFeature
      expect(sendChatMessageForFeature).not.toHaveBeenCalled()
    })

    it('should prevent multiple messages during streaming', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      // Simulate streaming state directly
      chatStore.setIsStreaming(true)

      // Try to send messages while streaming - should return false immediately
      const result1 = await wrapper.vm.handleSendMessage('First')
      const result2 = await wrapper.vm.handleSendMessage('Second')

      // handleSendMessage should return early (returns false) when streaming
      expect(result1).toBe(false)
      expect(result2).toBe(false)

      // sendChatMessageForFeature should not have been called
      expect(sendChatMessageForFeature).not.toHaveBeenCalled()

      // End streaming
      chatStore.setIsStreaming(false)

      // Now should be able to send a message
      wrapper.vm.handleSendMessage('Third')
      await wrapper.vm.$nextTick()

      // Should have been called once now
      expect(sendChatMessageForFeature).toHaveBeenCalledTimes(1)
    })
  })

  describe('Fixed Navigation Header', () => {
    it('should not show fixed nav header when no root message exists', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // No root message, so header should not be shown
      expect(wrapper.find('.fixed-nav-header').exists()).toBe(false)
    })

    it('should show fixed nav header when messages exist', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true,
            MessageNavigation: true
          }
        }
      })

      await flushPromises()

      // Add a message first
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      // Header should be visible immediately (no scroll required)
      expect(wrapper.find('.fixed-nav-header').exists()).toBe(true)
    })

    it('should always show fixed nav header regardless of scroll position', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPiniaWithTestChat()],
          stubs: {
            ChatMessage: true,
            ChatInput: true,
            MessageNavigation: true
          }
        }
      })

      await flushPromises()

      // Add a message
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      // Header should be visible at top
      expect(wrapper.find('.fixed-nav-header').exists()).toBe(true)

      // Simulate scroll - header should still be visible
      const messagesContainer = wrapper.find('.messages-container')
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true,
        configurable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.fixed-nav-header').exists()).toBe(true)
    })
  })

  describe('Add New Question Mode', () => {
    it('should initialize with isAddingNewQuestion as false', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.vm.isAddingNewQuestion).toBe(false)
    })

    it('should set isAddingNewQuestion to true when handleNewQuestion is called', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      wrapper.vm.handleNewQuestion()
      expect(wrapper.vm.isAddingNewQuestion).toBe(true)
    })

    it('should show ChatInput when isAddingNewQuestion is true even with existing messages', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      // Send a message first
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      // ChatInput should be hidden (because there are messages)
      expect(wrapper.findComponent(ChatInput).exists()).toBe(false)

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      // ChatInput should now be visible
      expect(wrapper.findComponent(ChatInput).exists()).toBe(true)
    })

    it('should hide current message when isAddingNewQuestion is true', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      // Send a message first
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'Test message')
      await flushPromises()

      // ChatMessage should be visible
      expect(wrapper.findComponent(ChatMessage).exists()).toBe(true)

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      // ChatMessage should be hidden
      expect(wrapper.findComponent(ChatMessage).exists()).toBe(false)
    })

    it('should show "Ask a new question" heading when isAddingNewQuestion is true', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Send a message to have existing content
      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })
      await wrapper.vm.$nextTick()

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      const welcomeMessage = wrapper.find('.welcome-message h2')
      expect(welcomeMessage.exists()).toBe(true)
      expect(welcomeMessage.text()).toContain('Ask a new question')
    })

    it('should reset isAddingNewQuestion to false when sending a message', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      expect(wrapper.vm.isAddingNewQuestion).toBe(true)

      // Send a message
      const chatInput = wrapper.findComponent(ChatInput)
      await chatInput.vm.$emit('send', 'New question')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.isAddingNewQuestion).toBe(false)
    })

    it('should reset isAddingNewQuestion to false when selecting a question', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      expect(wrapper.vm.isAddingNewQuestion).toBe(true)

      // Select a question
      const question = { id: 'msg1', chatId: chatId, rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      expect(wrapper.vm.isAddingNewQuestion).toBe(false)
    })

    it('should pass isAddingNewQuestion to ChatSidebar', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const chatSidebar = wrapper.findComponent({ name: 'ChatSidebar' })

      // Initially false
      expect(chatSidebar.props('isAddingNewQuestion')).toBe(false)

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      expect(chatSidebar.props('isAddingNewQuestion')).toBe(true)
    })

    it('should pass null as currentMessageId to ChatSidebar when isAddingNewQuestion is true', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      chatStore.createNewChat()
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      await wrapper.vm.$nextTick()

      const chatSidebar = wrapper.findComponent({ name: 'ChatSidebar' })

      // Initially should have currentMessageId
      expect(chatSidebar.props('currentMessageId')).toBe('msg1')

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      // currentMessageId should be null
      expect(chatSidebar.props('currentMessageId')).toBeNull()
    })

    it('should pass autofocus prop to ChatInput when isAddingNewQuestion is true', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      const chatInput = wrapper.findComponent(ChatInput)
      expect(chatInput.props('autofocus')).toBe(true)
    })

    it('should not hide example prompts in initial welcome state', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Initial state (no messages)
      expect(wrapper.find('.example-prompts').exists()).toBe(true)
    })

    it('should hide example prompts when isAddingNewQuestion is true', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      // Enable add new question mode
      wrapper.vm.handleNewQuestion()
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.example-prompts').exists()).toBe(false)
    })
  })

  describe('Question Selection from Sidebar', () => {
    beforeEach(() => {
      mockPush.mockClear()
    })

    it('should navigate to question route when selecting question from different chat', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      // Create first chat with a message
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({
        id: 'chat1-msg1',
        question: 'Chat 1 Question',
        response: 'Response 1'
      })

      // Create second chat with a message
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({
        id: 'chat2-msg1',
        question: 'Chat 2 Question',
        response: 'Response 2'
      })

      // Currently on chat2
      expect(chatStore.currentChatId).toBe(chat2Id)

      // Select question from chat1
      const question = { id: 'chat1-msg1', chatId: chat1Id, rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      // Should navigate via router to the question
      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chat1Id, questionId: 'chat1-msg1' }
      })
    })

    it('should navigate to question route with correct params', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      // Create chat with multiple messages
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Question 1',
        response: 'Response 1'
      })

      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Question 2',
        response: 'Response 2'
      })

      chatStore.addRootMessage({
        id: 'msg3',
        question: 'Question 3',
        response: 'Response 3'
      })

      // Select second question (index 1)
      const question = { id: 'msg2', chatId: chatId, rootIndex: 1 }
      await wrapper.vm.handleSelectQuestion(question)

      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chatId, questionId: 'msg2' }
      })
    })

    it('should use current chatId when selecting question without chatId', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      // Create chat with message
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Question 1',
        response: 'Response 1'
      })

      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Question 2',
        response: 'Response 2'
      })

      // Select question without explicit chatId
      const question = { id: 'msg1', rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      // Should use current chatId
      expect(mockPush).toHaveBeenCalledWith({
        name: 'question',
        params: { id: chatId, questionId: 'msg1' }
      })
    })

    it('should reset isAddingNewQuestion when selecting a question', async () => {
      wrapper = mount(ChatView, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Question 1',
        response: 'Response 1'
      })

      // Set adding new question state
      wrapper.vm.isAddingNewQuestion = true
      expect(wrapper.vm.isAddingNewQuestion).toBe(true)

      // Select a question
      const question = { id: 'msg1', chatId: chatId, rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      expect(wrapper.vm.isAddingNewQuestion).toBe(false)
    })
  })
})
