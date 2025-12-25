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

// Mock taskRouter service
vi.mock('../services/llm/taskRouter.js', () => ({
  analyzeGenerateAndExecute: vi.fn(),
  findRouterAndExecutorModels: vi.fn(() => ({ router: null, executor: null }))
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

  const mountPlaygroundChat = async (options = {}) => {
    wrapper = mount(PlaygroundChat, {
      global: {
        stubs: {
          SlideTransition: {
            template: '<div><slot /></div>'
          },
          MarkdownRenderer: {
            template: '<div class="markdown-stub">{{ content }}</div>',
            props: ['content']
          },
          CodeBlock: {
            template: '<pre class="code-block-stub">{{ code }}</pre>',
            props: ['code', 'language']
          }
        }
      }
    })
    // Wait for onMounted to complete
    await vi.waitFor(() => {
      return wrapper.vm.providers.length > 0
    })
    // Default to single-model mode for backward compatibility with existing tests
    if (!options.twoModelMode) {
      wrapper.vm.twoModelMode = false
    }
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

      expect(wrapper.vm.messages[0]).toMatchObject({ role: 'user', content: 'Hello AI', attachments: [] })
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
      expect(wrapper.vm.messages[1]).toMatchObject({ role: 'assistant', content: '' })
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

  describe('File Upload', () => {
    it('should render upload button', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.upload-button').exists()).toBe(true)
    })

    it('should render hidden file input', async () => {
      await mountPlaygroundChat()
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.exists()).toBe(true)
      expect(fileInput.attributes('style')).toContain('display: none')
    })

    it('should accept all file types', async () => {
      await mountPlaygroundChat()
      const fileInput = wrapper.find('input[type="file"]')
      // File input accepts all types (no accept attribute or empty)
      expect(fileInput.exists()).toBe(true)
    })

    it('should allow multiple file selection', async () => {
      await mountPlaygroundChat()
      const fileInput = wrapper.find('input[type="file"]')
      expect(fileInput.attributes('multiple')).toBeDefined()
    })

    it('should disable upload button while streaming', async () => {
      mockSendChatMessage.mockImplementation(() => new Promise(() => {}))
      await mountPlaygroundChat()
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.find('.upload-button').attributes('disabled')).toBeDefined()
    })

    it('should display uploaded files', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello world', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.file-status-container').exists()).toBe(true)
      expect(wrapper.find('.file-status-item').exists()).toBe(true)
      expect(wrapper.find('.file-name').text()).toContain('test.txt')
    })

    it('should display file size', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello world', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.file-size').text()).toContain('11 chars')
    })

    it('should display file size in k for large files', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'large.txt', content: 'x'.repeat(5000), status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.file-size').text()).toContain('5.0k chars')
    })

    it('should show remove button for uploaded files', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello world', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.file-remove').exists()).toBe(true)
    })

    it('should remove file when remove button is clicked', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello world', status: 'success' },
        { name: 'test2.txt', content: 'Goodbye', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      const removeButtons = wrapper.findAll('.file-remove')
      await removeButtons[0].trigger('click')

      expect(wrapper.vm.uploadedFiles.length).toBe(1)
      expect(wrapper.vm.uploadedFiles[0].name).toBe('test2.txt')
    })

    it('should not show file status container when no files uploaded', async () => {
      await mountPlaygroundChat()
      expect(wrapper.find('.file-status-container').exists()).toBe(false)
    })

    it('should include file content in message when sending', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', file: { name: 'test.txt' }, content: 'File content here', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Check this file')
      await wrapper.find('.send-button').trigger('click')

      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'model-1',
        [{ role: 'user', content: expect.stringContaining('File content here') }],
        expect.any(Function),
        expect.any(Object)
      )
    })

    it('should include file content without name markers in message', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', file: { name: 'test.txt' }, content: 'File content', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Check this')
      await wrapper.find('.send-button').trigger('click')

      // Content should be included but no file name markers
      expect(mockSendChatMessage).toHaveBeenCalledWith(
        'model-1',
        [{ role: 'user', content: expect.stringContaining('File content') }],
        expect.any(Function),
        expect.any(Object)
      )
      // Should NOT contain file markers
      const callArgs = mockSendChatMessage.mock.calls[0][1][0].content
      expect(callArgs).not.toContain('--- File:')
    })

    it('should clear uploaded files after sending', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Hello')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.vm.uploadedFiles).toEqual([])
    })

    it('should display original message without file content in chat', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'File content here', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Check this file')
      await wrapper.find('.send-button').trigger('click')

      // The displayed user message should be the original text only
      expect(wrapper.vm.messages[0].content).toBe('Check this file')
    })

    it('should truncate long file names', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'this-is-a-very-long-filename-that-should-be-truncated.txt', content: 'content', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      const fileName = wrapper.find('.file-name').text()
      expect(fileName.length).toBeLessThan(35)
      expect(fileName).toContain('...')
    })

    it('should handle multiple uploaded files', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'file1.txt', content: 'Content 1', status: 'success' },
        { name: 'file2.txt', content: 'Content 2', status: 'success' }
      ]
      await wrapper.vm.$nextTick()

      const fileItems = wrapper.findAll('.file-status-item')
      expect(fileItems.length).toBe(2)
    })

    it('should include multiple files content in message', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'file1.txt', file: { name: 'file1.txt' }, content: 'Content 1', status: 'success' },
        { name: 'file2.txt', file: { name: 'file2.txt' }, content: 'Content 2', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Check files')
      await wrapper.find('.send-button').trigger('click')

      const sentMessage = mockSendChatMessage.mock.calls[0][1][0].content
      expect(sentMessage).toContain('Content 1')
      expect(sentMessage).toContain('Content 2')
      // Should NOT contain file markers
      expect(sentMessage).not.toContain('--- File:')
    })

    it('should store file attachments in user message', async () => {
      await mountPlaygroundChat()
      wrapper.vm.uploadedFiles = [
        { name: 'test.txt', content: 'Hello', status: 'success' }
      ]
      await wrapper.find('textarea').setValue('Check this')
      await wrapper.find('.send-button').trigger('click')

      expect(wrapper.vm.messages[0].attachments).toEqual([
        expect.objectContaining({ type: 'file', name: 'test.txt' })
      ])
    })

    it('should display attachments indicator for messages with attachments', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello', attachments: [{ type: 'file', name: 'test.txt' }] }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.attachments-indicator').exists()).toBe(true)
      expect(wrapper.find('.attachment-badge').exists()).toBe(true)
    })

    it('should show file icon for file attachments', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello', attachments: [{ type: 'file', name: 'test.txt' }] }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.attachment-icon').text()).toContain('📄')
    })

    it('should show link icon for URL attachments', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello', attachments: [{ type: 'url', name: 'example.com' }] }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.attachment-icon').text()).toContain('🔗')
    })

    it('should not display attachments indicator when no attachments', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello', attachments: [] }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.attachments-indicator').exists()).toBe(false)
    })

    it('should display multiple attachments', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'user', content: 'Hello', attachments: [
          { type: 'file', name: 'file1.txt' },
          { type: 'url', name: 'example.com' }
        ]}
      ]
      await wrapper.vm.$nextTick()

      const badges = wrapper.findAll('.attachment-badge')
      expect(badges.length).toBe(2)
    })
  })

  describe('Copy Code Button', () => {
    it('should show copy button when generated code is present', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        {
          role: 'assistant',
          content: '8',
          generatedCode: '5 + 3',
          execution: { success: true, result: 8 }
        }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.copy-code-btn').exists()).toBe(true)
    })

    it('should not show copy button when no generated code', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        { role: 'assistant', content: 'Hello' }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.copy-code-btn').exists()).toBe(false)
    })

    it('should copy code to clipboard when clicked', async () => {
      const mockWriteText = vi.fn().mockResolvedValue()
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText }
      })

      await mountPlaygroundChat()
      wrapper.vm.messages = [
        {
          role: 'assistant',
          content: '8',
          generatedCode: 'const x = 5 + 3; x',
          execution: { success: true, result: 8 }
        }
      ]
      await wrapper.vm.$nextTick()

      await wrapper.find('.copy-code-btn').trigger('click')

      expect(mockWriteText).toHaveBeenCalledWith('const x = 5 + 3; x')

      vi.unstubAllGlobals()
    })

    it('should update copiedCode state after copying', async () => {
      const mockWriteText = vi.fn().mockResolvedValue()
      vi.stubGlobal('navigator', {
        clipboard: { writeText: mockWriteText }
      })

      await mountPlaygroundChat()
      const code = '5 + 3'
      wrapper.vm.messages = [
        {
          role: 'assistant',
          content: '8',
          generatedCode: code,
          execution: { success: true, result: 8 }
        }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.copiedCode).toBeNull()

      await wrapper.find('.copy-code-btn').trigger('click')
      await wrapper.vm.$nextTick()

      expect(wrapper.vm.copiedCode).toBe(code)

      vi.unstubAllGlobals()
    })

    it('should show generated code in details element', async () => {
      await mountPlaygroundChat()
      wrapper.vm.messages = [
        {
          role: 'assistant',
          content: '8',
          generatedCode: 'const sum = 5 + 3; sum',
          execution: { success: true, result: 8 }
        }
      ]
      await wrapper.vm.$nextTick()

      expect(wrapper.find('.generated-code').text()).toBe('const sum = 5 + 3; sum')
    })
  })
})
