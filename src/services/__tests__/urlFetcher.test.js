import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectUrls,
  fetchUrlContent,
  fetchMultipleUrls,
  formatFetchedContentForPrompt,
  invalidateFetchSettingsCache
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
    let consoleLogSpy
    let consoleWarnSpy

    beforeEach(() => {
      originalFetch = global.fetch
      consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      // Reset settings cache before each test
      invalidateFetchSettingsCache()
      // Default: no custom fetch URL
      loadUserSettings.mockResolvedValue(null)
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.clearAllMocks()
      consoleLogSpy.mockRestore()
      consoleWarnSpy.mockRestore()
    })

    it('should fetch content via local server when no custom URL is set', async () => {
      loadUserSettings.mockResolvedValue(null)

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, content: 'Hello from backend' })
      })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Hello from backend')
      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/fetch'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('https://example.com')
        })
      )
    })

    it('should try custom fetch URL first when set', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom-fetch.example.com/api/fetch' })

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        headers: {
          get: (name) => name === 'content-type' ? 'application/json' : null
        },
        json: () => Promise.resolve({ success: true, content: 'Hello from custom service' })
      })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Hello from custom service')
      // Custom service uses GET with URL as query param
      expect(global.fetch).toHaveBeenCalledWith(
        'https://custom-fetch.example.com/api/fetch?url=https%3A%2F%2Fexample.com'
      )
    })

    it('should fall back to local server when custom URL fails', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom-fetch.example.com/api/fetch' })

      global.fetch = vi.fn()
        .mockRejectedValueOnce(new Error('Custom service down'))
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, content: 'Hello from local server' })
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('Hello from local server')
      expect(global.fetch).toHaveBeenCalledTimes(2)
      expect(consoleWarnSpy).toHaveBeenCalledWith('Custom fetch service failed:', 'Custom service down')
    })

    it('should throw error when all methods fail', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com/fetch' })

      // Fail custom and local server
      global.fetch = vi.fn().mockRejectedValue(new Error('All failed'))

      await expect(fetchUrlContent('https://example.com'))
        .rejects.toThrow('All fetch methods failed for https://example.com')

      // 1 custom + 1 local = 2
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should cache settings and not reload on subsequent calls', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com/fetch' })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      await fetchUrlContent('https://example1.com')
      await fetchUrlContent('https://example2.com')

      // loadUserSettings should only be called once due to caching
      expect(loadUserSettings).toHaveBeenCalledTimes(1)
    })

    it('should reload settings after cache is invalidated', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com/fetch' })

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      await fetchUrlContent('https://example1.com')
      invalidateFetchSettingsCache()
      await fetchUrlContent('https://example2.com')

      expect(loadUserSettings).toHaveBeenCalledTimes(2)
    })

    it('should handle custom fetch URL returning non-ok response', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com/fetch' })

      global.fetch = vi.fn()
        .mockResolvedValueOnce({ ok: false, status: 500 })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, content: 'From local server' })
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('From local server')
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Custom fetch service failed:',
        'Custom fetch service error: HTTP 500'
      )
    })

    it('should handle custom fetch URL returning success: false', async () => {
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://custom.com/fetch' })

      global.fetch = vi.fn()
        .mockResolvedValueOnce({
          ok: true,
          headers: { get: () => 'application/json' },
          json: () => Promise.resolve({ success: false, error: 'Rate limited' })
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true, content: 'From local server' })
        })

      const content = await fetchUrlContent('https://example.com')
      expect(content).toBe('From local server')
    })
  })

  describe('fetchMultipleUrls', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = global.fetch
      invalidateFetchSettingsCache()
      loadUserSettings.mockResolvedValue(null)
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.restoreAllMocks()
    })

    it('should fetch multiple URLs in parallel', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, content: 'Content' })
      })

      const results = await fetchMultipleUrls([
        'https://example1.com',
        'https://example2.com'
      ])

      expect(results['https://example1.com'].success).toBe(true)
      expect(results['https://example2.com'].success).toBe(true)
      expect(global.fetch).toHaveBeenCalledTimes(2)
    })

    it('should handle mixed success and failure', async () => {
      let callCount = 0
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true, content: 'Success' })
          })
        }
        // Second URL fails completely (all fallbacks)
        return Promise.reject(new Error('Failed'))
      })

      const results = await fetchMultipleUrls([
        'https://success.com',
        'https://failure.com'
      ])

      expect(results['https://success.com'].success).toBe(true)
      expect(results['https://failure.com'].success).toBe(false)
      expect(results['https://failure.com'].error).toContain('All fetch methods failed')
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
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://first-custom.com/fetch' })
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'First' })
      })

      invalidateFetchSettingsCache()
      await fetchUrlContent('https://example.com')
      // Custom service uses GET with URL as query param
      expect(global.fetch).toHaveBeenCalledWith('https://first-custom.com/fetch?url=https%3A%2F%2Fexample.com')

      // Change settings and invalidate
      loadUserSettings.mockResolvedValue({ customFetchUrl: 'https://second-custom.com/fetch' })
      invalidateFetchSettingsCache()

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ success: true, content: 'Second' })
      })

      await fetchUrlContent('https://example.com')
      expect(global.fetch).toHaveBeenCalledWith('https://second-custom.com/fetch?url=https%3A%2F%2Fexample.com')

      global.fetch = originalFetch
    })
  })
})
