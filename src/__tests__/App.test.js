import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'
import DevToolbar from '../components/DevToolbar.vue'

// Mock the API module
vi.mock('../services/api.js', () => ({
  fetchModels: vi.fn(),
  sendChatMessage: vi.fn()
}))

import { fetchModels, sendChatMessage } from '../services/api.js'

// Mock loadChatState to always return null for clean state
vi.mock('../services/storage.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    loadChatState: () => null,
    clearAllStorage: vi.fn()
  }
})

// Mock the environment composable with default dev mode
vi.mock('../composables/useEnvironment.js')

import { getIsDev, getDefaultQuestions } from '../composables/useEnvironment.js'

describe('App', () => {
  let wrapper

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }

    // Reset mocks
    vi.clearAllMocks()

    // Default mock implementations
    fetchModels.mockResolvedValue([
      { id: 'test-model-1' },
      { id: 'test-model-2' }
    ])

    sendChatMessage.mockImplementation((messages, model, onChunk) => {
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
      wrapper = mount(App, {
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
      wrapper = mount(App, {
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
      wrapper = mount(App,{ 
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
      wrapper = mount(App, {
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
      wrapper = mount(App, {
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
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(fetchModels).toHaveBeenCalledTimes(1)
    })

    it('should use first model from fetched models', async () => {
      fetchModels.mockResolvedValue([
        { id: 'model-a' },
        { id: 'model-b' }
      ])

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Check the chatStore instead of vm.currentModel
      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()
      expect(chatStore.currentModel).toBe('model-a')
    })

    it('should show error when no models available', async () => {
      fetchModels.mockResolvedValue([])

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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
      sendChatMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(App, {
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
      sendChatMessage.mockRejectedValue(new Error('API Error'))

      wrapper = mount(App, {
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
      sendChatMessage.mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce('Success')

      wrapper = mount(App, {
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

      // First message causes error
      await chatInput.vm.$emit('send', 'First')
      await flushPromises()
      expect(wrapper.find('.error-message').exists()).toBe(true)

      // Second message should clear error
      await chatInput.vm.$emit('send', 'Second')
      await wrapper.vm.$nextTick()
      expect(wrapper.vm.error).toBeNull()
    })
  })

  describe('Message Display', () => {
    it('should hide welcome message when messages exist', async () => {
      wrapper = mount(App, {
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
      wrapper = mount(App, {
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
      wrapper = mount(App, {
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
    it('should pass disabled prop to ChatInput when streaming', async () => {
      let resolveMessage
      sendChatMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      chatInput.vm.$emit('send', 'Test')
      await wrapper.vm.$nextTick()

      expect(chatInput.props('disabled')).toBe(true)

      resolveMessage('Response')
      await flushPromises()
      expect(chatInput.props('disabled')).toBe(false)
    })

    it('should pass isLoading prop to ChatInput when streaming', async () => {
      let resolveMessage
      sendChatMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)
      chatInput.vm.$emit('send', 'Test')
      await wrapper.vm.$nextTick()

      expect(chatInput.props('isLoading')).toBe(true)

      resolveMessage('Response')
      await flushPromises()
      expect(chatInput.props('isLoading')).toBe(false)
    })
  })

  describe('DevToolbar', () => {
    it('should render DevToolbar in development mode', () => {
      getIsDev.mockReturnValue(true)

      wrapper = mount(App, {
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

      wrapper = mount(App, {
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

      wrapper = mount(App, {
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

      wrapper = mount(App, {
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
      wrapper = mount(App, {
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

      // Should have called sendChatMessage
      expect(sendChatMessage).toHaveBeenCalled()
    })

    it('should render all prepopulated questions', async () => {
      wrapper = mount(App, {
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

      wrapper = mount(App, {
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

      wrapper = mount(App, {
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
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const examplePrompts = wrapper.findAll('.example-prompts li.clickable')
      const firstPrompt = examplePrompts[0]

      await firstPrompt.trigger('click')
      await flushPromises()

      // Verify sendChatMessage was called
      expect(sendChatMessage).toHaveBeenCalled()
    })
  })

  describe('handleSendMessage streaming behavior', () => {
    it('should return false when already streaming', async () => {
      let resolveMessage
      sendChatMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(App, {
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

      // Should have only called sendChatMessage once
      expect(sendChatMessage).toHaveBeenCalledTimes(1)

      resolveMessage('Response')
      await flushPromises()
    })

    it('should return false when message is empty', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send empty message - should return false
      chatInput.vm.$emit('send', '')
      await wrapper.vm.$nextTick()

      // Should not have called sendChatMessage
      expect(sendChatMessage).not.toHaveBeenCalled()
    })

    it('should return false when message is only whitespace', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send whitespace-only message - should return false
      chatInput.vm.$emit('send', '   ')
      await wrapper.vm.$nextTick()

      // Should not have called sendChatMessage
      expect(sendChatMessage).not.toHaveBeenCalled()
    })

    it('should prevent multiple messages during streaming', async () => {
      let resolveMessage
      sendChatMessage.mockImplementation(() => {
        return new Promise((resolve) => {
          resolveMessage = resolve
        })
      })

      wrapper = mount(App, {
        global: {
          plugins: [createPinia()]
        }
      })

      await flushPromises()

      const { useChatStore } = await import('../stores/chat.js')
      const chatStore = useChatStore()

      const chatInput = wrapper.findComponent(ChatInput)

      // Send first message
      chatInput.vm.$emit('send', 'First')
      await wrapper.vm.$nextTick()

      // Verify streaming is active
      expect(chatStore.isStreaming).toBe(true)

      // Try to send multiple messages while streaming
      chatInput.vm.$emit('send', 'Second')
      chatInput.vm.$emit('send', 'Third')
      await wrapper.vm.$nextTick()

      // Should still only have one call to sendChatMessage
      expect(sendChatMessage).toHaveBeenCalledTimes(1)

      resolveMessage('Response')
      await flushPromises()

      // Now streaming is complete
      expect(chatStore.isStreaming).toBe(false)

      // Now should be able to send another message
      chatInput.vm.$emit('send', 'Fourth')
      await flushPromises()

      // Should have been called twice now
      expect(sendChatMessage).toHaveBeenCalledTimes(2)
    })
  })

  describe('Fixed Navigation Header', () => {
    it('should not show fixed nav header initially (scroll position 0)', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      expect(wrapper.find('.fixed-nav-header').exists()).toBe(false)
    })

    it('should not show fixed nav header when no root message exists', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Simulate scrolling past threshold
      const messagesContainer = wrapper.find('.messages-container')
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 200,
        writable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      // Still should not show because no root message
      expect(wrapper.find('.fixed-nav-header').exists()).toBe(false)
    })

    it('should show fixed nav header when scrolled past threshold with messages', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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

      // Simulate scrolling past threshold (100px)
      const messagesContainer = wrapper.find('.messages-container')
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.fixed-nav-header').exists()).toBe(true)
    })

    it('should hide fixed nav header when scrolled back to top', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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

      const messagesContainer = wrapper.find('.messages-container')

      // First scroll down
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true,
        configurable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.fixed-nav-header').exists()).toBe(true)

      // Then scroll back up
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 50,
        writable: true,
        configurable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.fixed-nav-header').exists()).toBe(false)
    })

    it('should show root navigation buttons in fixed header', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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

      // Scroll down
      const messagesContainer = wrapper.find('.messages-container')
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      const fixedHeader = wrapper.find('.fixed-nav-header')
      expect(fixedHeader.exists()).toBe(true)

      // Should have root nav with prev/next buttons
      expect(fixedHeader.find('.fixed-root-nav').exists()).toBe(true)
      expect(fixedHeader.find('.root-nav-indicator').exists()).toBe(true)
    })

    it('should show correct root navigation indicator in fixed header', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
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

      // Scroll down
      const messagesContainer = wrapper.find('.messages-container')
      Object.defineProperty(messagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true
      })
      await messagesContainer.trigger('scroll')
      await wrapper.vm.$nextTick()

      const indicator = wrapper.find('.fixed-nav-header .root-nav-indicator')
      expect(indicator.text()).toBe('1 / 1')
    })

    it('should add scroll listener on mount', async () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      // Unmount and re-mount to verify scroll listener works
      wrapper.unmount()
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      await flushPromises()

      const newMessagesContainer = wrapper.find('.messages-container')
      // Verify the scroll handler is working by triggering scroll
      Object.defineProperty(newMessagesContainer.element, 'scrollTop', {
        value: 150,
        writable: true
      })
      await newMessagesContainer.trigger('scroll')

      // If scroll listener wasn't added, isScrolledDown wouldn't change
      expect(wrapper.vm.isScrolledDown).toBe(true)
    })
  })

  describe('Question Selection from Sidebar', () => {
    it('should switch to correct chat when selecting question from different chat', async () => {
      wrapper = mount(App, {
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

      // Should switch to chat1
      expect(chatStore.currentChatId).toBe(chat1Id)
      expect(chatStore.currentRootIndex).toBe(0)
      expect(chatStore.currentMessageId).toBe('chat1-msg1')
    })

    it('should set correct rootIndex when selecting question', async () => {
      wrapper = mount(App, {
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

      // Currently on last message (index 2)
      expect(chatStore.currentRootIndex).toBe(2)

      // Select second question (index 1)
      const question = { id: 'msg2', chatId: chatId, rootIndex: 1 }
      await wrapper.vm.handleSelectQuestion(question)

      expect(chatStore.currentRootIndex).toBe(1)
      expect(chatStore.currentMessageId).toBe('msg2')
    })

    it('should not switch chat when selecting question from current chat', async () => {
      wrapper = mount(App, {
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

      // Spy on switchToChat to verify it's not called unnecessarily
      const switchToChatSpy = vi.spyOn(chatStore, 'switchToChat')

      // Select question from same chat
      const question = { id: 'msg1', chatId: chatId, rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      // Should not call switchToChat since we're already on the correct chat
      expect(switchToChatSpy).not.toHaveBeenCalled()
      expect(chatStore.currentRootIndex).toBe(0)
    })

    it('should navigate to message and set correct currentMessageId', async () => {
      wrapper = mount(App, {
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

      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Question 2',
        response: 'Response 2'
      })

      // Select first question
      const question = { id: 'msg1', chatId: chatId, rootIndex: 0 }
      await wrapper.vm.handleSelectQuestion(question)

      expect(chatStore.currentMessageId).toBe('msg1')
    })
  })
})
