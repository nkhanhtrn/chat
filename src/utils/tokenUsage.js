/**
 * Token usage utilities
 * Generic functions for tracking and displaying token usage across the application
 */

/**
 * @typedef {Object} TokenUsage
 * @property {number} promptTokens - Number of input/prompt tokens
 * @property {number} completionTokens - Number of output/completion tokens
 * @property {number} totalTokens - Total tokens (prompt + completion)
 */

/**
 * Create an empty token usage object
 * @returns {TokenUsage}
 */
export function createEmptyUsage() {
  return {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0
  }
}

/**
 * Parse token usage from OpenAI-compatible API response
 * @param {Object} response - API response object
 * @returns {TokenUsage|null} Token usage or null if not available
 */
export function parseOpenAIUsage(response) {
  const usage = response?.usage
  if (!usage) return null

  return {
    promptTokens: usage.prompt_tokens || 0,
    completionTokens: usage.completion_tokens || 0,
    totalTokens: usage.total_tokens || (usage.prompt_tokens || 0) + (usage.completion_tokens || 0)
  }
}

/**
 * Parse token usage from Google Gemini API response
 * @param {Object} response - API response object
 * @returns {TokenUsage|null} Token usage or null if not available
 */
export function parseGeminiUsage(response) {
  const metadata = response?.usageMetadata
  if (!metadata) return null

  return {
    promptTokens: metadata.promptTokenCount || 0,
    completionTokens: metadata.candidatesTokenCount || 0,
    totalTokens: metadata.totalTokenCount ||
      (metadata.promptTokenCount || 0) + (metadata.candidatesTokenCount || 0)
  }
}

/**
 * Merge multiple usage objects together
 * @param {...TokenUsage} usages - Usage objects to merge
 * @returns {TokenUsage} Combined usage
 */
export function mergeUsage(...usages) {
  return usages.reduce((acc, usage) => {
    if (!usage) return acc
    return {
      promptTokens: acc.promptTokens + (usage.promptTokens || 0),
      completionTokens: acc.completionTokens + (usage.completionTokens || 0),
      totalTokens: acc.totalTokens + (usage.totalTokens || 0)
    }
  }, createEmptyUsage())
}

/**
 * Format token count for display
 * @param {number} count - Token count
 * @returns {string} Formatted string (e.g., "1.2k" or "567")
 */
export function formatTokenCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return String(count)
}

/**
 * Format full usage for display
 * @param {TokenUsage} usage - Token usage object
 * @param {Object} options - Formatting options
 * @param {boolean} options.showBreakdown - Show prompt/completion breakdown
 * @returns {string} Formatted string
 */
export function formatUsage(usage, options = {}) {
  if (!usage || usage.totalTokens === 0) return ''

  const { showBreakdown = false } = options

  if (showBreakdown) {
    return `${formatTokenCount(usage.promptTokens)} in / ${formatTokenCount(usage.completionTokens)} out`
  }

  return formatTokenCount(usage.totalTokens)
}

/**
 * Estimate tokens from text using a simple heuristic
 * Rough estimate: ~4 characters per token for English text
 * @param {string} text - Text to estimate
 * @returns {number} Estimated token count
 */
export function estimateTokens(text) {
  if (!text) return 0
  return Math.ceil(text.length / 4)
}

/**
 * Create usage from estimated values (when API doesn't provide actual usage)
 * @param {string} inputText - Input/prompt text
 * @param {string} outputText - Output/completion text
 * @returns {TokenUsage} Estimated token usage
 */
export function createEstimatedUsage(inputText, outputText) {
  const promptTokens = estimateTokens(inputText)
  const completionTokens = estimateTokens(outputText)
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  }
}
