/**
 * TextResponseCapability - Handles natural language responses
 *
 * Pipe interface:
 * - Input: Accepts any type - transforms to text context
 * - Process: Generates natural language response using LLM
 * - Output: Produces 'text' type
 *
 * This is the fallback capability for tasks that require:
 * - Translation, summarization, rewriting
 * - Explanations, creative writing
 * - General Q&A and conversation
 * - Tasks requiring judgment or interpretation
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

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

  // ===========================================================================
  // PIPE INTERFACE
  // ===========================================================================

  /**
   * Receive raw data from previous capability
   * Converts to text for inclusion in LLM context
   */
  receiveInput(pipeInput, context) {
    if (!pipeInput?.data) {
      return { data: null, context }
    }

    const data = pipeInput.data

    // Convert raw data to text for LLM context
    let pipedText = ''
    if (typeof data === 'string') {
      pipedText = data
    } else if (Array.isArray(data) && data[0]?.url && data[0]?.content) {
      // Looks like search results
      pipedText = data.map((r, i) =>
        `--- Source ${i + 1}: ${r.title || 'Untitled'} ---\nURL: ${r.url}\n\n${r.content}\n`
      ).join('\n')
    } else {
      // Let LLM handle raw data - just describe it
      pipedText = `Previous result from ${pipeInput.source || 'prior step'}:\n${String(data)}`
    }

    return { data, pipedText, context }
  }

  /**
   * Main processing: generate text response
   */
  async process(input) {
    const { pipedText, context } = input
    const {
      fullContext,
      messages,
      models,
      config,
      provider,
      signal,
      onChunk,
      webSearchResults = []
    } = context

    // Build full context including piped data
    let enhancedContext = fullContext
    if (pipedText) {
      enhancedContext = `${fullContext}\n\n${pipedText}`
    }

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
        messagesWithContext.push({ ...m, content: enhancedContext })
      } else {
        messagesWithContext.push(m)
      }
    })

    const response = await provider.sendMessage(
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
        sourceCount: webSearchResults.length,
        hasPipedInput: !!pipedText
      }
    }
  }

  /**
   * Produce output - just pass raw result
   */
  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  /**
   * Execute with pipe support
   */
  async execute(context, pipeInput = null) {
    const transformedInput = this.receiveInput(pipeInput, context)
    const processResult = await this.process(transformedInput)
    const pipeOutput = this.produceOutput(processResult)

    return {
      ...processResult,
      pipe: pipeOutput
    }
  }

  // ===========================================================================
  // LEGACY INTERFACE
  // ===========================================================================

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
