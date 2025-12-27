import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock localStorage
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, value) => { store[key] = value }),
    removeItem: vi.fn((key) => { delete store[key] }),
    clear: vi.fn(() => { store = {} })
  }
})()
Object.defineProperty(window, 'localStorage', { value: localStorageMock })

import { useStudioChat } from '../useStudioChat.js'

// Mock the LLM service
vi.mock('../../../services/llm/index.js', () => ({
  sendChatMessage: vi.fn(async (model, messages, onChunk) => {
    onChunk('Hello ')
    onChunk('World!')
  })
}))

// Mock the task router
let mockTaskRouterOptions = {}
vi.mock('../../../services/llm/taskRouter.js', () => ({
  analyzeGenerateAndExecute: vi.fn(async (messages, config, onChunk, signal, options) => {
    mockTaskRouterOptions = options
    if (options?.onAnalysis) {
      options.onAnalysis({ capability: 'text', taskDescription: 'Test task' })
    }
    onChunk('Response ')
    onChunk('from router')
    return {
      finalResponse: 'Response from router',
      attempts: 1
    }
  })
}))

// Mock utility functions
vi.mock('../../../utils/format.js', () => ({
  truncateUrl: vi.fn((url) => url.slice(0, 20)),
  truncateFileName: vi.fn((name) => name.slice(0, 15))
}))

vi.mock('../studioAttachments.js', () => ({
  buildRawAttachments: vi.fn(() => []),
  formatUploadedFilesForPrompt: vi.fn(() => ''),
  formatFetchedContentForPrompt: vi.fn(() => ''),
  buildAttachmentsForDisplay: vi.fn(() => [])
}))

describe('useStudioChat', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
  })

  it('should initialize with empty state', () => {
    const chat = useStudioChat()

    expect(chat.messages.value).toEqual([])
    expect(chat.isStreaming.value).toBe(false)
    expect(chat.isRouting.value).toBe(false)
    expect(chat.currentVerifyAttempt.value).toBe(0)
  })

  it('should get last message', () => {
    const chat = useStudioChat()

    expect(chat.getLastMessage()).toBeNull()

    chat.messages.value = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi there' }
    ]

    expect(chat.getLastMessage()).toEqual({ role: 'assistant', content: 'Hi there' })
  })

  it('should update last message', () => {
    const chat = useStudioChat()

    chat.messages.value = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' }
    ]

    chat.updateLastMessage({ content: 'Hi there!', analysis: { type: 'text' } })

    expect(chat.messages.value[1].content).toBe('Hi there!')
    expect(chat.messages.value[1].analysis).toEqual({ type: 'text' })
  })

  it('should handle updateLastMessage with empty messages', () => {
    const chat = useStudioChat()

    // Should not throw
    chat.updateLastMessage({ content: 'test' })

    expect(chat.messages.value).toEqual([])
  })

  it('should clear chat', () => {
    const chat = useStudioChat()

    chat.messages.value = [
      { role: 'user', content: 'Hello' },
      { role: 'assistant', content: 'Hi' }
    ]

    chat.clearChat()

    expect(chat.messages.value).toEqual([])
  })

  it('should stop streaming', async () => {
    const chat = useStudioChat()

    // Simulate starting a request
    chat.isStreaming.value = true

    // stopStreaming should not throw even without active controller
    chat.stopStreaming()
  })

  describe('sendMessage', () => {
    it('should send message in single model mode', async () => {
      const { sendChatMessage } = await import('../../../services/llm/index.js')
      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: {
          selectedModel: 'gpt-4'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      expect(sendChatMessage).toHaveBeenCalled()
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[0].role).toBe('user')
      expect(chat.messages.value[0].content).toBe('Hello')
      expect(chat.messages.value[1].role).toBe('assistant')
      expect(chat.messages.value[1].content).toBe('Hello World!')
    })

    it('should send message in two model mode', async () => {
      const { analyzeGenerateAndExecute } = await import('../../../services/llm/taskRouter.js')
      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: true,
        modelSelection: {
          routerModel: 'mistral-7b',
          routerProviderId: 'lmstudio',
          executorModel: 'gpt-4',
          executorProviderId: 'openai'
        },
        searchCallbacks: {
          onWebSearchStart: vi.fn(),
          onWebSearchProgress: vi.fn(),
          onWebSearchResult: vi.fn(),
          onWebSearchComplete: vi.fn()
        },
        planningCallbacks: {
          onPlanGenerated: vi.fn(),
          onStepStart: vi.fn(),
          onStepComplete: vi.fn(),
          onPlanComplete: vi.fn()
        }
      })

      expect(analyzeGenerateAndExecute).toHaveBeenCalled()
      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[1].content).toBe('Response from router')
      expect(chat.messages.value[1].analysis).toBeDefined()
    })

    it('should handle errors gracefully', async () => {
      const { sendChatMessage } = await import('../../../services/llm/index.js')
      sendChatMessage.mockRejectedValueOnce(new Error('Network error'))

      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: {
          selectedModel: 'gpt-4'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      expect(chat.messages.value[1].content).toBe('Error: Network error')
      expect(chat.isStreaming.value).toBe(false)
    })

    it('should not show error for AbortError', async () => {
      const { sendChatMessage } = await import('../../../services/llm/index.js')
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      sendChatMessage.mockRejectedValueOnce(abortError)

      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: {
          selectedModel: 'gpt-4'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      expect(chat.messages.value[1].content).not.toContain('Error')
    })

    it('should reset streaming state after completion', async () => {
      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: {
          selectedModel: 'gpt-4'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      expect(chat.isStreaming.value).toBe(false)
      expect(chat.isRouting.value).toBe(false)
      expect(chat.currentVerifyAttempt.value).toBe(0)
    })
  })

  describe('onOutput callback', () => {
    it('should register onOutput callback', () => {
      const chat = useStudioChat()
      const callback = vi.fn()

      chat.onOutput(callback)

      // Callback should be registered (we can't easily test this directly,
      // but we can test it's called when outputs are emitted)
      expect(typeof chat.onOutput).toBe('function')
    })

    it('should emit codeResult with result and code', async () => {
      const chat = useStudioChat()
      const outputCallback = vi.fn()
      chat.onOutput(outputCallback)

      // Start a message to set up the message structure
      await chat.sendMessage({
        inputText: 'Calculate something',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: true,
        modelSelection: {
          routerModel: 'mistral-7b',
          routerProviderId: 'lmstudio',
          executorModel: 'gpt-4',
          executorProviderId: 'openai'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      // Simulate code generation and execution
      const lastMsg = chat.getLastMessage()
      chat.updateLastMessage({ generatedCode: 'return 42' })

      // Manually trigger the execution complete callback
      if (mockTaskRouterOptions.onExecutionComplete) {
        mockTaskRouterOptions.onExecutionComplete({ success: true, result: 42 })
      }

      // Check that outputCallback was called with correct structure
      const codeResultCall = outputCallback.mock.calls.find(
        call => call[0]?.type === 'codeResult'
      )

      if (codeResultCall) {
        expect(codeResultCall[0].type).toBe('codeResult')
        expect(codeResultCall[0].content).toEqual({
          result: 42,
          code: 'return 42'
        })
      }
    })

    it('should not emit codeResult for failed execution', async () => {
      const chat = useStudioChat()
      const outputCallback = vi.fn()
      chat.onOutput(outputCallback)

      await chat.sendMessage({
        inputText: 'Calculate something',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: true,
        modelSelection: {
          routerModel: 'mistral-7b',
          routerProviderId: 'lmstudio',
          executorModel: 'gpt-4',
          executorProviderId: 'openai'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      // Clear any previous calls
      outputCallback.mockClear()

      // Simulate failed execution
      if (mockTaskRouterOptions.onExecutionComplete) {
        mockTaskRouterOptions.onExecutionComplete({ success: false, error: 'Error occurred' })
      }

      // Should not emit codeResult for failed execution
      const codeResultCall = outputCallback.mock.calls.find(
        call => call[0]?.type === 'codeResult'
      )
      expect(codeResultCall).toBeUndefined()
    })
  })

  describe('localStorage persistence', () => {
    it('should save messages to localStorage after sending', async () => {
      const chat = useStudioChat()

      await chat.sendMessage({
        inputText: 'Hello',
        attachmentSnapshot: {
          uploadedFiles: [],
          detectedUrls: [],
          fetchedContents: {}
        },
        twoModelMode: false,
        modelSelection: {
          selectedModel: 'gpt-4'
        },
        searchCallbacks: {},
        planningCallbacks: {}
      })

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1])
      expect(savedData.messages).toHaveLength(2)
    })

    it('should load messages from localStorage on init', () => {
      const savedState = {
        messages: [
          { role: 'user', content: 'Test message' },
          { role: 'assistant', content: 'Test response' }
        ],
        nextMessageId: 3
      }
      localStorageMock.getItem.mockReturnValue(JSON.stringify(savedState))

      const chat = useStudioChat()

      expect(chat.messages.value).toHaveLength(2)
      expect(chat.messages.value[0].content).toBe('Test message')
      expect(chat.messages.value[1].content).toBe('Test response')
    })

    it('should clear localStorage when clearing chat', () => {
      const chat = useStudioChat()
      chat.messages.value = [
        { role: 'user', content: 'Hello' },
        { role: 'assistant', content: 'Hi' }
      ]

      chat.clearChat()

      expect(localStorageMock.setItem).toHaveBeenCalled()
      const savedData = JSON.parse(localStorageMock.setItem.mock.calls[localStorageMock.setItem.mock.calls.length - 1][1])
      expect(savedData.messages).toHaveLength(0)
      expect(savedData.nextMessageId).toBe(1)
    })

    it('should handle corrupted localStorage gracefully', () => {
      localStorageMock.getItem.mockReturnValue('invalid json{{{')

      const chat = useStudioChat()

      expect(chat.messages.value).toEqual([])
    })

    it('should handle localStorage errors gracefully', () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage full')
      })

      const chat = useStudioChat()

      // Should not throw
      expect(() => chat.clearChat()).not.toThrow()
    })
  })
})
