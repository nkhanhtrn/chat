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

// Default dependencies for production use
const defaultDeps = {
  fetchFn: (...args) => fetch(...args),
  apiClient: api,
  getBaseUrl: () => API_BASE_URL
};

export const sendChatMessageFull = async (model, messages, deps = defaultDeps) => {
  const { apiClient } = deps;
  const response = await apiClient.post('/v1/chat/completions', {
    model: model,
    messages: messages,
    temperature: 0.7,
    max_tokens: -1,
    stream: false
  });
  if (response.data.choices && response.data.choices.length > 0) {
    return response.data.choices[0].message.content;
  } else {
    throw new Error('No response from model');
  }
};

export const processSSEStream = async (reader, onChunk) => {
  const decoder = new TextDecoder();
  let buffer = '';
  let fullContent = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine === '' || trimmedLine === 'data: [DONE]') continue;

      if (trimmedLine.startsWith('data: ')) {
        try {
          const jsonStr = trimmedLine.slice(6);
          const data = JSON.parse(jsonStr);
          if (data.choices && data.choices[0].delta && data.choices[0].delta.content) {
            const chunk = data.choices[0].delta.content;
            fullContent += chunk;
            onChunk(chunk);
          }
        } catch (e) {
          console.warn('Failed to parse SSE data:', trimmedLine, e);
        }
      }
    }
  }

  return fullContent;
};

export const sendChatMessageStreaming = async (model, messages, onChunk, deps = defaultDeps) => {
  const { fetchFn, getBaseUrl } = deps;

  const response = await fetchFn(`${getBaseUrl()}/v1/chat/completions`, {
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
    })
  });

  if (!response.ok) {
    throw new Error('Failed to get chat response');
  }

  const reader = response.body.getReader();
  return processSSEStream(reader, onChunk);
};

export const sendChatMessage = async (model, messages, onChunk = null, deps = defaultDeps) => {
  try {
    if (!onChunk) {
      return await sendChatMessageFull(model, messages, deps);
    }
    return await sendChatMessageStreaming(model, messages, onChunk, deps);
  } catch (error) {
    if (error.message === 'No response from model') throw error;
    if (error.code === 'ERR_NETWORK' || error.name === 'TypeError') throw new Error('Cannot connect to LM Studio server');
    throw new Error(error.response?.data?.error?.message || 'Failed to get chat response');
  }
};

