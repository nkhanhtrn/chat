import { describe, it, expect, vi, beforeEach } from 'vitest'
import { WebSearchCapability } from '../WebSearchCapability.js'
import { createPipeData } from '../BaseCapability.js'
import { searchWeb } from '../../../webSearch.js'
import { fetchUrlContent, cleanHtml } from '../../../urlFetcher.js'

vi.mock('../../../webSearch.js', () => ({
  searchWeb: vi.fn()
}))

vi.mock('../../../urlFetcher.js', () => ({
  fetchUrlContent: vi.fn(),
  cleanHtml: vi.fn(html => html)
}))

describe('WebSearchCapability', () => {
  let capability

  beforeEach(() => {
    capability = new WebSearchCapability()
    vi.clearAllMocks()
  })

  describe('properties', () => {
    it('should have name "websearch"', () => {
      expect(capability.name).toBe('websearch')
    })

    it('should have priority 70', () => {
      expect(capability.priority).toBe(70)
    })
  })

  describe('getRouterDescription', () => {
    it('should return description with name', () => {
      const desc = capability.getRouterDescription()

      expect(desc.name).toBe('websearch')
    })

    it('should include description about current information', () => {
      const desc = capability.getRouterDescription()

      expect(desc.description).toContain('CURRENT information')
      expect(desc.description).toContain('real-time')
    })

    it('should include conditions for web search', () => {
      const desc = capability.getRouterDescription()

      expect(desc.conditions).toBeDefined()
      expect(desc.conditions.length).toBeGreaterThan(0)
      expect(desc.conditions.some(c => c.toLowerCase().includes('current') || c.toLowerCase().includes('recent'))).toBe(true)
    })

    it('should include examples', () => {
      const desc = capability.getRouterDescription()

      expect(desc.examples.length).toBeGreaterThan(0)
      expect(desc.examples[0]).toHaveProperty('input')
    })
  })

  describe('canHandle', () => {
    it('should handle when capability is "websearch"', () => {
      expect(capability.canHandle({ capability: 'websearch' })).toBe(true)
    })

    it('should handle when needsWebSearch is true with searchQuery', () => {
      expect(capability.canHandle({
        needsWebSearch: true,
        searchQuery: 'test query'
      })).toBeTruthy()
    })

    it('should not handle when needsWebSearch is true but no searchQuery', () => {
      expect(capability.canHandle({ needsWebSearch: true })).toBeFalsy()
    })

    it('should not handle other capabilities', () => {
      expect(capability.canHandle({ capability: 'text' })).toBe(false)
      expect(capability.canHandle({ capability: 'code' })).toBe(false)
    })

    it('should not handle empty analysis', () => {
      expect(capability.canHandle({})).toBe(false)
    })
  })

  describe('getSystemPrompt', () => {
    it('should return web search assistant prompt', () => {
      const prompt = capability.getSystemPrompt()

      expect(prompt).toContain('web search assistant')
    })
  })

  describe('receiveInput', () => {
    it('should extract data and context from pipe input', () => {
      const pipeInput = createPipeData('previous data', 'prev')
      const context = { analysis: { searchQuery: 'test' } }

      const result = capability.receiveInput(pipeInput, context)

      expect(result.data).toBe('previous data')
      expect(result.context).toBe(context)
    })

    it('should handle null pipe input', () => {
      const context = { analysis: {} }

      const result = capability.receiveInput(null, context)

      expect(result.data).toBeNull()
      expect(result.context).toBe(context)
    })
  })

  describe('process', () => {
    const mockSearchResults = [
      { url: 'https://example.com/1', title: 'Result 1', snippet: 'Snippet 1' },
      { url: 'https://example.com/2', title: 'Result 2', snippet: 'Snippet 2' }
    ]

    beforeEach(() => {
      searchWeb.mockResolvedValue(mockSearchResults)
      fetchUrlContent.mockResolvedValue('<html>content</html>')
      cleanHtml.mockImplementation(html => 'cleaned content')
    })

    it('should search web with query from analysis', async () => {
      const input = {
        context: {
          analysis: { searchQuery: 'bitcoin price' }
        }
      }

      await capability.process(input)

      expect(searchWeb).toHaveBeenCalledWith('bitcoin price', { maxResults: 3 })
    })

    it('should fall back to taskDescription if no searchQuery', async () => {
      const input = {
        context: {
          analysis: { taskDescription: 'find weather' }
        }
      }

      await capability.process(input)

      expect(searchWeb).toHaveBeenCalledWith('find weather', { maxResults: 3 })
    })

    it('should fetch content for each search result', async () => {
      const input = {
        context: { analysis: { searchQuery: 'test' } }
      }

      await capability.process(input)

      expect(fetchUrlContent).toHaveBeenCalledTimes(2)
      expect(fetchUrlContent).toHaveBeenCalledWith('https://example.com/1')
      expect(fetchUrlContent).toHaveBeenCalledWith('https://example.com/2')
    })

    it('should clean fetched HTML content', async () => {
      const input = {
        context: { analysis: { searchQuery: 'test' } }
      }

      await capability.process(input)

      expect(cleanHtml).toHaveBeenCalledWith('<html>content</html>')
    })

    it('should return success with fetched results', async () => {
      const input = {
        context: { analysis: { searchQuery: 'test' } }
      }

      const result = await capability.process(input)

      expect(result.success).toBe(true)
      expect(result.result).toHaveLength(2)
      expect(result.result[0]).toMatchObject({
        url: 'https://example.com/1',
        title: 'Result 1',
        content: 'cleaned content',
        success: true
      })
      expect(result.metadata.query).toBe('test')
      expect(result.metadata.resultCount).toBe(2)
    })

    it('should handle fetch errors gracefully', async () => {
      fetchUrlContent.mockRejectedValueOnce(new Error('Network error'))
      fetchUrlContent.mockResolvedValueOnce('<html>ok</html>')

      const input = {
        context: { analysis: { searchQuery: 'test' } }
      }

      const result = await capability.process(input)

      expect(result.success).toBe(true)
      expect(result.result[0]).toMatchObject({
        url: 'https://example.com/1',
        content: 'Snippet 1',
        success: false,
        error: 'Network error'
      })
      expect(result.result[1].success).toBe(true)
    })

    it('should return error when search fails', async () => {
      searchWeb.mockRejectedValue(new Error('Search API error'))

      const input = {
        context: { analysis: { searchQuery: 'test' } }
      }

      const result = await capability.process(input)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Search API error')
      expect(result.result).toBeNull()
    })

    it('should abort when signal is aborted', async () => {
      const abortController = new AbortController()
      abortController.abort()

      const input = {
        context: {
          analysis: { searchQuery: 'test' },
          signal: abortController.signal
        }
      }

      const result = await capability.process(input)

      expect(result.success).toBe(false)
      expect(result.error).toBe('Aborted')
    })

    describe('callbacks', () => {
      it('should call onWebSearchStart with query', async () => {
        const onWebSearchStart = vi.fn()
        const input = {
          context: {
            analysis: { searchQuery: 'bitcoin' },
            callbacks: { onWebSearchStart }
          }
        }

        await capability.process(input)

        expect(onWebSearchStart).toHaveBeenCalledWith('bitcoin')
      })

      it('should call onWebSearchProgress after search', async () => {
        const onWebSearchProgress = vi.fn()
        const input = {
          context: {
            analysis: { searchQuery: 'test' },
            callbacks: { onWebSearchProgress }
          }
        }

        await capability.process(input)

        expect(onWebSearchProgress).toHaveBeenCalledWith({
          phase: 'search_complete',
          resultsCount: 2,
          results: expect.arrayContaining([
            expect.objectContaining({ url: 'https://example.com/1' })
          ])
        })
      })

      it('should call onWebSearchResult for each result', async () => {
        const onWebSearchResult = vi.fn()
        const input = {
          context: {
            analysis: { searchQuery: 'test' },
            callbacks: { onWebSearchResult }
          }
        }

        await capability.process(input)

        expect(onWebSearchResult).toHaveBeenCalledTimes(2)
        expect(onWebSearchResult).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'https://example.com/1' }),
          0
        )
        expect(onWebSearchResult).toHaveBeenCalledWith(
          expect.objectContaining({ url: 'https://example.com/2' }),
          1
        )
      })

      it('should call onWebSearchComplete with all results', async () => {
        const onWebSearchComplete = vi.fn()
        const input = {
          context: {
            analysis: { searchQuery: 'test' },
            callbacks: { onWebSearchComplete }
          }
        }

        await capability.process(input)

        expect(onWebSearchComplete).toHaveBeenCalledWith(
          expect.arrayContaining([
            expect.objectContaining({ url: 'https://example.com/1' }),
            expect.objectContaining({ url: 'https://example.com/2' })
          ])
        )
      })

      it('should call onWebSearchProgress with error on failure', async () => {
        searchWeb.mockRejectedValue(new Error('API down'))
        const onWebSearchProgress = vi.fn()
        const input = {
          context: {
            analysis: { searchQuery: 'test' },
            callbacks: { onWebSearchProgress }
          }
        }

        await capability.process(input)

        expect(onWebSearchProgress).toHaveBeenCalledWith({
          phase: 'error',
          error: 'API down'
        })
      })

      it('should handle missing callbacks gracefully', async () => {
        const input = {
          context: {
            analysis: { searchQuery: 'test' },
            callbacks: {}
          }
        }

        await expect(capability.process(input)).resolves.not.toThrow()
      })

      it('should handle undefined callbacks object', async () => {
        const input = {
          context: {
            analysis: { searchQuery: 'test' }
          }
        }

        await expect(capability.process(input)).resolves.not.toThrow()
      })
    })
  })

  describe('produceOutput', () => {
    it('should create pipe data from successful result', () => {
      const processResult = {
        success: true,
        result: [{ url: 'http://test.com', content: 'data' }],
        error: null
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual([{ url: 'http://test.com', content: 'data' }])
      expect(output.source).toBe('websearch')
    })

    it('should create error pipe data from failed result', () => {
      const processResult = {
        success: false,
        result: null,
        error: 'Search failed'
      }

      const output = capability.produceOutput(processResult)

      expect(output.data).toEqual({ error: 'Search failed' })
      expect(output.source).toBe('websearch')
    })
  })

  describe('getChainTo', () => {
    it('should chain to text capability on success', () => {
      const processResult = { success: true, result: [] }

      expect(capability.getChainTo(processResult, {})).toBe('text')
    })

    it('should not chain on failure', () => {
      const processResult = { success: false, error: 'Failed' }

      expect(capability.getChainTo(processResult, {})).toBeNull()
    })
  })

  describe('formatOutput', () => {
    it('should format results as websearch type', () => {
      const results = [
        { url: 'http://a.com', content: 'A' },
        { url: 'http://b.com', content: 'B' }
      ]

      const output = capability.formatOutput(results)

      expect(output.type).toBe('websearch')
      expect(output.content).toBe(results)
      expect(output.displayHint).toBe('sources')
    })

    it('should handle null result', () => {
      const output = capability.formatOutput(null)

      expect(output.type).toBe('text')
      expect(output.content).toBe('No results')
      expect(output.displayHint).toBe('plain')
    })

    it('should handle non-array result', () => {
      const output = capability.formatOutput('not an array')

      expect(output.type).toBe('text')
      expect(output.content).toBe('No results')
    })

    it('should handle empty array', () => {
      const output = capability.formatOutput([])

      expect(output.type).toBe('websearch')
      expect(output.content).toEqual([])
      expect(output.displayHint).toBe('sources')
    })
  })

  describe('execute integration', () => {
    beforeEach(() => {
      searchWeb.mockResolvedValue([
        { url: 'https://test.com', title: 'Test', snippet: 'Test snippet' }
      ])
      fetchUrlContent.mockResolvedValue('<p>Test content</p>')
      cleanHtml.mockReturnValue('Test content')
    })

    it('should execute full pipe flow', async () => {
      const context = {
        analysis: { searchQuery: 'test query' }
      }

      const result = await capability.execute(context)

      expect(result.success).toBe(true)
      expect(result.result).toHaveLength(1)
      expect(result.pipe.source).toBe('websearch')
      expect(result.chainTo).toBe('text')
    })

    it('should work with pipe input', async () => {
      const context = {
        analysis: { searchQuery: 'test' }
      }
      const pipeInput = createPipeData('previous data', 'previous')

      const result = await capability.execute(context, pipeInput)

      expect(result.success).toBe(true)
    })
  })
})
