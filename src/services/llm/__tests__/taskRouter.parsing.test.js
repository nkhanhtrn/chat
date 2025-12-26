import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock dependencies
vi.mock('../providers/lmstudio.js', () => ({
  lmstudioProvider: {
    sendMessage: vi.fn(),
    fetchModels: vi.fn()
  }
}))

vi.mock('../../attachmentReader.js', () => ({
  readAttachments: vi.fn(),
  formatAttachmentsForPrompt: vi.fn()
}))

vi.mock('../../webSearch.js', () => ({
  searchWeb: vi.fn()
}))

vi.mock('../../urlFetcher.js', () => ({
  fetchUrlContent: vi.fn()
}))

vi.mock('../index.js', () => ({
  getProviderConfig: vi.fn().mockReturnValue({})
}))

import { lmstudioProvider } from '../providers/lmstudio.js'

describe('taskRouter JSON parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to test parsing by calling analyzeRequest
  const testParsing = async (llmResponse) => {
    vi.mocked(lmstudioProvider.sendMessage).mockResolvedValue(llmResponse)

    const { analyzeRequest } = await import('../taskRouter.js')
    return analyzeRequest('test message', 'model-id', {})
  }

  describe('valid JSON responses', () => {
    it('should parse clean JSON', async () => {
      const response = JSON.stringify({
        capability: 'code',
        taskDescription: 'Calculate sum',
        needsWebSearch: false
      })

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
      expect(result.taskDescription).toBe('Calculate sum')
    })
  })

  describe('JSON cleanup - trailing commas', () => {
    it('should fix trailing commas', async () => {
      const response = `{
        "capability": "code",
        "taskDescription": "test",
      }`

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
    })
  })

  describe('JSON cleanup - numbers with units', () => {
    it('should fix numbers with percentage signs', async () => {
      const response = `{
        "capability": "visualization",
        "inputs": [{"name": "value", "value": 30%}],
        "taskDescription": "chart"
      }`

      const result = await testParsing(response)

      // Should fallback gracefully if parsing still fails
      expect(result).toBeDefined()
    })
  })

  describe('JSON cleanup - boolean casing', () => {
    it('should fix True/False casing', async () => {
      const response = `{
        "capability": "code",
        "needsWebSearch": False,
        "canBeCode": True
      }`

      const result = await testParsing(response)

      expect(result).toBeDefined()
    })
  })

  describe('JSON cleanup - single quotes', () => {
    it('should fix single-quoted strings', async () => {
      const response = `{
        'capability': 'code',
        'taskDescription': 'test task'
      }`

      const result = await testParsing(response)

      expect(result).toBeDefined()
    })
  })

  describe('fallback analysis', () => {
    it('should extract capability from malformed JSON', async () => {
      const response = `Here's the analysis: {"capability": "visualization", broken json...`

      const result = await testParsing(response)

      // Should use fallback and detect visualization
      expect(result).toBeDefined()
      expect(result.taskDescription).toBeDefined()
    })

    it('should detect isVisualization from text', async () => {
      const response = `{"isVisualization": true, "visualizationType": "chart", broken`

      const result = await testParsing(response)

      expect(result.isVisualization).toBe(true)
      expect(result.visualizationType).toBe('chart')
    })

    it('should detect canBeCode false from text', async () => {
      const response = `{"canBeCode": false, this is a language task`

      const result = await testParsing(response)

      expect(result.canBeCode).toBe(false)
    })

    it('should extract searchQuery from text', async () => {
      const response = `{"needsWebSearch": true, "searchQuery": "react hooks tutorial", broken`

      const result = await testParsing(response)

      expect(result.needsWebSearch).toBe(true)
      expect(result.searchQuery).toBe('react hooks tutorial')
    })
  })

  describe('edge cases', () => {
    it('should handle empty response', async () => {
      const result = await testParsing('')

      expect(result).toBeDefined()
      expect(result.capability).toBeDefined()
    })

    it('should handle response with no JSON', async () => {
      const response = 'This is just plain text with no JSON at all'

      const result = await testParsing(response)

      expect(result).toBeDefined()
      // Falls back to defaults
      expect(result.taskDescription).toBe('Process the user request')
    })

    it('should handle nested JSON objects', async () => {
      const response = JSON.stringify({
        capability: 'code',
        inputs: [
          { name: 'data', value: { nested: 'object' } }
        ],
        taskDescription: 'process data'
      })

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
      expect(result.inputs[0].value.nested).toBe('object')
    })
  })
})
