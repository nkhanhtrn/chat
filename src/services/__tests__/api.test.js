import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted to ensure mockAxiosInstance is available in the factory
const { mockAxiosInstance } = vi.hoisted(() => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: {
      baseURL: 'http://localhost:1234'
    }
  }
  return { mockAxiosInstance }
})

import * as apiModule from '../api.js'

describe('getQuestionSummary', () => {
  const question = 'What is the capital of France?';
  const model = 'test-model';

  it('should return summary from valid response', async () => {
    mockAxiosInstance.post.mockResolvedValue({
      data: {
        choices: [
          { message: { content: 'Paris' } }
        ]
      }
    });
    const result = await apiModule.getQuestionSummary(question, model);
    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      '/v1/chat/completions',
      expect.objectContaining({
        model,
        messages: expect.any(Array),
        temperature: 0.7,
        max_tokens: 100,
        stream: false
      })
    );
    expect(result).toBe('Paris');
  });

  it('should throw error if no choices returned', async () => {
    mockAxiosInstance.post.mockResolvedValue({ data: { choices: [] } });
    await expect(apiModule.getQuestionSummary(question, model)).rejects.toThrow('Failed to get summary');
  });

  it('should throw error if API returns error message', async () => {
    mockAxiosInstance.post.mockRejectedValue({
      response: { data: { error: { message: 'API Error' } } }
    });
    await expect(apiModule.getQuestionSummary(question, model)).rejects.toThrow('API Error');
  });

  it('should throw generic error if no response', async () => {
    mockAxiosInstance.post.mockRejectedValue({ message: 'Network Error' });
    await expect(apiModule.getQuestionSummary(question, model)).rejects.toThrow('Failed to get summary');
  });
});

// Mock axios module
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => mockAxiosInstance)
  }
}))

import * as apiModule from '../api.js'

describe('API Service', () => {
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks()
    mockAxiosInstance.defaults.baseURL = 'http://localhost:1234'
    
    // Reset the module's API_BASE_URL
    apiModule.setApiBaseUrl('http://localhost:1234')
  })

  describe('setApiBaseUrl', () => {
    it('should update the base URL', () => {
      const newUrl = 'http://localhost:8080'
      apiModule.setApiBaseUrl(newUrl)
      
      // The function should update the axios instance baseURL
      expect(mockAxiosInstance.defaults.baseURL).toBe(newUrl)
    })
  })

  describe('fetchModels', () => {
    it('should fetch models successfully with data array', async () => {
      const mockModels = [
        { id: 'model-1', name: 'Model 1' },
        { id: 'model-2', name: 'Model 2' }
      ]
      
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: mockModels }
      })

      const result = await apiModule.fetchModels()
      
      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/v1/models')
      expect(result).toEqual(mockModels)
    })

    it('should handle response with data as direct array', async () => {
      const mockModels = [
        { id: 'model-1' },
        { id: 'model-2' }
      ]
      
      mockAxiosInstance.get.mockResolvedValue({
        data: mockModels
      })

      const result = await apiModule.fetchModels()
      
      expect(result).toEqual(mockModels)
    })

    it('should return empty array for unexpected format', async () => {
      mockAxiosInstance.get.mockResolvedValue({
        data: { unexpected: 'format' }
      })

      const result = await apiModule.fetchModels()
      
      expect(result).toEqual([])
    })

    it('should throw error on network failure', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        code: 'ERR_NETWORK',
        message: 'Network Error'
      })

      await expect(apiModule.fetchModels()).rejects.toThrow('Cannot connect to LM Studio')
    })

    it('should throw error with API error message', async () => {
      mockAxiosInstance.get.mockRejectedValue({
        response: {
          data: {
            error: {
              message: 'API Error Message'
            }
          }
        }
      })

      await expect(apiModule.fetchModels()).rejects.toThrow('API Error Message')
    })
  })

  describe('sendChatMessage', () => {
    it('should send chat message successfully in non-streaming mode', async () => {
      const question = 'Hello'
      const model = 'test-model'
      const mockResponse = 'Hello! How can I help you?'

      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [
            {
              message: {
                content: mockResponse
              }
            }
          ]
        }
      })

      const result = await apiModule.sendChatMessage(question, model)

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        {
          model: model,
          messages: [
            { role: 'user', content: question }
          ],
          temperature: 0.7,
          max_tokens: -1,
          stream: false
        }
      )
      expect(result).toBe(mockResponse)
    })

    it('should stream chat message successfully', async () => {
      const question = 'Hello'
      const model = 'test-model'
      const chunks = ['Hello', ' there', '!']

      // Mock fetch for streaming
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hello"}}]}\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":" there"}}]}\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"!"}}]}\n')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: [DONE]\n')
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined
          })
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      })

      const receivedChunks = []
      const onChunk = vi.fn((chunk) => receivedChunks.push(chunk))

      const result = await apiModule.sendChatMessage(question, model, onChunk)

      expect(global.fetch).toHaveBeenCalledWith(
        `${mockAxiosInstance.defaults.baseURL}/v1/chat/completions`,
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: model,
            messages: [
              { role: 'user', content: question }
            ],
            temperature: 0.7,
            max_tokens: -1,
            stream: true
          }),
          signal: expect.any(AbortSignal)
        })
      )

      expect(onChunk).toHaveBeenCalledTimes(3)
      expect(receivedChunks).toEqual(chunks)
      expect(result).toBe('Hello there!')
    })

    it('should handle streaming with partial SSE lines', async () => {
      const question = 'Test'
      const model = 'test-model'

      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hel')
          })
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('lo"}}]}\n')
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined
          })
      }

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      })

      const receivedChunks = []
      const onChunk = vi.fn((chunk) => receivedChunks.push(chunk))

      const result = await apiModule.sendChatMessage(question, model, onChunk)

      expect(onChunk).toHaveBeenCalledTimes(1)
      expect(receivedChunks).toEqual(['Hello'])
      expect(result).toBe('Hello')
    })
  })

  describe('abortChatMessage', () => {
    it('should abort ongoing streaming request', async () => {
      const messages = [{ role: 'user', content: 'Hello' }]
      const model = 'test-model'
      
      let abortController = null
      
      // Mock fetch to capture the abort controller
      global.fetch = vi.fn((url, options) => {
        abortController = new AbortController()
        // Simulate the signal being passed
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            if (options.signal.aborted) {
              reject(new DOMException('Aborted', 'AbortError'))
            } else {
              resolve({
                ok: true,
                body: {
                  getReader: () => ({
                    read: vi.fn().mockResolvedValue({ done: true })
                  })
                }
              })
            }
          }, 100)
        })
      })
      
      const onChunk = vi.fn()
      const promise = apiModule.sendChatMessage(messages, model, onChunk)
      
      // Call abort after a short delay
      setTimeout(() => {
        apiModule.abortChatMessage()
      }, 10)
      
      await expect(promise).rejects.toThrow('Request cancelled')
    })

    it('should handle abort when no request is in progress', () => {
      // Should not throw error when called with no active request
      expect(() => apiModule.abortChatMessage()).not.toThrow()
    })

    it('should handle AbortError during streaming', async () => {
      const messages = [{ role: 'user', content: 'Test' }]
      const model = 'test-model'
      
      const abortError = new DOMException('The operation was aborted', 'AbortError')
      global.fetch = vi.fn().mockRejectedValue(abortError)
      
      const onChunk = vi.fn()
      
      await expect(
        apiModule.sendChatMessage(messages, model, onChunk)
      ).rejects.toThrow('Request cancelled')
    })

    it('should clean up abort controller after successful stream', async () => {
      const messages = [{ role: 'user', content: 'Test' }]
      const model = 'test-model'
      
      const mockReader = {
        read: vi.fn()
          .mockResolvedValueOnce({
            done: false,
            value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Hi"}}]}\n')
          })
          .mockResolvedValueOnce({
            done: true,
            value: undefined
          })
      }
      
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        body: {
          getReader: () => mockReader
        }
      })
      
      const onChunk = vi.fn()
      await apiModule.sendChatMessage(messages, model, onChunk)
      
      // Calling abort after successful completion should be safe
      expect(() => apiModule.abortChatMessage()).not.toThrow()
    })

    it('should clean up abort controller after error', async () => {
      const messages = [{ role: 'user', content: 'Test' }]
      const model = 'test-model'
      
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))
      
      const onChunk = vi.fn()
      
      try {
        await apiModule.sendChatMessage(messages, model, onChunk)
      } catch (error) {
        // Expected error
      }
      
      // Calling abort after error should be safe
      expect(() => apiModule.abortChatMessage()).not.toThrow()
    })
  })
})
