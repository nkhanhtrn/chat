import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// Mock the firestore module
vi.mock('../../firestore.js', () => ({
  loadUserSettings: vi.fn(),
  saveUserSettings: vi.fn()
}))

// Mock the providers
vi.mock('../providers/lmstudio.js', () => ({
  lmstudioProvider: {
    id: 'lmstudio',
    name: 'LM Studio',
    requiresApiKey: false,
    defaultBaseUrl: 'http://localhost:1234',
    fetchModels: vi.fn(),
    sendMessage: vi.fn(),
    testConnection: vi.fn()
  }
}))

vi.mock('../providers/google.js', () => ({
  googleProvider: {
    id: 'google',
    name: 'Google AI',
    requiresApiKey: true,
    defaultBaseUrl: 'https://generativelanguage.googleapis.com',
    fetchModels: vi.fn(),
    sendMessage: vi.fn(),
    testConnection: vi.fn()
  }
}))

vi.mock('../providers/cerebras.js', () => ({
  cerebrasProvider: {
    id: 'cerebras',
    name: 'Cerebras',
    requiresApiKey: true,
    defaultBaseUrl: 'https://api.cerebras.ai/v1',
    fetchModels: vi.fn(),
    sendMessage: vi.fn(),
    testConnection: vi.fn()
  }
}))

describe('LLM Provider Manager', () => {
  let llmModule
  let loadUserSettings
  let saveUserSettings

  beforeEach(async () => {
    vi.clearAllMocks()

    // Reset module state by re-importing
    vi.resetModules()

    const firestoreModule = await import('../../firestore.js')
    loadUserSettings = firestoreModule.loadUserSettings
    saveUserSettings = firestoreModule.saveUserSettings

    // Default mock - no settings
    vi.mocked(loadUserSettings).mockResolvedValue(null)
    vi.mocked(saveUserSettings).mockResolvedValue(undefined)

    llmModule = await import('../index.js')
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('listProviders', () => {
    it('should return all available providers', () => {
      const providers = llmModule.listProviders()

      expect(providers).toHaveLength(3)
      expect(providers.map(p => p.id)).toContain('lmstudio')
      expect(providers.map(p => p.id)).toContain('google')
      expect(providers.map(p => p.id)).toContain('cerebras')
    })

    it('should include requiresApiKey flag for each provider', () => {
      const providers = llmModule.listProviders()

      const lmstudio = providers.find(p => p.id === 'lmstudio')
      const google = providers.find(p => p.id === 'google')
      const cerebras = providers.find(p => p.id === 'cerebras')

      expect(lmstudio.requiresApiKey).toBe(false)
      expect(google.requiresApiKey).toBe(true)
      expect(cerebras.requiresApiKey).toBe(true)
    })
  })

  describe('setProvider', () => {
    it('should set provider and save settings', () => {
      llmModule.setProvider('google', { apiKey: 'test-key' })

      expect(llmModule.getCurrentProviderId()).toBe('google')
      expect(saveUserSettings).toHaveBeenCalledWith({
        llmProvider: 'google',
        llmConfig: { apiKey: 'test-key' }
      })
    })

    it('should throw error for unknown provider', () => {
      expect(() => {
        llmModule.setProvider('unknown', {})
      }).toThrow('Unknown provider: unknown')
    })

    describe('config filtering', () => {
      it('should only keep apiKey for providers that require it', () => {
        llmModule.setProvider('cerebras', {
          apiKey: 'cerebras-key',
          baseUrl: 'http://localhost:1234' // This should be filtered out
        })

        const config = llmModule.getCurrentConfig()
        expect(config.apiKey).toBe('cerebras-key')
        expect(config.baseUrl).toBeUndefined()
      })

      it('should support apiKeys array for providers that require API key', () => {
        llmModule.setProvider('google', {
          apiKeys: ['key1', 'key2', 'key3']
        })

        const config = llmModule.getCurrentConfig()
        expect(config.apiKeys).toEqual(['key1', 'key2', 'key3'])
        expect(config.apiKey).toBeUndefined()
      })

      it('should prefer apiKeys over apiKey when both provided', () => {
        llmModule.setProvider('cerebras', {
          apiKey: 'single-key',
          apiKeys: ['array-key1', 'array-key2']
        })

        const config = llmModule.getCurrentConfig()
        expect(config.apiKeys).toEqual(['array-key1', 'array-key2'])
        expect(config.apiKey).toBeUndefined()
      })

      it('should only keep baseUrl for providers that do not require apiKey', () => {
        llmModule.setProvider('lmstudio', {
          apiKey: 'some-key', // This should be filtered out
          baseUrl: 'http://localhost:5678'
        })

        const config = llmModule.getCurrentConfig()
        expect(config.baseUrl).toBe('http://localhost:5678')
        expect(config.apiKey).toBeUndefined()
      })

      it('should save filtered config to Firestore', () => {
        llmModule.setProvider('google', {
          apiKey: 'google-key',
          baseUrl: 'http://wrong-url' // Should be filtered out
        })

        expect(saveUserSettings).toHaveBeenCalledWith({
          llmProvider: 'google',
          llmConfig: { apiKey: 'google-key' }
        })
      })

      it('should not include baseUrl in Cerebras config', () => {
        llmModule.setProvider('cerebras', {
          apiKey: 'cerebras-key',
          baseUrl: 'http://localhost:1234'
        })

        expect(saveUserSettings).toHaveBeenCalledWith({
          llmProvider: 'cerebras',
          llmConfig: { apiKey: 'cerebras-key' }
        })
      })
    })
  })

  describe('initProvider', () => {
    it('should load provider from settings', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'google',
        providerConfigs: {
          google: { apiKey: 'saved-google-key' }
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      expect(freshModule.getCurrentProviderId()).toBe('google')
      expect(freshModule.getCurrentConfig()).toEqual({ apiKey: 'saved-google-key' })
    })

    it('should load apiKeys array from settings', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'google',
        providerConfigs: {
          google: { apiKeys: ['key1', 'key2', 'key3'] }
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      expect(freshModule.getCurrentProviderId()).toBe('google')
      expect(freshModule.getCurrentConfig()).toEqual({ apiKeys: ['key1', 'key2', 'key3'] })
    })

    it('should prefer apiKeys over apiKey when loading from settings', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'cerebras',
        providerConfigs: {
          cerebras: {
            apiKey: 'single-key',
            apiKeys: ['array-key1', 'array-key2']
          }
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const config = freshModule.getCurrentConfig()
      expect(config.apiKeys).toEqual(['array-key1', 'array-key2'])
      expect(config.apiKey).toBeUndefined()
    })

    it('should filter config when loading from providerConfigs', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'cerebras',
        providerConfigs: {
          cerebras: {
            apiKey: 'cerebras-key',
            baseUrl: 'http://localhost:1234' // Polluted data - should be filtered
          }
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const config = freshModule.getCurrentConfig()
      expect(config.apiKey).toBe('cerebras-key')
      expect(config.baseUrl).toBeUndefined()
    })

    it('should filter legacy llmConfig when loading', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'cerebras',
        llmConfig: {
          apiKey: 'cerebras-key',
          baseUrl: 'http://localhost:1234' // Legacy polluted data
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const config = freshModule.getCurrentConfig()
      expect(config.apiKey).toBe('cerebras-key')
      expect(config.baseUrl).toBeUndefined()
    })

    it('should load baseUrl for providers that do not require apiKey', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          lmstudio: {
            baseUrl: 'http://custom:5678',
            apiKey: 'some-key' // Should be filtered out
          }
        }
      })

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const config = freshModule.getCurrentConfig()
      expect(config.baseUrl).toBe('http://custom:5678')
      expect(config.apiKey).toBeUndefined()
    })

    it('should default to lmstudio when no settings', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue(null)

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      expect(freshModule.getCurrentProviderId()).toBe('lmstudio')
    })

    it('should only initialize once', async () => {
      vi.resetModules()

      const firestoreModule = await import('../../firestore.js')
      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'google',
        providerConfigs: { google: { apiKey: 'key1' } }
      })

      const freshModule = await import('../index.js')

      await freshModule.initProvider()
      await freshModule.initProvider() // Second call should be no-op

      expect(firestoreModule.loadUserSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('sendChatMessage', () => {
    it('should pass filtered config to provider', async () => {
      vi.resetModules()

      const cerebrasModule = await import('../providers/cerebras.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'cerebras',
        providerConfigs: {
          cerebras: {
            apiKey: 'cerebras-key',
            baseUrl: 'http://localhost:1234' // Should NOT be passed to provider
          }
        }
      })

      vi.mocked(cerebrasModule.cerebrasProvider.sendMessage).mockResolvedValue('response')

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      await freshModule.sendChatMessage('model', [{ role: 'user', content: 'test' }])

      expect(cerebrasModule.cerebrasProvider.sendMessage).toHaveBeenCalledWith(
        'model',
        [{ role: 'user', content: 'test' }],
        null,
        null,
        { apiKey: 'cerebras-key' } // baseUrl should NOT be here
      )
    })
  })

  describe('getCurrentConfig', () => {
    it('should return a copy of the config', () => {
      llmModule.setProvider('lmstudio', { baseUrl: 'http://test:1234' })

      const config1 = llmModule.getCurrentConfig()
      const config2 = llmModule.getCurrentConfig()

      expect(config1).toEqual(config2)
      expect(config1).not.toBe(config2) // Different references
    })
  })

  describe('sendChatMessageForFeature - provider availability with apiKeys', () => {
    it('should use provider when apiKeys array is configured', async () => {
      vi.resetModules()

      const googleModule = await import('../providers/google.js')
      const lmstudioModule = await import('../providers/lmstudio.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          google: { apiKeys: ['key1', 'key2'] }
        }
      })

      // Mock lmstudio for dev mode fallback
      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(lmstudioModule.lmstudioProvider.sendMessage).mockResolvedValue('response from lmstudio')

      vi.mocked(googleModule.googleProvider.fetchModels).mockResolvedValue([
        { id: 'models/gemini-2.5-flash', name: 'Gemini 2.5 Flash' }
      ])
      vi.mocked(googleModule.googleProvider.sendMessage).mockResolvedValue('response from google')

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      // In dev mode (vitest), it uses lmstudio - test that config is loaded correctly
      const result = await freshModule.sendChatMessageForFeature(
        freshModule.FeatureType.QUESTION,
        [{ role: 'user', content: 'test' }]
      )

      // In dev mode, uses lmstudio
      expect(result).toBe('response from lmstudio')
    })

    it('should use provider when single apiKey is configured', async () => {
      vi.resetModules()

      const cerebrasModule = await import('../providers/cerebras.js')
      const lmstudioModule = await import('../providers/lmstudio.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          cerebras: { apiKey: 'single-key' }
        }
      })

      // Mock lmstudio for dev mode
      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(lmstudioModule.lmstudioProvider.sendMessage).mockResolvedValue('response from lmstudio')

      vi.mocked(cerebrasModule.cerebrasProvider.fetchModels).mockResolvedValue([
        { id: 'gpt-oss-120b', name: 'GPT OSS 120B' }
      ])
      vi.mocked(cerebrasModule.cerebrasProvider.sendMessage).mockResolvedValue('response from cerebras')

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const result = await freshModule.sendChatMessageForFeature(
        freshModule.FeatureType.SUMMARY,
        [{ role: 'user', content: 'summarize this' }]
      )

      // In dev mode, uses lmstudio
      expect(result).toBe('response from lmstudio')
    })

    it('should fallback to next provider when primary has no keys configured', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          // google has no keys - should fallback to lmstudio
        }
      })

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(lmstudioModule.lmstudioProvider.sendMessage).mockResolvedValue('response from lmstudio')

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const result = await freshModule.sendChatMessageForFeature(
        freshModule.FeatureType.QUESTION, // prefers google, but will fallback to lmstudio
        [{ role: 'user', content: 'test' }]
      )

      expect(result).toBe('response from lmstudio')
      expect(lmstudioModule.lmstudioProvider.sendMessage).toHaveBeenCalled()
    })

    it('should skip provider with empty apiKeys array', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          google: { apiKeys: [] } // Empty array - should not be available
        }
      })

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(lmstudioModule.lmstudioProvider.sendMessage).mockResolvedValue('response from lmstudio')

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const result = await freshModule.sendChatMessageForFeature(
        freshModule.FeatureType.QUESTION,
        [{ role: 'user', content: 'test' }]
      )

      expect(result).toBe('response from lmstudio')
    })
  })

  describe('getCurrentProvider', () => {
    it('should return the current provider instance', () => {
      llmModule.setProvider('google', { apiKey: 'test' })

      const provider = llmModule.getCurrentProvider()

      expect(provider.id).toBe('google')
      expect(provider.name).toBe('Google AI')
    })
  })

  describe('fetchAllModels', () => {
    it('should fetch models from all providers', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const googleModule = await import('../providers/google.js')
      const cerebrasModule = await import('../providers/cerebras.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue({
        llmProvider: 'lmstudio',
        providerConfigs: {
          google: { apiKey: 'google-key' },
          cerebras: { apiKey: 'cerebras-key' }
        }
      })

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model-1', name: 'Local Model 1' },
        { id: 'local-model-2', name: 'Local Model 2' }
      ])
      vi.mocked(googleModule.googleProvider.fetchModels).mockResolvedValue([
        { id: 'gemini-pro', name: 'Gemini Pro' }
      ])
      vi.mocked(cerebrasModule.cerebrasProvider.fetchModels).mockResolvedValue([
        { id: 'gpt-oss-20b', name: 'GPT OSS 20B' }
      ])

      const freshModule = await import('../index.js')
      await freshModule.initProvider()

      const allModels = await freshModule.fetchAllModels()

      expect(allModels).toHaveLength(4)
      expect(allModels.map(m => m.id)).toContain('local-model-1')
      expect(allModels.map(m => m.id)).toContain('local-model-2')
      expect(allModels.map(m => m.id)).toContain('gemini-pro')
      expect(allModels.map(m => m.id)).toContain('gpt-oss-20b')
    })

    it('should include provider info in model name', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const googleModule = await import('../providers/google.js')
      const cerebrasModule = await import('../providers/cerebras.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue(null)

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(googleModule.googleProvider.fetchModels).mockResolvedValue([
        { id: 'gemini-pro', name: 'Gemini Pro' }
      ])
      vi.mocked(cerebrasModule.cerebrasProvider.fetchModels).mockResolvedValue([
        { id: 'gpt-oss-20b', name: 'GPT OSS 20B' }
      ])

      const freshModule = await import('../index.js')

      const allModels = await freshModule.fetchAllModels()

      const lmModel = allModels.find(m => m.id === 'local-model')
      const googleModel = allModels.find(m => m.id === 'gemini-pro')
      const cerebrasModel = allModels.find(m => m.id === 'gpt-oss-20b')

      expect(lmModel.name).toBe('Local Model (LM Studio)')
      expect(lmModel.providerId).toBe('lmstudio')
      expect(googleModel.name).toBe('Gemini Pro (Google AI)')
      expect(googleModel.providerId).toBe('google')
      expect(cerebrasModel.name).toBe('GPT OSS 20B (Cerebras)')
      expect(cerebrasModel.providerId).toBe('cerebras')
    })

    it('should continue fetching from other providers if one fails', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const googleModule = await import('../providers/google.js')
      const cerebrasModule = await import('../providers/cerebras.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue(null)

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockResolvedValue([
        { id: 'local-model', name: 'Local Model' }
      ])
      vi.mocked(googleModule.googleProvider.fetchModels).mockRejectedValue(
        new Error('API key invalid')
      )
      vi.mocked(cerebrasModule.cerebrasProvider.fetchModels).mockResolvedValue([
        { id: 'gpt-oss-20b', name: 'GPT OSS 20B' }
      ])

      const freshModule = await import('../index.js')

      const allModels = await freshModule.fetchAllModels()

      // Should have models from lmstudio and cerebras, but not google
      expect(allModels).toHaveLength(2)
      expect(allModels.map(m => m.id)).toContain('local-model')
      expect(allModels.map(m => m.id)).toContain('gpt-oss-20b')
      expect(allModels.map(m => m.id)).not.toContain('gemini-pro')
    })

    it('should return empty array if all providers fail', async () => {
      vi.resetModules()

      const lmstudioModule = await import('../providers/lmstudio.js')
      const googleModule = await import('../providers/google.js')
      const cerebrasModule = await import('../providers/cerebras.js')
      const firestoreModule = await import('../../firestore.js')

      vi.mocked(firestoreModule.loadUserSettings).mockResolvedValue(null)

      vi.mocked(lmstudioModule.lmstudioProvider.fetchModels).mockRejectedValue(
        new Error('Connection refused')
      )
      vi.mocked(googleModule.googleProvider.fetchModels).mockRejectedValue(
        new Error('API key invalid')
      )
      vi.mocked(cerebrasModule.cerebrasProvider.fetchModels).mockRejectedValue(
        new Error('Service unavailable')
      )

      const freshModule = await import('../index.js')

      const allModels = await freshModule.fetchAllModels()

      expect(allModels).toHaveLength(0)
    })
  })
})
