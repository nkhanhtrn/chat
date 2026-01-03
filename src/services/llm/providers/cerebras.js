/**
 * Cerebras Provider
 * OpenAI-compatible API with extremely fast inference
 * Supports multiple API keys with round-robin load balancing
 * Category: 'quick' (fast inference)
 */
import { parseOpenAIUsage } from '../../../utils/tokenUsage.js'
import { Provider } from '../Provider.js'

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1'

// Round-robin state for multiple API keys
let currentKeyIndex = 0

/**
 * Get the next API key using round-robin
 * @param {string|string[]} apiKeyOrKeys - Single key or array of keys
 * @returns {string} The next API key to use
 */
const getNextApiKey = (apiKeyOrKeys) => {
  if (!apiKeyOrKeys) return null

  // Handle single key (string)
  if (typeof apiKeyOrKeys === 'string') {
    return apiKeyOrKeys
  }

  // Handle array of keys
  if (Array.isArray(apiKeyOrKeys) && apiKeyOrKeys.length > 0) {
    const key = apiKeyOrKeys[currentKeyIndex % apiKeyOrKeys.length]
    currentKeyIndex = (currentKeyIndex + 1) % apiKeyOrKeys.length
    return key
  }

  return null
}

/**
 * Process SSE stream from OpenAI-compatible API
 * @returns {{ content: string, usage: Object|null }}
 */
const processSSEStream = async (reader, onChunk, signal = null) => {
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''
  let usage = null

  try {
    while (true) {
      if (signal?.aborted) break

      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue

        if (trimmedLine.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmedLine.slice(6))

            // Check for error response in stream
            if (data.error) {
              throw new Error(data.error.message || `API Error: ${data.error.code || 'Unknown'}`)
            }

            const content = data.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
              onChunk(content)
            }
            // Capture usage from final chunk
            if (data.usage) {
              usage = parseOpenAIUsage(data)
            }
          } catch (e) {
            // Re-throw API errors, skip parse errors
            if (e.message?.includes('API Error') || e.message?.includes('Rate') || e.message?.includes('limit') || e.message?.includes('quota')) {
              throw e
            }
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel()
    } catch (e) {
      // Ignore cancel errors
    }
  }

  return { content: fullContent, usage }
}

/**
 * Cerebras Provider class
 */
export class CerebrasProvider extends Provider {
  constructor() {
    super('cerebras', 'Cerebras', 'quick', {
      requiresApiKey: true,
      supportsStreaming: true
    })
    this.defaultBaseUrl = DEFAULT_BASE_URL
  }

  /**
   * Get default model for Cerebras
   * @returns {string} Default model ID
   */
  getDefaultModel() {
    return 'gpt-oss-120b'
  }

  /**
   * List available models
   * @returns {Promise<Array<{id: string, name: string}>>} Available models
   */
  async listModels() {
    const config = this.getConfig()
    const { apiKey, apiKeys } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      return []
    }

    // Available Cerebras models
    return [
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B' },
      { id: 'llama-3.3-70b', name: 'Llama 3.3 70B' },
      { id: 'qwen-3-32b', name: 'Qwen 3 32B' }
    ]
  }

  /**
   * Send a chat message (non-streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {Promise<{content: string, usage?: Object}>} Response
   */
  async send(messages) {
    const model = this.getModelId()
    const config = this.getConfig()
    const { apiKey, apiKeys, baseUrl = this.defaultBaseUrl } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      throw new Error('Cerebras API key is required')
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage = parseOpenAIUsage(data)
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      throw new Error('No response from model')
    }

    return { content, usage }
  }

  /**
   * Send a chat message (streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {AsyncIterable<string>} Streaming response chunks
   */
  async *sendStream(messages) {
    const model = this.getModelId()
    const config = this.getConfig()
    const { apiKey, apiKeys, baseUrl = this.defaultBaseUrl } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      throw new Error('Cerebras API key is required')
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${keyToUse}`
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        stream: true
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          const trimmedLine = line.trim()
          if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue

          if (trimmedLine.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmedLine.slice(6))

              if (data.error) {
                throw new Error(data.error.message || `API Error: ${data.error.code || 'Unknown'}`)
              }

              const content = data.choices?.[0]?.delta?.content
              if (content) {
                yield content
              }
            } catch (e) {
              if (e.message?.includes('API Error')) {
                throw e
              }
            }
          }
        }
      }
    } finally {
      try {
        await reader.cancel()
      } catch {
        // Ignore
      }
    }
  }

}

// Export singleton instance for backward compatibility
const cerebrasProvider = new CerebrasProvider()

export default cerebrasProvider
