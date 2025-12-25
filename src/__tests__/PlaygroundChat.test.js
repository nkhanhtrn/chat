import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import PlaygroundChat from '../views/PlaygroundChat.vue'

// Mock vue-router
const mockPush = vi.fn()
vi.mock('vue-router', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    useRouter: () => ({
      push: mockPush
    }),
    RouterLink: {
      template: '<a><slot /></a>'
    }
  }
})

// Mock LLM service
const mockFetchModels = vi.fn()
const mockSendChatMessage = vi.fn()
vi.mock('../services/llm/index.js', () => ({
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
    { id: 'google', name: 'Google AI Studio', requiresApiKey: true },
    { id: 'cerebras', name: 'Cerebras', requiresApiKey: true }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getProviderConfig: vi.fn((providerId) => {
    if (providerId === 'google') return { apiKeys: ['test-key'] }
    if (providerId === 'cerebras') return { apiKeys: ['test-key'] }
    return {}
  }),
  setProvider: vi.fn(),
  fetchModels: () => mockFetchModels(),
  sendChatMessage: (...args) => mockSendChatMessage(...args)
}))

describe('PlaygroundChat', () => {
  let wrapper

  beforeEach(() => {
    setActivePinia(createPinia())
    mockPush.mockClear()
    mockFetchModels.mockReset()
    mockSendChatMessage.mockReset()

    // Default mock implementations
    mockFetchModels.mockResolvedValue([
      { id: 'model-1', name: 'Test Model 1' },
      { id: 'model-2', name: 'Test Model 2' }
    ])
    mockSendChatMessage.mockResolvedValue('Mock response')
  })

  afterEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
  })

  const mountPlaygroundChat = async () => {
    wrapper = mount(PlaygroundChat, {
      global: {
        stubs: {
          SlideTransition: {
            template: '<div><slot /></div>'
          },
          MarkdownRenderer: {
            template: '<div class="markdown-stub">{{ content }}</div>',
            props: ['content']
          }
        }
      }
    })
    // Wait for onMounted to complete
    await vi.waitFor(() => {
      return wrapper.vm.providers.length > 0
    })
    return wrapper
  }

  describe('Rendering', () => {
    it('should render playground page container', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.playground-page').exists()).toBe(true)
    })

    it('should render header with title', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.playground-header h1').text()).toBe('AI Playground')
    })

    it('should render back link to home', async () => {
      await mountPlaygroundChat()
      const backLink = wrapper.find('.back-link')
      expect(backLink.exists()).toBe(true)
      expect(backLink.text()).toContain('Home')
    })

    it('should render provider select dropdown', async () => {
      await mountPlaygroundChat()
      const providerSelect = wrapper.find('.provider-select')
      expect(providerSelect.exists()).toBe(true)
    })

    it('should render model select dropdown', async () => {
      await mountPlaygroundChat()
      const modelSelect = wrapper.find('.model-select')
      expect(modelSelect.exists()).toBe(true)
    })

    it('should render messages container', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.messages-container').exists()).toBe(true)
    })

    it('should render input container', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.input-container').exists()).toBe(true)
    })

    it('should render textarea for message input', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('textarea').exists()).toBe(true)
    })

    it('should render send button', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.send-button').exists()).toBe(true)
    })

    it('should render clear chat button', async () => {
      await mountPlaygroundChat()
      const clearBtn = wrapper.find('.clear-button')
      expect(clearBtn.exists()).toBe(true)
      expect(clearBtn.text()).toBe('Clear chat')
    })
  })

  describe('Empty State', () => {
    it('should show empty state message when no messages', async () => {
      await mountPlaygroundChat()
      const emptyState = wrapper.find('.empty-state')
      expect(emptyState.exists()).toBe(true)
      expect(emptyState.text()).toContain('Start a conversation with the AI')
    })

    it('should show hint that messages are not saved', async () => {
      await mountPlaygroundChat()
      const hint = wrapper.find('.empty-state .hint')
      expect(hint.exists()).toBe(true)
      expect(hint.text()).toContain('Messages are not saved')
    })

    it('should hide empty state when messages exist', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'user', content: 'Hello' }]
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.empty-state').exists()).toBe(false)
    })
  })

  describe('Provider Selection', () => {
    it('should populate provider options from listProviders', async () => {
      await mountPlaygroundChat()
      const options = wrapper.find('.provider-select').findAll('option')
      expect(options.length).toBe(3)
      expect(options[0].text()).toBe('LM Studio')
      expect(options[1].text()).toBe('Google AI Studio')
      expect(options[2].text()).toBe('Cerebras')
    })

    it('should set initial provider from getCurrentProviderId', async () => {
      await mountPlaygroundChat()
      expect(wrapper.vm.selectedProvider).toBe('lmstudio')
    })

    it('should load models when provider changes', async () => {
      await mountPlaygroundChat()
      mockFetchModels.mockClear()

      const providerSelect = wrapper.find('.provider-select')
      await providerSelect.setValue('google')

      expect(mockFetchModels).toHaveBeenCalled()
    })
  })

  describe('Model Selection', () => {
    it('should populate model options from fetchModels', async () => {
      await mountPlaygroundChat()
      const options = wrapper.find('.model-select').findAll('option')
      expect(options.length).toBe(2)
      expect(options[0].text()).toBe('Test Model 1')
      expect(options[1].text()).toBe('Test Model 2')
    })

    it('should auto-select first model', async () => {
      await mountPlaygroundChat()
      expect(wrapper.vm.selectedModel).toBe('model-1')
    })

    it('should show loading message when models are empty', async () => {
      mockFetchModels.mockResolvedValue([])
      await mountPlaygroundChat()

      const options = wrapper.find('.model-select').findAll('option')
      expect(options[0].text()).toBe('Loading models...')
    })

    it('should disable model select when no models available', async () => {
      mockFetchModels.mockResolvedValue([])
      await mountPlaygroundChat()

      expect(wrapper.find('.model-select').attributes('disabled')).toBeDefined()
    })
  })

  describe('Sending Messages', () => {
    it('should disable send button when input is empty', async () => {
      await mountPlaygroundChat()
      const sendBtn = wrapper.find('.send-button')
      expect(sendBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable send button when input has text', async () => {
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      const sendBtn = wrapper.find('.send-button')
      expect(sendBtn.attributes('disabled')).toBeUndefined()
    })

    it('should add user message when send is clicked', async () => {
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello AI')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.vm.messages[0]).toEqual({ role: 'user', content: 'Hello AI' })
    })

    it('should clear input after sending', async () => {
      await mountPlaygroundChat()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello AI')
      await wrapper.find('.send-button').trigger('click')

      expect(textarea.element.value).toBe('')
    })

    it('should call sendChatMessage with correct params', async () => {
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello AI')
      await wrapper.find('.send-button').trigger('click')

      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'model-1',
        [{ role: 'user', content: 'Hello AI' }],
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should add empty assistant message for streaming', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {})) // Never resolves
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello AI')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.vm.messages.length).toBe(2)
      expect(wrapper.vm.messages[1]).toEqual({ role: 'assistant', content: '' })
    })

    it('should send on Enter key press', async () => {
      await mountPlaygroundChat()
      const textarea = wrapper.find('textarea')
      await textarea.setValue('Hello AI')
      await textarea.trigger('keydown.enter')

      expect(mockSendChatMessage).toHaveBeenCalled()
    })
  })

  describe('Streaming State', () => {
    it('should set isStreaming to true during message send', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.vm.isStreaming).toBe(true)
    })

    it('should show stop button while streaming', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.find('.stop-button').exists()).toBe(true)
      expect(wrapper.find('.send-button').exists()).toBe(false)
    })

    it('should display "Stop generating" text on stop button', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.find('.stop-button').text()).toBe('Stop generating')
    })

    it('should disable textarea while streaming', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.find('textarea').attributes('disabled')).toBeDefined()
    })

    it('should set isStreaming to false after message completes', async () => {
      mockSendChatMessage.mockResolvedValue('Response')
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      // Wait for async operation
      await vi.waitFor(() => !wrapper.vm.isStreaming)
      expect(wrapper.vm.isStreaming).toBe(false)
    })
  })

  describe('Stop Streaming', () => {
    it('should abort request when stop button is clicked', async () => {
      let abortSignal
      mockSendChatMessage.mockImplementation((model, messages, onChunk, signal) => {
        abortSignal = signal
        return new Promise(() => {})
      })

      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')
      await wrapper.find('.stop-button').trigger('click')

      expect(abortSignal.aborted).toBe(true)
    })
  })

  describe('Clear Chat', () => {
    it('should disable clear button when no messages', async () => {
      await mountPlaygroundChat()
      const clearBtn = wrapper.find('.clear-button')
      expect(clearBtn.attributes('disabled')).toBeDefined()
    })

    it('should enable clear button when messages exist', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'user', content: 'Hello' }]
      await wrapper.vm.$nextTick()

      const clearBtn = wrapper.find('.clear-button')
      expect(clearBtn.attributes('disabled')).toBeUndefined()
    })

    it('should clear all messages when clear button is clicked', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi there' }
      ]
      await wrapper.vm.$nextTick()

      await wrapper.find('.clear-button').trigger('click')

      expect(wrapper.vm.messages).toEqual([])
    })
  })

  describe('Message Display', () => {
    it('should display user messages with correct role label', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'user', content: 'Hello' }]
      await wrapper.vm.$nextTick()

      const messageRole = wrapper.find('.message.user .message-role')
      expect(messageRole.text()).toBe('You')
    })

    it('should display assistant messages with correct role label', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'assistant', content: 'Hi there' }]
      await wrapper.vm.$nextTick()

      const messageRole = wrapper.find('.message.assistant .message-role')
      expect(messageRole.text()).toBe('AI')
    })

    it('should display user message content as plain text', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'user', content: 'Hello world' }]
      await wrapper.vm.$nextTick()

      const messageContent = wrapper.find('.message.user .message-content')
      expect(messageContent.text()).toContain('Hello world')
    })

    it('should render assistant messages with MarkdownRenderer', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [{ role: 'assistant', content: '**Bold text**' }]
      await wrapper.vm.$nextTick()

      const markdownStub = wrapper.find('.markdown-stub')
      expect(markdownStub.exists()).toBe(true)
    })

    it('should show cursor during streaming', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      const cursor = wrapper.find('.cursor')
      expect(cursor.exists()).toBe(true)
    })
  })

  describe('Conversation History', () => {
    it('should include all previous messages when sending', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'First message' },
        { role: 'assistant', content: 'First response' }
      ]
      await wrapper.vm.$nextTick()

      await wrapper.find('textarea').setValue('Second message')
      await wrapper.find('.send-button').trigger('click')

      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'model-1',
        [
          { role: 'user', content: 'First message' },
          { role: 'assistant', content: 'First response' },
          { role: 'user', content: 'Second message' }
        ],
        expect.any(Function),
        expect.any(Object)
      )
    })
  })

  describe('Error Handling', () => {
    it('should display error message when sendChatMessage fails', async () => {
      mockSendChatMessage.mockRejectedValue(new Error('Connection failed'))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      await vi.waitFor(() => !wrapper.vm.isStreaming)

      const lastMessage = wrapper.vm.messages[wrapper.vm.messages.length - 1]
      expect(lastMessage.content).toContain('Error: Connection failed')
    })

    it('should handle model fetch errors gracefully', async () => {
      mockFetchModels.mockRejectedValue(new Error('Failed to fetch'))
      await mountPlaygroundChat()

      expect(wrapper.vm.models).toEqual([])
    })
  })

  describe('Stop Button Styling', () => {
    it('should have stop-button class on stop button', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.find('.stop-button').classes()).toContain('stop-button')
    })
  })
})
