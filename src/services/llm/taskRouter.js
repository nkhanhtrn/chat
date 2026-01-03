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

import lmService, { Category } from './LMService.js'
import { parseAnalysisResponse } from './responseParser.js'
import { readAttachments, formatAttachmentsForPrompt } from '../attachmentReader.js'
import { registry } from './capabilities/index.js'
import { createEmptyUsage, mergeUsage } from '../../utils/tokenUsage.js'

// ============================================================================
// Public API
// ============================================================================

/**
 * Format code execution result for display
 */
function formatCodeResult(result) {
  if (result === undefined) return 'undefined'
  if (result === null) return 'null'
  if (typeof result === 'string') return result
  if (Array.isArray(result) || typeof result === 'object') {
    return JSON.stringify(result, null, 2)
  }
  return String(result)
}

/**
 * Analyze user request with the router model (uses QUICK category)
 * @param {string} userMessage - The user message to analyze
 * @returns {Promise<Object>} Analysis result with optional usage data
 */
export const analyzeRequest = async (userMessage) => {
  const provider = lmService.getProviderByCategory(Category.QUICK)

  const messages = [
    { role: 'system', content: registry.buildRouterPrompt() },
    { role: 'user', content: userMessage }
  ]

  const response = await provider.send(messages)

  const analysis = parseAnalysisResponse(response)
  return analysis
}

/**
 * Full pipeline: Parse Attachments → Analyze → Web Search → Execute Capability
 *
 * @param {Array<{role: string, content: string}>} messages - Conversation messages
 * @param {Function|null} onChunk - Streaming callback for final result only
 * @param {AbortSignal|null} signal - Abort signal
 * @param {Object} options - Additional options
 * @returns {Promise<Object>}
 */
export const analyzeGenerateAndExecute = async (messages, onChunk = null, signal = null, options = {}) => {
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
    onToolGenerated,
    onBuildStepStart,
    onBuildStepComplete,
    onPlanGenerated,
    onStepStart,
    onStepComplete,
    onPlanComplete,
    verifyMode = false,
    maxRetries = 3,
    sessionId = null
  } = options

  // Get the last user message
  const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')
  if (!lastUserMessage) {
    throw new Error('No user message to process')
  }

  // Track token usage
  let executorUsage = createEmptyUsage()

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

  // Step 2: Analyze with router model (uses QUICK category)
  const analysis = await analyzeRequest(messageForAnalysis)

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

  // Get the executor provider - QUICK normally, REASONING if thinking mode enabled
  const useThinkingMode = options.useThinkingMode || false
  const executorCategory = useThinkingMode ? Category.REASONING : Category.QUICK
  const executorProvider = lmService.getProviderByCategory(executorCategory)

  // Track web search results across chain
  let webSearchResults = []

  // Build execution context (providers handle their own config internally)
  let executionContext = {
    analysis,
    userMessage: lastUserMessage.content,
    fullContext,
    messages,
    useThinkingMode,
    provider: executorProvider,
    signal,
    onChunk: null,  // Only stream on final capability
    webSearchResults,
    sessionId,
    callbacks: {
      onCodeGenerated,
      onExecutionComplete,
      onVerifyAttempt,
      onVisualizationGenerated,
      onToolGenerated,
      onBuildStepStart,
      onBuildStepComplete,
      onWebSearchStart,
      onWebSearchProgress,
      onWebSearchResult,
      onWebSearchComplete,
      onPlanGenerated,
      onStepStart,
      onStepComplete,
      onPlanComplete,
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
    pipe: result.pipe,
    usage: executorUsage.totalTokens > 0 ? {
      executor: executorUsage.totalTokens > 0 ? executorUsage : null
    } : null
  }

  // Map result based on final capability type
  if (finalCapability.name === 'planning') {
    response.planning = result.success ? result.result : null
    response.finalResponse = result.success ? result.result.summary : `Error: ${result.error}`
  } else if (finalCapability.name === 'code') {
    response.code = result.metadata?.code || null
    response.execution = result.metadata?.executionDetails || null
    response.visualization = null
    response.tool = null
    response.finalResponse = result.success ? formatCodeResult(result.result) : `Error: ${result.error}`

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
  analyzeRequest,
  analyzeGenerateAndExecute,
  registry
}
