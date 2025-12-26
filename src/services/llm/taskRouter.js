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
  const result = {
    capability: 'text',
    taskDescription: json.taskDescription || '',
    needsWebSearch: json.needsWebSearch || false,
    searchQuery: json.searchQuery || '',
    inputs: json.inputs || [],
    isVisualization: json.isVisualization || false,
    visualizationType: json.visualizationType || null,
    canBeCode: json.canBeCode !== undefined ? json.canBeCode : true,
    codeType: json.codeType || 'expression',
    functionName: json.functionName || '',
    expectedOutput: json.expectedOutput || ''
  }

  // Determine capability from JSON fields
  if (json.isVisualization) {
    result.capability = 'visualization'
  } else if (json.canBeCode === true) {
    result.capability = 'code'
  } else if (json.canBeCode === false) {
    result.capability = 'text'
  }

  return result
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

  // Extract canBeCode
  const codeMatch = text.match(/"canBeCode"\s*:\s*(true|false)/)
  if (codeMatch) result.canBeCode = codeMatch[1] === 'true'

  // Extract isVisualization
  const vizMatch = text.match(/"isVisualization"\s*:\s*(true|false)/)
  if (vizMatch) {
    result.isVisualization = vizMatch[1] === 'true'
    if (result.isVisualization) result.capability = 'visualization'
  }

  // Extract visualizationType
  const vizTypeMatch = text.match(/"visualizationType"\s*:\s*"([^"]+)"/)
  if (vizTypeMatch) result.visualizationType = vizTypeMatch[1]

  // Detect language task from text content
  const languageKeywords = ['language task', 'translate', 'translation', 'summarize', 'explain', 'describe']
  if (languageKeywords.some(kw => text.toLowerCase().includes(kw))) {
    result.canBeCode = false
    result.capability = 'text'
  }

  return result
}

/**
 * Parse router's response into structured data
 * Tries JSON first, then falls back to line-based parsing
 */
const parseAnalysisResponse = (response) => {
  // Try JSON parsing first
  const jsonResult = tryParseJson(response)
  if (jsonResult) {
    return jsonResult
  }

  // Fall back to line-based parsing
  const lines = response.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'))

  // Check if this is a multi-step plan
  const planLine = lines.find(l => l.toLowerCase().startsWith('plan:'))
  if (planLine || lines.some(l => /^step\s+\d+/i.test(l))) {
    return parseMultiStepPlan(lines, planLine)
  }

  // Try line-based parsing
  const result = parseSingleStep(lines)

  // Also try to extract fields from malformed JSON in the response
  extractFieldsFromText(response, result)

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
    canBeCode: true,
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

  // Infer properties from capability
  if (result.capability === 'visualization') {
    result.isVisualization = true
  }
  if (result.capability === 'code') {
    result.canBeCode = true
  }

  return result
}

/**
 * Parse multi-step plan response
 */
const parseMultiStepPlan = (lines, planLine) => {
  const result = {
    requiresPlanning: true,
    summary: planLine ? planLine.replace(/^plan:\s*/i, '') : 'Multi-step task',
    steps: []
  }

  let currentStep = null

  for (const line of lines) {
    // Check for STEP N header
    const stepMatch = line.match(/^step\s+(\d+)/i)
    if (stepMatch) {
      if (currentStep) {
        result.steps.push(currentStep)
      }
      currentStep = {
        stepNumber: parseInt(stepMatch[1]),
        capability: 'text',
        taskDescription: '',
        description: '',
        inputs: [],
        needsWebSearch: false,
        searchQuery: ''
      }
      continue
    }

    // Skip if no current step yet (preamble lines)
    if (!currentStep) continue

    // Parse key: value
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).toLowerCase().trim()
    const value = line.slice(colonIdx + 1).trim()

    switch (key) {
      case 'capability':
        currentStep.capability = value.toLowerCase()
        break
      case 'task':
      case 'taskdescription':
        currentStep.taskDescription = value
        currentStep.description = value
        break
      case 'description':
        currentStep.description = value
        if (!currentStep.taskDescription) currentStep.taskDescription = value
        break
      case 'searchquery':
      case 'search':
        currentStep.searchQuery = value
        currentStep.needsWebSearch = !!value
        break
      case 'input':
      case 'inputs':
        // Handle {{step_N_result}} references
        currentStep.inputs.push({ name: 'input', value, type: 'string' })
        break
      case 'codetype':
        currentStep.codeType = value
        break
      case 'visualizationtype':
        currentStep.visualizationType = value
        currentStep.isVisualization = true
        break
    }
  }

  // Don't forget the last step
  if (currentStep) {
    result.steps.push(currentStep)
  }

  return result
}

/**
 * Check if analysis contains a multi-step plan
 */
const isPlanAnalysis = (analysis) => {
  return analysis.requiresPlanning === true && Array.isArray(analysis.steps) && analysis.steps.length > 0
}

/**
 * Replace step result placeholders in inputs
 * e.g., {{step_1_result}} -> actual result from step 1
 */
const resolveStepInputs = (inputs, stepResults) => {
  if (!inputs || !Array.isArray(inputs)) return inputs

  return inputs.map(input => {
    if (typeof input.value === 'string') {
      // Replace {{step_N_result}} placeholders
      const replaced = input.value.replace(/\{\{step_(\d+)_result\}\}/g, (match, stepNum) => {
        const result = stepResults[parseInt(stepNum)]
        return result !== undefined ? JSON.stringify(result) : match
      })
      // Try to parse back to original type if it was a placeholder
      if (replaced !== input.value) {
        try {
          return { ...input, value: JSON.parse(replaced) }
        } catch {
          return { ...input, value: replaced }
        }
      }
    }
    return input
  })
}

/**
 * Execute a single step/analysis using its capability
 * @param {Object} analysis - Step analysis
 * @param {string} fullContext - Text context for LLM
 * @param {Object} models - Router/executor model config
 * @param {AbortSignal} signal - Abort signal
 * @param {Function} onChunk - Streaming callback
 * @param {Object} options - Callbacks and options
 * @param {Object} previousResults - Structured results from previous steps { stepNum: { capability, data } }
 * @param {Object|null} pipeInput - Piped data from previous capability (PipeData format)
 */
const executeSingleStep = async (analysis, fullContext, models, signal, onChunk, options, previousResults = {}, pipeInput = null) => {
  const capability = registry.resolve(analysis) || registry.getDefault()
  if (!capability) throw new Error(`No capability for: ${analysis.capability}`)

  const executorProviderId = models.executorProviderId || 'lmstudio'

  const context = {
    analysis,
    userMessage: fullContext,
    fullContext,
    messages: [{ role: 'user', content: fullContext }],
    models,
    config: getProviderConfig(executorProviderId),
    provider: getProvider(executorProviderId),
    signal,
    onChunk,
    previousResults,  // Pass structured data from previous steps (backwards compatibility)
    callbacks: {
      onCodeGenerated: options.onCodeGenerated,
      onExecutionComplete: options.onExecutionComplete,
      onVerifyAttempt: options.onVerifyAttempt,
      onVisualizationGenerated: options.onVisualizationGenerated,
      onWebSearchStart: options.onWebSearchStart,
      onWebSearchProgress: options.onWebSearchProgress,
      onWebSearchResult: options.onWebSearchResult,
      onWebSearchComplete: options.onWebSearchComplete,
      verifyMode: options.verifyMode ?? false,
      maxRetries: options.maxRetries ?? 3
    }
  }

  // Execute with pipe interface - pass pipeInput if available
  const result = await capability.execute(context, pipeInput)

  return {
    success: result.success,
    result: result.result,
    error: result.error,
    capability: capability.name,
    code: result.metadata?.code || null,
    execution: result.metadata?.executionDetails || null,
    visualization: capability.name === 'visualization' ? result.result : null,
    tool: capability.name === 'build' ? result.result : null,
    webSearchResults: capability.name === 'websearch' ? result.result : [],
    finalResponse: formatStepResponse(capability.name, result),
    pipe: result.pipe  // Include pipe output for chaining
  }
}

/**
 * Format step response based on capability type
 */
const formatStepResponse = (capabilityName, result) => {
  if (capabilityName === 'code') {
    return result.success ? formatResult(result.result) : `Error: ${result.error}`
  }
  if (capabilityName === 'websearch') {
    return ''  // Web search results are passed to next step, not displayed directly
  }
  if (capabilityName === 'extraction') {
    return result.success ? formatResult(result.result) : `Error: ${result.error}`
  }
  return result.result || ''
}

/**
 * Format a step's result for inclusion in context (human-readable)
 */
const formatResultForContext = (capability, data) => {
  if (!data) return 'No data'

  switch (capability) {
    case 'websearch':
      // Format web search results as source summaries
      if (Array.isArray(data)) {
        return data.map((r, i) =>
          `Source ${i + 1}: ${r.title || r.url}\n${r.content?.substring(0, 500) || r.snippet || ''}...`
        ).join('\n\n')
      }
      return JSON.stringify(data, null, 2)

    case 'code':
      // Format code result
      if (typeof data === 'object') {
        return JSON.stringify(data, null, 2)
      }
      return String(data)

    case 'visualization':
      return '[Visualization data - use previousResults for raw data]'

    default:
      if (typeof data === 'string') return data
      return JSON.stringify(data, null, 2)
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
  const executorPatterns = ['gpt-oss-20b', 'gpt-oss', 'openai', 'cerebras']

  return {
    router: findModelByPattern(models, routerPatterns),
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

  // Step 3: Check for multi-step plan
  if (isPlanAnalysis(analysis)) {
    const { onPlanCreated, onStepStart, onStepComplete, waitForPlanApproval } = options

    if (onPlanCreated) {
      onPlanCreated({ summary: analysis.summary, steps: analysis.steps })
    }

    // If waitForPlanApproval is provided, wait for user confirmation before executing
    if (waitForPlanApproval) {
      const approved = await waitForPlanApproval({ summary: analysis.summary, steps: analysis.steps })
      if (!approved) {
        // User rejected the plan - return early with just the analysis
        return {
          analysis,
          parsedAttachments,
          plan: { summary: analysis.summary, steps: analysis.steps, previousResults: {} },
          cancelled: true,
          finalResponse: 'Plan execution cancelled by user.'
        }
      }
    }

    // Structured results: { stepNum: { capability, data, success } }
    const previousResults = {}
    let finalResponse = null
    let lastPipeOutput = null  // Track pipe output for chaining

    for (const step of analysis.steps) {
      if (signal?.aborted) break

      if (onStepStart) {
        onStepStart({ stepNumber: step.stepNumber, description: step.description, capability: step.capability })
      }

      // Build text context with formatted previous results (for LLM reasoning)
      let stepContext = lastUserMessage.content
      if (attachmentContent) stepContext += `\n\n${attachmentContent}`
      if (Object.keys(previousResults).length > 0) {
        stepContext += '\n\nPrevious step results:'
        for (const [stepNum, stepData] of Object.entries(previousResults)) {
          stepContext += `\n\nStep ${stepNum} (${stepData.capability}):`
          stepContext += `\n${formatResultForContext(stepData.capability, stepData.data)}`
        }
      }

      // Execute step with both text context AND pipe input from previous step
      const stepAnalysis = { ...step }
      const stepOutput = await executeSingleStep(
        stepAnalysis,
        stepContext,
        models,
        signal,
        step.stepNumber === analysis.steps.length ? onChunk : null,
        options,
        previousResults,  // Pass structured data (backwards compatibility)
        lastPipeOutput    // Pass pipe output from previous step
      )

      // Store structured result for next steps (backwards compatibility)
      previousResults[step.stepNumber] = {
        capability: stepOutput.capability,
        data: stepOutput.result,
        success: stepOutput.success
      }

      // Store pipe output for next step (new pipe interface)
      lastPipeOutput = stepOutput.pipe
      finalResponse = stepOutput

      if (onStepComplete) {
        onStepComplete({
          stepNumber: step.stepNumber,
          capability: step.capability,
          result: stepOutput.result,
          success: stepOutput.success,
          pipe: stepOutput.pipe  // Include pipe output in callback
        })
      }
    }

    return {
      analysis,
      parsedAttachments,
      plan: { summary: analysis.summary, steps: analysis.steps, previousResults },
      ...finalResponse
    }
  }

  // Step 4: Perform web search if needed (single-step flow)
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

  // Get the executor provider
  const executorProviderId = models.executorProviderId || 'lmstudio'
  const executorProvider = getProvider(executorProviderId)
  const executorConfig = getProviderConfig(executorProviderId)

  // Build execution context
  const executionContext = {
    analysis,
    userMessage: lastUserMessage.content,
    fullContext,
    messages,
    models,
    config: executorConfig,
    provider: executorProvider,  // Pass the provider instance
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

  // Execute the capability (no pipe input for single-step)
  const result = await capability.execute(executionContext, null)

  // Build response in expected format for backwards compatibility
  const response = {
    analysis,
    parsedAttachments,
    webSearchResults,
    attempts: result.metadata?.attempts || 0,
    pipe: result.pipe  // Include pipe output for potential chaining
  }

  // Map result based on capability type
  if (capability.name === 'code') {
    response.code = result.metadata?.code || null
    response.execution = result.metadata?.executionDetails || null
    response.visualization = null
    response.tool = null
    response.finalResponse = result.success ? formatResult(result.result) : `Error: ${result.error}`

    if (onChunk && response.finalResponse) {
      onChunk(response.finalResponse)
    }
  } else if (capability.name === 'visualization') {
    response.code = null
    response.execution = null
    response.visualization = result.result
    response.tool = null
    response.finalResponse = ''
  } else if (capability.name === 'build') {
    response.code = null
    response.execution = null
    response.visualization = null
    response.tool = result.success ? result.result : null
    response.finalResponse = result.success ? '' : `Error: ${result.error}`
  } else if (capability.name === 'extraction') {
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
