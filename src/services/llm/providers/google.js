/**
 * Google AI Studio Provider (Gemini)
 * Supports multiple API keys with round-robin load balancing
 * Category: 'details' (detailed responses)
 */
import { parseGeminiUsage } from '../../../utils/tokenUsage.js'
import { Provider } from '../Provider.js'

const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta'

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
 * Convert OpenAI-style messages to Gemini format
 */
const convertMessages = (messages) => {
  // Gemini doesn't support system role in contents, extract it
  const systemMessage = messages.find(m => m.role === 'system')
  const chatMessages = messages.filter(m => m.role !== 'system')

  const contents = chatMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }))

  return {
    contents,
    systemInstruction: systemMessage ? { parts: [{ text: systemMessage.content }] } : undefined
  }
}

/**
 * Process Gemini SSE stream
 * @returns {{ content: string, usage: Object|null }}
 */
const processGeminiSSEStream = async (reader, onChunk, signal = null) => {
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

            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              fullContent += text
              onChunk(text)
            }
            // Capture usage metadata from chunks (Gemini includes it in streaming)
            if (data.usageMetadata) {
              usage = parseGeminiUsage(data)
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
 * Google AI Provider class
 */
export class GoogleProvider extends Provider {
  constructor() {
    super('google', 'Google AI Studio', 'details', {
      requiresApiKey: true,
      supportsStreaming: true
    })
    this.defaultBaseUrl = DEFAULT_BASE_URL
  }

  /**
   * Get default model for Google AI
   * @returns {string} Default model ID
   */
  getDefaultModel() {
    return 'models/gemini-2.5-flash'
  }

  /**
   * List available models
   * @returns {Promise<Array<{id: string, name: string}>>} Available models
   */
  async listModels() {
    const config = this.getConfig()
    const { apiKey, apiKeys, baseUrl = this.defaultBaseUrl } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      return []
    }

    try {
      const response = await fetch(
        `${baseUrl}/models?key=${keyToUse}`,
        {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' }
        }
      )

      if (!response.ok) {
        return []
      }

      const data = await response.json()

      // Filter for models that support content generation and map to expected format
      const models = (data.models || [])
        .filter(model =>
          model.supportedGenerationMethods?.includes('generateContent')
        )
        .map(model => ({
          id: model.name,
          name: model.displayName || model.name.replace('models/', '')
        }))

      return models
    } catch (error) {
      console.warn('Failed to fetch Google models:', error.message)
      return []
    }
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
      throw new Error('Google AI API key is required')
    }

    const { contents, systemInstruction } = convertMessages(messages)

    const response = await fetch(
      `${baseUrl}/${model}:generateContent?key=${keyToUse}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    )

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(error.error?.message || `HTTP ${response.status}`)
    }

    const data = await response.json()
    const usage = parseGeminiUsage(data)
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!text) {
      throw new Error('No response from model')
    }

    return { content: text, usage }
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
      throw new Error('Google AI API key is required')
    }

    const { contents, systemInstruction } = convertMessages(messages)

    const response = await fetch(
      `${baseUrl}/${model}:streamGenerateContent?alt=sse&key=${keyToUse}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents,
          systemInstruction,
          generationConfig: {
            temperature: 0.7
          }
        })
      }
    )

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

              const text = data.candidates?.[0]?.content?.parts?.[0]?.text
              if (text) {
                yield text
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
const googleProvider = new GoogleProvider()

export default googleProvider
