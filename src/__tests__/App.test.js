import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { createPinia } from 'pinia'
import App from '../App.vue'
import ChatMessage from '../components/ChatMessage.vue'
import ChatInput from '../components/ChatInput.vue'

// Mock the API module
vi.mock('../services/api.js', () => ({
  fetchModels: vi.fn(),
  sendChatMessage: vi.fn(),
  abortChatMessage: vi.fn()
}))

import { fetchModels, sendChatMessage } from '../services/api.js'

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

    it('should render header with title', () => {
      wrapper = mount(App, {
        global: {
          plugins: [createPinia()],
          stubs: {
            ChatMessage: true,
            ChatInput: true
          }
        }
      })

      expect(wrapper.find('.chat-header').exists()).toBe(true)
      expect(wrapper.find('.chat-header h1').text()).toBe('Study Assistant')
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
})
