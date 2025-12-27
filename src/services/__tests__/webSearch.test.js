import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchWeb, formatSearchResultsForPrompt } from '../webSearch.js'

// Mock the urlFetcher module
vi.mock('../urlFetcher.js', () => ({
  fetchUrlContent: vi.fn()
}))

import { fetchUrlContent } from '../urlFetcher.js'

describe('webSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('formatSearchResultsForPrompt', () => {
    it('should format search results with numbered list', () => {
      const results = [
        { title: 'First Result', url: 'https://example.com/1', snippet: 'This is the first snippet' },
        { title: 'Second Result', url: 'https://example.com/2', snippet: 'This is the second snippet' }
      ]

      const formatted = formatSearchResultsForPrompt(results)

      expect(formatted).toContain('--- Web Search Results ---')
      expect(formatted).toContain('1. First Result')
      expect(formatted).toContain('URL: https://example.com/1')
      expect(formatted).toContain('This is the first snippet')
      expect(formatted).toContain('2. Second Result')
      expect(formatted).toContain('URL: https://example.com/2')
      expect(formatted).toContain('--- End of Search Results ---')
    })

    it('should handle results without snippets', () => {
      const results = [
        { title: 'No Snippet Result', url: 'https://example.com/no-snippet', snippet: '' }
      ]

      const formatted = formatSearchResultsForPrompt(results)

      expect(formatted).toContain('1. No Snippet Result')
      expect(formatted).toContain('URL: https://example.com/no-snippet')
      expect(formatted).not.toMatch(/URL: https:\/\/example\.com\/no-snippet\n\s+\n/)
    })

    it('should return empty string for empty results', () => {
      expect(formatSearchResultsForPrompt([])).toBe('')
      expect(formatSearchResultsForPrompt(null)).toBe('')
      expect(formatSearchResultsForPrompt(undefined)).toBe('')
    })
  })

  describe('searchWeb', () => {
    // Mock DDG HTML response
    const mockDDGHtml = `
      <html>
        <body>
          <div class="result">
            <a class="result__a" href="https://example.com/page1">Example Page 1</a>
            <div class="result__snippet">This is snippet 1</div>
          </div>
          <div class="result">
            <a class="result__a" href="https://example.com/page2">Example Page 2</a>
            <div class="result__snippet">This is snippet 2</div>
          </div>
        </body>
      </html>
    `

    // Mock Brave HTML response
    const mockBraveHtml = `
      <html>
        <body>
          <div data-type="web">
            <a class="result-header" href="https://brave-result.com/1">Brave Result 1</a>
            <div class="snippet-description">Brave snippet 1</div>
          </div>
        </body>
      </html>
    `

    it('should search and return results from DuckDuckGo', async () => {
      fetchUrlContent.mockResolvedValueOnce(mockDDGHtml)

      const results = await searchWeb('test query')

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({
        title: 'Example Page 1',
        url: 'https://example.com/page1',
        snippet: 'This is snippet 1'
      })
      expect(results[1]).toEqual({
        title: 'Example Page 2',
        url: 'https://example.com/page2',
        snippet: 'This is snippet 2'
      })
    })

    it('should fall back to Brave when DDG fails', async () => {
      fetchUrlContent
        .mockRejectedValueOnce(new Error('DDG failed'))
        .mockResolvedValueOnce(mockBraveHtml)

      const results = await searchWeb('test query')

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://brave-result.com/1')
      expect(fetchUrlContent).toHaveBeenCalledTimes(2)
    })

    it('should call DDG URL first', async () => {
      fetchUrlContent.mockResolvedValueOnce(mockDDGHtml)

      await searchWeb('hello world')

      expect(fetchUrlContent).toHaveBeenCalledWith(
        'https://html.duckduckgo.com/html/?q=hello%20world'
      )
    })

    it('should throw error when all search engines fail', async () => {
      fetchUrlContent
        .mockRejectedValueOnce(new Error('DDG failed'))
        .mockRejectedValueOnce(new Error('Brave failed'))

      await expect(searchWeb('test')).rejects.toThrow('Search failed')
    })

    it('should throw error when no results found', async () => {
      // Return empty HTML with no results
      fetchUrlContent
        .mockResolvedValueOnce('<html><body></body></html>')
        .mockResolvedValueOnce('<html><body></body></html>')

      await expect(searchWeb('test')).rejects.toThrow('Search failed')
    })

    it('should respect maxResults option', async () => {
      const manyResultsHtml = `
        <html>
          <body>
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="result">
                <a class="result__a" href="https://example.com/page${i}">Result ${i}</a>
                <div class="result__snippet">Snippet ${i}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `

      fetchUrlContent.mockResolvedValueOnce(manyResultsHtml)

      const results = await searchWeb('test query', { maxResults: 3 })

      expect(results).toHaveLength(3)
    })

    it('should use default maxResults of 5', async () => {
      const manyResultsHtml = `
        <html>
          <body>
            ${Array.from({ length: 10 }, (_, i) => `
              <div class="result">
                <a class="result__a" href="https://example.com/page${i}">Result ${i}</a>
                <div class="result__snippet">Snippet ${i}</div>
              </div>
            `).join('')}
          </body>
        </html>
      `

      fetchUrlContent.mockResolvedValueOnce(manyResultsHtml)

      const results = await searchWeb('test query')

      expect(results).toHaveLength(5)
    })

    it('should handle DDG redirect URLs', async () => {
      const ddgWithRedirects = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Freal-site.com%2Fpage">Redirected Result</a>
              <div class="result__snippet">Snippet for redirect</div>
            </div>
          </body>
        </html>
      `

      fetchUrlContent.mockResolvedValueOnce(ddgWithRedirects)

      const results = await searchWeb('test')

      expect(results[0].url).toBe('https://real-site.com/page')
    })
  })
})
