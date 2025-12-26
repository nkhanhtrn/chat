/**
 * BaseCapability - Abstract base class for all capabilities
 *
 * Each capability represents a high-level task type that the system can handle
 * (e.g., code execution, visualization, text response).
 *
 * To add a new capability:
 * 1. Extend this class
 * 2. Implement all required methods
 * 3. Register it in capabilities/index.js
 */
export class BaseCapability {
  /**
   * Unique identifier for this capability
   * @type {string}
   */
  name = ''

  /**
   * Priority for capability resolution (higher = checked first)
   * Use this when capabilities might overlap
   * @type {number}
   */
  priority = 0

  /**
   * Get the description for the router prompt
   * This tells the router LLM when to route to this capability
   *
   * @returns {{
   *   name: string,
   *   description: string,
   *   conditions: string[],
   *   antiConditions: string[],
   *   outputSchema: Object,
   *   examples: Array<{input: string, output: Object}>
   * }}
   */
  getRouterDescription() {
    throw new Error('getRouterDescription() must be implemented')
  }

  /**
   * Check if this capability can handle the given analysis result
   *
   * @param {Object} analysis - The parsed analysis from the router LLM
   * @returns {boolean}
   */
  canHandle(analysis) {
    throw new Error('canHandle() must be implemented')
  }

  /**
   * Get the system prompt for this capability's executor
   *
   * @param {Object} context - Execution context
   * @param {Object} context.analysis - Router analysis result
   * @param {string} context.userMessage - Original user message
   * @param {Array} context.attachments - Parsed attachments
   * @param {Array} context.webSearchResults - Web search results if any
   * @returns {string}
   */
  getSystemPrompt(context) {
    throw new Error('getSystemPrompt() must be implemented')
  }

  /**
   * Build the user prompt for the executor LLM
   *
   * @param {Object} context - Execution context
   * @returns {string}
   */
  buildExecutorPrompt(context) {
    const { analysis, userMessage } = context
    return `Task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Result'}

Original request: "${userMessage}"

Generate the output now:`
  }

  /**
   * Execute this capability
   *
   * @param {Object} context - Execution context
   * @param {Object} context.analysis - Router analysis result
   * @param {string} context.userMessage - Original user message
   * @param {string} context.fullContext - User message + attachments + web search
   * @param {Array} context.messages - Full conversation history
   * @param {Object} context.models - { routerId, executorId }
   * @param {Object} context.config - LM Studio config
   * @param {Function|null} context.onChunk - Streaming callback
   * @param {AbortSignal|null} context.signal - Abort signal
   * @param {Object} context.callbacks - Capability-specific callbacks
   * @returns {Promise<{
   *   success: boolean,
   *   result: any,
   *   error: string|null,
   *   metadata: Object
   * }>}
   */
  async execute(context) {
    throw new Error('execute() must be implemented')
  }

  /**
   * Format the execution result for display
   *
   * @param {any} result - The raw execution result
   * @param {Object} metadata - Additional metadata from execution
   * @returns {{
   *   type: string,
   *   content: any,
   *   displayHint: string
   * }}
   */
  formatOutput(result, metadata = {}) {
    return {
      type: 'text',
      content: String(result),
      displayHint: 'plain'
    }
  }

  /**
   * Clean/sanitize output from the LLM before processing
   * Override this for capability-specific cleaning
   *
   * @param {string} rawOutput - Raw LLM output
   * @returns {string}
   */
  cleanOutput(rawOutput) {
    let cleaned = rawOutput.trim()

    // Remove markdown code blocks if present
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-z]*\n?/, '').replace(/\n?```$/, '')
    }

    return cleaned.trim()
  }
}

export default BaseCapability
