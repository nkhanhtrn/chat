import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStudioChat } from '../useStudioChat.js'

// Mock the LLM service
vi.mock('../../services/llm/index.js', () => ({
  sendChatMessage: vi.fn(async (model, messages, onChunk) => {
    onChunk('Hello ')
    onChunk('World!')
  })
}))

// Mock the task router
vi.mock('../../services/llm/taskRouter.js', () => ({
  analyzeGenerateAndExecute: vi.fn(async (messages, config, onChunk, signal, options) => {
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
vi.mock('../../utils/format.js', () => ({
  truncateUrl: vi.fn((url) => url.slice(0, 20)),
  truncateFileName: vi.fn((name) => name.slice(0, 15))
}))

vi.mock('../../utils/studioAttachments.js', () => ({
  buildRawAttachments: vi.fn(() => []),
  formatUploadedFilesForPrompt: vi.fn(() => ''),
  formatFetchedContentForPrompt: vi.fn(() => ''),
  buildAttachmentsForDisplay: vi.fn(() => [])
}))

describe('useStudioChat', () => {
  beforeEach(() => {
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
      const { sendChatMessage } = await import('../../services/llm/index.js')
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
      const { analyzeGenerateAndExecute } = await import('../../services/llm/taskRouter.js')
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
      const { sendChatMessage } = await import('../../services/llm/index.js')
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
      const { sendChatMessage } = await import('../../services/llm/index.js')
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
})
