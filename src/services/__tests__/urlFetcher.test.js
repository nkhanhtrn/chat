import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectUrls,
  extractTextFromHtml,
  fetchUrlContent,
  fetchMultipleUrls,
  formatFetchedContentForPrompt,
  resetProxyIndex,
  getProxyCount
} from '../urlFetcher.js'

describe('urlFetcher', () => {
  describe('detectUrls', () => {
    it('should detect a single HTTP URL', () => {
      const text = 'Check out http://example.com for more info'
      expect(detectUrls(text)).toEqual(['http://example.com'])
    })

    it('should detect a single HTTPS URL', () => {
      const text = 'Visit https://example.com/page'
      expect(detectUrls(text)).toEqual(['https://example.com/page'])
    })

    it('should detect multiple URLs', () => {
      const text = 'See https://foo.com and https://bar.com/path'
      expect(detectUrls(text)).toEqual(['https://foo.com', 'https://bar.com/path'])
    })

    it('should remove duplicate URLs', () => {
      const text = 'https://example.com and again https://example.com'
      expect(detectUrls(text)).toEqual(['https://example.com'])
    })

    it('should return empty array for text without URLs', () => {
      const text = 'No URLs here, just plain text'
      expect(detectUrls(text)).toEqual([])
    })

    it('should handle URLs with query parameters', () => {
      const text = 'https://example.com/search?q=test&page=1'
      expect(detectUrls(text)).toEqual(['https://example.com/search?q=test&page=1'])
    })

    it('should handle URLs with fragments', () => {
      const text = 'https://example.com/page#section'
      expect(detectUrls(text)).toEqual(['https://example.com/page#section'])
    })

    it('should handle URLs with ports', () => {
      const text = 'http://localhost:3000/api'
      expect(detectUrls(text)).toEqual(['http://localhost:3000/api'])
    })

    it('should not match invalid URLs', () => {
      const text = 'not a url: example.com or ftp://other.com'
      expect(detectUrls(text)).toEqual([])
    })

    it('should handle URLs at end of sentence', () => {
      const text = 'Visit https://example.com.'
      const urls = detectUrls(text)
      expect(urls.length).toBe(1)
      expect(urls[0]).toMatch(/^https:\/\/example\.com/)
    })
  })

  describe('extractTextFromHtml', () => {
    it('should extract text from simple HTML', () => {
      const html = '<p>Hello World</p>'
      expect(extractTextFromHtml(html)).toBe('Hello World')
    })

    it('should remove script tags', () => {
      const html = '<p>Text</p><script>alert("evil")</script>'
      expect(extractTextFromHtml(html)).toBe('Text')
    })

    it('should remove style tags', () => {
      const html = '<style>.foo { color: red; }</style><p>Content</p>'
      expect(extractTextFromHtml(html)).toBe('Content')
    })

    it('should remove nav, header, footer, aside elements', () => {
      const html = `
        <nav>Navigation</nav>
        <header>Header</header>
        <main>Main Content</main>
        <aside>Sidebar</aside>
        <footer>Footer</footer>
      `
      expect(extractTextFromHtml(html)).toBe('Main Content')
    })

    it('should prefer main content selectors', () => {
      const html = `
        <div>Other stuff</div>
        <article>Article content here</article>
      `
      expect(extractTextFromHtml(html)).toBe('Article content here')
    })

    it('should collapse whitespace', () => {
      const html = '<p>Text   with    extra   spaces</p>'
      expect(extractTextFromHtml(html)).toBe('Text with extra spaces')
    })

    it('should handle empty HTML', () => {
      expect(extractTextFromHtml('')).toBe('')
    })

    it('should remove noscript and iframe elements', () => {
      const html = '<p>Visible</p><noscript>No JS</noscript><iframe src="x"></iframe>'
      expect(extractTextFromHtml(html)).toBe('Visible')
    })
  })

  describe('fetchUrlContent', () => {
    let originalFetch

    // Helper to create mock headers
    function createMockHeaders(contentType) {
      return {
        get: (name) => name.toLowerCase() === 'content-type' ? contentType : null
      }
    }

    beforeEach(() => {
      originalFetch = global.fetch
      resetProxyIndex() // Reset to allorigins (first proxy, returns data.contents)
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.clearAllMocks()
    })

    it('should fetch and extract content via proxy', async () => {
      // First proxy (corsproxy.io) returns raw HTML
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: createMockHeaders('text/html'),
        text: () => Promise.resolve('<p>Hello from proxy</p>')
      })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Hello from proxy')
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should handle JSON response from allorigins', async () => {
      // Skip first proxy, test allorigins JSON format
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('First failed'))
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('application/json'),
          json: () => Promise.resolve({ contents: '<p>JSON content</p>' })
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('JSON content')
    })

    it('should truncate long content', async () => {
      const longContent = 'A'.repeat(10000)
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: createMockHeaders('text/html'),
        text: () => Promise.resolve(`<p>${longContent}</p>`)
      })

      const content = await fetchUrlContent('https://example.com', { maxLength: 100 })
      expect(content.length).toBeLessThanOrEqual(100 + 30) // +30 for truncation message
      expect(content).toContain('[Content truncated...]')
    })

    it('should try next proxy on failure', async () => {
      // First proxy fails, second proxy returns HTML
      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('First proxy failed'))
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('text/html'),
          text: () => Promise.resolve('<p>Second proxy worked</p>')
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Second proxy worked')
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should throw error when all proxies fail', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('All failed'))

      await expect(fetchUrlContent('https://example.com')).rejects.toThrow('Failed to fetch URL')
    })

    it('should handle HTTP error responses', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 404
      })

      await expect(fetchUrlContent('https://example.com')).rejects.toThrow()
    })

    it('should handle non-string content from JSON response', async () => {
      // When proxy.parseResponse returns an object instead of a string
      // (e.g., data.contents is an object or undefined)
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('application/json'),
          json: () => Promise.resolve({ contents: { nested: 'object' } })
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('text/html'),
          text: () => Promise.resolve('<p>Fallback content</p>')
        })

      const content = await fetchUrlContent('https://example.com')
      // Should fallback to next proxy or convert to string
      expect(typeof content).toBe('string')
    })

    it('should handle null content from JSON response', async () => {
      // First proxy (corsproxy.io) returns null directly, should throw and try next
      // Second proxy (allorigins) has contents: null, should also throw
      // Third proxy (allorigins-raw) returns valid content
      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('application/json'),
          json: () => Promise.resolve(null) // corsproxy.io returns data directly, null fails
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('application/json'),
          json: () => Promise.resolve({ contents: null }) // allorigins returns data.contents which is null
        })
        .mockResolvedValueOnce({
          ok: true,
          headers: createMockHeaders('text/html'),
          text: () => Promise.resolve('<p>Third proxy content</p>')
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Third proxy content')
    })
  })

  describe('fetchMultipleUrls', () => {
    let originalFetch

    // Helper to create mock headers
    function createMockHeaders(contentType) {
      return {
        get: (name) => name.toLowerCase() === 'content-type' ? contentType : null
      }
    }

    beforeEach(() => {
      originalFetch = global.fetch
      resetProxyIndex()
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('should fetch multiple URLs in parallel', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: createMockHeaders('text/html'),
        text: () => Promise.resolve('<p>Content</p>')
      })

      const results = await fetchMultipleUrls([
        'https://example1.com',
        'https://example2.com'
      ])

      expect(results['https://example1.com'].success).toBe(true)
      expect(results['https://example2.com'].success).toBe(true)
    })

    it('should handle mixed success and failure', async () => {
      const proxyCount = getProxyCount()
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        // First call succeeds (for first URL)
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            headers: createMockHeaders('text/html'),
            text: () => Promise.resolve('<p>Success</p>')
          })
        }
        // All other calls fail (second URL tries all proxies)
        return Promise.reject(new Error('Failed'))
      })

      const results = await fetchMultipleUrls([
        'https://success.com',
        'https://failure.com'
      ])

      expect(results['https://success.com'].success).toBe(true)
      expect(results['https://failure.com'].success).toBe(false)
    })
  })

  describe('formatFetchedContentForPrompt', () => {
    it('should format single URL content', () => {
      const contents = {
        'https://example.com': 'Example content here'
      }
      const result = formatFetchedContentForPrompt(contents)
      expect(result).toContain('--- Content from https://example.com ---')
      expect(result).toContain('Example content here')
      expect(result).toContain('--- End of https://example.com ---')
    })

    it('should format multiple URL contents', () => {
      const contents = {
        'https://foo.com': 'Foo content',
        'https://bar.com': 'Bar content'
      }
      const result = formatFetchedContentForPrompt(contents)
      expect(result).toContain('https://foo.com')
      expect(result).toContain('Foo content')
      expect(result).toContain('https://bar.com')
      expect(result).toContain('Bar content')
    })

    it('should return empty string for empty contents', () => {
      expect(formatFetchedContentForPrompt({})).toBe('')
    })

    it('should skip entries with empty content', () => {
      const contents = {
        'https://empty.com': '',
        'https://valid.com': 'Valid content'
      }
      const result = formatFetchedContentForPrompt(contents)
      expect(result).not.toContain('https://empty.com')
      expect(result).toContain('https://valid.com')
    })

    it('should skip entries with whitespace-only content', () => {
      const contents = {
        'https://whitespace.com': '   \n\t  ',
        'https://valid.com': 'Valid content'
      }
      const result = formatFetchedContentForPrompt(contents)
      expect(result).not.toContain('https://whitespace.com')
      expect(result).toContain('https://valid.com')
    })
  })
})
