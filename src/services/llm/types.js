/**
 * Shared types for LLM providers (JSDoc for IDE support)
 */

/**
 * @typedef {Object} Model
 * @property {string} id - Model identifier used in API calls
 * @property {string} name - Display name for UI
 */

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [apiKey] - API key for the provider
 * @property {string} [baseUrl] - Base URL for API calls
 */

/**
 * @typedef {Object} LLMProvider
 * @property {string} id - Provider identifier (e.g., 'lmstudio', 'google')
 * @property {string} name - Display name (e.g., 'LM Studio', 'Google AI')
 * @property {boolean} requiresApiKey - Whether provider needs an API key
 * @property {string} [defaultBaseUrl] - Default API base URL
 * @property {(config: ProviderConfig) => Promise<Model[]>} fetchModels - Get available models
 * @property {(model: string, messages: Message[], onChunk: Function|null, signal: AbortSignal|null, config: ProviderConfig) => Promise<string|null>} sendMessage - Send chat message
 * @property {(config: ProviderConfig) => Promise<boolean>} testConnection - Test if connection works
 */

export default {}
