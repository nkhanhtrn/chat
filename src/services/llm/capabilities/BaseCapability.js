/**
 * BaseCapability - Abstract base class for all capabilities
 *
 * Each capability represents a high-level task type that the system can handle
 * (e.g., code execution, visualization, text response).
 *
 * Capabilities follow a Unix pipe-like pattern:
 * - Input: receiveInput() - receives and transforms piped data from previous capability
 * - Processing: process() - performs the main work
 * - Output: produceOutput() - formats result for next capability or final display
 *
 * To add a new capability:
 * 1. Extend this class
 * 2. Implement all required methods
 * 3. Register it in capabilities/index.js
 */

/**
 * Standard pipe data format for passing data between capabilities
 *
 * Data is passed RAW without serialization - LLMs handle raw data well.
 * This avoids JSON brittleness (circular refs, type loss, large data).
 *
 * @typedef {Object} PipeData
 * @property {any} data - The raw data payload (passed as-is, not serialized)
 * @property {string} source - Source capability name
 */

/**
 * Create a standard PipeData object
 * @param {any} data - The raw data payload
 * @param {string} source - Source capability name
 * @returns {PipeData}
 */
export const createPipeData = (data, source) => ({
  data,
  source
})

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

  // ===========================================================================
  // PIPE INTERFACE: Input → Process → Output
  // ===========================================================================

  /**
   * PIPE INPUT: Receive raw data from previous capability
   * Override this to customize how piped data is prepared for processing
   *
   * @param {PipeData|null} pipeInput - Input from previous capability, null if first in chain
   * @param {Object} context - Execution context
   * @returns {Object} Input ready for processing
   */
  receiveInput(pipeInput, context) {
    return {
      data: pipeInput?.data ?? null,
      source: pipeInput?.source ?? null,
      context
    }
  }

  /**
   * PIPE PROCESS: Main processing logic
   * This is the core of the capability - transforms input to output
   *
   * @param {Object} input - Input from receiveInput()
   * @returns {Promise<{success: boolean, result: any, error: string|null, metadata: Object}>}
   */
  async process(input) {
    throw new Error('process() must be implemented')
  }

  /**
   * PIPE OUTPUT: Package result for next capability
   * Creates PipeData with raw result data
   *
   * @param {Object} processResult - Result from process()
   * @returns {PipeData}
   */
  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  /**
   * Determine if this capability should chain to another capability
   * Override this to enable automatic chaining
   *
   * @param {Object} processResult - Result from process()
   * @param {Object} context - Execution context
   * @returns {string|null} - Name of next capability to chain to, or null
   */
  getChainTo(processResult, context) {
    return null  // No chaining by default
  }

  /**
   * Execute the full pipe: Input → Process → Output
   * This is the main entry point for capability execution
   *
   * @param {Object} context - Execution context
   * @param {PipeData|null} pipeInput - Input from previous capability
   * @returns {Promise<{success: boolean, result: any, error: string|null, metadata: Object, pipe: PipeData, chainTo: string|null}>}
   */
  async execute(context, pipeInput = null) {
    const input = this.receiveInput(pipeInput, context)
    const processResult = await this.process(input)
    const pipeOutput = this.produceOutput(processResult)
    const chainTo = this.getChainTo(processResult, context)

    return {
      ...processResult,
      pipe: pipeOutput,
      chainTo
    }
  }

  // ===========================================================================
  // LEGACY METHODS (for backwards compatibility)
  // ===========================================================================

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
