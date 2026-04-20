// Prompt generation for notebook Q&A
// TODO: Port full system prompt with learning guidelines from original

export function getMainPrompts(
  question: string,
  previousMessages: Array<Record<string, unknown>> = [],
  _contextQuestions: Array<Record<string, unknown>> = []
): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = []

  messages.push({
    role: 'system',
    content: `You are a knowledgeable study assistant. Help the student understand topics deeply.
Provide clear, well-structured answers with explanations, examples, and analogies.
Use markdown formatting for better readability.`
  })

  // Add conversation history from previous questions
  if (previousMessages.length > 0) {
    const history = previousMessages
      .map((m) => `Q: ${(m as Record<string, unknown>).question}`)
      .join('\n')
    messages.push({ role: 'system', content: `Previous questions in this notebook:\n${history}` })
  }

  messages.push({ role: 'user', content: question })

  return messages
}

export function getQuickExplainPrompts(text: string, _previousMessages: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  return [
    { role: 'system', content: 'You are a study assistant. Provide clear, concise explanations using markdown formatting.' },
    { role: 'user', content: text }
  ]
}

export function getDictionaryPrompts(word: string, _previousMessages: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  return [{ role: 'user', content: `Define the word: ${word}` }]
}

export function getSummaryPrompts(text: string, _previousMessages: Array<Record<string, unknown>> = []): Array<Record<string, unknown>> {
  return [
    { role: 'system', content: 'You are a study assistant. Summarize the given text concisely, capturing the key points. Use markdown formatting.' },
    { role: 'user', content: `Summarize the following text:\n\n${text}` }
  ]
}
