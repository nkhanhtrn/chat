/**
 * LM Service - Central service for all LLM providers
 *
 * This service:
 * - Hosts all registered providers
 * - Provides generic interface for chat operations
 * - Routes calls to appropriate provider by category
 *
 * Provider Categories:
 * - free: LM Studio (local, no API key)
 * - quick: Cerebras (fast inference)
 * - details: Google AI (detailed responses)
 * - reasoning: Code API (code & reasoning)
 */

import { Provider } from './Provider.js'
import lmstudioProvider from './providers/lmstudio.js'
import cerebrasProvider from './providers/cerebras.js'
import googleProvider from './providers/google.js'
import codeApiProvider from './providers/codeapi.js'

// Provider categories
export const Category = {
  FREE: 'free',
  QUICK: 'quick',
  DETAILS: 'details',
  REASONING: 'reasoning'
}

/**
 * LM Service class
 * Provides generic interface for LLM operations
 */
class LMService {
  constructor() {
    // Provider registry
    this._providers = new Map()

    // Register all providers
    this._registerProviders()
  }

  /**
   * Register all providers
   * @private
   */
  _registerProviders() {
    this.register(lmstudioProvider)
    this.register(cerebrasProvider)
    this.register(googleProvider)
    this.register(codeApiProvider)
  }

  /**
   * Register a provider
   * @param {Provider} provider - Provider instance
   */
  register(provider) {
    this._providers.set(provider.id, provider)
  }

  /**
   * Get a provider by ID
   * @param {string} providerId - Provider ID
   * @returns {Provider} Provider instance
   */
  getProvider(providerId) {
    const provider = this._providers.get(providerId)
    if (!provider) {
      throw new Error(`Unknown provider: ${providerId}`)
    }
    return provider
  }

  /**
   * Get provider by category
   * @param {string} category - 'free' | 'quick' | 'details' | 'reasoning'
   * @returns {Provider} Provider instance
   */
  getProviderByCategory(category) {
    // In dev environment, use LM Studio for all categories except reasoning
    const isDev = import.meta.env.DEV
    if (isDev && category !== 'reasoning') {
      // Get the 'free' provider directly without recursion
      for (const provider of this._providers.values()) {
        if (provider.category === 'free') {
          return provider
        }
      }
    }

    for (const provider of this._providers.values()) {
      if (provider.category === category) {
        return provider
      }
    }
    throw new Error(`No provider found for category: ${category}`)
  }

  /**
   * Get free provider (local, no API key)
   * @returns {Provider} LM Studio provider
   */
  getFreeProvider() {
    return this.getProviderByCategory('free')
  }

  /**
   * Get default provider ID (LM Studio)
   * @returns {string} Default provider ID
   */
  getDefaultProviderId() {
    return 'lmstudio'
  }

  /**
   * Get quick provider (fast inference)
   * @returns {Provider} Cerebras provider
   */
  getQuickProvider() {
    return this.getProviderByCategory('quick')
  }

  /**
   * Get details provider (detailed responses)
   * @returns {Provider} Google provider
   */
  getDetailsProvider() {
    return this.getProviderByCategory('details')
  }

  /**
   * Get reasoning provider (code & reasoning)
   * @returns {Provider} Code API provider
   */
  getReasoningProvider() {
    return this.getProviderByCategory('reasoning')
  }

  /**
   * List all providers
   * @returns {Array<{id: string, name: string, category: string}>} Provider list
   */
  listProviders() {
    return Array.from(this._providers.values()).map(p => ({
      id: p.id,
      name: p.name,
      category: p.category,
      requiresApiKey: p.requiresApiKey,
      supportsStreaming: p.supportsStreaming
    }))
  }

  /**
   * Send a chat message (non-streaming)
   * @param {string} providerId - Provider ID
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {Promise<{content: string, usage?: Object}>} Response
   */
  async send(providerId, messages) {
    const provider = this.getProvider(providerId)
    return provider.send(messages)
  }

  /**
   * Send a chat message (streaming)
   * @param {string} providerId - Provider ID
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {function} onChunk - Callback for streaming chunks
   * @returns {Promise<string>} Full response content
   */
  async sendStream(providerId, messages, onChunk) {
    const provider = this.getProvider(providerId)

    if (!provider.supportsStreaming) {
      // Fallback to non-streaming
      const result = await provider.send(messages)
      return result.content
    }

    // Collect chunks from async iterable
    let fullContent = ''
    for await (const chunk of provider.sendStream(messages)) {
      fullContent += chunk
      if (onChunk) {
        onChunk(chunk)
      }
    }
    return fullContent
  }

  /**
   * Send a chat message by category (routes to provider for that category)
   * @param {string} category - 'free' | 'quick' | 'details' | 'reasoning'
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @param {function|null} onChunk - Callback for streaming chunks
   * @returns {Promise<string|null>} Full response content
   */
  async sendByCategory(category, messages, onChunk = null) {
    const provider = this.getProviderByCategory(category)

    if (onChunk && provider.supportsStreaming) {
      return await this.sendStream(provider.id, messages, onChunk)
    }

    const result = await this.send(provider.id, messages)
    return result?.content || null
  }
}

// Singleton instance
const lmService = new LMService()

// Export both class and singleton
export { LMService }
export default lmService
