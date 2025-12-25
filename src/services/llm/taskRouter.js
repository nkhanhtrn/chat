/**
 * Task Router Service
 *
 * Two-model code generation pipeline:
 * 1. Parse attachments (files/URLs) first using attachment reader
 * 2. Mistral 3B analyzes user request + parsed content and generates instructions for code
 * 3. gpt-oss-20b writes JavaScript code based on those instructions
 * 4. Code is executed in a sandboxed environment in the browser
 *
 * Both models run via LM Studio (local)
 */

import { lmstudioProvider } from './providers/lmstudio.js'
import { getProviderConfig } from './index.js'
import {
  readAttachments,
  formatAttachmentsForPrompt
} from '../attachmentReader.js'

// Mistral 3B system prompt - analyzes request and creates code instructions
const ROUTER_SYSTEM_PROMPT = `You are a task analyzer. Determine if a request should be handled by code execution or direct language response.

CODE TASKS (canBeCode: true) - mechanical/deterministic operations:
- Math calculations, data transformations, parsing, formatting
- String manipulation (reverse, encode, split, etc.)
- Array/object operations (sort, filter, extract, count)
- Data extraction from structured formats (JSON, CSV)

LANGUAGE TASKS (canBeCode: false) - require understanding/generation:
- Translation (even with file content attached)
- Summarization, rewriting, paraphrasing
- Explanations, creative writing, answering questions
- Analysis requiring judgment or interpretation

IMPORTANT: The presence of attached content does NOT make it a code task. Focus on what the user is ASKING to do, not what data is attached.

Respond with JSON:
{"canBeCode": boolean, "taskDescription": "...", "inputs": [...], "expectedOutput": "...", "codeType": "function|expression|none", "functionName": "..."}

Examples:

User: "convert hello to ASCII"
{"canBeCode": true, "taskDescription": "Convert text to ASCII codes", "inputs": [{"name": "text", "value": "hello", "type": "string"}], "expectedOutput": "Array of ASCII codes", "codeType": "function", "functionName": "textToAscii"}

User: "what is 25 * 4 + 10?"
{"canBeCode": true, "taskDescription": "Calculate", "inputs": [], "expectedOutput": "Number", "codeType": "expression", "functionName": "calculate"}

User: "translate this to French\n\nHello world, this is a test."
{"canBeCode": false, "taskDescription": "Language task", "inputs": [], "expectedOutput": "Translated text", "codeType": "none", "functionName": ""}

User: "summarize this"
{"canBeCode": false, "taskDescription": "Language task", "inputs": [], "expectedOutput": "Summary", "codeType": "none", "functionName": ""}

Respond ONLY with JSON.`

// gpt-oss-20b system prompt - writes executable JavaScript code
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
reverseString("javascript")

Instructions: Count words in text "The quick brown fox"
Code:
const countWords = (text) => text.trim().split(/\s+/).filter(w => w.length > 0).length;
countWords("The quick brown fox")

Instructions: Parse JSON and extract names from [{"name": "Alice"}, {"name": "Bob"}]
Code:
const extractNames = (jsonStr) => JSON.parse(jsonStr).map(item => item.name);
extractNames('[{"name": "Alice"}, {"name": "Bob"}]')

Instructions: Generate 5 random numbers between 1 and 100
Code:
const generateRandom = (count, min, max) => Array.from({length: count}, () => Math.floor(Math.random() * (max - min + 1)) + min);
generateRandom(5, 1, 100)`

// System prompt for code fix/retry
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

/**
 * Find a model matching the given patterns from available models
 * @param {Array<{id: string, name: string}>} models
 * @param {string[]} patterns
 * @returns {{id: string, name: string}|null}
 */
const findModelByPattern = (models, patterns) => {
  for (const pattern of patterns) {
    const match = models.find(m =>
      m.id.toLowerCase().includes(pattern.toLowerCase()) ||
      m.name.toLowerCase().includes(pattern.toLowerCase())
    )
    if (match) return match
  }
  return null
}

/**
 * Parse Mistral's analysis response
 * @param {string} response
 * @returns {Object}
 */
const parseAnalysisResponse = (response) => {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('No JSON object found in response:', response.substring(0, 200))
    return createFallbackAnalysis(response)
  }

  let jsonStr = jsonMatch[0]

  // Try parsing as-is first
  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.warn('Initial JSON parse failed, attempting cleanup:', e.message)
  }

  // Clean up common JSON issues from LLMs
  try {
    // Remove trailing commas before } or ]
    jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1')

    // Replace single quotes with double quotes (careful with apostrophes in text)
    // Only replace quotes that look like JSON string delimiters
    jsonStr = jsonStr.replace(/'([^']*)'(\s*[,:\]}])/g, '"$1"$2')
    jsonStr = jsonStr.replace(/(\{|\[|,)\s*'([^']*)'/g, '$1"$2"')

    // Fix unquoted property names
    jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')

    // Remove any JavaScript comments
    jsonStr = jsonStr.replace(/\/\/[^\n]*/g, '')
    jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '')

    return JSON.parse(jsonStr)
  } catch (e) {
    console.warn('JSON cleanup parse failed:', e.message)
    console.warn('Problematic JSON:', jsonStr.substring(0, 500))
  }

  // Final fallback - try to extract key fields manually
  return createFallbackAnalysis(response)
}

/**
 * Create a fallback analysis by trying to extract info from text
 * @param {string} response
 * @returns {Object}
 */
const createFallbackAnalysis = (response) => {
  const lowerResponse = response.toLowerCase()

  // Detect if explicitly marked as non-code, or mentions language task indicators
  const isNonCode = lowerResponse.includes('"canbecode": false') ||
                    lowerResponse.includes('"canbecode":false') ||
                    lowerResponse.includes('language task')

  const canBeCode = !isNonCode

  // Try to extract task description
  let taskDescription = 'Process the user request'
  const taskMatch = response.match(/"taskDescription"\s*:\s*"([^"]+)"/i)
  if (taskMatch) {
    taskDescription = taskMatch[1]
  }

  // Try to extract function name
  let functionName = 'process'
  const funcMatch = response.match(/"functionName"\s*:\s*"([^"]+)"/i)
  if (funcMatch) {
    functionName = funcMatch[1]
  }

  return {
    canBeCode,
    taskDescription,
    inputs: [],
    expectedOutput: 'Result',
    codeType: 'expression',
    functionName
  }
}

/**
 * Execute JavaScript code safely in a sandboxed environment
 * Handles multi-line code: declarations followed by a final expression
 *
 * @param {string} code - JavaScript code to execute
 * @returns {{success: boolean, result: any, error: string|null}}
 */
export const executeCode = (code) => {
  try {
    const trimmedCode = code.trim()

    // Split into lines and find declarations vs final expression
    const lines = trimmedCode.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//'))

    if (lines.length === 0) {
      return { success: false, result: null, error: 'No code to execute' }
    }

    // Separate declarations from the final expression
    const declarations = []
    let finalExpression = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const isLastLine = i === lines.length - 1

      // Check if line is a declaration (const, let, var, function, class)
      const isDeclaration = /^(const|let|var|function|class)\s/.test(line)

      if (isLastLine && !isDeclaration) {
        // Last line is an expression - this is what we want to return
        finalExpression = line.endsWith(';') ? line.slice(0, -1) : line
      } else {
        // It's a declaration or not the last line
        declarations.push(line.endsWith(';') ? line : line + ';')
      }
    }

    // If no final expression found, the last declaration might be what we need
    // (e.g., single line: "5 + 3")
    if (!finalExpression && declarations.length > 0) {
      const lastDecl = declarations.pop()
      finalExpression = lastDecl.endsWith(';') ? lastDecl.slice(0, -1) : lastDecl
    }

    // Build executable code
    const executableCode = `
      "use strict";
      ${declarations.join('\n')}
      return (${finalExpression});
    `

    const sandbox = new Function(executableCode)
    const result = sandbox()

    return {
      success: true,
      result: result,
      error: null
    }
  } catch (e) {
    return { success: false, result: null, error: e.message }
  }
}

/**
 * Format execution result for display
 * @param {any} result
 * @returns {string}
 */
export const formatResult = (result) => {
  if (result === undefined) return 'undefined'
  if (result === null) return 'null'
  if (typeof result === 'string') return result
  if (Array.isArray(result)) return JSON.stringify(result, null, 2)
  if (typeof result === 'object') return JSON.stringify(result, null, 2)
  return String(result)
}

/**
 * Fetch all available models from LM Studio
 * @param {Object} config - LM Studio config
 * @returns {Promise<Array<{id: string, name: string}>>}
 */
export const fetchAvailableModels = async (config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')
  return lmstudioProvider.fetchModels(providerConfig)
}

/**
 * Find router and executor models from available models
 * @param {Array<{id: string, name: string}>} models
 * @returns {{router: {id: string, name: string}|null, executor: {id: string, name: string}|null}}
 */
export const findRouterAndExecutorModels = (models) => {
  // Patterns for router model (Mistral 3B)
  const routerPatterns = ['ministral', 'mistral-3b', 'mistral3b', 'mistral-3', 'mistral']

  // Patterns for executor model (gpt-oss-20b)
  const executorPatterns = ['gpt-oss-20b', 'gpt-oss', 'openai']

  const router = findModelByPattern(models, routerPatterns)
  const executor = findModelByPattern(models, executorPatterns)

  return { router, executor }
}

/**
 * Step 1: Analyze user request with Mistral 3B
 * @param {string} userMessage - The user's message
 * @param {string} routerModelId - The router model ID
 * @param {Object} config - LM Studio config
 * @returns {Promise<Object>} Analysis result
 */
export const analyzeRequest = async (userMessage, routerModelId, config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')

  const messages = [
    { role: 'system', content: ROUTER_SYSTEM_PROMPT },
    { role: 'user', content: userMessage }
  ]

  const response = await lmstudioProvider.sendMessage(
    routerModelId,
    messages,
    null,
    null,
    providerConfig
  )

  return parseAnalysisResponse(response)
}

/**
 * Step 2: Generate code with gpt-oss-20b based on Mistral's instructions
 * @param {Object} analysis - Analysis from Mistral
 * @param {string} originalRequest - Original user request
 * @param {string} executorModelId - The executor model ID
 * @param {Function|null} onChunk - Streaming callback
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} config - LM Studio config
 * @returns {Promise<string>} Generated code
 */
export const generateCode = async (analysis, originalRequest, executorModelId, onChunk = null, signal = null, config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')

  // Build the instruction prompt for the code generator
  const instructionPrompt = `Task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs)}
Expected output: ${analysis.expectedOutput}
Code type: ${analysis.codeType}
Function name: ${analysis.functionName}

Original request: "${originalRequest}"

Write the JavaScript code now:`

  const messages = [
    { role: 'system', content: EXECUTOR_SYSTEM_PROMPT },
    { role: 'user', content: instructionPrompt }
  ]

  return lmstudioProvider.sendMessage(
    executorModelId,
    messages,
    onChunk,
    signal,
    providerConfig
  )
}

/**
 * Regenerate code with error feedback
 * @param {Object} analysis - Original analysis
 * @param {string} originalRequest - Original user request
 * @param {string} previousCode - The code that failed
 * @param {string} errorMessage - The error from execution
 * @param {string} executorModelId - The executor model ID
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} config - LM Studio config
 * @returns {Promise<string>} New generated code
 */
export const regenerateCodeWithError = async (analysis, originalRequest, previousCode, errorMessage, executorModelId, signal = null, config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')

  const fixPrompt = `Original task: ${analysis.taskDescription}
Inputs: ${JSON.stringify(analysis.inputs)}
Expected output: ${analysis.expectedOutput}

Your previous code:
${previousCode}

Error when executing:
${errorMessage}

Fix the code to work correctly. Write only the corrected JavaScript code:`

  const messages = [
    { role: 'system', content: CODE_FIX_SYSTEM_PROMPT },
    { role: 'user', content: fixPrompt }
  ]

  return lmstudioProvider.sendMessage(
    executorModelId,
    messages,
    null,
    signal,
    providerConfig
  )
}

/**
 * Clean generated code (remove markdown, extra text)
 * @param {string} code
 * @returns {string}
 */
const cleanCode = (code) => {
  let cleaned = code.trim()

  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:javascript|js)?\n?/, '').replace(/\n?```$/, '')
  }

  // Remove any leading/trailing quotes
  if ((cleaned.startsWith('"') && cleaned.endsWith('"')) ||
      (cleaned.startsWith("'") && cleaned.endsWith("'"))) {
    cleaned = cleaned.slice(1, -1)
  }

  return cleaned.trim()
}

/**
 * Full pipeline: Parse Attachments → Analyze → Generate Code → Execute (with optional verification/retry)
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} models - { routerId: string, executorId: string }
 * @param {Function|null} onChunk - Streaming callback for final result only
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} options - Additional options
 * @param {Array} options.attachments - Raw attachments to parse (files/URLs)
 * @param {Function|null} options.onAttachmentsParsed - Callback when attachments are parsed
 * @param {Function|null} options.onAnalysis - Callback when analysis is complete
 * @param {Function|null} options.onCodeGenerated - Callback when code is generated (before execution)
 * @param {Function|null} options.onExecutionComplete - Callback when execution is complete
 * @param {Function|null} options.onVerifyAttempt - Callback when a verification retry attempt starts (attempt number, error)
 * @param {boolean} options.verifyMode - Enable verification mode (retry on error)
 * @param {number} options.maxRetries - Maximum retry attempts in verify mode (default: 3)
 * @param {Object} options.config - LM Studio config
 * @returns {Promise<{analysis: Object, code: string, execution: Object, finalResponse: string, parsedAttachments: Array, attempts: number}>}
 */
export const analyzeGenerateAndExecute = async (messages, models, onChunk = null, signal = null, options = {}) => {
  const {
    attachments = [],
    onAttachmentsParsed,
    onAnalysis,
    onCodeGenerated,
    onExecutionComplete,
    onVerifyAttempt,
    verifyMode = false,
    maxRetries = 3,
    config = {}
  } = options

  // Get the last user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) {
    throw new Error('No user message to process')
  }

  // Step 0: Parse attachments first using attachment reader
  let parsedAttachments = []
  let attachmentContent = ''

  if (attachments.length > 0) {
    parsedAttachments = await readAttachments(attachments)
    attachmentContent = formatAttachmentsForPrompt(parsedAttachments)

    if (onAttachmentsParsed) {
      onAttachmentsParsed(parsedAttachments)
    }
  }

  // Combine user message with parsed attachment content
  const messageWithAttachments = attachmentContent
    ? `${lastUserMessage.content}\n\n${attachmentContent}`
    : lastUserMessage.content

  // Step 1: Analyze with Mistral 3B (using message WITH parsed attachments)
  const analysis = await analyzeRequest(messageWithAttachments, models.routerId, config)

  if (onAnalysis) {
    onAnalysis(analysis)
  }

  // If it's not a code task, just pass to executor for normal response
  if (!analysis.canBeCode) {
    // Build messages with attachment content included
    const messagesWithAttachments = messages.map((m, i) => {
      // Add attachment content to the last user message
      if (m.role === 'user' && i === messages.length - 1 && attachmentContent) {
        return { ...m, content: `${m.content}\n\n${attachmentContent}` }
      }
      return m
    })

    const response = await lmstudioProvider.sendMessage(
      models.executorId,
      messagesWithAttachments,
      onChunk,
      signal,
      config
    )
    return {
      analysis,
      code: null,
      execution: null,
      finalResponse: response,
      parsedAttachments,
      attempts: 0
    }
  }

  // Step 2: Generate code with gpt-oss-20b (using message WITH parsed attachments)
  let code = await generateCode(
    analysis,
    messageWithAttachments,
    models.executorId,
    null,  // No streaming for code
    signal,
    config
  )

  let cleanedCode = cleanCode(code)
  let execution = executeCode(cleanedCode)
  let attempts = 1

  // Verification mode: retry on failure
  if (verifyMode && !execution.success) {
    while (!execution.success && attempts < maxRetries) {
      if (signal?.aborted) {
        break
      }

      attempts++

      if (onVerifyAttempt) {
        onVerifyAttempt(attempts, execution.error)
      }

      // Regenerate code with error feedback
      code = await regenerateCodeWithError(
        analysis,
        messageWithAttachments,
        cleanedCode,
        execution.error,
        models.executorId,
        signal,
        config
      )

      cleanedCode = cleanCode(code)
      execution = executeCode(cleanedCode)
    }
  }

  if (onCodeGenerated) {
    onCodeGenerated(cleanedCode)
  }

  if (onExecutionComplete) {
    onExecutionComplete(execution)
  }

  // Build final response - just the result
  let finalResponse = ''
  if (execution.success) {
    finalResponse = formatResult(execution.result)
  } else {
    finalResponse = `Error: ${execution.error}`
    if (verifyMode && attempts >= maxRetries) {
      finalResponse += ` (failed after ${attempts} attempts)`
    }
  }

  // Stream the result to UI
  if (onChunk) {
    onChunk(finalResponse)
  }

  return {
    analysis,
    code: cleanedCode,
    execution,
    finalResponse,
    parsedAttachments,
    attempts
  }
}

export default {
  fetchAvailableModels,
  findRouterAndExecutorModels,
  analyzeRequest,
  generateCode,
  regenerateCodeWithError,
  executeCode,
  formatResult,
  analyzeGenerateAndExecute
}
