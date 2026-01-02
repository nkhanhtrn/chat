/**
 * Code API Provider (Reasoning AI)
 *
 * This provider wraps the Code API for use in chat-style conversations.
 * The Code API is designed for code generation with reasoning/thinking capabilities.
 */
import { generateCode, getReasoningAiUrl, isReasoningAiConfigured } from '../../codeApi.js'

/**
 * @type {import('../types.js').LLMProvider}
 */
export const codeApiProvider = {
  id: 'codeapi',
  name: 'Code API',
  requiresApiKey: false, // Uses codeApiUrl from settings instead

  async fetchModels(config = {}) {
    // Check if Code API is configured
    const configured = await isReasoningAiConfigured()
    if (!configured) {
      return []
    }

    // Return a single "model" for Code API
    return [
      { id: 'codeapi-model', name: 'Reasoning AI' }
    ]
  },

  async sendMessage(model, messages, onChunk = null, signal = null, config = {}) {
    // Get the last user message as the prompt
    const lastMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastMessage) {
      throw new Error('No user message found')
    }

    const prompt = lastMessage.content

    try {
      const result = await generateCode({
        initial_code: '',
        edit_prompt: prompt,
        output_path: 'chat.txt',
        onStdoutChunk: onChunk || (() => {}),
        signal
      })

      // Return the stdout (reasoning output) or code as the response
      return result.stdout || result.code || 'Done'
    } catch (error) {
      if (error.name === 'AbortError') {
        return null
      }
      throw error
    }
  },

  async testConnection(config = {}) {
    return await isReasoningAiConfigured()
  }
}

export default codeApiProvider
