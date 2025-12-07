/**
 * LM Studio Provider
 * OpenAI-compatible local LLM server
 */
import axios from 'axios'

const DEFAULT_BASE_URL = 'http://localhost:1234'

/**
 * Process SSE stream from OpenAI-compatible API
 */
const processSSEStream = async (reader, onChunk, signal = null) => {
  const decoder = new TextDecoder()
  let buffer = ''
  let fullContent = ''

  try {
    while (true) {
      if (signal?.aborted) {
        break
      }

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
            const jsonStr = trimmedLine.slice(6)
            const data = JSON.parse(jsonStr)
            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              const chunk = data.choices[0].delta.content
              fullContent += chunk
              onChunk(chunk)
            }
          } catch (e) {
            console.warn('Failed to parse SSE data:', trimmedLine, e)
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
export const lmstudioProvider = {
  id: 'lmstudio',
  name: 'LM Studio',
  requiresApiKey: false,
  defaultBaseUrl: DEFAULT_BASE_URL,

  async fetchModels(config = {}) {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL
    const api = axios.create({
      baseURL: baseUrl,
      headers: { 'Content-Type': 'application/json' }
    })

    try {
      const response = await api.get('/v1/models')

      if (response.data.data && Array.isArray(response.data.data)) {
        return response.data.data.map(m => ({ id: m.id, name: m.id }))
      } else if (Array.isArray(response.data)) {
        return response.data.map(m => ({ id: m.id || m, name: m.id || m }))
      }
      return []
    } catch (error) {
      if (error.code === 'ERR_NETWORK') {
        throw new Error('Cannot connect to LM Studio. Make sure the server is running.')
      }
      throw new Error(error.response?.data?.error?.message || 'Failed to fetch models')
    }
  },

  async sendMessage(model, messages, onChunk = null, signal = null, config = {}) {
    const baseUrl = config.baseUrl || DEFAULT_BASE_URL

    try {
      if (!onChunk) {
        // Non-streaming
        const api = axios.create({
          baseURL: baseUrl,
          headers: { 'Content-Type': 'application/json' }
        })
        const response = await api.post('/v1/chat/completions', {
          model,
          messages,
          temperature: 0.7,
          max_tokens: -1,
          stream: false
        })
        if (response.data.choices && response.data.choices.length > 0) {
          return response.data.choices[0].message.content
        }
        throw new Error('No response from model')
      }

      // Streaming
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.7,
          max_tokens: -1,
          stream: true
        }),
        signal
      })

      if (!response.ok) {
        throw new Error('Failed to get chat response')
      }

      const reader = response.body.getReader()
      return await processSSEStream(reader, onChunk, signal)
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      if (error.code === 'ERR_NETWORK' || error.name === 'TypeError') {
        throw new Error('Cannot connect to LM Studio server')
      }
      throw new Error(error.response?.data?.error?.message || error.message || 'Failed to get chat response')
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

export default lmstudioProvider
