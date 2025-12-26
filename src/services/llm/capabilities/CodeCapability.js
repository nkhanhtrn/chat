/**
 * CodeCapability - Handles JavaScript code generation and execution
 *
 * This capability:
 * 1. Generates JavaScript code based on user request
 * 2. Executes the code in a sandboxed environment
 * 3. Supports retry on execution failure
 */

import { BaseCapability } from './BaseCapability.js'

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
      name: 'CODE',
      description: 'mechanical/deterministic operations',
      conditions: [
        'Math calculations, data transformations, parsing, formatting',
        'String manipulation (reverse, encode, split, etc.)',
        'Array/object operations (sort, filter, extract, count)',
        'Data extraction from structured formats (JSON, CSV)',
        'QR codes, barcodes, hashing, encryption, image processing'
      ],
      antiConditions: [
        'Translation, summarization, rewriting, paraphrasing',
        'Explanations, creative writing, answering questions',
        'Analysis requiring judgment or interpretation'
      ],
      outputSchema: {
        codeType: 'function|expression',
        functionName: 'string'
      },
      examples: [
        {
          input: 'convert hello to ASCII',
          output: {
            taskDescription: 'Convert text to ASCII codes',
            inputs: [{ name: 'text', value: 'hello', type: 'string' }],
            expectedOutput: 'Array of ASCII codes',
            codeType: 'function',
            functionName: 'textToAscii'
          }
        },
        {
          input: 'what is 25 * 4 + 10?',
          output: {
            taskDescription: 'Calculate',
            inputs: [],
            expectedOutput: 'Number',
            codeType: 'expression',
            functionName: 'calculate'
          }
        }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'code' ||
           analysis.canBeCode === true ||
           analysis.codeType === 'function' ||
           analysis.codeType === 'expression'
  }

  getSystemPrompt() {
    return EXECUTOR_SYSTEM_PROMPT
  }

  buildExecutorPrompt(context) {
    const { analysis, userMessage } = context
    return `Task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Result'}
Code type: ${analysis.codeType || 'expression'}
Function name: ${analysis.functionName || 'process'}

Original request: "${userMessage}"

Write the JavaScript code now:`
  }

  async execute(context) {
    const {
      analysis,
      fullContext,
      models,
      config,
      provider,
      signal,
      callbacks = {}
    } = context

    const {
      onCodeGenerated,
      onExecutionComplete,
      onVerifyAttempt,
      verifyMode = false,
      maxRetries = 3
    } = callbacks

    // Generate code
    let code = await this._generateCode(analysis, fullContext, models.executorId, provider, config, signal)
    let cleanedCode = this.cleanOutput(code)
    let execution = this._executeCode(cleanedCode)
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
          signal
        )

        cleanedCode = this.cleanOutput(code)
        execution = this._executeCode(cleanedCode)
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

  async _generateCode(analysis, userMessage, executorModelId, provider, config, signal) {
    const messages = [
      { role: 'system', content: this.getSystemPrompt() },
      { role: 'user', content: this.buildExecutorPrompt({ analysis, userMessage }) }
    ]

    return provider.sendMessage(
      executorModelId,
      messages,
      null,
      signal,
      config
    )
  }

  async _regenerateWithError(analysis, userMessage, previousCode, errorMessage, executorModelId, provider, config, signal) {
    const fixPrompt = `Original task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs || [])}
Expected output: ${analysis.expectedOutput || 'Result'}

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
   */
  _executeCode(code) {
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

      const executableCode = `
        "use strict";
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
