/**
 * Cerebras Provider
 * OpenAI-compatible API with extremely fast inference
 */

const DEFAULT_BASE_URL = 'https://api.cerebras.ai/v1'

/**
 * Process SSE stream from OpenAI-compatible API
 */
const processSSEStream = async (reader, onChunk, signal = null) => {
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
            const content = data.choices?.[0]?.delta?.content
            if (content) {
              fullContent += content
              onChunk(content)
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
export const cerebrasProvider = {
  id: 'cerebras',
  name: 'Cerebras',
  requiresApiKey: true,
  defaultBaseUrl: DEFAULT_BASE_URL,

  async fetchModels(config = {}) {
    const { apiKey } = config

    if (!apiKey) {
      throw new Error('Cerebras API key is required')
    }

    // Only use gpt-oss-120b model
    return [
      { id: 'gpt-oss-120b', name: 'GPT-OSS 120B' }
    ]
  },

  async sendMessage(model, messages, onChunk = null, signal = null, config = {}) {
    const { apiKey, baseUrl = DEFAULT_BASE_URL } = config

    if (!apiKey) {
      throw new Error('Cerebras API key is required')
    }

    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }

    try {
      if (!onChunk) {
        // Non-streaming
        const response = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model,
            messages,
            temperature: 0.7
          }),
          signal
        })

        if (!response.ok) {
          const error = await response.json().catch(() => ({}))
          throw new Error(error.error?.message || `HTTP ${response.status}`)
        }

        const data = await response.json()
        const content = data.choices?.[0]?.message?.content
        if (!content) {
          throw new Error('No response from model')
        }
        return content
      }

      // Streaming
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          stream: true
        }),
        signal
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.error?.message || `HTTP ${response.status}`)
      }

      const reader = response.body.getReader()
      return await processSSEStream(reader, onChunk, signal)
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      throw new Error(error.message || 'Failed to get chat response')
    }
  },

  async testConnection(config = {}) {
    const { apiKey, baseUrl = DEFAULT_BASE_URL } = config

    if (!apiKey) {
      return false
    }

    try {
      const response = await fetch(`${baseUrl}/models`, {
        headers: { 'Authorization': `Bearer ${apiKey}` }
      })
      return response.ok
    } catch {
      return false
    }
  }
}

export default cerebrasProvider
