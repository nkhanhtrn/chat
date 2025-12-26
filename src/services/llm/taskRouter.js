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
import { searchWeb } from '../webSearch.js'
import { fetchUrlContent } from '../urlFetcher.js'

// Get current date for the router prompt
const getCurrentDateString = () => {
  const now = new Date()
  const months = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
  return `${months[now.getMonth()]} ${now.getFullYear()}`
}

// Mistral 3B system prompt - analyzes request, determines web search need, and creates code instructions
const getRouterSystemPrompt = () => `You are a task analyzer. Today is ${getCurrentDateString()}. Analyze the user's request and determine:
1. If web search is needed to answer the question
2. If it should be handled by code execution, visualization, or direct language response

WEB SEARCH (needsWebSearch: true) - when current/external information is required:
- Current events, news, recent developments
- Facts that may have changed or need verification
- Information about specific products, services, companies
- Technical documentation, tutorials, how-to guides
- Anything the user explicitly asks to "search for" or "look up"

NO WEB SEARCH (needsWebSearch: false):
- General knowledge questions
- Math calculations, coding tasks
- Creative writing, translation
- Questions about attached content
- Opinions or subjective discussions

VISUALIZATION TASKS (isVisualization: true) - displaying data or concepts visually:
- Charts/graphs for data (bar, line, pie, scatter, etc.) → visualizationType: "chart"
- Flowcharts, diagrams, sequences, entity relationships → visualizationType: "mermaid"
- Simple illustrations, icons, shapes → visualizationType: "svg"

Use CODE TASKS instead when the output requires computation, encoding, or library usage (e.g., QR codes, barcodes, hashing, encryption, image processing).

Examples:
- "pie chart of sales" → visualization (chart)
- "flowchart for login process" → visualization (mermaid)
- "draw a star icon" → visualization (svg)
- "generate QR code" → code task (needs library)
- "encode as base64" → code task (computation)

CODE TASKS (canBeCode: true) - mechanical/deterministic operations:
- Math calculations, data transformations, parsing, formatting
- String manipulation (reverse, encode, split, etc.)
- Array/object operations (sort, filter, extract, count)
- Data extraction from structured formats (JSON, CSV)

LANGUAGE TASKS (canBeCode: false) - require understanding/generation:
- Translation, summarization, rewriting, paraphrasing
- Explanations, creative writing, answering questions
- Analysis requiring judgment or interpretation

Respond with JSON:
{
  "needsWebSearch": boolean,
  "searchQuery": "the search query",
  "isVisualization": boolean,
  "visualizationType": "chart|mermaid|svg|null",
  "canBeCode": boolean,
  "taskDescription": "...",
  "inputs": [...],
  "expectedOutput": "...",
  "codeType": "function|expression|none",
  "functionName": "..."
}

IMPORTANT: If needsWebSearch is true, provide exactly 1 specific search query that would find the most relevant information. Make the query specific and targeted.

Examples:

User: "What's the latest news about OpenAI?"
{"needsWebSearch": true, "searchQuery": "OpenAI latest news", "isVisualization": false, "visualizationType": null, "canBeCode": false, "taskDescription": "Find current news about OpenAI", "inputs": [], "expectedOutput": "News summary", "codeType": "none", "functionName": ""}

User: "How do I install React?"
{"needsWebSearch": true, "searchQuery": "React installation guide npm", "isVisualization": false, "visualizationType": null, "canBeCode": false, "taskDescription": "Find React installation instructions", "inputs": [], "expectedOutput": "Installation guide", "codeType": "none", "functionName": ""}

User: "convert hello to ASCII"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": false, "visualizationType": null, "canBeCode": true, "taskDescription": "Convert text to ASCII codes", "inputs": [{"name": "text", "value": "hello", "type": "string"}], "expectedOutput": "Array of ASCII codes", "codeType": "function", "functionName": "textToAscii"}

User: "what is 25 * 4 + 10?"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": false, "visualizationType": null, "canBeCode": true, "taskDescription": "Calculate", "inputs": [], "expectedOutput": "Number", "codeType": "expression", "functionName": "calculate"}

User: "translate this to French: Hello world"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": false, "visualizationType": null, "canBeCode": false, "taskDescription": "Language task", "inputs": [], "expectedOutput": "Translated text", "codeType": "none", "functionName": ""}

User: "draw a pie chart showing: Apple 30%, Google 25%, Microsoft 45%"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": true, "visualizationType": "chart", "canBeCode": false, "taskDescription": "Create pie chart with company market shares", "inputs": [{"name": "data", "value": [{"name": "Apple", "value": 30}, {"name": "Google", "value": 25}, {"name": "Microsoft", "value": 45}], "type": "array"}], "expectedOutput": "Pie chart visualization", "codeType": "none", "functionName": ""}

User: "create a flowchart: Start -> Check Input -> Valid? -> Process / Error -> End"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": true, "visualizationType": "mermaid", "canBeCode": false, "taskDescription": "Create flowchart for input validation process", "inputs": [], "expectedOutput": "Mermaid flowchart", "codeType": "none", "functionName": ""}

User: "draw a simple smiley face"
{"needsWebSearch": false, "searchQuery": "", "isVisualization": true, "visualizationType": "svg", "canBeCode": false, "taskDescription": "Draw SVG smiley face", "inputs": [], "expectedOutput": "SVG drawing", "codeType": "none", "functionName": ""}

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

// System prompt for ECharts visualization generation
const CHART_SYSTEM_PROMPT = `You are a chart generator that creates ECharts configuration objects.

CRITICAL RULES:
1. Output ONLY a valid JSON object - no markdown, no explanations, no code blocks
2. The JSON must be a valid ECharts option object
3. Use appropriate chart types: 'pie', 'bar', 'line', 'scatter', 'radar', etc.
4. Include proper titles, legends, and axis labels where appropriate
5. Use a clean color palette

EXAMPLES:

For a pie chart with data Apple: 30, Google: 25, Microsoft: 45:
{
  "title": {"text": "Market Share", "left": "center"},
  "tooltip": {"trigger": "item"},
  "legend": {"orient": "vertical", "left": "left"},
  "series": [{
    "name": "Share",
    "type": "pie",
    "radius": "50%",
    "data": [
      {"value": 30, "name": "Apple"},
      {"value": 25, "name": "Google"},
      {"value": 45, "name": "Microsoft"}
    ]
  }]
}

For a bar chart with monthly sales:
{
  "title": {"text": "Monthly Sales"},
  "tooltip": {},
  "xAxis": {"type": "category", "data": ["Jan", "Feb", "Mar", "Apr"]},
  "yAxis": {"type": "value"},
  "series": [{"type": "bar", "data": [120, 200, 150, 80]}]
}

For a line chart:
{
  "title": {"text": "Trend"},
  "tooltip": {"trigger": "axis"},
  "xAxis": {"type": "category", "data": ["Mon", "Tue", "Wed", "Thu", "Fri"]},
  "yAxis": {"type": "value"},
  "series": [{"type": "line", "data": [150, 230, 224, 218, 135]}]
}

Output ONLY the JSON object, nothing else.`

// System prompt for Mermaid diagram generation
const MERMAID_SYSTEM_PROMPT = `You are a Mermaid diagram generator.

CRITICAL RULES:
1. Output ONLY valid Mermaid diagram syntax - no markdown code blocks, no explanations
2. Start directly with the diagram type (flowchart, sequenceDiagram, classDiagram, etc.)
3. Use proper Mermaid syntax

DIAGRAM TYPES AND SYNTAX:

Flowchart:
flowchart TD
    A[Start] --> B{Decision}
    B -->|Yes| C[Process]
    B -->|No| D[End]
    C --> D

Sequence Diagram:
sequenceDiagram
    participant A as Alice
    participant B as Bob
    A->>B: Hello
    B-->>A: Hi there

Class Diagram:
classDiagram
    class Animal {
        +String name
        +makeSound()
    }
    class Dog {
        +bark()
    }
    Animal <|-- Dog

Entity Relationship:
erDiagram
    CUSTOMER ||--o{ ORDER : places
    ORDER ||--|{ LINE-ITEM : contains

State Diagram:
stateDiagram-v2
    [*] --> Active
    Active --> Inactive
    Inactive --> [*]

Output ONLY the Mermaid diagram code, nothing else.`

// System prompt for SVG generation
const SVG_SYSTEM_PROMPT = `You are an SVG illustration generator.

CRITICAL RULES:
1. Output ONLY valid SVG code - no markdown, no explanations
2. Start directly with <svg> tag
3. Use viewBox for proper scaling, typically viewBox="0 0 200 200"
4. Include width="100%" and height="auto" for responsiveness
5. Use simple, clean shapes and colors
6. Keep illustrations simple and recognizable

EXAMPLES:

Simple star:
<svg viewBox="0 0 200 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <polygon points="100,10 40,198 190,78 10,78 160,198" fill="#FFD700" stroke="#FFA500" stroke-width="2"/>
</svg>

Smiley face:
<svg viewBox="0 0 200 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <circle cx="100" cy="100" r="90" fill="#FFE66D" stroke="#333" stroke-width="3"/>
  <circle cx="65" cy="80" r="12" fill="#333"/>
  <circle cx="135" cy="80" r="12" fill="#333"/>
  <path d="M 50 120 Q 100 170 150 120" stroke="#333" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>

Simple house:
<svg viewBox="0 0 200 200" width="100%" height="auto" xmlns="http://www.w3.org/2000/svg">
  <polygon points="100,20 20,80 180,80" fill="#8B4513"/>
  <rect x="40" y="80" width="120" height="100" fill="#DEB887"/>
  <rect x="80" y="120" width="40" height="60" fill="#8B4513"/>
  <rect x="50" y="100" width="30" height="30" fill="#87CEEB"/>
  <rect x="120" y="100" width="30" height="30" fill="#87CEEB"/>
</svg>

Output ONLY the SVG code, nothing else.`

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

  // Detect if web search is needed
  const needsWebSearch = lowerResponse.includes('"needswebsearch": true') ||
                         lowerResponse.includes('"needswebsearch":true')

  // Detect if visualization is needed
  const isVisualization = lowerResponse.includes('"isvisualization": true') ||
                          lowerResponse.includes('"isvisualization":true')

  // Try to extract visualization type
  let visualizationType = null
  const vizTypeMatch = response.match(/"visualizationType"\s*:\s*"([^"]+)"/i)
  if (vizTypeMatch) {
    visualizationType = vizTypeMatch[1]
  }

  // Try to extract search query
  let searchQuery = ''
  const queryMatch = response.match(/"searchQuery"\s*:\s*"([^"]+)"/i)
  if (queryMatch) {
    searchQuery = queryMatch[1]
  }

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
    needsWebSearch,
    searchQuery,
    isVisualization,
    visualizationType,
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
    { role: 'system', content: getRouterSystemPrompt() },
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
 * Generate visualization content based on type
 * @param {Object} analysis - Analysis from Mistral
 * @param {string} originalRequest - Original user request
 * @param {string} executorModelId - The executor model ID
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} config - LM Studio config
 * @returns {Promise<{type: string, content: string}>} Generated visualization
 */
export const generateVisualization = async (analysis, originalRequest, executorModelId, signal = null, config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')

  // Select the appropriate system prompt based on visualization type
  let systemPrompt
  switch (analysis.visualizationType) {
    case 'chart':
      systemPrompt = CHART_SYSTEM_PROMPT
      break
    case 'mermaid':
      systemPrompt = MERMAID_SYSTEM_PROMPT
      break
    case 'svg':
      systemPrompt = SVG_SYSTEM_PROMPT
      break
    default:
      // Default to chart if unspecified
      systemPrompt = CHART_SYSTEM_PROMPT
  }

  const instructionPrompt = `Task: ${analysis.taskDescription}
Data/Inputs: ${JSON.stringify(analysis.inputs)}
Expected output: ${analysis.expectedOutput}

Original request: "${originalRequest}"

Generate the visualization now:`

  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: instructionPrompt }
  ]

  const response = await lmstudioProvider.sendMessage(
    executorModelId,
    messages,
    null,
    signal,
    providerConfig
  )

  return {
    type: analysis.visualizationType || 'chart',
    content: cleanVisualization(response, analysis.visualizationType)
  }
}

/**
 * Clean visualization output (remove markdown, extra text)
 * @param {string} content
 * @param {string} type
 * @returns {string}
 */
const cleanVisualization = (content, type) => {
  let cleaned = content.trim()

  // Remove markdown code blocks if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json|mermaid|svg|xml)?\n?/, '').replace(/\n?```$/, '')
  }

  // For charts, try to extract JSON object
  if (type === 'chart') {
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      cleaned = jsonMatch[0]
    }
  }

  // For SVG, ensure it starts with <svg
  if (type === 'svg') {
    const svgMatch = cleaned.match(/<svg[\s\S]*<\/svg>/i)
    if (svgMatch) {
      cleaned = svgMatch[0]
    }
  }

  return cleaned.trim()
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
 * Full pipeline: Parse Attachments → Analyze → Web Search → Generate Code → Execute (with optional verification/retry)
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} models - { routerId: string, executorId: string }
 * @param {Function|null} onChunk - Streaming callback for final result only
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} options - Additional options
 * @param {Array} options.attachments - Raw attachments to parse (files/URLs)
 * @param {Function|null} options.onAttachmentsParsed - Callback when attachments are parsed
 * @param {Function|null} options.onAnalysis - Callback when analysis is complete
 * @param {Function|null} options.onWebSearchStart - Callback when web search starts (query string)
 * @param {Function|null} options.onWebSearchProgress - Callback for search progress updates (phase, details)
 * @param {Function|null} options.onWebSearchResult - Callback for each fetched page (result, index)
 * @param {Function|null} options.onWebSearchComplete - Callback when all web searches complete (results array)
 * @param {Function|null} options.onCodeGenerated - Callback when code is generated (before execution)
 * @param {Function|null} options.onExecutionComplete - Callback when execution is complete
 * @param {Function|null} options.onVerifyAttempt - Callback when a verification retry attempt starts (attempt number, error)
 * @param {Function|null} options.onVisualizationGenerated - Callback when visualization is generated
 * @param {boolean} options.verifyMode - Enable verification mode (retry on error)
 * @param {number} options.maxRetries - Maximum retry attempts in verify mode (default: 3)
 * @param {Object} options.config - LM Studio config
 * @returns {Promise<{analysis: Object, code: string, execution: Object, visualization: Object, finalResponse: string, parsedAttachments: Array, webSearchResults: Array, attempts: number}>}
 */
export const analyzeGenerateAndExecute = async (messages, models, onChunk = null, signal = null, options = {}) => {
  const {
    attachments = [],
    onAttachmentsParsed,
    onAnalysis,
    onWebSearchStart,
    onWebSearchProgress,
    onWebSearchResult,
    onWebSearchComplete,
    onCodeGenerated,
    onExecutionComplete,
    onVerifyAttempt,
    onVisualizationGenerated,
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

  // Combine user message with parsed attachment content for analysis
  let messageForAnalysis = lastUserMessage.content
  if (attachmentContent) {
    messageForAnalysis += `\n\n${attachmentContent}`
  }

  // Step 1: Analyze with Mistral 3B (determines if web search is needed)
  const analysis = await analyzeRequest(messageForAnalysis, models.routerId, config)

  if (onAnalysis) {
    onAnalysis(analysis)
  }

  // Step 2: Perform web search if needed
  let webSearchResults = []
  let webSearchContent = ''

  if (analysis.needsWebSearch && analysis.searchQuery) {
    const query = analysis.searchQuery

    if (onWebSearchStart) {
      onWebSearchStart(query)
    }

    try {
      // Search for the query, get top 3 results
      const searchResults = await searchWeb(query, { maxResults: 3 })

      // Pass search results with URLs/titles for display while fetching
      const searchResultsMeta = searchResults.map(r => ({
        url: r.url,
        title: r.title,
        snippet: r.snippet
      }))

      if (onWebSearchProgress) {
        onWebSearchProgress({ phase: 'search_complete', resultsCount: searchResults.length, results: searchResultsMeta })
      }

      if (signal?.aborted) {
        return
      }

      // Fetch content for all results concurrently
      if (onWebSearchProgress) {
        onWebSearchProgress({ phase: 'fetching', total: searchResults.length, results: searchResultsMeta })
      }

      const fetchPromises = searchResults.map(async (searchResult, i) => {
        try {
          const pageContent = await fetchUrlContent(searchResult.url, { maxLength: 6000 })

          const result = {
            query,
            url: searchResult.url,
            title: searchResult.title,
            content: pageContent,
            success: true
          }

          if (onWebSearchResult) {
            onWebSearchResult(result, i)
          }

          return result
        } catch (fetchError) {
          // If fetch fails, use the snippet from search
          const result = {
            query,
            url: searchResult.url,
            title: searchResult.title,
            content: searchResult.snippet || 'Could not fetch page content',
            success: false,
            error: fetchError.message
          }

          if (onWebSearchResult) {
            onWebSearchResult(result, i)
          }

          return result
        }
      })

      // Wait for all fetches to complete
      webSearchResults = await Promise.all(fetchPromises)
    } catch (searchError) {
      console.warn(`Search failed for query "${query}":`, searchError.message)
      if (onWebSearchProgress) {
        onWebSearchProgress({ phase: 'error', error: searchError.message })
      }
    }

    if (onWebSearchComplete) {
      onWebSearchComplete(webSearchResults)
    }

    // Format web search results for the prompt
    if (webSearchResults.length > 0) {
      webSearchContent = webSearchResults.map((r, i) => {
        return `--- Source ${i + 1}: ${r.title} ---\nURL: ${r.url}\n\n${r.content}\n--- End of Source ${i + 1} ---`
      }).join('\n\n')
    }
  }

  // Combine all context: user message + web search + attachments
  let fullContext = lastUserMessage.content
  if (webSearchContent) {
    fullContext += `\n\n${webSearchContent}`
  }
  if (attachmentContent) {
    fullContext += `\n\n${attachmentContent}`
  }

  // If it's a visualization task, generate the appropriate visualization
  if (analysis.isVisualization && analysis.visualizationType) {
    const visualization = await generateVisualization(
      analysis,
      fullContext,
      models.executorId,
      signal,
      config
    )

    if (onVisualizationGenerated) {
      onVisualizationGenerated(visualization)
    }

    return {
      analysis,
      code: null,
      execution: null,
      visualization,
      finalResponse: '',
      parsedAttachments,
      webSearchResults,
      attempts: 0
    }
  }

  // If it's not a code task, just pass to executor for normal response
  if (!analysis.canBeCode) {
    // Build messages with all context included
    const messagesWithContext = []

    // Add system prompt for summarization if web search was used
    if (webSearchResults.length > 0) {
      messagesWithContext.push({
        role: 'system',
        content: `You are a research assistant that summarizes web search results. The user asked a question and I searched the web for answers. The search results are included after the user's question.

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
      })
    }

    // Add conversation messages
    messages.forEach((m, i) => {
      // Add all context to the last user message
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
      analysis,
      code: null,
      execution: null,
      visualization: null,
      finalResponse: response,
      parsedAttachments,
      webSearchResults,
      attempts: 0
    }
  }

  // Step 3: Generate code with gpt-oss-20b (using full context including web search)
  let code = await generateCode(
    analysis,
    fullContext,
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
        fullContext,
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
    visualization: null,
    finalResponse,
    parsedAttachments,
    webSearchResults,
    attempts
  }
}

export default {
  fetchAvailableModels,
  findRouterAndExecutorModels,
  analyzeRequest,
  generateCode,
  regenerateCodeWithError,
  generateVisualization,
  executeCode,
  formatResult,
  analyzeGenerateAndExecute
}
