/**
 * Google AI Studio Provider (Gemini)
 * Supports multiple API keys with round-robin load balancing
 */

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
 */
const processGeminiSSEStream = async (reader, onChunk, signal = null) => {
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

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
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text
            if (text) {
              fullContent += text
              onChunk(text)
            }
          } catch (e) {
            // Skip parse errors
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

  return fullContent
}

/**
 * @type {import('../types.js').LLMProvider}
 */
export const googleProvider = {
  id: 'google',
  name: 'Google AI Studio',
  requiresApiKey: true,
  defaultBaseUrl: DEFAULT_BASE_URL,

  async fetchModels(config = {}) {
    const { apiKey, apiKeys, baseUrl = DEFAULT_BASE_URL } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      throw new Error('Google AI API key is required')
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
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `HTTP ${response.status}`)
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
      console.error('Failed to fetch Google models:', error.message)
      throw new Error(error.message || 'Failed to fetch models from Google API')
    }
  },

  async sendMessage(model, messages, onChunk = null, signal = null, config = {}) {
    const { apiKey, apiKeys, baseUrl = DEFAULT_BASE_URL } = config
    const keyToUse = getNextApiKey(apiKeys || apiKey)

    if (!keyToUse) {
      throw new Error('Google AI API key is required')
    }

    const { contents, systemInstruction } = convertMessages(messages)

    try {
      if (!onChunk) {
        // Non-streaming
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
            }),
            signal
          }
        )

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }

        const data = await response.json()
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text
        if (!text) {
          throw new Error('No response from model')
        }
        return text
      }

      // Streaming
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
          }),
          signal
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      return await processGeminiSSEStream(reader, onChunk, signal)
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      throw new Error(error.message || 'Failed to get chat response')
    }
  },

  async testConnection(config = {}) {
    try {
      const models = await this.fetchModels(config)
      return models.length > 0
    } catch {
      return false
    }
  }
}

export default googleProvider
