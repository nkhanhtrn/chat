/**
 * API Service - Re-exports from LLM provider system
 * This file maintains backwards compatibility with existing imports
 */
export {
  fetchModels,
  sendChatMessage,
  sendChatMessageForFeature,
  FeatureType,
  listProviders,
  getCurrentProviderId,
  getCurrentConfig,
  setProvider,
  updateConfig,
  testConnection,
  initProvider
} from './llm/index.js'

// Re-export for tests that need direct access to streaming functions
export { sendChatMessage as sendChatMessageFull } from './llm/index.js'
export { sendChatMessage as sendChatMessageStreaming } from './llm/index.js'

// Legacy exports for test compatibility
export const processSSEStream = async (reader, onChunk, signal = null) => {
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
      // Ignore
    }
  }

  return fullContent
}
