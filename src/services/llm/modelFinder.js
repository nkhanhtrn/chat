/**
 * Model Finder Utilities
 *
 * Utilities for finding and selecting models from available model lists.
 */

import { lmstudioProvider } from './providers/lmstudio.js'
import { getProviderConfig } from './index.js'

/**
 * Find a model matching the given patterns from available models
 * @param {Array} models - List of available models
 * @param {string[]} patterns - Patterns to match against model id/name
 * @returns {Object|null} The matched model or null
 */
export const findModelByPattern = (models, patterns) => {
  for (const pattern of patterns) {
    const match = models.find(m =>
      m.id.toLowerCase().includes(pattern.toLowerCase()) ||
      m.name.toLowerCase().includes(pattern.toLowerCase())
    )
    if (match) return match
  }
  return null
}

/**
 * Fetch all available models from LM Studio
 * @param {Object} config - Provider configuration
 * @returns {Promise<Array>} List of available models
 */
export const fetchAvailableModels = async (config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')
  return lmstudioProvider.fetchModels(providerConfig)
}

/**
 * Find executor model from available models
 * Router model must be explicitly specified by user
 * @param {Array} models - List of available models
 * @returns {Object} Object with router (null) and executor model
 */
export const findRouterAndExecutorModels = (models) => {
  const executorPatterns = ['gpt-oss-20b', 'gpt-oss', 'openai', 'cerebras']

  return {
    router: null,  // User must specify router model explicitly
    executor: findModelByPattern(models, executorPatterns)
  }
}

export default {
  findModelByPattern,
  fetchAvailableModels,
  findRouterAndExecutorModels
}
