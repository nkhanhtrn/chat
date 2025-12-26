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
import { getProviderConfig } from './index.js'
import {
  readAttachments,
  formatAttachmentsForPrompt
} from '../attachmentReader.js'
import { searchWeb } from '../webSearch.js'
import { fetchUrlContent } from '../urlFetcher.js'
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
 * Parse router's analysis response into structured data
 */
const parseAnalysisResponse = (response) => {
  const jsonMatch = response.match(/\{[\s\S]*\}/)
  if (!jsonMatch) {
    console.warn('No JSON object found in response:', response.substring(0, 200))
    return createFallbackAnalysis(response)
  }

  let jsonStr = jsonMatch[0]

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.warn('Initial JSON parse failed, attempting cleanup:', e.message)
  }

  try {
    jsonStr = jsonStr.replace(/,\s*([\]}])/g, '$1')
    jsonStr = jsonStr.replace(/'([^']*)'(\s*[,:\]}])/g, '"$1"$2')
    jsonStr = jsonStr.replace(/(\{|\[|,)\s*'([^']*)'/g, '$1"$2"')
    jsonStr = jsonStr.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
    jsonStr = jsonStr.replace(/\/\/[^\n]*/g, '')
    jsonStr = jsonStr.replace(/\/\*[\s\S]*?\*\//g, '')

    return JSON.parse(jsonStr)
  } catch (e) {
    console.warn('JSON cleanup parse failed:', e.message)
  }

  return createFallbackAnalysis(response)
}

/**
 * Create fallback analysis by extracting fields from text
 */
const createFallbackAnalysis = (response) => {
  const lowerResponse = response.toLowerCase()

  const isNonCode = lowerResponse.includes('"canbecode": false') ||
                    lowerResponse.includes('"canbecode":false') ||
                    lowerResponse.includes('"capability": "text"') ||
                    lowerResponse.includes('language task')

  const needsWebSearch = lowerResponse.includes('"needswebsearch": true') ||
                         lowerResponse.includes('"needswebsearch":true')

  const isVisualization = lowerResponse.includes('"isvisualization": true') ||
                          lowerResponse.includes('"isvisualization":true') ||
                          lowerResponse.includes('"capability": "visualization"')

  let visualizationType = null
  const vizTypeMatch = response.match(/"visualizationType"\s*:\s*"([^"]+)"/i)
  if (vizTypeMatch) visualizationType = vizTypeMatch[1]

  let searchQuery = ''
  const queryMatch = response.match(/"searchQuery"\s*:\s*"([^"]+)"/i)
  if (queryMatch) searchQuery = queryMatch[1]

  let taskDescription = 'Process the user request'
  const taskMatch = response.match(/"taskDescription"\s*:\s*"([^"]+)"/i)
  if (taskMatch) taskDescription = taskMatch[1]

  let capability = 'text'
  const capMatch = response.match(/"capability"\s*:\s*"([^"]+)"/i)
  if (capMatch) capability = capMatch[1]

  return {
    capability: isVisualization ? 'visualization' : (isNonCode ? 'text' : 'code'),
    needsWebSearch,
    searchQuery,
    isVisualization,
    visualizationType,
    canBeCode: !isNonCode,
    taskDescription,
    inputs: [],
    expectedOutput: 'Result',
    codeType: 'expression',
    functionName: 'process'
  }
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
        const pageContent = await fetchUrlContent(searchResult.url, { maxLength: 6000 })
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
 * Find router and executor models from available models
 */
export const findRouterAndExecutorModels = (models) => {
  const routerPatterns = ['ministral', 'mistral-3b', 'mistral3b', 'mistral-3', 'mistral']
  const executorPatterns = ['gpt-oss-20b', 'gpt-oss', 'openai']

  return {
    router: findModelByPattern(models, routerPatterns),
    executor: findModelByPattern(models, executorPatterns)
  }
}

/**
 * Analyze user request with the router model
 */
export const analyzeRequest = async (userMessage, routerModelId, config = {}) => {
  const providerConfig = config || getProviderConfig('lmstudio')

  const messages = [
    { role: 'system', content: registry.buildRouterPrompt() },
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

  return codeCapability._generateCode(analysis, originalRequest, executorModelId, config, signal)
}

/**
 * Regenerate code with error feedback (kept for backwards compatibility)
 */
export const regenerateCodeWithError = async (analysis, originalRequest, previousCode, errorMessage, executorModelId, signal = null, config = {}) => {
  const codeCapability = registry.get('code')
  if (!codeCapability) {
    throw new Error('Code capability not registered')
  }

  return codeCapability._regenerateWithError(analysis, originalRequest, previousCode, errorMessage, executorModelId, config, signal)
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
    config,
    signal,
    callbacks: {}
  })

  return result.result
}

/**
 * Full pipeline: Parse Attachments → Analyze → Web Search → Execute Capability
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Object} models - { routerId: string, executorId: string }
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
  const analysis = await analyzeRequest(messageForAnalysis, models.routerId, config)

  if (onAnalysis) {
    onAnalysis(analysis)
  }

  // Step 3: Perform web search if needed
  let webSearchResults = []
  let webSearchContent = ''

  if (analysis.needsWebSearch && analysis.searchQuery) {
    webSearchResults = await performWebSearch(
      analysis.searchQuery,
      { onWebSearchStart, onWebSearchProgress, onWebSearchResult, onWebSearchComplete },
      signal
    )
    webSearchContent = formatWebSearchContent(webSearchResults)
  }

  // Build full context
  let fullContext = lastUserMessage.content
  if (webSearchContent) fullContext += `\n\n${webSearchContent}`
  if (attachmentContent) fullContext += `\n\n${attachmentContent}`

  // Step 4: Resolve and execute capability
  const capability = registry.resolve(analysis) || registry.getDefault()

  if (!capability) {
    throw new Error('No capability available to handle this request')
  }

  // Build execution context
  const executionContext = {
    analysis,
    userMessage: lastUserMessage.content,
    fullContext,
    messages,
    models,
    config,
    signal,
    onChunk,
    webSearchResults,
    callbacks: {
      onCodeGenerated,
      onExecutionComplete,
      onVerifyAttempt,
      onVisualizationGenerated,
      verifyMode,
      maxRetries
    }
  }

  // Execute the capability
  const result = await capability.execute(executionContext)

  // Build response in expected format for backwards compatibility
  const response = {
    analysis,
    parsedAttachments,
    webSearchResults,
    attempts: result.metadata?.attempts || 0
  }

  // Map result based on capability type
  if (capability.name === 'code') {
    response.code = result.metadata?.code || null
    response.execution = result.metadata?.executionDetails || null
    response.visualization = null
    response.finalResponse = result.success ? formatResult(result.result) : `Error: ${result.error}`

    if (onChunk && response.finalResponse) {
      onChunk(response.finalResponse)
    }
  } else if (capability.name === 'visualization') {
    response.code = null
    response.execution = null
    response.visualization = result.result
    response.finalResponse = ''
  } else {
    // Text response
    response.code = null
    response.execution = null
    response.visualization = null
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
