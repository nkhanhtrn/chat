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
  sendChatMessage: vi.fn(),
  abortChatMessage: vi.fn()
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
      wrapper = mount(App, {
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
})
