import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { fetchWebsiteContent, parseWebsiteContent, resetProxyIndex, corsProxies } from '../websiteContent.js'

// Helper to extract proxy index from URL
const getProxyIndex = (url) => {
  for (let i = 0; i < corsProxies.length; i++) {
    if (url.includes(corsProxies[i])) {
      return i
    }
  }
  return null
}

describe('websiteContent', () => {
  let originalFetch
  let consoleLogSpy
  let consoleErrorSpy

  beforeEach(() => {
    originalFetch = global.fetch
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Reset the proxy index for consistent test behavior
    resetProxyIndex()
  })

  afterEach(() => {
    global.fetch = originalFetch
    consoleLogSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  describe('parseWebsiteContent', () => {
    it('should parse HTML and extract text content', async () => {
      const url = 'https://example.com'
      const html = `
        <html>
          <head><title>Test Page</title></head>
          <body>
            <h1>Hello World</h1>
            <p>This is a test paragraph.</p>
          </body>
        </html>
      `

      const result = await parseWebsiteContent(url, html)

      expect(result.url).toBe(url)
      expect(result.title).toBe('Test Page')
      expect(result.content).toContain('Hello World')
      expect(result.content).toContain('This is a test paragraph')
      expect(result.timestamp).toBeDefined()
    })

    it('should remove script tags from content', async () => {
      const url = 'https://example.com'
      const html = `
        <html>
          <body>
            <script>alert('xss')</script>
            <p>Content</p>
          </body>
        </html>
      `

      const result = await parseWebsiteContent(url, html)

      expect(result.content).not.toContain('alert')
      expect(result.content).not.toContain('xss')
      expect(result.content).toContain('Content')
    })

    it('should remove style tags from content', async () => {
      const url = 'https://example.com'
      const html = `
        <html>
          <body>
            <style>.test { color: red; }</style>
            <p>Content</p>
          </body>
        </html>
      `

      const result = await parseWebsiteContent(url, html)

      expect(result.content).not.toContain('color: red')
      expect(result.content).toContain('Content')
    })

    it('should remove noscript and iframe tags', async () => {
      const url = 'https://example.com'
      const html = `
        <html>
          <body>
            <noscript>Enable JS</noscript>
            <iframe src="ads.html"></iframe>
            <p>Content</p>
          </body>
        </html>
      `

      const result = await parseWebsiteContent(url, html)

      expect(result.content).not.toContain('Enable JS')
      expect(result.content).not.toContain('ads.html')
      expect(result.content).toContain('Content')
    })

    it('should clean up excessive whitespace', async () => {
      const url = 'https://example.com'
      const html = `
        <html>
          <body>
            <p>Text    with     spaces</p>
            <p>Multiple


            newlines</p>
          </body>
        </html>
      `

      const result = await parseWebsiteContent(url, html)

      expect(result.content).not.toContain('    ')
      expect(result.content).not.toContain('\n\n\n')
    })

    it('should use URL as title if no title tag', async () => {
      const url = 'https://example.com'
      const html = '<html><body>Content</body></html>'

      const result = await parseWebsiteContent(url, html)

      expect(result.title).toBe(url)
    })

    it('should handle empty body', async () => {
      const url = 'https://example.com'
      const html = '<html><head><title>Empty</title></head><body></body></html>'

      const result = await parseWebsiteContent(url, html)

      expect(result.content).toBe('')
      expect(result.title).toBe('Empty')
    })

    it('should throw error if parsing fails', async () => {
      const url = 'https://example.com'
      
      // Mock DOMParser to throw error
      const originalDOMParser = global.DOMParser
      global.DOMParser = class {
        parseFromString() {
          throw new Error('Parse error')
        }
      }

      await expect(parseWebsiteContent(url, '<html></html>'))
        .rejects.toThrow('Failed to parse content from https://example.com')

      global.DOMParser = originalDOMParser
    })

    it('should include timestamp in ISO format', async () => {
      const url = 'https://example.com'
      const html = '<html><body>Content</body></html>'

      const result = await parseWebsiteContent(url, html)

      expect(result.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    })
  })

  describe('fetchWebsiteContent', () => {
    it('should fetch content directly if no CORS issues', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><head><title>Direct</title></head><body>Content</body></html>'

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(mockHtml)
      })

      const result = await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledWith(url)
      expect(result.title).toBe('Direct')
      expect(result.content).toContain('Content')
    })

    it('should try CORS proxy if direct fetch fails', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><head><title>Proxied</title></head><body>Content</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('CORS error'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const result = await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(global.fetch).toHaveBeenCalledWith(url)
      expect(global.fetch).toHaveBeenCalledWith(expect.stringContaining('allorigins'))
      expect(result.title).toBe('Proxied')
    })

    it('should try multiple proxies if first proxy fails', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><head><title>Success</title></head><body>Content</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('CORS error')) // Direct fetch
        .mockRejectedValueOnce(new Error('Proxy 1 failed')) // First proxy
        .mockResolvedValueOnce({ // Second proxy succeeds
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const result = await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(result.title).toBe('Success')
    })

    it('should try all proxies before failing', async () => {
      const url = 'https://example.com'

      // Mock to reject all attempts (direct + all proxies)
      global.fetch = vi.fn().mockRejectedValue(new Error('All failed'))

      await expect(fetchWebsiteContent(url))
        .rejects.toThrow('Failed to fetch content. All proxies failed or CORS blocked.')

      // Should try: 1 direct + all proxies in the list
      expect(global.fetch).toHaveBeenCalledTimes(1 + corsProxies.length)
    })

    it('should handle non-ok response from direct fetch', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><body>Proxy content</body></html>'

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 404 }) // Direct fetch returns 404
        .mockResolvedValueOnce({ // Proxy succeeds
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const result = await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(result.content).toContain('Proxy content')
    })

    it('should handle non-ok response from proxy', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><body>Success</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Direct failed'))
        .mockResolvedValueOnce({ ok: false, status: 500 }) // First proxy fails
        .mockResolvedValueOnce({ // Second proxy succeeds
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      const result = await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledTimes(3)
      expect(result.content).toContain('Success')
    })

    it('should encode URL when using proxy', async () => {
      const url = 'https://example.com/path?query=value&other=test'
      const mockHtml = '<html><body>Content</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Direct failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      await fetchWebsiteContent(url)

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining(encodeURIComponent(url))
      )
    })

    it('should log when direct fetch fails', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><body>Content</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('CORS'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      await fetchWebsiteContent(url)

      expect(consoleLogSpy).toHaveBeenCalledWith('Direct fetch failed, trying CORS proxies...')
    })

    it('should log when proxy fails', async () => {
      const url = 'https://example.com'
      const mockHtml = '<html><body>Content</body></html>'

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Direct failed'))
        .mockRejectedValueOnce(new Error('Proxy 1 failed'))
        .mockResolvedValueOnce({
          ok: true,
          text: () => Promise.resolve(mockHtml)
        })

      await fetchWebsiteContent(url)

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Proxy')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed, trying next...')
      )
    })

    it('should use round-robin for proxy selection on subsequent calls', async () => {
      const mockHtml = '<html><body>Content</body></html>'
      const proxyUsage = []

      // Mock to track proxy calls
      global.fetch = vi.fn().mockImplementation(async (url) => {
        // Check if it's a proxy call
        const proxyIndex = getProxyIndex(url)
        if (proxyIndex !== null) {
          proxyUsage.push(proxyIndex)
          return { ok: true, text: () => Promise.resolve(mockHtml) }
        }
        // Direct fetch fails
        throw new Error('Direct failed')
      })

      // Make requests equal to proxies count + 1 to verify cycling
      const requestCount = corsProxies.length + 1
      for (let i = 0; i < requestCount; i++) {
        await fetchWebsiteContent(`https://example${i}.com`)
      }

      // Verify we have the expected number of requests
      expect(proxyUsage.length).toBe(requestCount)
      
      // Verify round-robin: last proxy should be same as first (cycling back)
      expect(proxyUsage[proxyUsage.length - 1]).toBe(proxyUsage[0])
      
      // Verify all proxies were used
      const uniqueProxies = new Set(proxyUsage)
      expect(uniqueProxies.size).toBe(corsProxies.length)
      
      // Verify no consecutive duplicates (proper cycling)
      for (let i = 0; i < proxyUsage.length - 1; i++) {
        expect(proxyUsage[i]).not.toBe(proxyUsage[i + 1])
      }
    })

    it('should fall back to next proxy if current one fails', async () => {
      const mockHtml = '<html><body>Content</body></html>'
      const proxyUsage = []
      
      global.fetch = vi.fn().mockImplementation(async (url) => {
        const proxyIndex = getProxyIndex(url)
        
        // Direct fetch fails
        if (proxyIndex === null) {
          throw new Error('Direct failed')
        }
        
        proxyUsage.push(proxyIndex)
        
        // First proxy (index 0) fails
        if (proxyIndex === 0) {
          throw new Error('First proxy failed')
        }
        
        // Other proxies succeed
        return { ok: true, text: () => Promise.resolve(mockHtml) }
      })

      const result = await fetchWebsiteContent('https://example.com')

      // Should try first proxy (index 0, fails), then second proxy (index 1, succeeds)
      expect(proxyUsage.length).toBe(2)
      expect(proxyUsage[0]).toBe(0)
      expect(proxyUsage[1]).toBe(1)
      expect(result.content).toBe('Content')
      
      // Next request should start from third proxy (index 2, next in rotation)
      proxyUsage.length = 0
      await fetchWebsiteContent('https://example2.com')
      
      // Should use the proxy after the one that succeeded (index 2)
      const expectedNextIndex = 2 % corsProxies.length
      expect(proxyUsage[0]).toBe(expectedNextIndex)
    })
  })

  describe('Integration', () => {
    it('should fetch and parse real-world-like HTML', async () => {
      const url = 'https://example.com/article'
      const html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Article Title</title>
          <style>.header { color: blue; }</style>
          <script>console.log('tracking')</script>
        </head>
        <body>
          <header>
            <nav>Menu</nav>
          </header>
          <main>
            <h1>Main Heading</h1>
            <article>
              <p>First paragraph with important information.</p>
              <p>Second paragraph with more details.</p>
            </article>
          </main>
          <footer>Copyright 2025</footer>
          <script src="analytics.js"></script>
        </body>
        </html>
      `

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve(html)
      })

      const result = await fetchWebsiteContent(url)

      expect(result.url).toBe(url)
      expect(result.title).toBe('Article Title')
      expect(result.content).toContain('Main Heading')
      expect(result.content).toContain('First paragraph')
      expect(result.content).toContain('Second paragraph')
      expect(result.content).not.toContain('color: blue')
      expect(result.content).not.toContain('tracking')
      expect(result.content).not.toContain('analytics.js')
    })
  })
})
