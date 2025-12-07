/**
 * LLM Provider Manager
 * Manages provider selection and configuration, delegates API calls to active provider
 */
import { lmstudioProvider } from './providers/lmstudio.js'
import { googleProvider } from './providers/google.js'

const STORAGE_KEY_PROVIDER = 'llm-provider'
const STORAGE_KEY_PROVIDER_CONFIG = 'llm-provider-config'

// Registry of available providers
const providers = {
  lmstudio: lmstudioProvider,
  google: googleProvider
}

// Current provider state
let currentProviderId = 'lmstudio'
let currentConfig = {}

/**
 * Initialize provider from localStorage
 */
export const initProvider = () => {
  try {
    const savedProviderId = localStorage.getItem(STORAGE_KEY_PROVIDER)
    const savedConfig = localStorage.getItem(STORAGE_KEY_PROVIDER_CONFIG)

    if (savedProviderId && providers[savedProviderId]) {
      currentProviderId = savedProviderId
    }

    if (savedConfig) {
      currentConfig = JSON.parse(savedConfig)
    }
  } catch (error) {
    console.warn('Failed to load provider settings:', error)
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

  currentProviderId = providerId
  currentConfig = config

  // Persist to localStorage
  localStorage.setItem(STORAGE_KEY_PROVIDER, providerId)
  localStorage.setItem(STORAGE_KEY_PROVIDER_CONFIG, JSON.stringify(config))
}

/**
 * Update config for current provider
 * @param {Object} config
 */
export const updateConfig = (config) => {
  currentConfig = { ...currentConfig, ...config }
  localStorage.setItem(STORAGE_KEY_PROVIDER_CONFIG, JSON.stringify(currentConfig))
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

// Initialize on module load
initProvider()
