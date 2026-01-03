/**
 * Code API Provider (Reasoning AI)
 *
 * This provider wraps the Code API for use in chat-style conversations.
 * The Code API is designed for code generation with reasoning/thinking capabilities.
 * Category: 'reasoning' (code & reasoning)
 */
import { generateCode } from '../../codeApi.js'
import { Settings } from '../../Settings.js'
import { Provider } from '../Provider.js'

/**
 * Code API Provider class
 */
export class CodeApiProvider extends Provider {
  constructor() {
    super('codeapi', 'Code API', 'reasoning', {
      requiresApiKey: false,
      supportsStreaming: true
    })
  }

  /**
   * Get default model for Code API
   * @returns {string} Default model ID
   */
  getDefaultModel() {
    return 'codeapi-model'
  }

  /**
   * List available models
   * @returns {Promise<Array<{id: string, name: string}>>} Available models
   */
  async listModels() {
    return [
      { id: 'codeapi-model', name: 'Reasoning AI' }
    ]
  }

  /**
   * Send a chat message (non-streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {Promise<{content: string}>} Response
   */
  async send(messages) {
    // Get the last user message
    const lastMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastMessage) {
      throw new Error('No user message found')
    }

    const prompt = lastMessage.content

    // Get codeApiUrl from Settings
    const settings = Settings.getAll()
    const config = this.getConfig()
    const codeApiUrl = config.codeApiUrl || settings.codeApiUrl || ''

    const result = await generateCode({
      initial_code: '',
      edit_prompt: prompt,
      output_path: 'chat.txt',
      onStdoutChunk: () => {}, // Non-streaming, ignore chunks
      codeApiUrl
    })

    return {
      content: result.stdout || result.code || 'Done'
    }
  }

  /**
   * Send a chat message (streaming)
   * @param {Array<{role: string, content: string}>} messages - Chat messages
   * @returns {AsyncIterable<string>} Streaming response chunks
   */
  async *sendStream(messages) {
    // Get the last user message
    const lastMessage = messages.filter(m => m.role === 'user').pop()
    if (!lastMessage) {
      throw new Error('No user message found')
    }

    const prompt = lastMessage.content

    // Get codeApiUrl from Settings
    const settings = Settings.getAll()
    const config = this.getConfig()
    const codeApiUrl = config.codeApiUrl || settings.codeApiUrl || ''

    // Collect chunks from the generateCode function
    const chunks = []
    const onChunk = (chunk) => {
      chunks.push(chunk)
    }

    const result = await generateCode({
      initial_code: '',
      edit_prompt: prompt,
      output_path: 'chat.txt',
      onStdoutChunk: onChunk,
      codeApiUrl
    })

    // Yield all collected chunks
    for (const chunk of chunks) {
      yield chunk
    }

    // If no chunks were streamed, yield the final result
    if (chunks.length === 0) {
      yield result.stdout || result.code || 'Done'
    }
  }

}

// Export singleton instance for backward compatibility
const codeApiProvider = new CodeApiProvider()

export default codeApiProvider
