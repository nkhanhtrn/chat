import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchWeb, formatSearchResultsForPrompt } from '../webSearch.js'

// Import the module to access parseDuckDuckGoResults for testing
// We need to test it indirectly through searchWeb or re-export it
// For now, we'll test it through searchWeb's behavior

describe('webSearch', () => {
  let originalFetch
  let consoleWarnSpy

  beforeEach(() => {
    originalFetch = global.fetch
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleWarnSpy.mockRestore()
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
    it('should search and return parsed results', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage1">Example Page 1</a>
              <div class="result__snippet">This is snippet 1</div>
            </div>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Fpage2">Example Page 2</a>
              <div class="result__snippet">This is snippet 2</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

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

    it('should respect maxResults option', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F1">Result 1</a>
              <div class="result__snippet">Snippet 1</div>
            </div>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F2">Result 2</a>
              <div class="result__snippet">Snippet 2</div>
            </div>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F3">Result 3</a>
              <div class="result__snippet">Snippet 3</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test query', { maxResults: 2 })

      expect(results).toHaveLength(2)
      expect(results[0].url).toBe('https://example.com/1')
      expect(results[1].url).toBe('https://example.com/2')
    })

    it('should try next proxy when first fails', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Test</a>
              <div class="result__snippet">Snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('First proxy failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const results = await searchWeb('test')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(results).toHaveLength(1)
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed:'),
        expect.any(String)
      )
    })

    it('should throw error when all proxies fail', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('All proxies down'))

      await expect(searchWeb('test'))
        .rejects.toThrow('Web search failed:')

      // Should have tried all proxies (2 proxies defined)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle HTTP error responses', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Test</a>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const results = await searchWeb('test')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(results).toHaveLength(1)
    })

    it('should use fallback parsing when no result elements found', async () => {
      // Fallback looks for <a href*="http"> links, so the href must contain "http"
      // and the text must be >= 10 chars, and url must start with http after extraction
      const mockHtml = `
        <html>
          <body>
            <a href="https://example.com/page?uddg=https%3A%2F%2Freal-result.com">This is a longer link text for search</a>
            <a href="https://duckduckgo.com/something">DDG Link</a>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test')

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://real-result.com')
      expect(results[0].title).toBe('This is a longer link text for search')
      expect(results[0].snippet).toBe('')
    })

    it('should skip DDG internal links in fallback parsing', async () => {
      // Fallback selector is a[href*="http"] so we need http in the href
      const mockHtml = `
        <html>
          <body>
            <a href="https://duckduckgo.com/about">About DDG - Long Enough Text</a>
            <a href="https://duckduckgo.com/privacy">Privacy Policy Info</a>
            <a href="https://redirect.com/l/?uddg=https%3A%2F%2Freal-result.com">Real Result That Is Long Enough</a>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test')

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://real-result.com')
    })

    it('should try next proxy when no results are parsed', async () => {
      const emptyHtml = '<html><body></body></html>'
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Test Result</a>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(emptyHtml)
        })
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const results = await searchWeb('test')

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(results).toHaveLength(1)
    })

    it('should encode query in search URL', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Test</a>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      await searchWeb('hello world & special chars')

      // The search URL is: html.duckduckgo.com/html/?q=<encoded_query>
      // Then that whole URL is encoded again for the proxy
      // So we check that the fetch URL contains the encoded search term (inside the double-encoded URL)
      const fetchUrl = global.fetch.mock.calls[0][0]
      // Decode the proxy URL to check the inner search URL contains the query
      expect(fetchUrl).toContain('duckduckgo.com')
      // The query "hello world & special chars" gets encoded to "hello%20world%20%26%20special%20chars"
      // Then that gets encoded again for the proxy, becoming "hello%2520world%2520%2526%2520special%2520chars"
      expect(fetchUrl).toContain('hello%2520world')
    })

    it('should handle URLs without uddg redirect', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="https://direct-url.com/page">Direct Link</a>
              <div class="result__snippet">Direct snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test')

      expect(results).toHaveLength(1)
      expect(results[0].url).toBe('https://direct-url.com/page')
    })

    it('should limit results to 10 maximum', async () => {
      // Generate 15 result elements
      const resultsHtml = Array.from({ length: 15 }, (_, i) => `
        <div class="result">
          <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2F${i}">Result ${i}</a>
          <div class="result__snippet">Snippet ${i}</div>
        </div>
      `).join('')

      const mockHtml = `<html><body>${resultsHtml}</body></html>`

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      // Request more than internal limit
      const results = await searchWeb('test', { maxResults: 15 })

      // Should be limited to 10 by parseDuckDuckGoResults
      expect(results.length).toBeLessThanOrEqual(10)
    })

    it('should parse results_links class elements', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="results_links">
              <a class="result-link" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com%2Falt">Alt Result</a>
              <div class="result-snippet">Alt snippet</div>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Alt Result')
      expect(results[0].snippet).toBe('Alt snippet')
    })

    it('should skip results without title or URL', async () => {
      const mockHtml = `
        <html>
          <body>
            <div class="result">
              <a class="result__a" href="">No URL</a>
            </div>
            <div class="result">
              <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fexample.com">Valid</a>
            </div>
          </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const results = await searchWeb('test')

      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Valid')
    })
  })

  describe('timeout handling', () => {
    it('should convert abort error to timeout message', async () => {
      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'

      // Mock fetch to immediately reject with AbortError
      global.fetch = vi.fn().mockRejectedValue(abortError)

      await expect(searchWeb('test')).rejects.toThrow('Web search failed: Request timeout')
    })
  })
})
