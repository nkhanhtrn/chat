import { describe, it, expect, vi, beforeEach } from 'vitest'
import { processSSEStream } from '../api.js'

// Mock the llm module
vi.mock('../llm/index.js', () => ({
  fetchModels: vi.fn(),
  sendChatMessage: vi.fn(),
  listProviders: vi.fn(() => [
    { id: 'lmstudio', name: 'LM Studio', requiresApiKey: false },
    { id: 'google', name: 'Google AI Studio', requiresApiKey: true }
  ]),
  getCurrentProviderId: vi.fn(() => 'lmstudio'),
  getCurrentConfig: vi.fn(() => ({})),
  setProvider: vi.fn(),
  updateConfig: vi.fn(),
  testConnection: vi.fn(),
  initProvider: vi.fn()
}))

describe('api', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('processSSEStream (legacy export)', () => {
    function createMockReader(chunks) {
      let index = 0
      return {
        read: vi.fn().mockImplementation(() => {
          if (index >= chunks.length) {
            return Promise.resolve({ done: true, value: undefined })
          }
          const value = new TextEncoder().encode(chunks[index])
          index++
          return Promise.resolve({ done: false, value })
        }),
        cancel: vi.fn().mockResolvedValue(undefined)
      }
    }

    it('should parse SSE data and call onChunk', async () => {
      const chunks = []
      const mockReader = createMockReader([
        'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":" World"}}]}\n\n',
        'data: [DONE]\n\n'
      ])

      const result = await processSSEStream(mockReader, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['Hello', ' World'])
      expect(result).toBe('Hello World')
    })

    it('should handle empty lines', async () => {
      const chunks = []
      const mockReader = createMockReader([
        '\n\n',
        'data: {"choices":[{"delta":{"content":"Test"}}]}\n\n'
      ])

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['Test'])
    })

    it('should skip invalid JSON gracefully', async () => {
      const chunks = []
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const mockReader = createMockReader([
        'data: invalid json\n\n',
        'data: {"choices":[{"delta":{"content":"Valid"}}]}\n\n'
      ])

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['Valid'])
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should handle chunks without delta content', async () => {
      const chunks = []
      const mockReader = createMockReader([
        'data: {"choices":[{"delta":{}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Has content"}}]}\n\n'
      ])

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['Has content'])
    })

    it('should handle buffered partial lines', async () => {
      const chunks = []
      const mockReader = createMockReader([
        'data: {"choices":[{"delta":{"content":"Part',
        '1"}}]}\ndata: {"choices":[{"delta":{"content":"Part2"}}]}\n'
      ])

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk))

      expect(chunks).toEqual(['Part1', 'Part2'])
    })

    it('should stop processing when signal is aborted', async () => {
      const chunks = []
      const abortController = new AbortController()
      let readCount = 0

      const mockReader = {
        read: vi.fn().mockImplementation(() => {
          readCount++
          if (readCount === 1) {
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"First"}}]}\n\n')
            })
          }
          if (readCount === 2) {
            abortController.abort()
            return Promise.resolve({
              done: false,
              value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Second"}}]}\n\n')
            })
          }
          return Promise.resolve({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Third"}}]}\n\n')
          })
        }),
        cancel: vi.fn().mockResolvedValue(undefined)
      }

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk), abortController.signal)

      expect(chunks).toEqual(['First', 'Second'])
      expect(readCount).toBe(2)
      expect(mockReader.cancel).toHaveBeenCalled()
    })

    it('should stop immediately if signal is already aborted', async () => {
      const chunks = []
      const abortController = new AbortController()
      abortController.abort()

      const mockReader = {
        read: vi.fn().mockResolvedValue({
          done: false,
          value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Never"}}]}\n\n')
        }),
        cancel: vi.fn().mockResolvedValue(undefined)
      }

      await processSSEStream(mockReader, (chunk) => chunks.push(chunk), abortController.signal)

      expect(chunks).toEqual([])
      expect(mockReader.read).not.toHaveBeenCalled()
      expect(mockReader.cancel).toHaveBeenCalled()
    })

    it('should cancel reader in finally block even without signal', async () => {
      const mockReader = createMockReader([
        'data: {"choices":[{"delta":{"content":"Done"}}]}\n\n'
      ])

      await processSSEStream(mockReader, () => {})

      expect(mockReader.cancel).toHaveBeenCalled()
    })
  })

  describe('re-exports from llm module', () => {
    it('should re-export fetchModels', async () => {
      const { fetchModels } = await import('../api.js')
      expect(fetchModels).toBeDefined()
    })

    it('should re-export sendChatMessage', async () => {
      const { sendChatMessage } = await import('../api.js')
      expect(sendChatMessage).toBeDefined()
    })

    it('should re-export listProviders', async () => {
      const { listProviders } = await import('../api.js')
      expect(listProviders).toBeDefined()
      const providers = listProviders()
      expect(providers).toHaveLength(2)
      expect(providers[0].id).toBe('lmstudio')
      expect(providers[1].id).toBe('google')
    })

    it('should re-export getCurrentProviderId', async () => {
      const { getCurrentProviderId } = await import('../api.js')
      expect(getCurrentProviderId).toBeDefined()
      expect(getCurrentProviderId()).toBe('lmstudio')
    })

    it('should re-export setProvider', async () => {
      const { setProvider } = await import('../api.js')
      expect(setProvider).toBeDefined()
    })

    it('should re-export testConnection', async () => {
      const { testConnection } = await import('../api.js')
      expect(testConnection).toBeDefined()
    })
  })
})
