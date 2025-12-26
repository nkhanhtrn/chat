import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

describe('Google Provider', () => {
  let googleProvider

  beforeEach(async () => {
    vi.resetModules()
    // Import fresh module to reset the currentKeyIndex state
    const module = await import('../providers/google.js')
    googleProvider = module.googleProvider
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()
  })

  describe('fetchModels', () => {
    it('should throw error when no API key provided', async () => {
      await expect(googleProvider.fetchModels({})).rejects.toThrow('Google AI API key is required')
    })

    it('should throw error when apiKeys array is empty', async () => {
      await expect(googleProvider.fetchModels({ apiKeys: [] })).rejects.toThrow('Google AI API key is required')
    })

    it('should fetch models from Google API', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
          },
          {
            name: 'models/gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
          }
        ]
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }))

      const models = await googleProvider.fetchModels({ apiKey: 'test-key' })

      expect(fetch).toHaveBeenCalledWith(
        'https://generativelanguage.googleapis.com/v1beta/models?key=test-key',
        expect.objectContaining({
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        })
      )

      expect(models).toHaveLength(2)
      expect(models[0]).toEqual({ id: 'models/gemini-2.0-flash', name: 'Gemini 2.0 Flash' })
      expect(models[1]).toEqual({ id: 'models/gemini-1.5-pro', name: 'Gemini 1.5 Pro' })
    })

    it('should filter out models that do not support generateContent', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
          },
          {
            name: 'models/text-embedding-004',
            displayName: 'Text Embedding 004',
            supportedGenerationMethods: ['embedContent']
          },
          {
            name: 'models/gemini-1.5-pro',
            displayName: 'Gemini 1.5 Pro',
            supportedGenerationMethods: ['generateContent']
          }
        ]
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }))

      const models = await googleProvider.fetchModels({ apiKey: 'test-key' })

      expect(models).toHaveLength(2)
      expect(models.map(m => m.id)).toEqual([
        'models/gemini-2.0-flash',
        'models/gemini-1.5-pro'
      ])
    })

    it('should use displayName when available, fallback to cleaned model name', async () => {
      const mockResponse = {
        models: [
          {
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent']
          },
          {
            name: 'models/custom-model',
            // No displayName
            supportedGenerationMethods: ['generateContent']
          }
        ]
      }

      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse)
      }))

      const models = await googleProvider.fetchModels({ apiKey: 'test-key' })

      expect(models[0].name).toBe('Gemini 2.0 Flash')
      expect(models[1].name).toBe('custom-model') // Fallback: models/ prefix removed
    })

    it('should handle empty models array', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      }))

      const models = await googleProvider.fetchModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('should handle missing models field in response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({})
      }))

      const models = await googleProvider.fetchModels({ apiKey: 'test-key' })
      expect(models).toEqual([])
    })

    it('should throw error on API error response', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      }))

      await expect(googleProvider.fetchModels({ apiKey: 'invalid-key' }))
        .rejects.toThrow('Invalid API key')
    })

    it('should handle API error without message', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      }))

      await expect(googleProvider.fetchModels({ apiKey: 'test-key' }))
        .rejects.toThrow('HTTP 500')
    })

    it('should handle network errors', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      await expect(googleProvider.fetchModels({ apiKey: 'test-key' }))
        .rejects.toThrow('Network error')
    })

    it('should use custom baseUrl when provided', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      }))

      await googleProvider.fetchModels({
        apiKey: 'test-key',
        baseUrl: 'https://custom.api.com/v1'
      })

      expect(fetch).toHaveBeenCalledWith(
        'https://custom.api.com/v1/models?key=test-key',
        expect.any(Object)
      )
    })

    it('should prefer apiKeys array over single apiKey', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ models: [] })
      }))

      await googleProvider.fetchModels({
        apiKey: 'single-key',
        apiKeys: ['array-key1', 'array-key2']
      })

      // Should use the first key from apiKeys array
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('key=array-key1'),
        expect.any(Object)
      )
    })
  })

  describe('Round Robin API Keys', () => {
    it('should cycle through keys on successive calls', async () => {
      const fetchCalls = []
      vi.stubGlobal('fetch', vi.fn().mockImplementation((url) => {
        fetchCalls.push(url)
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ models: [] })
        })
      }))

      const config = { apiKeys: ['key1', 'key2', 'key3'] }

      await googleProvider.fetchModels(config)
      await googleProvider.fetchModels(config)
      await googleProvider.fetchModels(config)
      await googleProvider.fetchModels(config) // Should wrap around to key1

      expect(fetchCalls[0]).toContain('key=key1')
      expect(fetchCalls[1]).toContain('key=key2')
      expect(fetchCalls[2]).toContain('key=key3')
      expect(fetchCalls[3]).toContain('key=key1') // Wrapped around
    })
  })

  describe('testConnection', () => {
    it('should return true when API returns models', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({
          models: [{
            name: 'models/gemini-2.0-flash',
            displayName: 'Gemini 2.0 Flash',
            supportedGenerationMethods: ['generateContent']
          }]
        })
      }))

      const result = await googleProvider.testConnection({ apiKey: 'valid-key' })
      expect(result).toBe(true)
    })

    it('should return false when no API key provided', async () => {
      const result = await googleProvider.testConnection({})
      expect(result).toBe(false)
    })

    it('should return false when API returns error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: () => Promise.resolve({ error: { message: 'Invalid API key' } })
      }))

      const result = await googleProvider.testConnection({ apiKey: 'invalid-key' })
      expect(result).toBe(false)
    })

    it('should return false on network error', async () => {
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network error')))

      const result = await googleProvider.testConnection({ apiKey: 'test-key' })
      expect(result).toBe(false)
    })
  })

  describe('Provider metadata', () => {
    it('should have correct provider properties', () => {
      expect(googleProvider.id).toBe('google')
      expect(googleProvider.name).toBe('Google AI Studio')
      expect(googleProvider.requiresApiKey).toBe(true)
      expect(googleProvider.defaultBaseUrl).toBe('https://generativelanguage.googleapis.com/v1beta')
    })
  })
})
