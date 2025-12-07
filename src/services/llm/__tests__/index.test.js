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

  describe('getCurrentProvider', () => {
    it('should return the current provider instance', () => {
      llmModule.setProvider('google', { apiKey: 'test' })

      const provider = llmModule.getCurrentProvider()

      expect(provider.id).toBe('google')
      expect(provider.name).toBe('Google AI')
    })
  })
})
