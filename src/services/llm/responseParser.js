/**
 * Response Parser
 *
 * Parses router model responses into structured analysis data.
 * Handles both JSON and line-based response formats.
 */

/**
 * Try to extract and parse JSON from a response that may contain extra text
 * @param {string|Object} response - Raw response text or object with content
 * @returns {Object|null} Parsed JSON or null
 */
export const tryParseJson = (response) => {
  // Handle object response (from provider.send)
  const text = typeof response === 'object' ? response?.content || '' : response
  if (!text || typeof text !== 'string') return null

  // Try to extract JSON from the response
  const jsonMatch = text.match(/\{[\s\S]*\}/)
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
 * Supports both new capability-based format and legacy canBeCode format
 * @param {Object} json - Parsed JSON object
 * @returns {Object} Normalized analysis object
 */
export const normalizeJsonAnalysis = (json) => {
  // Determine capability from either the new 'capability' field or legacy 'canBeCode'
  let capability = json.capability?.toLowerCase()
  if (!capability) {
    if (json.isVisualization) {
      capability = 'visualization'
    } else if (json.canBeCode === true) {
      capability = 'code'
    } else if (json.canBeCode === false) {
      capability = 'text'
    } else {
      capability = 'text'
    }
  }

  // canBeCode: use the JSON value if provided, otherwise derive from capability
  // For backwards compatibility, default to true if not explicitly set
  let canBeCode
  if (json.canBeCode !== undefined) {
    canBeCode = json.canBeCode
  } else {
    canBeCode = capability === 'code' || capability === 'visualization' || capability === 'build'
  }

  return {
    capability,
    canBeCode, // Legacy field for backwards compatibility
    taskDescription: json.taskDescription || json.task || '',
    needsWebSearch: json.needsWebSearch || false,
    searchQuery: json.searchQuery || '',
    inputs: json.inputs || [],
    isVisualization: json.isVisualization || capability === 'visualization',
    visualizationType: json.visualizationType || null,
    codeType: json.codeType || 'expression',
    functionName: json.functionName || '',
    expectedOutput: json.expectedOutput || ''
  }
}

/**
 * Extract field values from text using regex patterns (for malformed JSON)
 * @param {string} text - Text to extract from
 * @param {Object} result - Result object to populate
 * @returns {Object} Updated result object
 */
export const extractFieldsFromText = (text, result) => {
  // Extract taskDescription
  const taskMatch = text.match(/"taskDescription"\s*:\s*"([^"]+)"/)
  if (taskMatch) result.taskDescription = taskMatch[1]

  // Extract functionName
  const funcMatch = text.match(/"functionName"\s*:\s*"([^"]+)"/)
  if (funcMatch) result.functionName = funcMatch[1]

  // Extract capability
  const capMatch = text.match(/"capability"\s*:\s*"([^"]+)"/)
  if (capMatch) result.capability = capMatch[1].toLowerCase()

  // Extract canBeCode (legacy field)
  const canBeCodeMatch = text.match(/"canBeCode"\s*:\s*(true|false)/)
  if (canBeCodeMatch) {
    result.canBeCode = canBeCodeMatch[1] === 'true'
    // Also set capability based on canBeCode if not already set
    if (!capMatch) {
      result.capability = result.canBeCode ? 'code' : 'text'
    }
  }

  // Extract isVisualization
  const vizMatch = text.match(/"isVisualization"\s*:\s*(true|false)/)
  if (vizMatch) {
    result.isVisualization = vizMatch[1] === 'true'
    if (result.isVisualization) result.capability = 'visualization'
  }

  // Extract visualizationType
  const vizTypeMatch = text.match(/"visualizationType"\s*:\s*"([^"]+)"/)
  if (vizTypeMatch) result.visualizationType = vizTypeMatch[1]

  // Only update canBeCode based on capability if it was explicitly set via capMatch
  // Don't override the default value when parsing failed
  if (capMatch) {
    result.canBeCode = result.capability === 'code' || result.capability === 'visualization' || result.capability === 'build'
  }

  return result
}

/**
 * Parse single-step response from line-based format
 * @param {string[]} lines - Array of lines to parse
 * @returns {Object} Parsed analysis object
 */
export const parseSingleStep = (lines) => {
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
    expectedOutput: '',
    canBeCode: true  // Default to true for safety when parsing fails or is ambiguous
  }

  let capabilityExplicitlySet = false

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':')
    const value = valueParts.join(':').trim()

    switch (key.toLowerCase().trim()) {
      case 'capability':
        result.capability = value.toLowerCase()
        capabilityExplicitlySet = true
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

  // Update canBeCode based on capability if it was explicitly set
  if (capabilityExplicitlySet) {
    result.canBeCode = result.capability === 'code' || result.capability === 'visualization' || result.capability === 'build'
  }

  return result
}

/**
 * Parse router's response into structured data
 * Tries JSON first, then falls back to line-based parsing
 * @param {string|Object} response - Raw response from router model
 * @returns {Object} Parsed analysis object
 */
export const parseAnalysisResponse = (response) => {
  // Handle object response (from provider.send)
  const text = typeof response === 'object' ? response?.content || '' : response

  console.log('[Router] Raw response:\n', text)

  // Try JSON parsing first
  const jsonResult = tryParseJson(response)
  if (jsonResult) {
    console.log('[Router] Parsed as JSON:', jsonResult)
    return jsonResult
  }

  // Fall back to line-based parsing
  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'))

  // Try line-based parsing
  const result = parseSingleStep(lines)

  // Also try to extract fields from malformed JSON in the response
  extractFieldsFromText(text, result)

  // Detect language/text tasks from fallback text content
  const lowerResponse = text.toLowerCase()
  if (lowerResponse.includes('language task') ||
      lowerResponse.includes('text task') ||
      lowerResponse.includes('not code') ||
      lowerResponse.includes('cannot be code')) {
    result.canBeCode = false
    result.capability = 'text'
  }

  console.log('[Router] Parsed as lines:', result)
  return result
}

export default {
  tryParseJson,
  normalizeJsonAnalysis,
  extractFieldsFromText,
  parseSingleStep,
  parseAnalysisResponse
}
