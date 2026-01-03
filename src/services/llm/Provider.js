/**
 * Base Provider Interface
 * All LLM providers extend or implement this interface
 */
import { Settings } from '../Settings.js'

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [apiKey] - Single API key
 * @property {string[]} [apiKeys] - Multiple API keys (round-robin)
 * @property {string} [baseUrl] - Custom base URL
 * @property {string} [codeApiUrl] - For Code API provider
 */

/**
 * Base Provider class that all providers should extend
 */
export class Provider {
  /**
   * @param {string} id - Provider identifier
   * @param {string} name - Display name
   * @param {string} category - Provider category: 'free' | 'quick' | 'details' | 'reasoning'
   * @param {boolean} requiresApiKey - Whether provider needs API key
   * @param {boolean} supportsStreaming - Whether provider supports streaming
   */
  constructor(id, name, category, { requiresApiKey = false, supportsStreaming = true } = {}) {
    this.id = id
    this.name = name
    this.category = category
    this.requiresApiKey = requiresApiKey
    this.supportsStreaming = supportsStreaming
  }

  /**
   * Get the model ID for this provider from Settings
   * @returns {string} Model ID
   */
  getModelId() {
    const settings = Settings.getAll()
    return settings.currentModels?.[this.id] || this.getDefaultModel()
  }

  /**
   * Get default model for this provider (fallback)
   * @returns {string} Default model ID
   */
  getDefaultModel() {
    return 'default-model'
  }

  /**
   * Get provider config from Settings
   * @returns {ProviderConfig} Provider configuration
   */
  getConfig() {
    const settings = Settings.getAll()
    return settings.providerConfigs?.[this.id] || {}
  }

  /**
   * Send a chat message (non-streaming)
   * @param {Message[]} messages - Chat messages
   * @returns {Promise<{content: string, usage?: Object}>} Response
   */
  async send(messages) {
    throw new Error('send() must be implemented by subclass')
  }

  /**
   * Send a chat message (streaming)
   * @param {Message[]} messages - Chat messages
   * @returns {AsyncIterable<string>} Streaming response chunks
   */
  async *sendStream(messages) {
    throw new Error('sendStream() must be implemented by subclass')
  }

  /**
   * List available models
   * @returns {Promise<Array<{id: string, name: string}>>} Available models
   */
  async listModels() {
    return []
  }
}

export default Provider
