import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  detectUrls,
  fetchUrlContent,
  fetchMultipleUrls,
  formatFetchedContentForPrompt
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

  describe('fetchUrlContent', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
      vi.clearAllMocks()
    })

    it('should fetch content via backend API', async () => {
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

    it('should pass maxLength option to backend', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true, content: 'Truncated content' })
      })

      await fetchUrlContent('https://example.com', { maxLength: 100 })

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(callBody.maxLength).toBe(100)
    })

    it('should throw error on HTTP failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 500
      })

      await expect(fetchUrlContent('https://example.com')).rejects.toThrow('Backend error: HTTP 500')
    })

    it('should throw error when backend returns failure', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'URL not accessible' })
      })

      await expect(fetchUrlContent('https://example.com')).rejects.toThrow('URL not accessible')
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValueOnce(new Error('Network error'))

      await expect(fetchUrlContent('https://example.com')).rejects.toThrow('Network error')
    })
  })

  describe('fetchMultipleUrls', () => {
    let originalFetch

    beforeEach(() => {
      originalFetch = global.fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
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
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ success: false, error: 'Failed' })
        })
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
