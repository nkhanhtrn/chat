/**
 * LM Studio Provider
 * OpenAI-compatible local LLM server
 * Category: 'free' (local, no API key required)
 */
import axios from 'axios'
import { parseOpenAIUsage } from '../../../utils/tokenUsage.js'
import { Provider } from '../Provider.js'

const DEFAULT_BASE_URL = 'http://localhost:1234'

/**
 * LM Studio Provider class
 */
export class LMStudioProvider extends Provider {
  constructor() {
    super('lmstudio', 'LM Studio', 'free', {
      requiresApiKey: false,
      supportsStreaming: true
    })
    this.defaultBaseUrl = DEFAULT_BASE_URL
  }

  /**
   * Get default model for LM Studio
   * @returns {string} Default model ID
   */
  getDefaultModel() {
    return 'local-model'
  }

  /**
   * List available models
   * @returns {Promise<Array<{id: string, name: string}>>} Available models
   */
  async listModels() {
    const config = this.getConfig()
    const baseUrl = config.baseUrl || this.defaultBaseUrl
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
  }

  /**
   * Send a chat message (non-streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {Promise<{content: string, usage?: Object}>} Response
   */
  async send(messages) {
    const model = this.getModelId()
    const config = this.getConfig()
    const baseUrl = config.baseUrl || this.defaultBaseUrl

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

    const usage = parseOpenAIUsage(response.data)

    if (response.data.choices && response.data.choices.length > 0) {
      return { content: response.data.choices[0].message.content, usage }
    }
    throw new Error('No response from model')
  }

  /**
   * Send a chat message (streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {AsyncIterable<string>} Streaming response chunks
   */
  async *sendStream(messages) {
    const model = this.getModelId()
    const config = this.getConfig()
    const baseUrl = config.baseUrl || this.defaultBaseUrl

    const response = await fetch(`${baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.7,
        max_tokens: -1,
        stream: true
      })
    })

    if (!response.ok) {
      throw new Error('Failed to get chat response')
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

              if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
                yield data.choices[0].delta.content
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
const lmstudioProvider = new LMStudioProvider()

export default lmstudioProvider
