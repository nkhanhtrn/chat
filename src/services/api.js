import axios from 'axios'

// Configure your Studio LM API base URL
// Default LM Studio local server runs on http://localhost:1234
// You can change this to point to your Studio LM API endpoint
let API_BASE_URL = 'http://localhost:1234'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

/**
 * Update the API base URL
 */
export const setApiBaseUrl = (url) => {
  API_BASE_URL = url
  api.defaults.baseURL = url
}

/**
 * GET /v1/models - Fetch available models
 */
export const fetchModels = async () => {
  try {
    const response = await api.get('/v1/models')
    console.log('Models API response:', response.data)
    
    // Handle different response formats
    if (response.data.data && Array.isArray(response.data.data)) {
      return response.data.data
    } else if (Array.isArray(response.data)) {
      return response.data
    } else {
      console.warn('Unexpected models response format:', response.data)
      return []
    }
  } catch (error) {
    console.error('Error fetching models:', error.message)
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to LM Studio. Make sure the server is running on http://localhost:1234')
    }
    throw new Error(error.response?.data?.error?.message || 'Failed to fetch models')
  }
}

// Store the current abort controller for cancelling requests
let currentAbortController = null

/**
 * Abort the current streaming request
 */
export const abortChatMessage = () => {
  if (currentAbortController) {
    console.log('Aborting current request')
    currentAbortController.abort()
    currentAbortController = null
  }
}

/**
 * POST /v1/chat/completions - Send chat message with streaming support
 * @param {Array} messages - Array of message objects
 * @param {string} model - Model name
 * @param {Function} onChunk - Optional callback for streaming chunks (chunk) => void
 * @returns {Promise<string>} - Complete response text (or empty if streaming)
 */
export const sendChatMessage = async (messages, model, onChunk = null) => {
  try {
    console.log('Sending chat request:', { model, messageCount: messages.length })
    
    // If no callback provided, use non-streaming mode
    if (!onChunk) {
      const response = await api.post('/v1/chat/completions', {
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: -1,
        stream: false
      })
      
      console.log('Chat response received')
      
      if (response.data.choices && response.data.choices.length > 0) {
        return response.data.choices[0].message.content
      } else {
        throw new Error('No response from model')
      }
    }
    
    // Streaming mode
    console.log('Using streaming mode with callback')
    
    // Create abort controller for this request
    currentAbortController = new AbortController()
    
    const response = await fetch(`${API_BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        messages: messages,
        temperature: 0.7,
        max_tokens: -1,
        stream: true
      }),
      signal: currentAbortController.signal
    })
    
    console.log('Fetch response received, status:', response.status)
    
    if (!response.ok) {
      throw new Error('Failed to get chat response')
    }
    
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let fullContent = ''
    
    console.log('Starting to read stream...')
    
    while (true) {
      const { done, value } = await reader.read()
      
      if (done) {
        console.log('Stream done')
        break
      }
      
      console.log('Received stream chunk, size:', value.length)
      
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || ''
      
      for (const line of lines) {
        const trimmedLine = line.trim()
        
        if (trimmedLine === '' || trimmedLine === 'data: [DONE]') {
          continue
        }
        
        if (trimmedLine.startsWith('data: ')) {
          try {
            const jsonStr = trimmedLine.slice(6) // Remove 'data: ' prefix
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
    
    console.log('Streaming complete')
    currentAbortController = null
    return fullContent
  } catch (error) {
    console.error('Error in chat completion:', error.message)
    
    // Clean up abort controller
    currentAbortController = null
    
    // Handle abort error
    if (error.name === 'AbortError') {
      console.log('Request was aborted by user')
      throw new Error('Request cancelled')
    }
    
    // If it's our own error message, rethrow it directly
    if (error.message === 'No response from model') {
      throw error
    }
    if (error.code === 'ERR_NETWORK' || error.name === 'TypeError') {
      throw new Error('Cannot connect to LM Studio server')
    }
    throw new Error(error.response?.data?.error?.message || 'Failed to get chat response')
  }
}

