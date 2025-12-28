/**
 * LM Studio Provider
 * OpenAI-compatible local LLM server
 */
import axios from 'axios'
import { parseOpenAIUsage } from '../../../utils/tokenUsage.js'

const DEFAULT_BASE_URL = 'http://localhost:1234'

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

            // Check for error response in stream
            if (data.error) {
              throw new Error(data.error.message || `API Error: ${data.error.code || 'Unknown'}`)
            }

            if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
              const chunk = data.choices[0].delta.content
              fullContent += chunk
              onChunk(chunk)
            }
            // Capture usage from final chunk (some providers include it)
            if (data.usage) {
              usage = parseOpenAIUsage(data)
            }
          } catch (e) {
            // Re-throw API errors, skip parse errors
            if (e.message?.includes('API Error') || e.message?.includes('Rate') || e.message?.includes('limit') || e.message?.includes('quota')) {
              throw e
            }
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

  return { content: fullContent, usage }
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
    const { onUsage } = config

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

        // Extract usage data
        const usage = parseOpenAIUsage(response.data)
        if (usage && onUsage) {
          onUsage(usage)
        }

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
      const result = await processSSEStream(reader, onChunk, signal)

      // Report usage if available
      if (result.usage && onUsage) {
        onUsage(result.usage)
      }

      return result.content
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
