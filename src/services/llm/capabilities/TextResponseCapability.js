/**
 * TextResponseCapability - Handles natural language responses
 *
 * This is the fallback capability for tasks that require:
 * - Translation, summarization, rewriting
 * - Explanations, creative writing
 * - General Q&A and conversation
 * - Tasks requiring judgment or interpretation
 */

import { BaseCapability } from './BaseCapability.js'
import { lmstudioProvider } from '../providers/lmstudio.js'

// Get current date for the system prompt
const getCurrentDateString = () => {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

export class TextResponseCapability extends BaseCapability {
  name = 'text'
  priority = 0  // Lowest priority - this is the fallback

  getRouterDescription() {
    return {
      name: 'TEXT/LANGUAGE',
      description: 'require understanding, generation, or judgment',
      conditions: [
        'Translation, summarization, rewriting, paraphrasing',
        'Explanations, creative writing, answering questions',
        'Analysis requiring judgment or interpretation',
        'General conversation and Q&A',
        'Opinions or subjective discussions'
      ],
      antiConditions: [],  // This is the fallback, accepts anything
      outputSchema: {},
      examples: [
        {
          input: 'translate this to French: Hello world',
          output: {
            taskDescription: 'Translate text to French',
            inputs: [{ name: 'text', value: 'Hello world', type: 'string' }],
            expectedOutput: 'Translated text'
          }
        },
        {
          input: 'explain how photosynthesis works',
          output: {
            taskDescription: 'Explain photosynthesis',
            inputs: [],
            expectedOutput: 'Educational explanation'
          }
        },
        {
          input: 'summarize this article',
          output: {
            taskDescription: 'Summarize content',
            inputs: [],
            expectedOutput: 'Summary text'
          }
        }
      ]
    }
  }

  canHandle(analysis) {
    // This is the fallback - always returns true
    // But check for explicit routing first
    return analysis.capability === 'text' ||
           analysis.canBeCode === false ||
           analysis.codeType === 'none' ||
           // Fallback: if no other capability matched
           (!analysis.canBeCode && !analysis.isVisualization)
  }

  getSystemPrompt(context) {
    const { webSearchResults = [] } = context

    // Use specialized prompt when web search results are included
    if (webSearchResults.length > 0) {
      return `You are a research assistant that summarizes web search results. The user asked a question and I searched the web for answers. The search results are included after the user's question.

IMPORTANT INSTRUCTIONS:
- Summarize the key information from the web sources that answers the user's question
- Be concise - aim for 2-4 paragraphs maximum
- Start with the most important/direct answer
- Mention which source each piece of information comes from (e.g., "According to Source 1...")
- If sources disagree, note the different perspectives
- Use bullet points for lists of items
- Do NOT just repeat the raw content - synthesize and summarize it
- If the sources don't answer the question well, say so briefly

Today's date is ${getCurrentDateString()}.`
    }

    // Default conversational prompt
    return `You are a helpful assistant. Today's date is ${getCurrentDateString()}.

Respond naturally and helpfully to the user's request. Be concise but thorough.`
  }

  async execute(context) {
    const {
      fullContext,
      messages,
      models,
      config,
      signal,
      onChunk,
      webSearchResults = []
    } = context

    // Build messages with context
    const messagesWithContext = []

    // Add system prompt
    messagesWithContext.push({
      role: 'system',
      content: this.getSystemPrompt({ webSearchResults })
    })

    // Add conversation history, replacing last user message with full context
    messages.forEach((m, i) => {
      if (m.role === 'user' && i === messages.length - 1) {
        messagesWithContext.push({ ...m, content: fullContext })
      } else {
        messagesWithContext.push(m)
      }
    })

    const response = await lmstudioProvider.sendMessage(
      models.executorId,
      messagesWithContext,
      onChunk,
      signal,
      config
    )

    return {
      success: true,
      result: response,
      error: null,
      metadata: {
        hasWebSearch: webSearchResults.length > 0,
        sourceCount: webSearchResults.length
      }
    }
  }

  formatOutput(result, metadata = {}) {
    return {
      type: 'text',
      content: result,
      displayHint: metadata.hasWebSearch ? 'research' : 'plain',
      metadata
    }
  }
}

export default TextResponseCapability
