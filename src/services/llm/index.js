/**
 * LLM Provider Manager
 * Manages provider selection and configuration, delegates API calls to active provider
 */
import { lmstudioProvider } from './providers/lmstudio.js'
import { googleProvider } from './providers/google.js'
import { cerebrasProvider } from './providers/cerebras.js'
import { saveUserSettings, loadUserSettings } from '../firestore.js'

// Registry of available providers
const providers = {
  lmstudio: lmstudioProvider,
  google: googleProvider,
  cerebras: cerebrasProvider
}

// Feature types for provider preference
export const FeatureType = {
  QUESTION: 'question',
  DEEP_DIVE: 'deep_dive',
  SUMMARY: 'summary',
  EXPLAIN: 'explain',
  DICTIONARY: 'dictionary',
  SR_SUMMARY: 'sr_summary'
}

// Provider preferences by feature (production only)
// Google AI: question, deep_dive
// Cerebras: summary, explain
// Fallback: lmstudio (local)
const featureProviderPreference = {
  [FeatureType.QUESTION]: ['google', 'lmstudio'],
  [FeatureType.DEEP_DIVE]: ['google', 'lmstudio'],
  [FeatureType.SUMMARY]: ['cerebras', 'lmstudio'],
  [FeatureType.EXPLAIN]: ['cerebras', 'lmstudio'],
  [FeatureType.DICTIONARY]: ['cerebras', 'lmstudio'],
  [FeatureType.SR_SUMMARY]: ['cerebras', 'lmstudio']
}

// Check if running in development mode
const isDev = () => {
  return import.meta.env?.DEV || import.meta.env?.MODE === 'development'
}

// Current provider state
let currentProviderId = 'lmstudio'
let currentConfig = {}
let firestoreInitialized = false
// Store configs for all providers (loaded from Firestore)
let allProviderConfigs = {}

/**
 * Initialize provider from Firestore (uses cached settings)
 * @returns {Promise<void>}
 */
export const initProvider = async () => {
  if (firestoreInitialized) return

  try {
    // Uses cached settings - no additional Firestore read
    const settings = await loadUserSettings()

    if (settings?.llmProvider && providers[settings.llmProvider]) {
      currentProviderId = settings.llmProvider
    }

    // Store all provider configs for feature-based provider selection
    allProviderConfigs = settings?.providerConfigs || {}
    // Also check legacy llmConfig
    if (settings?.llmConfig && !allProviderConfigs[currentProviderId]) {
      allProviderConfigs[currentProviderId] = settings.llmConfig
    }

    // Load provider-specific config, filtering to only relevant keys
    const provider = providers[currentProviderId]
    const savedConfig = allProviderConfigs[currentProviderId] || {}
    const config = {}

    // Only load keys that are relevant for this provider type
    if (provider?.requiresApiKey) {
      if (savedConfig.apiKeys) {
        config.apiKeys = savedConfig.apiKeys
      } else if (savedConfig.apiKey) {
        config.apiKey = savedConfig.apiKey
      }
    }
    if (!provider?.requiresApiKey && savedConfig.baseUrl) {
      config.baseUrl = savedConfig.baseUrl
    }

    currentConfig = config
    firestoreInitialized = true
  } catch (error) {
    console.warn('Failed to load provider settings from Firestore:', error)
  }
}

/**
 * Get list of available providers
 * @returns {Array<{id: string, name: string, requiresApiKey: boolean}>}
 */
export const listProviders = () => {
  return Object.values(providers).map(p => ({
    id: p.id,
    name: p.name,
    requiresApiKey: p.requiresApiKey,
    defaultBaseUrl: p.defaultBaseUrl
  }))
}

/**
 * Get current provider ID
 * @returns {string}
 */
export const getCurrentProviderId = () => currentProviderId

/**
 * Get current provider config
 * @returns {Object}
 */
export const getCurrentConfig = () => ({ ...currentConfig })

/**
 * Get current provider instance
 * @returns {import('./types.js').LLMProvider}
 */
export const getCurrentProvider = () => providers[currentProviderId]

/**
 * Set the active provider
 * @param {string} providerId
 * @param {Object} config - Provider-specific config (apiKey, baseUrl, etc.)
 */
export const setProvider = (providerId, config = {}) => {
  if (!providers[providerId]) {
    throw new Error(`Unknown provider: ${providerId}`)
  }

  const provider = providers[providerId]
  currentProviderId = providerId

  // Build clean config with only provider-relevant keys
  // This prevents baseUrl from LM Studio leaking to Cerebras, etc.
  const cleanConfig = {}
  if (provider.requiresApiKey) {
    if (config.apiKeys) {
      cleanConfig.apiKeys = config.apiKeys
    } else if (config.apiKey) {
      cleanConfig.apiKey = config.apiKey
    }
  }
  if (!provider.requiresApiKey && config.baseUrl) {
    cleanConfig.baseUrl = config.baseUrl
  }
  currentConfig = cleanConfig

  // Persist to Firestore
  saveUserSettings({
    llmProvider: providerId,
    llmConfig: currentConfig
  })
}

/**
 * Update config for current provider
 * @param {Object} config
 */
export const updateConfig = (config) => {
  currentConfig = { ...currentConfig, ...config }
  saveUserSettings({
    llmConfig: currentConfig
  })
}

/**
 * Test connection to current provider
 * @returns {Promise<boolean>}
 */
export const testConnection = async () => {
  const provider = getCurrentProvider()
  return provider.testConnection(currentConfig)
}

// ============================================
// Unified API (delegates to current provider)
// ============================================

/**
 * Fetch available models from current provider
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export const fetchModels = async () => {
  const provider = getCurrentProvider()
  return provider.fetchModels(currentConfig)
}

/**
 * Send a chat message using current provider
 * @param {string} model - Model ID
 * @param {Array<{role: string, content: string}>} messages
 * @param {Function|null} onChunk - Callback for streaming chunks
 * @param {AbortSignal|null} signal - Abort signal for cancellation
 * @returns {Promise<string|null>}
 */
export const sendChatMessage = async (model, messages, onChunk = null, signal = null) => {
  const provider = getCurrentProvider()
  return provider.sendMessage(model, messages, onChunk, signal, currentConfig)
}

/**
 * Get config for a specific provider
 * @param {string} providerId
 * @returns {Object}
 */
const getProviderConfig = (providerId) => {
  const provider = providers[providerId]
  if (!provider) return {}

  const savedConfig = allProviderConfigs[providerId] || {}
  const config = {}

  if (provider.requiresApiKey) {
    if (savedConfig.apiKeys) {
      config.apiKeys = savedConfig.apiKeys
    } else if (savedConfig.apiKey) {
      config.apiKey = savedConfig.apiKey
    }
  }
  if (!provider.requiresApiKey && savedConfig.baseUrl) {
    config.baseUrl = savedConfig.baseUrl
  }

  return config
}

/**
 * Check if a provider is available (has required config)
 * @param {string} providerId
 * @returns {boolean}
 */
const isProviderAvailable = (providerId) => {
  const provider = providers[providerId]
  if (!provider) return false

  // LM Studio (local) is always "available" - connection tested at runtime
  if (!provider.requiresApiKey) return true

  // Cloud providers need API key(s)
  const config = getProviderConfig(providerId)
  return !!(config.apiKey || (config.apiKeys && config.apiKeys.length > 0))
}

/**
 * Send a chat message with feature-based provider selection
 * In dev: always use Local LM (lmstudio)
 * In prod: use preferred provider for feature, fallback to lmstudio
 *
 * @param {string} featureType - One of FeatureType values
 * @param {Array<{role: string, content: string}>} messages
 * @param {Function|null} onChunk - Callback for streaming chunks
 * @param {AbortSignal|null} signal - Abort signal for cancellation
 * @returns {Promise<string|null>}
 */
export const sendChatMessageForFeature = async (featureType, messages, onChunk = null, signal = null) => {
  // In dev mode, always use local LM Studio
  if (isDev()) {
    const provider = providers.lmstudio
    const config = getProviderConfig('lmstudio')
    // Use first available model or a placeholder
    const models = await provider.fetchModels(config).catch(() => [])
    const model = models[0]?.id || 'local-model'
    return provider.sendMessage(model, messages, onChunk, signal, config)
  }

  // In production, use feature-based provider preference with fallback
  const preferenceList = featureProviderPreference[featureType] || ['lmstudio']

  for (const providerId of preferenceList) {
    if (!isProviderAvailable(providerId)) continue

    const provider = providers[providerId]
    const config = getProviderConfig(providerId)

    try {
      // Get model for this provider
      const models = await provider.fetchModels(config).catch(() => [])
      if (models.length === 0) continue

      const model = models[0].id
      return await provider.sendMessage(model, messages, onChunk, signal, config)
    } catch (error) {
      console.warn(`Provider ${providerId} failed for feature ${featureType}:`, error.message)
      // Continue to next provider in preference list
    }
  }

  // All providers failed, throw error
  throw new Error(`No available provider for feature: ${featureType}`)
}

// Note: initProvider() must be called explicitly after auth is ready
