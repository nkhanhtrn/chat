import { describe, it, expect, vi, beforeEach } from 'vitest'
import { TextResponseCapability } from '../TextResponseCapability.js'

describe('TextResponseCapability', () => {
  let capability
  let mockProvider

  beforeEach(() => {
    capability = new TextResponseCapability()
    mockProvider = {
      sendMessage: vi.fn()
    }
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have correct name', () => {
      expect(capability.name).toBe('text')
    })

    it('should have priority 0 (lowest - fallback)', () => {
      expect(capability.priority).toBe(0)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description for language tasks', () => {
      const desc = capability.getRouterDescription()

      expect(desc.name).toBe('TEXT/LANGUAGE')
      expect(desc.conditions.some(c => c.includes('Translation'))).toBe(true)
      expect(desc.conditions.some(c => c.includes('summarization'))).toBe(true)
      expect(desc.conditions.some(c => c.includes('creative writing'))).toBe(true)
    })

    it('should have empty antiConditions (accepts anything as fallback)', () => {
      const desc = capability.getRouterDescription()

      expect(desc.antiConditions).toEqual([])
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()

      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples.some(e => e.input.includes('translate'))).toBe(true)
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "text"', () => {
      expect(capability.canHandle({ capability: 'text' })).toBe(true)
    })

    it('should handle when canBeCode is false', () => {
      expect(capability.canHandle({ canBeCode: false })).toBe(true)
    })

    it('should handle when codeType is "none"', () => {
      expect(capability.canHandle({ codeType: 'none' })).toBe(true)
    })

    it('should handle as fallback when nothing else matches', () => {
      // No canBeCode and no isVisualization
      expect(capability.canHandle({})).toBe(true)
    })

    it('should not handle code capability', () => {
      expect(capability.canHandle({ capability: 'code', canBeCode: true })).toBe(false)
    })

    it('should not handle visualization capability', () => {
      expect(capability.canHandle({ capability: 'visualization', isVisualization: true })).toBe(false)
    })
  })

  describe('getSystemPrompt', () => {
    it('should return default prompt without web search', () => {
      const prompt = capability.getSystemPrompt({ webSearchResults: [] })

      expect(prompt).toContain('helpful assistant')
      expect(prompt).not.toContain('research assistant')
    })

    it('should return research prompt with web search results', () => {
      const prompt = capability.getSystemPrompt({
        webSearchResults: [{ url: 'http://test.com', content: 'test' }]
      })

      expect(prompt).toContain('research assistant')
      expect(prompt).toContain('summarize')
      expect(prompt).toContain('Source')
    })

    it('should include current date', () => {
      const prompt = capability.getSystemPrompt({ webSearchResults: [] })

      // Should contain a month name
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
      expect(months.some(m => prompt.includes(m))).toBe(true)
    })
  })

  describe('execute', () => {
    it('should send message to LLM provider', async () => {
      mockProvider.sendMessage.mockResolvedValue('LLM response')

      const context = {
        fullContext: 'translate hello to French',
        messages: [{ role: 'user', content: 'translate hello to French' }],
        models: { executorId: 'model-1' },
        config: {},
        provider: mockProvider,
        signal: null,
        onChunk: null,
        webSearchResults: []
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result).toBe('LLM response')
      expect(mockProvider.sendMessage).toHaveBeenCalled()
    })

    it('should include web search context in messages', async () => {
      mockProvider.sendMessage.mockResolvedValue('Summary response')

      const context = {
        fullContext: 'question with web results',
        messages: [{ role: 'user', content: 'what is X?' }],
        models: { executorId: 'model-1' },
        config: {},
        provider: mockProvider,
        signal: null,
        onChunk: null,
        webSearchResults: [{ url: 'http://test.com', content: 'info about X' }]
      }

      await capability.execute(context)

      // Check that system message mentions research
      const callArgs = mockProvider.sendMessage.mock.calls[0]
      const messages = callArgs[1]
      const systemMessage = messages.find(m => m.role === 'system')

      expect(systemMessage.content).toContain('research assistant')
    })

    it('should pass streaming callback', async () => {
      mockProvider.sendMessage.mockResolvedValue('streamed response')
      const onChunk = vi.fn()

      const context = {
        fullContext: 'test',
        messages: [{ role: 'user', content: 'test' }],
        models: { executorId: 'model-1' },
        config: {},
        provider: mockProvider,
        signal: null,
        onChunk,
        webSearchResults: []
      }

      await capability.execute(context)

      const callArgs = mockProvider.sendMessage.mock.calls[0]
      expect(callArgs[2]).toBe(onChunk)
    })

    it('should include metadata about web search', async () => {
      mockProvider.sendMessage.mockResolvedValue('response')

      const context = {
        fullContext: 'test',
        messages: [{ role: 'user', content: 'test' }],
        models: { executorId: 'model-1' },
        config: {},
        provider: mockProvider,
        signal: null,
        onChunk: null,
        webSearchResults: [{ url: 'a' }, { url: 'b' }]
      }

      const result = await capability.execute(context)

      expect(result.metadata.hasWebSearch).toBe(true)
      expect(result.metadata.sourceCount).toBe(2)
    })
  })

  describe('formatOutput', () => {
    it('should format text result', () => {
      const output = capability.formatOutput('hello world', {})

      expect(output.type).toBe('text')
      expect(output.content).toBe('hello world')
      expect(output.displayHint).toBe('plain')
    })

    it('should use research hint when web search was used', () => {
      const output = capability.formatOutput('summary', { hasWebSearch: true })

      expect(output.displayHint).toBe('research')
    })
  })
})
