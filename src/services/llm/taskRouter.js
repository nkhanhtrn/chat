/**
 * Task Router Service
 *
 * Orchestrates the two-model pipeline using the capability registry:
 * 1. Parse attachments (files/URLs) first using attachment reader
 * 2. Router model analyzes request and determines which capability to use
 * 3. Selected capability executes the task
 *
 * Adding new capabilities:
 * 1. Create a class extending BaseCapability in capabilities/
 * 2. Register it in capabilities/index.js
 * 3. The router prompt and execution are handled automatically
 */

import { lmstudioProvider } from './providers/lmstudio.js'
import { googleProvider } from './providers/google.js'
import { cerebrasProvider } from './providers/cerebras.js'
import { getProviderConfig } from './index.js'

// Provider registry for multi-provider support
const providerRegistry = {
  lmstudio: lmstudioProvider,
  google: googleProvider,
  cerebras: cerebrasProvider
}

/**
 * Get provider instance by ID
 */
export const getProvider = (providerId) => {
  return providerRegistry[providerId] || lmstudioProvider
}
import {
  readAttachments,
  formatAttachmentsForPrompt
} from '../attachmentReader.js'
import { searchWeb } from '../webSearch.js'
import { fetchUrlContent, cleanHtml } from '../urlFetcher.js'
import { registry } from './capabilities/index.js'

/**
 * Find a model matching the given patterns from available models
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
 * Try to extract and parse JSON from a response that may contain extra text
 */
const tryParseJson = (response) => {
  // Try to extract JSON from the response
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let jsonStr = jsonMatch[0]

  // Clean up common JSON issues from LLMs
  // Fix trailing commas
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')
  // Fix single quotes
  jsonStr = jsonStr.replace(/'/g, '"')

  try {
    const parsed = JSON.parse(jsonStr)
    return normalizeJsonAnalysis(parsed)
  } catch {
    return null
  }
}

/**
 * Normalize a JSON analysis response to the expected format
 */
const normalizeJsonAnalysis = (json) => {
  return {
    capability: json.capability?.toLowerCase() || 'text',
    taskDescription: json.taskDescription || json.task || '',
    needsWebSearch: json.needsWebSearch || false,
    searchQuery: json.searchQuery || '',
    inputs: json.inputs || [],
    isVisualization: json.isVisualization || false,
    visualizationType: json.visualizationType || null,
    codeType: json.codeType || 'expression',
    functionName: json.functionName || '',
    expectedOutput: json.expectedOutput || ''
  }
}

/**
 * Extract field values from text using regex patterns (for malformed JSON)
 */
const extractFieldsFromText = (text, result) => {
  // Extract taskDescription
  const taskMatch = text.match(/"taskDescription"\s*:\s*"([^"]+)"/)
  if (taskMatch) result.taskDescription = taskMatch[1]

  // Extract functionName
  const funcMatch = text.match(/"functionName"\s*:\s*"([^"]+)"/)
  if (funcMatch) result.functionName = funcMatch[1]

  // Extract capability
  const capMatch = text.match(/"capability"\s*:\s*"([^"]+)"/)
  if (capMatch) result.capability = capMatch[1].toLowerCase()

  // Extract isVisualization
  const vizMatch = text.match(/"isVisualization"\s*:\s*(true|false)/)
  if (vizMatch) {
    result.isVisualization = vizMatch[1] === 'true'
    if (result.isVisualization) result.capability = 'visualization'
  }

  // Extract visualizationType
  const vizTypeMatch = text.match(/"visualizationType"\s*:\s*"([^"]+)"/)
  if (vizTypeMatch) result.visualizationType = vizTypeMatch[1]

  return result
}

/**
 * Parse router's response into structured data
 * Tries JSON first, then falls back to line-based parsing
 */
const parseAnalysisResponse = (response) => {
  console.log('[Router] Raw response:\n', response)

  // Try JSON parsing first
  const jsonResult = tryParseJson(response)
  if (jsonResult) {
    console.log('[Router] Parsed as JSON:', jsonResult)
    return jsonResult
  }

  // Fall back to line-based parsing
  const lines = response.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'))

  // Try line-based parsing
  const result = parseSingleStep(lines)

  // Also try to extract fields from malformed JSON in the response
  extractFieldsFromText(response, result)

  console.log('[Router] Parsed as lines:', result)
  return result
}

/**
 * Parse single-step response
 */
const parseSingleStep = (lines) => {
  const result = {
    capability: 'text',
    taskDescription: '',
    needsWebSearch: false,
    searchQuery: '',
    inputs: [],
    isVisualization: false,
    visualizationType: null,
    codeType: 'expression',
    functionName: '',
    expectedOutput: ''
  }

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':')
    const value = valueParts.join(':').trim()

    switch (key.toLowerCase().trim()) {
      case 'capability':
        result.capability = value.toLowerCase()
        break
      case 'task':
      case 'taskdescription':
        result.taskDescription = value
        break
      case 'searchquery':
      case 'search':
        result.searchQuery = value
        result.needsWebSearch = !!value
        break
      case 'input':
      case 'inputs':
        result.inputs.push({ name: 'input', value, type: 'string' })
        break
      case 'codetype':
        result.codeType = value
        break
      case 'visualizationtype':
        result.visualizationType = value
        result.isVisualization = true
        break
    }
  }

  // Infer isVisualization from capability
  if (result.capability === 'visualization') {
    result.isVisualization = true
  }

  return result
}

/**
 * Perform web search and fetch content
 */
const performWebSearch = async (query, callbacks = {}, signal = null) => {
  const {
    onWebSearchStart,
    onWebSearchProgress,
    onWebSearchResult,
    onWebSearchComplete
  } = callbacks

  let webSearchResults = []

  if (onWebSearchStart) {
    onWebSearchStart(query)
  }

  try {
    const searchResults = await searchWeb(query, { maxResults: 3 })

    const searchResultsMeta = searchResults.map(r => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet
    }))

    if (onWebSearchProgress) {
      onWebSearchProgress({ phase: 'search_complete', resultsCount: searchResults.length, results: searchResultsMeta })
    }

    if (signal?.aborted) return []

    if (onWebSearchProgress) {
      onWebSearchProgress({ phase: 'fetching', total: searchResults.length, results: searchResultsMeta })
    }

    const fetchPromises = searchResults.map(async (searchResult, i) => {
      try {
        const rawContent = await fetchUrlContent(searchResult.url)
        const pageContent = cleanHtml(rawContent)
        const result = {
          query,
          url: searchResult.url,
          title: searchResult.title,
          content: pageContent,
          success: true
        }
        if (onWebSearchResult) onWebSearchResult(result, i)
        return result
      } catch (fetchError) {
        const result = {
          query,
          url: searchResult.url,
          title: searchResult.title,
          content: searchResult.snippet || 'Could not fetch page content',
          success: false,
          error: fetchError.message
        }
        if (onWebSearchResult) onWebSearchResult(result, i)
        return result
      }
    })

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

  return webSearchResults
}

/**
 * Format web search results for inclusion in prompt
 */
const formatWebSearchContent = (results) => {
  if (!results || results.length === 0) return ''

  return results.map((r, i) => {
    return `--- Source ${i + 1}: ${r.title} ---\nURL: ${r.url}\n\n${r.content}\n--- End of Source ${i + 1} ---`
  }).join('\n\n')
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Fetch all available models from LM Studio
 */
export const fetchAvailableModels = async (config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')
  return lmstudioProvider.fetchModels(providerConfig)
}

/**
 * Find executor model from available models
 * Router model must be explicitly specified by user
 */
export const findRouterAndExecutorModels = (models) => {
  const executorPatterns = ['gpt-oss-20b', 'gpt-oss', 'openai', 'cerebras']

  return {
    router: null,  // User must specify router model explicitly
    executor: findModelByPattern(models, executorPatterns)
  }
}

/**
 * Analyze user request with the router model
 * @param {string} userMessage - The user message to analyze
 * @param {string} routerModelId - The model ID to use
 * @param {string} routerProviderId - The provider ID (lmstudio, google, cerebras)
 * @param {Object} config - Provider config (optional, will be fetched if not provided)
 */
export const analyzeRequest = async (userMessage, routerModelId, routerProviderId = 'lmstudio', config = null) => {
  const provider = getProvider(routerProviderId)
  const providerConfig = config || getProviderConfig(routerProviderId)

  const messages = [
    { role: 'system', content: registry.buildRouterPrompt() },
    { role: 'user', content: userMessage }
  ]

  const response = await provider.sendMessage(
    routerModelId,
    messages,
    null,
    null,
    providerConfig
  )

  return parseAnalysisResponse(response)
}

/**
 * Execute JavaScript code safely (kept for backwards compatibility)
 */
export const executeCode = (code) => {
  const codeCapability = registry.get('code')
  if (codeCapability) {
    return codeCapability._executeCode(code)
  }

  // Fallback implementation
  try {
    const sandbox = new Function(`"use strict"; return (${code.trim()});`)
    return { success: true, result: sandbox(), error: null }
  } catch (e) {
    return { success: false, result: null, error: e.message }
  }
}

/**
 * Format execution result for display (kept for backwards compatibility)
 */
export const formatResult = (result) => {
  if (result === undefined) return 'undefined'
  if (result === null) return 'null'
  if (typeof result === 'string') return result
  if (Array.isArray(result) || typeof result === 'object') {
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

/**
 * Generate code with executor model (kept for backwards compatibility)
 */
export const generateCode = async (analysis, originalRequest, executorModelId, onChunk = null, signal = null, config = {}) => {
  const codeCapability = registry.get('code')
  if (!codeCapability) {
    throw new Error('Code capability not registered')
  }

  const provider = getProvider('lmstudio')
  const providerConfig = config || getProviderConfig('lmstudio')
  return codeCapability._generateCode(analysis, originalRequest, executorModelId, provider, providerConfig, signal)
}

/**
 * Regenerate code with error feedback (kept for backwards compatibility)
 */
export const regenerateCodeWithError = async (analysis, originalRequest, previousCode, errorMessage, executorModelId, signal = null, config = {}) => {
  const codeCapability = registry.get('code')
  if (!codeCapability) {
    throw new Error('Code capability not registered')
  }

  const provider = getProvider('lmstudio')
  const providerConfig = config || getProviderConfig('lmstudio')
  return codeCapability._regenerateWithError(analysis, originalRequest, previousCode, errorMessage, executorModelId, provider, providerConfig, signal)
}

/**
 * Generate visualization content (kept for backwards compatibility)
 */
export const generateVisualization = async (analysis, originalRequest, executorModelId, signal = null, config = {}) => {
  const vizCapability = registry.get('visualization')
  if (!vizCapability) {
    throw new Error('Visualization capability not registered')
  }

  const result = await vizCapability.execute({
    analysis,
    fullContext: originalRequest,
    models: { executorId: executorModelId },
    config: config || getProviderConfig('lmstudio'),
    provider: getProvider('lmstudio'),
    signal,
    callbacks: {}
  })

  return result.result
}

/**
 * Full pipeline: Parse Attachments → Analyze → Web Search → Execute Capability
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} models - { routerId: string, routerProviderId?: string, executorId: string, executorProviderId?: string }
 * @param {Function|null} onChunk - Streaming callback for final result only
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
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

  // Step 1: Parse attachments
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

  // Step 2: Analyze with router model (uses dynamic prompt from registry)
  const routerProviderId = models.routerProviderId || 'lmstudio'
  const analysis = await analyzeRequest(messageForAnalysis, models.routerId, routerProviderId)

  if (onAnalysis) {
    onAnalysis(analysis)
  }

  // Build full context
  let fullContext = lastUserMessage.content
  if (attachmentContent) fullContext += `\n\n${attachmentContent}`

  // Step 3: Resolve and execute capability chain
  // If needsWebSearch is true, force websearch capability (which chains to text)
  let capability
  if (analysis.needsWebSearch && analysis.searchQuery) {
    capability = registry.get('websearch') || registry.resolve(analysis) || registry.getDefault()
  } else {
    capability = registry.resolve(analysis) || registry.getDefault()
  }

  if (!capability) {
    throw new Error('No capability available to handle this request')
  }

  // Get the executor provider
  const executorProviderId = models.executorProviderId || 'lmstudio'
  const executorProvider = getProvider(executorProviderId)
  const executorConfig = getProviderConfig(executorProviderId)

  // Track web search results across chain
  let webSearchResults = []

  // Build execution context
  let executionContext = {
    analysis,
    userMessage: lastUserMessage.content,
    fullContext,
    messages,
    models,
    config: executorConfig,
    provider: executorProvider,
    signal,
    onChunk: null,  // Only stream on final capability
    webSearchResults,
    callbacks: {
      onCodeGenerated,
      onExecutionComplete,
      onVerifyAttempt,
      onVisualizationGenerated,
      onWebSearchStart,
      onWebSearchProgress,
      onWebSearchResult,
      onWebSearchComplete,
      verifyMode,
      maxRetries
    }
  }

  // Execute capability chain (capabilities can specify chainTo for next capability)
  let result = null
  let pipeInput = null
  let finalCapability = capability
  const MAX_CHAIN_DEPTH = 5  // Prevent infinite loops

  for (let depth = 0; depth < MAX_CHAIN_DEPTH; depth++) {
    if (signal?.aborted) break

    // Only stream output on the last capability in the chain
    const isLastInChain = !capability.getChainTo || depth === MAX_CHAIN_DEPTH - 1
    executionContext.onChunk = isLastInChain ? onChunk : null

    result = await capability.execute(executionContext, pipeInput)
    finalCapability = capability

    // Check if we should chain to another capability
    if (result.chainTo) {
      const nextCapability = registry.get(result.chainTo)
      if (nextCapability) {
        pipeInput = result.pipe
        capability = nextCapability
        // Update context with results from previous capability
        if (result.result && Array.isArray(result.result)) {
          executionContext.webSearchResults = result.result
        }
        continue
      }
    }
    break  // No more chaining
  }

  // Build response in expected format for backwards compatibility
  const response = {
    analysis,
    parsedAttachments,
    webSearchResults: executionContext.webSearchResults,
    attempts: result.metadata?.attempts || 0,
    pipe: result.pipe
  }

  // Map result based on final capability type
  if (finalCapability.name === 'code') {
    response.code = result.metadata?.code || null
    response.execution = result.metadata?.executionDetails || null
    response.visualization = null
    response.tool = null
    response.finalResponse = result.success ? formatResult(result.result) : `Error: ${result.error}`

    if (onChunk && response.finalResponse) {
      onChunk(response.finalResponse)
    }
  } else if (finalCapability.name === 'visualization') {
    response.code = null
    response.execution = null
    response.visualization = result.result
    response.tool = null
    response.finalResponse = ''
  } else if (finalCapability.name === 'build') {
    response.code = null
    response.execution = null
    response.visualization = null
    response.tool = result.success ? result.result : null
    response.finalResponse = result.success ? '' : `Error: ${result.error}`
  } else if (finalCapability.name === 'extraction') {
    response.code = null
    response.execution = null
    response.visualization = null
    response.tool = null
    response.extractedData = result.result
    response.finalResponse = result.success ? formatResult(result.result) : `Error: ${result.error}`
  } else {
    // Text response
    response.code = null
    response.execution = null
    response.visualization = null
    response.tool = null
    response.finalResponse = result.result || ''
  }

  return response
}

// Export the registry for direct access
export { registry }

export default {
  fetchAvailableModels,
  findRouterAndExecutorModels,
  analyzeRequest,
  generateCode,
  regenerateCodeWithError,
  generateVisualization,
  executeCode,
  formatResult,
  analyzeGenerateAndExecute,
  registry
}
