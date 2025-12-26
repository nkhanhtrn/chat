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

describe('taskRouter line-based parsing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Helper to test parsing by calling analyzeRequest
  const testParsing = async (llmResponse) => {
    vi.mocked(lmstudioProvider.sendMessage).mockResolvedValue(llmResponse)

    const { analyzeRequest } = await import('../taskRouter.js')
    return analyzeRequest('test message', 'model-id', {})
  }

  describe('single-step responses', () => {
    it('should parse capability from line format', async () => {
      const response = `capability: code
task: Calculate sum
`

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
      expect(result.taskDescription).toBe('Calculate sum')
    })

    it('should parse code capability with codeType', async () => {
      const response = `capability: code
task: Write a function
codeType: javascript
`

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
      expect(result.codeType).toBe('javascript')
      expect(result.canBeCode).toBe(true)
    })

    it('should parse visualization capability', async () => {
      const response = `capability: visualization
task: Create a chart
visualizationType: bar
`

      const result = await testParsing(response)

      expect(result.capability).toBe('visualization')
      expect(result.isVisualization).toBe(true)
      expect(result.visualizationType).toBe('bar')
    })

    it('should parse search query', async () => {
      const response = `capability: text
task: Answer question
searchQuery: react hooks tutorial
`

      const result = await testParsing(response)

      expect(result.needsWebSearch).toBe(true)
      expect(result.searchQuery).toBe('react hooks tutorial')
    })

    it('should parse inputs', async () => {
      const response = `capability: code
task: Calculate
input: 42
`

      const result = await testParsing(response)

      expect(result.inputs).toHaveLength(1)
      expect(result.inputs[0].value).toBe('42')
    })
  })

  describe('multi-step plan responses', () => {
    it('should parse multi-step plan', async () => {
      const response = `PLAN: Research and summarize

STEP 1
capability: websearch
task: Search for information
searchQuery: javascript async await

STEP 2
capability: text
task: Summarize results
input: {{step_1_result}}
`

      const result = await testParsing(response)

      expect(result.requiresPlanning).toBe(true)
      expect(result.summary).toBe('Research and summarize')
      expect(result.steps).toHaveLength(2)
      expect(result.steps[0].capability).toBe('websearch')
      expect(result.steps[0].searchQuery).toBe('javascript async await')
      expect(result.steps[1].capability).toBe('text')
    })
  })

  describe('defaults and fallbacks', () => {
    it('should default capability to text', async () => {
      const response = `task: Just respond
`

      const result = await testParsing(response)

      expect(result.capability).toBe('text')
    })

    it('should handle empty response', async () => {
      const result = await testParsing('')

      expect(result).toBeDefined()
      expect(result.capability).toBe('text')
    })

    it('should handle response with only dashes', async () => {
      const response = `---
---
---`

      const result = await testParsing(response)

      expect(result).toBeDefined()
      expect(result.capability).toBe('text')
    })
  })

  describe('edge cases', () => {
    it('should handle colons in values', async () => {
      const response = `capability: code
task: Parse time format like 12:30:45
`

      const result = await testParsing(response)

      expect(result.taskDescription).toBe('Parse time format like 12:30:45')
    })

    it('should handle case insensitive capability names', async () => {
      const response = `CAPABILITY: CODE
TASK: Test
`

      const result = await testParsing(response)

      expect(result.capability).toBe('code')
    })

    it('should handle taskDescription alias', async () => {
      const response = `capability: code
taskDescription: Calculate sum
`

      const result = await testParsing(response)

      expect(result.taskDescription).toBe('Calculate sum')
    })

    it('should handle search alias for searchQuery', async () => {
      const response = `capability: text
search: python tutorials
`

      const result = await testParsing(response)

      expect(result.needsWebSearch).toBe(true)
      expect(result.searchQuery).toBe('python tutorials')
    })
  })
})
