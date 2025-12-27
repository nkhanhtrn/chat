/**
 * Provider Registry
 *
 * Manages LLM providers (LM Studio, Google, Cerebras) and provides
 * a unified interface for accessing them.
 */

import { lmstudioProvider } from './providers/lmstudio.js'
import { googleProvider } from './providers/google.js'
import { cerebrasProvider } from './providers/cerebras.js'
import { getProviderConfig } from './index.js'

// Provider registry for multi-provider support
const providerRegistry = {
  lmstudio: lmstudioProvider,
  google: googleProvider,
  cerebras: cerebrasProvider
}

/**
 * Get provider instance by ID
 * @param {string} providerId - The provider ID (lmstudio, google, cerebras)
 * @returns {Object} The provider instance
 */
export const getProvider = (providerId) => {
  return providerRegistry[providerId] || lmstudioProvider
}

/**
 * Get provider config by ID
 * @param {string} providerId - The provider ID
 * @returns {Object} The provider configuration
 */
export const getProviderConfigById = (providerId) => {
  return getProviderConfig(providerId)
}

/**
 * Get all registered provider IDs
 * @returns {string[]} Array of provider IDs
 */
export const getProviderIds = () => {
  return Object.keys(providerRegistry)
}

/**
 * Check if a provider is registered
 * @param {string} providerId - The provider ID to check
 * @returns {boolean} True if provider exists
 */
export const hasProvider = (providerId) => {
  return providerId in providerRegistry
}

export default {
  getProvider,
  getProviderConfigById,
  getProviderIds,
  hasProvider
}
