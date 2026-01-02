import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectUrls,
  fetchUrlContent,
  fetchMultipleUrls,
  formatFetchedContentForPrompt,
  invalidateFetchSettingsCache,
  getProxyBaseUrl,
  getProxiedImageUrl,
  getProxiedTextUrl,
  getProxiedBrowseUrl,
  getProxiedBinaryUrl,
  fetchTextContent,
  fetchBinaryContent
} from '../urlFetcher.js'

// Mock the firestore module
vi.mock('../firestore.js', () => ({
  loadUserSettings: vi.fn()
}))

import { loadUserSettings } from '../firestore.js'

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

  describe('fetchUrlContent', () => {
    let originalFetch
    let consoleWarnSpy

    beforeEach(async () => {
      originalFetch = global.fetch
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Reset settings cache before each test
      await invalidateFetchSettingsCache()
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.clearAllMocks()
      consoleWarnSpy.mockRestore()
    })

    it('should throw error when no custom fetch URL is configured', async () => {
      loadUserSettings.mockResolvedValue(null)
      await invalidateFetchSettingsCache()

      await expect(fetchUrlContent('https://example.com'))
        .rejects.toThrow('No custom fetch URL configured')
    })

    it('should fetch content via custom fetch URL when set', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom-fetch.example.com' })
      await invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: {
          get: (name) => name === 'content-type' ? 'application/json' : null
        },
        json: () => Promise.resolve({ success: true, content: 'Hello from custom service' })
      })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Hello from custom service')
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-fetch.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com'
      )
    })

    it('should handle custom fetch URL returning non-ok response', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com' })
      await invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500 })

      await expect(fetchUrlContent('https://example.com'))
        .rejects.toThrow('Failed to fetch https://example.com')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Custom fetch service failed:',
        'Custom fetch service error: HTTP 500'
      )
    })

    it('should handle custom fetch URL returning success: false', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com' })
      await invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: false, error: 'Rate limited' })
      })

      await expect(fetchUrlContent('https://example.com'))
        .rejects.toThrow('Failed to fetch https://example.com')
    })

    it('should handle plain text response from custom fetch', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com' })
      await invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve('<html>Raw content</html>')
      })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('<html>Raw content</html>')
    })

    it('should cache settings and not reload on subsequent calls', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com' })
      await invalidateFetchSettingsCache()

      // Clear the mock calls after invalidateFetchSettingsCache
      loadUserSettings.mockClear()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      await fetchUrlContent('https://example1.com')
      await fetchUrlContent('https://example2.com')

      // loadUserSettings should not be called again due to caching
      expect(loadUserSettings).toHaveBeenCalledTimes(0)
    })

    it('should reload settings after cache is invalidated', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com' })
      await invalidateFetchSettingsCache()

      // Clear the mock calls after initial invalidateFetchSettingsCache
      loadUserSettings.mockClear()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      await fetchUrlContent('https://example1.com')
      await invalidateFetchSettingsCache()
      await fetchUrlContent('https://example2.com')

      // loadUserSettings called once during the second invalidateFetchSettingsCache
      expect(loadUserSettings).toHaveBeenCalledTimes(1)
    })
  })

  describe('fetchMultipleUrls', () => {
    let originalFetch

    beforeEach(async () => {
      originalFetch = global.fetch
      await invalidateFetchSettingsCache()
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('should fetch multiple URLs in parallel', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
      await invalidateFetchSettingsCache()

      const fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      global.fetch = fetchMock

      const results = await fetchMultipleUrls([
        'https://example1.com',
        'https://example2.com'
      ])

      expect(results['https://example1.com'].success).toBe(true)
      expect(results['https://example2.com'].success).toBe(true)
      expect(fetchMock).toHaveBeenCalledTimes(2)
    })

    it('should return error when no custom URL configured', async () => {
      loadUserSettings.mockResolvedValue(null)
      await invalidateFetchSettingsCache()

      const results = await fetchMultipleUrls(['https://example.com'])
      expect(results['https://example.com'].success).toBe(false)
      expect(results['https://example.com'].error).toContain('No custom fetch URL configured')
    })

    it('should handle mixed success and failure', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
      await invalidateFetchSettingsCache()

      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            headers: { get: () => 'application/json' },
            json: () => Promise.resolve({ success: true, content: 'Success' })
          })
        }
        return Promise.reject(new Error('Failed'))
      })

      const results = await fetchMultipleUrls([
        'https://success.com',
        'https://failure.com'
      ])

      expect(results['https://success.com'].success).toBe(true)
      expect(results['https://failure.com'].success).toBe(false)
      expect(results['https://failure.com'].error).toContain('Failed to fetch')
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

  describe('invalidateFetchSettingsCache', () => {
    beforeEach(() => {
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should cause settings to be reloaded on next fetch', async () => {
      const originalFetch = global.fetch

      // First call with one custom URL
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://first-custom.com' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'First' })
      })

      invalidateFetchSettingsCache()
      await fetchUrlContent('https://example.com')
      expect(global.fetch).toHaveBeenCalledWith('https://first-custom.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com')

      // Change settings and invalidate
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://second-custom.com' })
      invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Second' })
      })

      await fetchUrlContent('https://example.com')
      expect(global.fetch).toHaveBeenCalledWith('https://second-custom.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com')

      global.fetch = originalFetch
    })
  })

  describe('Generic Proxy Methods', () => {
    let originalFetch
    let consoleWarnSpy

    beforeEach(async () => {
      originalFetch = global.fetch
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      await invalidateFetchSettingsCache()
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.clearAllMocks()
      consoleWarnSpy.mockRestore()
    })

    describe('getProxyBaseUrl', () => {
      it('should return null when no custom URL is set', async () => {
        loadUserSettings.mockResolvedValue(null)
        await invalidateFetchSettingsCache()
        expect(getProxyBaseUrl()).toBe(null)
      })

      it('should return custom fetch URL when set', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()
        expect(getProxyBaseUrl()).toBe('https://proxy.example.com')
      })
    })

    describe('getProxiedImageUrl', () => {
      it('should return null for empty input', () => {
        expect(getProxiedImageUrl(null)).toBe(null)
        expect(getProxiedImageUrl('')).toBe(null)
      })

      it('should return proxied URL for image', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()
        const result = getProxiedImageUrl('https://example.com/image.png')
        expect(result).toBe('https://proxy.example.com/fetchBinaryContent?url=https%3A%2F%2Fexample.com%2Fimage.png')
      })
    })

    describe('getProxiedTextUrl', () => {
      it('should return proxied URL for text content', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()
        const result = getProxiedTextUrl('https://example.com/page')
        expect(result).toBe('https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com%2Fpage')
      })
    })

    describe('getProxiedBrowseUrl', () => {
      it('should return proxied browse URL', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()
        const result = getProxiedBrowseUrl('https://example.com/page')
        expect(result).toBe('https://proxy.example.com/browse?url=https%3A%2F%2Fexample.com%2Fpage')
      })
    })

    describe('getProxiedBinaryUrl', () => {
      it('should return proxied binary URL', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()
        const result = getProxiedBinaryUrl('https://example.com/file.pdf')
        expect(result).toBe('https://proxy.example.com/browseBinary?url=https%3A%2F%2Fexample.com%2Ffile.pdf')
      })
    })

    describe('fetchTextContent', () => {
      it('should throw error when no custom URL is set', async () => {
        loadUserSettings.mockResolvedValue(null)
        await invalidateFetchSettingsCache()

        await expect(fetchTextContent('https://example.com'))
          .rejects.toThrow('Proxy URL not configured')
      })

      it('should fetch text content via proxy', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: true, content: '<html>Content</html>' })
        })

        const result = await fetchTextContent('https://example.com')
        expect(result).toBe('<html>Content</html>')
      })

      it('should handle plain text response', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'text/html' },
          text: () => Promise.resolve('Raw HTML content')
        })

        const result = await fetchTextContent('https://example.com')
        expect(result).toBe('Raw HTML content')
      })

      it('should throw error on non-ok response', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 500
        })

        await expect(fetchTextContent('https://example.com')).rejects.toThrow('Proxy error: HTTP 500')
      })
    })

    describe('fetchBinaryContent', () => {
      it('should throw error when no custom URL is set', async () => {
        loadUserSettings.mockResolvedValue(null)
        await invalidateFetchSettingsCache()

        await expect(fetchBinaryContent('https://example.com/file.pdf'))
          .rejects.toThrow('Proxy URL not configured')
      })

      it('should fetch binary content via proxy', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        const mockBuffer = new ArrayBuffer(1024)
        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'application/octet-stream' },
          arrayBuffer: () => Promise.resolve(mockBuffer)
        })

        const onProgress = vi.fn()
        const result = await fetchBinaryContent('https://example.com/file.pdf', onProgress)

        expect(result).toBe(mockBuffer)
        expect(onProgress).toHaveBeenCalledWith(10)
        expect(onProgress).toHaveBeenCalledWith(50)
        expect(onProgress).toHaveBeenCalledWith(80)
        expect(onProgress).toHaveBeenCalledWith(100)
      })

      it('should handle HTML response and find direct download link', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        const htmlWithLink = '<html><body><a href="https://cdn.example.com/file.pdf">Download</a></body></html>'
        const mockBuffer = new ArrayBuffer(2048)

        let callCount = 0
        global.fetch = vi.fn(() => {
          callCount++
          if (callCount === 1) {
            return Promise.resolve({
              ok: true,
              headers: { get: () => 'text/html' },
              text: () => Promise.resolve(htmlWithLink)
            })
          } else {
            return Promise.resolve({
              ok: true,
              headers: { get: () => 'application/pdf' },
              arrayBuffer: () => Promise.resolve(mockBuffer)
            })
          }
        })

        const onProgress = vi.fn()
        const result = await fetchBinaryContent('https://example.com/download', onProgress)

        expect(result).toBe(mockBuffer)
        expect(global.fetch).toHaveBeenCalledTimes(2)
      })

      it('should throw error when direct link not found in HTML', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        const htmlWithoutLink = '<html><body>No download link here</body></html>'

        global.fetch = vi.fn().mockResolvedValue({
          ok: true,
          headers: { get: () => 'text/html' },
          text: () => Promise.resolve(htmlWithoutLink)
        })

        await expect(fetchBinaryContent('https://example.com/download')).rejects.toThrow('Could not find direct download link')
      })

      it('should throw error on non-ok response', async () => {
        loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://proxy.example.com' })
        await invalidateFetchSettingsCache()

        global.fetch = vi.fn().mockResolvedValue({
          ok: false,
          status: 404
        })

        await expect(fetchBinaryContent('https://example.com/file.pdf')).rejects.toThrow('Binary proxy error: HTTP 404')
      })
    })
  })
})
