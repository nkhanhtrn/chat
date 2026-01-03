/**
 * Shared types for LLM providers (JSDoc for IDE support)
 */

/**
 * @typedef {Object} Model
 * @property {string} id - Model identifier used in API calls
 * @property {string} name - Display name for UI
 * @property {string} [providerId] - Provider ID (for unified model lists)
 */

/**
 * @typedef {Object} Message
 * @property {'user'|'assistant'|'system'} role
 * @property {string} content
 * @property {string} [fullContent] - Full content including previous context
 */

/**
 * @typedef {Object} ProviderConfig
 * @property {string} [apiKey] - Single API key for the provider
 * @property {string[]} [apiKeys] - Array of API keys (for round-robin)
 * @property {string} [baseUrl] - Base URL for API calls
 */

/**
 * @typedef {Object} SendMessageOptions
 * @property {function(string): void} [onChunk] - Callback for streaming chunks
 * @property {AbortSignal} [signal] - Abort signal for cancellation
 * @property {function(Object): void} [onUsage] - Callback for token usage info
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} promptTokens - Tokens used in prompt
 * @property {number} completionTokens - Tokens used in completion
 * @property {number} totalTokens - Total tokens used
 */

/**
 * @typedef {Object} SendMessageResult
 * @property {string} content - The complete response content
 * @property {TokenUsage} [usage] - Token usage information
 */

/**
 * @typedef {Object} LLMProvider
 * @property {string} id - Provider identifier (e.g., 'lmstudio', 'google')
 * @property {string} name - Display name (e.g., 'LM Studio', 'Google AI')
 * @property {boolean} requiresApiKey - Whether provider needs an API key
 * @property {boolean} supportsStreaming - Whether provider supports streaming
 * @property {string} [defaultBaseUrl] - Default API base URL
 *
 * @property {(config: ProviderConfig) => Promise<Model[]>} fetchModels - Get available models
 * @property {(model: string, messages: Message[], options: SendMessageOptions, config: ProviderConfig) => Promise<SendMessageResult>} sendMessage - Send chat message
 * @property {(config: ProviderConfig) => Promise<boolean>} testConnection - Test if connection works
 */

export default {}
