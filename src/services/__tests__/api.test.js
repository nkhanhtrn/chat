import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  sendChatMessage,
  sendChatMessageFull,
  sendChatMessageStreaming,
  processSSEStream
} from '../api.js'

describe('api', () => {
  describe('sendChatMessageFull', () => {
    it('should return message content on successful response', async () => {
      const mockApiClient = {
        post: vi.fn().mockResolvedValue({
          data: {
            choices: [{ message: { content: 'Hello from AI!' } }]
          }
        })
      }

      const result = await sendChatMessageFull('test-model', [{ role: 'user', content: 'Hi' }], {
        apiClient: mockApiClient
      })

      expect(result).toBe('Hello from AI!')
      expect(mockApiClient.post).toHaveBeenCalledWith('/v1/chat/completions', {
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hi' }],
        temperature: 0.7,
        max_tokens: -1,
        stream: false
      })
    })

    it('should throw error when no choices in response', async () => {
      const mockApiClient = {
        post: vi.fn().mockResolvedValue({
          data: { choices: [] }
        })
      }

      await expect(
        sendChatMessageFull('test-model', [], { apiClient: mockApiClient })
      ).rejects.toThrow('No response from model')
    })

    it('should throw error when choices is undefined', async () => {
      const mockApiClient = {
        post: vi.fn().mockResolvedValue({
          data: {}
        })
      }

      await expect(
        sendChatMessageFull('test-model', [], { apiClient: mockApiClient })
      ).rejects.toThrow('No response from model')
    })
  })

  describe('processSSEStream', () => {
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
        })
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
  })

  describe('sendChatMessageStreaming', () => {
    it('should call fetch with correct parameters', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      }

      const mockFetchFn = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader }
      })

      const onChunk = vi.fn()
      await sendChatMessageStreaming('test-model', [{ role: 'user', content: 'Hello' }], onChunk, {
        fetchFn: mockFetchFn,
        getBaseUrl: () => 'http://test-server'
      })

      expect(mockFetchFn).toHaveBeenCalledWith(
        'http://test-server/v1/chat/completions',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'test-model',
            messages: [{ role: 'user', content: 'Hello' }],
            temperature: 0.7,
            max_tokens: -1,
            stream: true
          })
        })
      )
    })

    it('should throw error when response is not ok', async () => {
      const mockFetchFn = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(
        sendChatMessageStreaming('model', [], vi.fn(), {
          fetchFn: mockFetchFn,
          getBaseUrl: () => 'http://test'
        })
      ).rejects.toThrow('Failed to get chat response')
    })
  })

  describe('sendChatMessage', () => {
    it('should use sendChatMessageFull when onChunk is null', async () => {
      const mockApiClient = {
        post: vi.fn().mockResolvedValue({
          data: { choices: [{ message: { content: 'Response' } }] }
        })
      }

      const result = await sendChatMessage('model', [], null, {
        apiClient: mockApiClient,
        fetchFn: vi.fn(),
        getBaseUrl: () => 'http://test'
      })

      expect(result).toBe('Response')
      expect(mockApiClient.post).toHaveBeenCalled()
    })

    it('should use streaming when onChunk is provided', async () => {
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Streamed"}}]}\n\n')
          })
          .mockResolvedValueOnce({ done: true, value: undefined })
      }

      const mockFetchFn = vi.fn().mockResolvedValue({
        ok: true,
        body: { getReader: () => mockReader }
      })

      const onChunk = vi.fn()
      const result = await sendChatMessage('model', [], onChunk, {
        apiClient: { post: vi.fn() },
        fetchFn: mockFetchFn,
        getBaseUrl: () => 'http://test'
      })

      expect(result).toBe('Streamed')
      expect(onChunk).toHaveBeenCalledWith('Streamed')
      expect(mockFetchFn).toHaveBeenCalled()
    })

    it('should rethrow "No response from model" error as-is', async () => {
      const mockApiClient = {
        post: vi.fn().mockResolvedValue({ data: { choices: [] } })
      }

      await expect(
        sendChatMessage('model', [], null, {
          apiClient: mockApiClient,
          fetchFn: vi.fn(),
          getBaseUrl: () => 'http://test'
        })
      ).rejects.toThrow('No response from model')
    })

    it('should convert network errors to user-friendly message', async () => {
      const networkError = new Error('Network failed')
      networkError.code = 'ERR_NETWORK'

      const mockApiClient = {
        post: vi.fn().mockRejectedValue(networkError)
      }

      await expect(
        sendChatMessage('model', [], null, {
          apiClient: mockApiClient,
          fetchFn: vi.fn(),
          getBaseUrl: () => 'http://test'
        })
      ).rejects.toThrow('Cannot connect to LM Studio server')
    })

    it('should convert TypeError to connection error message', async () => {
      const typeError = new TypeError('Failed to fetch')

      const mockFetchFn = vi.fn().mockRejectedValue(typeError)

      await expect(
        sendChatMessage('model', [], vi.fn(), {
          apiClient: { post: vi.fn() },
          fetchFn: mockFetchFn,
          getBaseUrl: () => 'http://test'
        })
      ).rejects.toThrow('Cannot connect to LM Studio server')
    })
  })
})
