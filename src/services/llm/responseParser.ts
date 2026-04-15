export interface AnalysisResult {
  capability: string
  canBeCode: boolean
  taskDescription: string
  needsWebSearch: boolean
  searchQuery: string
  inputs: Array<{ name: string; value: string; type: string }>
  isVisualization: boolean
  visualizationType: string | null
  codeType: string
  functionName: string
  expectedOutput: string
}

function normalizeJsonAnalysis(json: Record<string, any>): AnalysisResult {
  let capability = json.capability?.toLowerCase()
  if (!capability) {
    if (json.isVisualization) capability = 'visualization'
    else if (json.canBeCode === true) capability = 'code'
    else if (json.canBeCode === false) capability = 'text'
    else capability = 'text'
  }

  let canBeCode: boolean
  if (json.canBeCode !== undefined) {
    canBeCode = json.canBeCode
  } else {
    canBeCode = capability === 'code' || capability === 'visualization' || capability === 'build'
  }

  return {
    capability,
    canBeCode,
    taskDescription: json.taskDescription ?? json.task ?? '',
    needsWebSearch: json.needsWebSearch ?? false,
    searchQuery: json.searchQuery ?? '',
    inputs: json.inputs ?? [],
    isVisualization: json.isVisualization ?? capability === 'visualization',
    visualizationType: json.visualizationType ?? null,
    codeType: json.codeType ?? 'expression',
    functionName: json.functionName ?? '',
    expectedOutput: json.expectedOutput ?? ''
  }
}

export function tryParseJson(response: string | Record<string, any>): AnalysisResult | null {
  const text = typeof response === 'object' ? response?.content ?? '' : response
  if (!text || typeof text !== 'string') return null

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) return null

  let jsonStr = jsonMatch[0]
  jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1')
  jsonStr = jsonStr.replace(/'/g, '"')

  try {
    const parsed = JSON.parse(jsonStr)
    return normalizeJsonAnalysis(parsed)
  } catch {
    return null
  }
}

function extractFieldsFromText(text: string, result: AnalysisResult): AnalysisResult {
  const taskMatch = text.match(/"taskDescription"\s*:\s*"([^"]+)"/)
  if (taskMatch) result.taskDescription = taskMatch[1]!

  const funcMatch = text.match(/"functionName"\s*:\s*"([^"]+)"/)
  if (funcMatch) result.functionName = funcMatch[1]!

  const capMatch = text.match(/"capability"\s*:\s*"([^"]+)"/)
  if (capMatch) result.capability = capMatch[1]!.toLowerCase()

  const canBeCodeMatch = text.match(/"canBeCode"\s*:\s*(true|false)/)
  if (canBeCodeMatch) {
    result.canBeCode = canBeCodeMatch[1] === 'true'
    if (!capMatch) result.capability = result.canBeCode ? 'code' : 'text'
  }

  const vizMatch = text.match(/"isVisualization"\s*:\s*(true|false)/)
  if (vizMatch) {
    result.isVisualization = vizMatch[1] === 'true'
    if (result.isVisualization) result.capability = 'visualization'
  }

  const vizTypeMatch = text.match(/"visualizationType"\s*:\s*"([^"]+)"/)
  if (vizTypeMatch) result.visualizationType = vizTypeMatch[1]

  if (capMatch) {
    result.canBeCode = result.capability === 'code' || result.capability === 'visualization' || result.capability === 'build'
  }

  return result
}

function parseSingleStep(lines: string[]): AnalysisResult {
  const result: AnalysisResult = {
    capability: 'text',
    canBeCode: true,
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

  let capabilityExplicitlySet = false

  for (const line of lines) {
    const [key, ...valueParts] = line.split(':')
    const value = valueParts.join(':').trim()

    switch (key?.toLowerCase().trim()) {
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

  if (result.capability === 'visualization') result.isVisualization = true
  if (capabilityExplicitlySet) {
    result.canBeCode = result.capability === 'code' || result.capability === 'visualization' || result.capability === 'build'
  }

  return result
}

export function parseAnalysisResponse(response: string | Record<string, any>): AnalysisResult {
  const text = typeof response === 'object' ? response?.content ?? '' : response

  const jsonResult = tryParseJson(response)
  if (jsonResult) return jsonResult

  const lines = text.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('---'))
  const result = parseSingleStep(lines)
  extractFieldsFromText(text, result)

  const lowerResponse = text.toLowerCase()
  if (lowerResponse.includes('language task') || lowerResponse.includes('text task') ||
      lowerResponse.includes('not code') || lowerResponse.includes('cannot be code')) {
    result.canBeCode = false
    result.capability = 'text'
  }

  return result
}
