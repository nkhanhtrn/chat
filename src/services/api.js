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

export const getQuestionSummary = async (question, model) => {
  const summaryPrompt = `Summarize the following in 2-5 words, no formatting, no punctuation, just the words:\n${question}`;
  const messages = [
    { role: 'user', content: summaryPrompt }
  ];
  try {
    const response = await api.post('/v1/chat/completions', {
      model: model,
      messages: messages,
      temperature: 0.7,
      max_tokens: 100,
      stream: false
    });
    if (response.data.choices && response.data.choices.length > 0) {
      return response.data.choices[0].message.content.trim();
    } else {
      throw new Error('No summary response from model');
    }
  } catch (error) {
    throw new Error(error.response?.data?.error?.message || 'Failed to get summary');
  }
};

export const sendChatMessage = async (question, model, onChunk = null) => {
  // Only send the question and return the answer
  const messages = [
    { role: 'user', content: question }
  ];
  try {
    if (!onChunk) {
      const response = await api.post('/v1/chat/completions', {
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
    }

    // Streaming mode
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
      })
    });
    if (!response.ok) {
      throw new Error('Failed to get chat response');
    }
    const reader = response.body.getReader();
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
  } catch (error) {
    if (error.message === 'No response from model') throw error;
    if (error.code === 'ERR_NETWORK' || error.name === 'TypeError') throw new Error('Cannot connect to LM Studio server');
    throw new Error(error.response?.data?.error?.message || 'Failed to get chat response');
  }
};

