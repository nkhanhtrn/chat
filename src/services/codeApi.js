/**
 * Reasoning AI Service
 *
 * Handles requests to external reasoning AI API.
 * Used for generating new code from Studio or editing existing code.
 */

import { loadUserSettings } from './firestore.js'

// Store reference to native fetch before it gets overridden by toolFetch
const nativeFetch = window.fetch.bind(window)

/**
 * Get the configured Reasoning AI URL from settings
 * @returns {Promise<string|null>} The Reasoning AI URL or null if not configured
 */
async function getReasoningAiUrl() {
  const settings = await loadUserSettings()
  return settings?.codeApiUrl?.trim() || null
}

/**
 * Check if Reasoning AI is configured
 * @returns {Promise<boolean>} True if Reasoning AI URL is configured
 */
async function isReasoningAiConfigured() {
  const url = await getReasoningAiUrl()
  const configured = url !== null && url !== ''
  console.log('[Reasoning AI] isConfigured:', configured, 'url:', url)
  return configured
}

/**
 * Process streaming response from Reasoning AI
 * Handles SSE events: stdout, done, error
 * @param {ReadableStream} body - Response body stream
 * @param {Function} onStdoutChunk - Callback for stdout chunks
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<Object>} Final parsed JSON response from 'done' event
 */
async function processReasoningStream(body, onStdoutChunk, signal = null) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  let currentEvent = null
  let finalResult = null

  try {
    while (true) {
      if (signal?.aborted) {
        reader.cancel()
        throw new Error('Aborted')
      }

      const { done, value } = await reader.read()

      if (done) break

      buffer += decoder.decode(value, { stream: true })

      // Process lines in buffer
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.trim()) continue

        // Handle SSE event lines
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim()
        } else if (line.startsWith('data: ')) {
          const data = line.slice(6).trim()

          try {
            const parsed = JSON.parse(data)

            switch (currentEvent) {
              case 'stdout':
                // stdout event: {text: "output chunk"}
                if (parsed.text !== undefined && onStdoutChunk) {
                  onStdoutChunk(parsed.text)
                }
                break

              case 'done':
                // done event: Final result with code, file_modified, etc.
                console.log('[Reasoning AI] Received done event:', parsed)
                finalResult = parsed
                break

              case 'error':
                // error event: {error: "message"}
                throw new Error(parsed.error || 'Unknown error from Reasoning AI')

              default:
                // Unknown event with text field, treat as stdout
                if (parsed.text !== undefined && onStdoutChunk) {
                  onStdoutChunk(parsed.text)
                }
            }
          } catch (e) {
            // JSON parse failed - might be raw text
            console.warn('[Reasoning AI] Failed to parse SSE data:', data, 'error:', e.message)
            if (currentEvent === 'stdout' && onStdoutChunk) {
              onStdoutChunk(data)
            }
          }

          // Reset event after processing data
          currentEvent = null
        }
      }
    }

    if (!finalResult) {
      console.error('[Reasoning AI] No done event received, buffer:', buffer)
      throw new Error('Reasoning AI did not return a complete response (missing done event)')
    }

    return finalResult
  } finally {
    reader.releaseLock()
  }
}

/**
 * Send a code generation request to the Reasoning AI
 * @param {Object} options - Request options
 * @param {string} options.initial_code - The initial code to write to the file
 * @param {string} options.edit_prompt - The prompt for editing the file
 * @param {string} options.output_path - File path where the code should be written
 * @param {Function} options.onStdoutChunk - Callback for streaming stdout chunks
 * @param {AbortSignal} options.signal - Abort signal
 * @returns {Promise<Object>} The response from the Reasoning AI
 */
async function generateCode({ initial_code, edit_prompt, output_path, onStdoutChunk, signal }) {
  const apiUrl = await getReasoningAiUrl()

  if (!apiUrl) {
    throw new Error('Reasoning AI is not configured')
  }

  const requestBody = {
    initial_code,
    edit_prompt: edit_prompt,
    output_path
  }

  console.log('[Reasoning AI] Sending request to:', apiUrl)
  console.log('[Reasoning AI] Request body:', { ...requestBody, initial_code: `${requestBody.initial_code?.substring(0, 100)}...` })
  console.log('[Reasoning AI] Request body size:', JSON.stringify(requestBody).length, 'bytes')

  try {
    const response = await nativeFetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody),
      signal
    })

    console.log('[Reasoning AI] Response status:', response.status, response.statusText)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Reasoning AI] Error response:', errorText)
      throw new Error(`Reasoning AI request failed: ${response.status} ${response.statusText} - ${errorText}`)
    }

    // Reasoning AI now always returns SSE streaming, so always process as stream
    console.log('[Reasoning AI] Processing streaming response')
    const data = await processReasoningStream(response.body, onStdoutChunk, signal)

    // Validate response format
    if (typeof data.code !== 'string') {
      throw new Error('Invalid Reasoning AI response: missing "code" field')
    }

    console.log('[Reasoning AI] Response received, code length:', data.code.length)

    return {
      code: data.code,
      output_path: data.output_path || output_path,
      success: data.success ?? true,
      file_modified: data.file_modified ?? true,
      stdout: data.stdout || '',
      stderr: data.stderr || ''
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log('[Reasoning AI] Request aborted')
      throw error
    }
    console.error('[Reasoning AI] Request failed:', error)
    console.error('[Reasoning AI] Error name:', error.name)
    console.error('[Reasoning AI] Error message:', error.message)
    throw error
  }
}

// Legacy exports for backward compatibility
export {
  getReasoningAiUrl as getCodeApiUrl,
  generateCode
}

export default {
  getCodeApiUrl: getReasoningAiUrl,
  generateCode
}
