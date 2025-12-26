import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { searchWeb, formatSearchResultsForPrompt } from '../webSearch.js'

describe('webSearch', () => {
  let originalFetch

  beforeEach(() => {
    originalFetch = global.fetch
  })

  afterEach(() => {
    global.fetch = originalFetch
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
    it('should search and return results from backend', async () => {
      const mockResults = [
        { title: 'Example Page 1', url: 'https://example.com/page1', snippet: 'This is snippet 1' },
        { title: 'Example Page 2', url: 'https://example.com/page2', snippet: 'This is snippet 2' }
      ]

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, results: mockResults })
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

    it('should pass maxResults option to backend', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, results: [] })
      })

      await searchWeb('test query', { maxResults: 3 })

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(callBody.maxResults).toBe(3)
    })

    it('should send POST request to backend API', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, results: [] })
      })

      await searchWeb('hello world')

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/search'),
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('hello world')
        })
      )
    })

    it('should throw error on HTTP failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500
      })

      await expect(searchWeb('test')).rejects.toThrow('Backend error: HTTP 500')
    })

    it('should throw error when backend returns failure', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: false, error: 'Search service unavailable' })
      })

      await expect(searchWeb('test')).rejects.toThrow('Search service unavailable')
    })

    it('should handle network errors', async () => {
      global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

      await expect(searchWeb('test')).rejects.toThrow('Network error')
    })

    it('should use default maxResults of 5', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true, results: [] })
      })

      await searchWeb('test query')

      const callBody = JSON.parse(global.fetch.mock.calls[0][1].body)
      expect(callBody.maxResults).toBe(5)
    })
  })
})
