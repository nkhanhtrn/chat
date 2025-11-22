import axios from 'axios'

// Configure your LM Studio API base URL
// Default LM Studio local server runs on http://localhost:1234
const API_BASE_URL = 'http://localhost:1234'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  }
})

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

/**
 * POST /v1/chat/completions - Send chat message
 */
export const sendChatMessage = async (messages, model) => {
  try {
    console.log('Sending chat request:', { model, messageCount: messages.length })
    
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
  } catch (error) {
    console.error('Error in chat completion:', error.message)
    if (error.code === 'ERR_NETWORK') {
      throw new Error('Cannot connect to LM Studio server')
    }
    throw new Error(error.response?.data?.error?.message || 'Failed to get chat response')
  }
}

/**
 * POST /v1/completions - Text completion
 */
export const sendCompletion = async (prompt, model) => {
  try {
    const response = await api.post('/v1/completions', {
      model: model,
      prompt: prompt,
      max_tokens: 100,
      temperature: 0.7
    })
    
    return response.data.choices[0].text
  } catch (error) {
    console.error('Error in completion:', error)
    throw new Error('Failed to get completion response')
  }
}

/**
 * POST /v1/embeddings - Generate embeddings
 */
export const generateEmbeddings = async (input, model) => {
  try {
    const response = await api.post('/v1/embeddings', {
      model: model,
      input: input
    })
    
    return response.data.data
  } catch (error) {
    console.error('Error generating embeddings:', error)
    throw new Error('Failed to generate embeddings')
  }
}

/**
 * POST /v1/responses - Custom response endpoint (if available in LM Studio)
 */
export const sendResponse = async (data, model) => {
  try {
    const response = await api.post('/v1/responses', {
      model: model,
      ...data
    })
    
    return response.data
  } catch (error) {
    console.error('Error in response:', error)
    throw new Error('Failed to get response')
  }
}

export default {
  fetchModels,
  sendChatMessage,
  sendCompletion,
  generateEmbeddings,
  sendResponse
}
