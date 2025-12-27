/**
 * CodeCapability - Handles JavaScript code generation and execution
 *
 * Pipe interface:
 * - Input: Accepts text, json, array, object, search-results from previous capabilities
 * - Process: Generates and executes JavaScript code
 * - Output: Produces 'code-result' type with execution result
 *
 * This capability:
 * 1. Generates JavaScript code based on user request
 * 2. Executes the code in a sandboxed environment
 * 3. Supports retry on execution failure
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'

const EXECUTOR_SYSTEM_PROMPT = `You are a JavaScript code generator. You receive instructions and write clean, executable JavaScript code.

CRITICAL RULES:
1. Write ONLY pure JavaScript code - no markdown, no explanations, no code blocks
2. The code must be immediately executable in a browser environment
3. Use modern ES6+ syntax
4. For functions: define and immediately call with the provided inputs
5. The last expression should be the result to display
6. Do NOT use console.log - just return/evaluate to the result
7. Handle edge cases gracefully
8. When inputs contain data from files/URLs, use that data directly in the code

OUTPUT FORMAT:
- Just the raw JavaScript code, nothing else
- No \`\`\`javascript blocks
- No comments unless essential for complex logic
- End with the expression that produces the final result

EXAMPLES:

Instructions: Convert text "hello" to ASCII codes
Code:
const textToAscii = (text) => [...text].map(c => c.charCodeAt(0));
textToAscii("hello")

Instructions: Calculate 25 * 4 + 10
Code:
25 * 4 + 10

Instructions: Reverse string "javascript"
Code:
const reverseString = (str) => [...str].reverse().join('');
reverseString("javascript")`

const CODE_FIX_SYSTEM_PROMPT = `You are a JavaScript code fixer. Your previous code had an error. Fix the code based on the error message.

CRITICAL RULES:
1. Write ONLY pure JavaScript code - no markdown, no explanations, no code blocks
2. The code must be immediately executable in a browser environment
3. Fix the specific error mentioned
4. The last expression should be the result to display
5. Do NOT use console.log - just return/evaluate to the result

OUTPUT FORMAT:
- Just the raw JavaScript code, nothing else
- No \`\`\`javascript blocks
- End with the expression that produces the final result`

export class CodeCapability extends BaseCapability {
  name = 'code'
  priority = 50

  getRouterDescription() {
    return {
      name: 'code',
      description: 'Runs JavaScript code to COMPUTE a numerical or data result. Use when the ANSWER requires calculation, even if phrased as a question.',
      conditions: [
        'Questions that need a computed/calculated answer',
        'Math, formulas, geometry, physics calculations',
        'Data transformations (sort, filter, convert, parse)',
        'String operations (reverse, encode/decode, split)',
        'Array or object processing'
      ],
      examples: [
        { input: 'What is 25 * 17 + 33?' },
        { input: 'What is the square root of the area of a 10cm circle?' },
        { input: 'Convert hello to ASCII codes' },
        { input: 'How many days between Jan 1 and Dec 31?' },
        { input: 'Sort these numbers: 5, 2, 8, 1, 9' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'code'
  }

  // ===========================================================================
  // PIPE INTERFACE
  // ===========================================================================

  /**
   * Receive raw data from previous capability
   */
  receiveInput(pipeInput, context) {
    return {
      data: pipeInput?.data ?? null,
      source: pipeInput?.source ?? null,
      context
    }
  }

  /**
   * Main processing: generate and execute code
   */
  async process(input) {
    const { data: pipedData, source: pipedSource, context } = input
    const {
      analysis,
      fullContext,
      models,
      config,
      provider,
      signal,
      previousResults = {},
      callbacks = {}
    } = context

    const {
      onCodeGenerated,
      onExecutionComplete,
      onVerifyAttempt,
      verifyMode = false,
      maxRetries = 3
    } = callbacks

    // Merge piped data into previousResults for backwards compatibility
    const mergedResults = { ...previousResults }
    if (pipedData !== null) {
      // Add piped data as a special 'pipe' key
      mergedResults.pipe = {
        capability: pipedSource || 'pipe',
        data: pipedData,
        success: true
      }
    }

    // Generate code with context including piped data
    let code = await this._generateCode(analysis, fullContext, models.executorId, provider, config, signal, mergedResults)
    let cleanedCode = this.cleanOutput(code)
    let execution = this._executeCode(cleanedCode, mergedResults)
    let attempts = 1

    // Verification mode: retry on failure
    if (verifyMode && !execution.success) {
      while (!execution.success && attempts < maxRetries) {
        if (signal?.aborted) break

        attempts++

        if (onVerifyAttempt) {
          onVerifyAttempt(attempts, execution.error)
        }

        code = await this._regenerateWithError(
          analysis,
          fullContext,
          cleanedCode,
          execution.error,
          models.executorId,
          provider,
          config,
          signal,
          mergedResults
        )

        cleanedCode = this.cleanOutput(code)
        execution = this._executeCode(cleanedCode, mergedResults)
      }
    }

    if (onCodeGenerated) {
      onCodeGenerated(cleanedCode)
    }

    if (onExecutionComplete) {
      onExecutionComplete(execution)
    }

    return {
      success: execution.success,
      result: execution.success ? execution.result : null,
      error: execution.error,
      metadata: {
        code: cleanedCode,
        attempts,
        executionDetails: execution
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
    // Use the pipe interface
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

  getSystemPrompt() {
    return EXECUTOR_SYSTEM_PROMPT
  }

  buildExecutorPrompt(context) {
    const { analysis, userMessage, previousResults = {} } = context

    let prompt = `Task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Result'}`

    // If there's data from previous steps, include it
    if (Object.keys(previousResults).length > 0) {
      prompt += `\n\nDATA FROM PREVIOUS STEPS (available as variables):`
      for (const [stepNum, stepData] of Object.entries(previousResults)) {
        // Handle both numbered steps and 'pipe' key
        const varName = stepNum === 'pipe' ? 'pipeData' : `step${stepNum}Data`
        prompt += `\n${varName} = ${JSON.stringify(stepData.data)}`
      }
      prompt += `\n\nUse these variables directly in your code.`
    }

    prompt += `\n\nOriginal request: "${userMessage}"

Write the JavaScript code now:`

    return prompt
  }

  async _generateCode(analysis, userMessage, executorModelId, provider, config, signal, previousResults = {}) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.buildExecutorPrompt({ analysis, userMessage, previousResults }) }
    ]

    return provider.sendMessage(
      executorModelId,
      messages,
      null,
      signal,
      config
    )
  }

  async _regenerateWithError(analysis, userMessage, previousCode, errorMessage, executorModelId, provider, config, signal, previousResults = {}) {
    let fixPrompt = `Original task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Result'}`

    // Include available data from previous steps
    if (Object.keys(previousResults).length > 0) {
      fixPrompt += `\n\nAvailable data from previous steps:`
      for (const [stepNum, stepData] of Object.entries(previousResults)) {
        // Handle both numbered steps and 'pipe' key
        const varName = stepNum === 'pipe' ? 'pipeData' : `step${stepNum}Data`
        fixPrompt += `\n${varName} = ${JSON.stringify(stepData.data)}`
      }
    }

    fixPrompt += `

Your previous code:
${previousCode}

Error when executing:
${errorMessage}

Fix the code to work correctly. Write only the corrected JavaScript code:`

    const messages = [
      { role: 'system', content: CODE_FIX_SYSTEM_PROMPT },
      { role: 'user', content: fixPrompt }
    ]

    return provider.sendMessage(
      executorModelId,
      messages,
      null,
      signal,
      config
    )
  }

  /**
   * Execute JavaScript code safely in a sandboxed environment
   * @param {string} code - The code to execute
   * @param {Object} previousResults - Data from previous steps to inject as variables
   */
  _executeCode(code, previousResults = {}) {
    try {
      const trimmedCode = code.trim()
      const lines = trimmedCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))

      if (lines.length === 0) {
        return { success: false, result: null, error: 'No code to execute' }
      }

      const declarations = []
      let finalExpression = ''

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]
        const isLastLine = i === lines.length - 1
        const isDeclaration = /^(const|let|var|function|class)\s/.test(line)

        if (isLastLine && !isDeclaration) {
          finalExpression = line.endsWith(';') ? line.slice(0, -1) : line
        } else {
          declarations.push(line.endsWith(';') ? line : line + ';')
        }
      }

      if (!finalExpression && declarations.length > 0) {
        const lastDecl = declarations.pop()
        finalExpression = lastDecl.endsWith(';') ? lastDecl.slice(0, -1) : lastDecl
      }

      // Inject previous step data as variables
      const injectedVars = []
      for (const [stepNum, stepData] of Object.entries(previousResults)) {
        // Handle both numbered steps and 'pipe' key
        const varName = stepNum === 'pipe' ? 'pipeData' : `step${stepNum}Data`
        injectedVars.push(`const ${varName} = ${JSON.stringify(stepData.data)};`)
      }

      const executableCode = `
        "use strict";
        ${injectedVars.join('\n')}
        ${declarations.join('\n')}
        return (${finalExpression});
      `

      const sandbox = new Function(executableCode)
      const result = sandbox()

      return { success: true, result, error: null }
    } catch (e) {
      return { success: false, result: null, error: e.message }
    }
  }

  formatOutput(result, metadata = {}) {
    let content
    if (result === undefined) content = 'undefined'
    else if (result === null) content = 'null'
    else if (typeof result === 'string') content = result
    else if (Array.isArray(result) || typeof result === 'object') {
      content = JSON.stringify(result, null, 2)
    } else {
      content = String(result)
    }

    return {
      type: 'code-result',
      content,
      displayHint: 'code',
      metadata: {
        code: metadata.code,
        attempts: metadata.attempts
      }
    }
  }

  cleanOutput(rawOutput) {
    let cleaned = rawOutput.trim()

    // Remove markdown code blocks
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '')
    }

    // Remove wrapping quotes
    if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
        (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
      cleaned = cleaned.slice(1, -1)
    }

    return cleaned.trim()
  }
}

export default CodeCapability
