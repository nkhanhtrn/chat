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
    it('should send chat message successfully', async () => {
      const messages = [
        { role: 'user', content: 'Hello' }
      ]
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

      const result = await apiModule.sendChatMessage(messages, model)
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/chat/completions',
        {
          model: model,
          messages: messages,
          temperature: 0.7,
          max_tokens: -1,
          stream: false
        }
      )
      expect(result).toBe(mockResponse)
    })

    it('should throw error when no choices in response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [] }
      })

      await expect(
        apiModule.sendChatMessage([{ role: 'user', content: 'Hi' }], 'model')
      ).rejects.toThrow('No response from model')
    })

    it('should throw error on network failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        code: 'ERR_NETWORK'
      })

      await expect(
        apiModule.sendChatMessage([{ role: 'user', content: 'Hi' }], 'model')
      ).rejects.toThrow('Cannot connect to LM Studio server')
    })

    it('should handle API error responses', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        response: {
          data: {
            error: {
              message: 'Rate limit exceeded'
            }
          }
        }
      })

      await expect(
        apiModule.sendChatMessage([{ role: 'user', content: 'Hi' }], 'model')
      ).rejects.toThrow('Rate limit exceeded')
    })

    it('should send correct parameters', async () => {
      const messages = [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Test' }
      ]
      const model = 'gpt-4'
      
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Response' } }]
        }
      })

      await apiModule.sendChatMessage(messages, model)
      
      const callArgs = mockAxiosInstance.post.mock.calls[0][1]
      expect(callArgs.model).toBe(model)
      expect(callArgs.messages).toEqual(messages)
      expect(callArgs.temperature).toBe(0.7)
      expect(callArgs.max_tokens).toBe(-1)
      expect(callArgs.stream).toBe(false)
    })
  })

  describe('sendCompletion', () => {
    it('should send completion request successfully', async () => {
      const prompt = 'Complete this sentence:'
      const model = 'test-model'
      const mockText = 'This is a completed sentence.'
      
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [
            {
              text: mockText
            }
          ]
        }
      })

      const result = await apiModule.sendCompletion(prompt, model)
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/completions',
        {
          model: model,
          prompt: prompt,
          max_tokens: 100,
          temperature: 0.7
        }
      )
      expect(result).toBe(mockText)
    })

    it('should throw error on completion failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        message: 'API Error'
      })

      await expect(
        apiModule.sendCompletion('Test prompt', 'model')
      ).rejects.toThrow('Failed to get completion response')
    })
  })

  describe('generateEmbeddings', () => {
    it('should generate embeddings successfully', async () => {
      const input = 'Test text for embedding'
      const model = 'embedding-model'
      const mockEmbeddings = [
        { embedding: [0.1, 0.2, 0.3], index: 0 }
      ]
      
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          data: mockEmbeddings
        }
      })

      const result = await apiModule.generateEmbeddings(input, model)
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/embeddings',
        {
          model: model,
          input: input
        }
      )
      expect(result).toEqual(mockEmbeddings)
    })

    it('should throw error on embeddings generation failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        message: 'API Error'
      })

      await expect(
        apiModule.generateEmbeddings('Test input', 'model')
      ).rejects.toThrow('Failed to generate embeddings')
    })
  })

  describe('sendResponse', () => {
    it('should send custom response successfully', async () => {
      const data = { customField: 'value' }
      const model = 'test-model'
      const mockResponse = { result: 'success' }
      
      mockAxiosInstance.post.mockResolvedValue({
        data: mockResponse
      })

      const result = await apiModule.sendResponse(data, model)
      
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/v1/responses',
        {
          model: model,
          customField: 'value'
        }
      )
      expect(result).toEqual(mockResponse)
    })

    it('should throw error on response failure', async () => {
      mockAxiosInstance.post.mockRejectedValue({
        message: 'API Error'
      })

      await expect(
        apiModule.sendResponse({ test: 'data' }, 'model')
      ).rejects.toThrow('Failed to get response')
    })
  })
})
