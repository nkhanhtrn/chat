/**
 * Tests for toolFetch utility functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { buildProxyUrl, createMockResponse, createProxiedFetch } from '../toolFetch.js'

describe('toolFetch', () => {
  describe('buildProxyUrl', () => {
    it('builds a proxy URL for a simple URL', () => {
      const url = 'https://example.com'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toBe('https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com')
    })

    it('encodes URL parameters properly', () => {
      const url = 'https://example.com?foo=bar&baz=qux'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toContain('url=')
      expect(result).toContain('https%3A%2F%2Fexample.com')
      expect(result).toContain('foo%3Dbar')
      expect(result).toContain('baz%3Dqux')
    })

    it('encodes special characters in URL', () => {
      const url = 'https://example.com/path?query=hello world'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toContain('hello%20world')
    })

    it('handles URLs with fragments', () => {
      const url = 'https://example.com#section'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      // Fragment is URL encoded as %23
      expect(result).toContain('%23section')
    })

    it('handles URLs with Unicode characters', () => {
      const url = 'https://example.com/path/café'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toContain('caf%C3%A9')
    })

    it('handles HTTP URLs', () => {
      const url = 'http://example.com'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toBe('https://proxy.example.com/fetchWebsiteContent?url=http%3A%2F%2Fexample.com')
    })

    it('handles URLs with ports', () => {
      const url = 'https://example.com:8080/path'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      expect(result).toContain('example.com%3A8080')
    })

    it('handles URLs with authentication (edge case)', () => {
      const url = 'https://user:pass@example.com'
      const proxyBaseUrl = 'https://proxy.example.com'
      const result = buildProxyUrl(url, proxyBaseUrl)

      // URL encoding should handle auth
      expect(result).toContain('user%3Apass')
    })
  })

  describe('createMockResponse', () => {
    it('creates a response-like object from string data', () => {
      const data = 'Hello world'
      const result = createMockResponse(data, 'text/html')

      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.statusText).toBe('OK')
      expect(typeof result.json).toBe('function')
      expect(typeof result.text).toBe('function')
      expect(typeof result.headers.get).toBe('function')
    })

    it('extracts content from data object', () => {
      const data = { content: 'Test content' }
      const result = createMockResponse(data, 'application/json')

      expect(result.text()).resolves.toBe('Test content')
    })

    it('extracts html from data object', () => {
      const data = { html: '<div>Hello</div>' }
      const result = createMockResponse(data, 'application/json')

      expect(result.text()).resolves.toBe('<div>Hello</div>')
    })

    it('extracts data field from data object', () => {
      const data = { data: 'Some data' }
      const result = createMockResponse(data, 'application/json')

      expect(result.text()).resolves.toBe('Some data')
    })

    it('prioritizes content over html over data', () => {
      const data = { content: 'A', html: 'B', data: 'C' }
      const result = createMockResponse(data, 'application/json')

      expect(result.text()).resolves.toBe('A')
    })

    it('handles empty string data', () => {
      const data = ''
      const result = createMockResponse(data)

      expect(result.text()).resolves.toBe('')
    })

    it('handles object with empty content field', () => {
      const data = { content: '' }
      const result = createMockResponse(data)

      expect(result.text()).resolves.toBe('')
    })

    it('returns content-type header as text/html', () => {
      const data = 'Test'
      const result = createMockResponse(data, 'application/json')

      expect(result.headers.get('content-type')).toBe('text/html')
    })

    it('returns null for unknown headers', () => {
      const data = 'Test'
      const result = createMockResponse(data)

      expect(result.headers.get('unknown-header')).toBeNull()
    })

    it('json method returns content wrapped in object', async () => {
      const data = 'Test content'
      const result = createMockResponse(data)

      const jsonResult = await result.json()
      expect(jsonResult).toEqual({ content: 'Test content' })
    })

    it('text method returns content directly', async () => {
      const data = 'Test content'
      const result = createMockResponse(data)

      expect(await result.text()).toBe('Test content')
    })
  })

  describe('createProxiedFetch', () => {
    let mockFetch
    let mockGetProxyBaseUrl
    let debugLogSpy

    beforeEach(() => {
      mockFetch = vi.fn()
      mockGetProxyBaseUrl = vi.fn(() => 'https://proxy.example.com')
      debugLogSpy = vi.fn()
    })

    describe('auto-detection behavior', () => {
      it('uses direct fetch for API URLs with /api/ path', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'API response'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        await proxiedFetch('https://example.com/api/users')

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith('https://example.com/api/users', {})
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Direct fetch:', 'https://example.com/api/users')
      })

      it('uses direct fetch for API URLs with /v1/ path', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'API response'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('https://api.service.com/v1/data')

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith('https://api.service.com/v1/data', {})
      })

      it('uses direct fetch for known AI API domains', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'AI response'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        await proxiedFetch('https://api.openai.com/v1/chat/completions')

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith('https://api.openai.com/v1/chat/completions', {})
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Direct fetch:', 'https://api.openai.com/v1/chat/completions')
      })

      it('uses direct fetch for generativelanguage.googleapis.com', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'AI response'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent')

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {})
      })

      it('uses proxy for arbitrary websites', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
          },
          json: async () => ({ content: 'Proxied content' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        await proxiedFetch('https://example.com/page')

        expect(mockGetProxyBaseUrl).toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith(
          'https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com%2Fpage',
          { method: 'GET' }
        )
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Proxying:', 'https://example.com/page', 'through:', 'https://proxy.example.com')
      })

      it('uses proxy for news websites', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: { get: () => 'text/html' },
          text: async () => '<html>Page content</html>'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('https://news.example.com/article')

        expect(mockGetProxyBaseUrl).toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('fetchWebsiteContent'),
          { method: 'GET' }
        )
      })

      it('handles Request objects by extracting URL', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'Direct content'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        const request = new Request('https://api.example.com/v1/data')
        await proxiedFetch(request)

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith(
          request,
          { method: 'GET', headers: request.headers, body: null }
        )
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Direct fetch:', 'https://api.example.com/v1/data')
      })

      it('proxies Request objects for non-API URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
          },
          json: async () => ({ content: 'Proxied content' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        const request = new Request('https://example.com/page')
        await proxiedFetch(request)

        expect(mockGetProxyBaseUrl).toHaveBeenCalled()
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Proxying:', 'https://example.com/page', 'through:', 'https://proxy.example.com')
      })
    })

    describe('explicit useProxy option', () => {
      it('forces proxy when useProxy is true, even for API URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
          },
          json: async () => ({ content: 'Proxied content' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('https://api.example.com/v1/data', { useProxy: true })

        expect(mockGetProxyBaseUrl).toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith(
          'https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fapi.example.com%2Fv1%2Fdata',
          { method: 'GET' }
        )
      })

      it('forces direct fetch when useProxy is false, even for non-API URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'Direct content'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch,
          debugLog: debugLogSpy
        })

        await proxiedFetch('https://example.com/page', { useProxy: false })

        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
        expect(mockFetch).toHaveBeenCalledWith('https://example.com/page', { useProxy: false })
        expect(debugLogSpy).toHaveBeenCalledWith('[Tool fetch] Direct fetch:', 'https://example.com/page')
      })
    })

    describe('same-origin and relative URLs', () => {
      it('uses native fetch for non-HTTP URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          text: async () => 'Local content'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const result = await proxiedFetch('/local/path')

        expect(mockFetch).toHaveBeenCalledWith('/local/path', {})
        expect(mockGetProxyBaseUrl).not.toHaveBeenCalled()
      })

      it('uses native fetch for relative URLs', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('relative/path')

        expect(mockFetch).toHaveBeenCalledWith('relative/path', {})
      })
    })

    describe('proxy response handling', () => {
      it('handles JSON responses from proxy', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: (name) => name === 'content-type' ? 'application/json' : null
          },
          json: async () => ({ content: 'JSON content', html: 'HTML content' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const result = await proxiedFetch('https://example.com', { useProxy: true })

        expect(await result.text()).toBe('JSON content')
      })

      it('handles text responses from proxy', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => 'text/plain'
          },
          text: async () => 'Plain text content'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const result = await proxiedFetch('https://example.com', { useProxy: true })

        expect(await result.text()).toBe('Plain text content')
      })

      it('handles empty content type header', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => null
          },
          text: async () => 'Content'
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const result = await proxiedFetch('https://example.com', { useProxy: true })

        expect(await result.text()).toBe('Content')
      })

      it('throws error when proxy is not configured', async () => {
        mockGetProxyBaseUrl = vi.fn(() => null)

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await expect(proxiedFetch('https://example.com', { useProxy: true }))
          .rejects.toThrow('Proxy URL not configured')
      })

      it('throws error on proxy HTTP error response', async () => {
        mockFetch.mockResolvedValue({
          ok: false,
          status: 500
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await expect(proxiedFetch('https://example.com', { useProxy: true }))
          .rejects.toThrow('Proxy error: HTTP 500')
      })

      it('throws error on proxy network failure', async () => {
        mockFetch.mockRejectedValue(new Error('Network error'))

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await expect(proxiedFetch('https://example.com', { useProxy: true }))
          .rejects.toThrow('Network error')
      })

      it('gets fresh proxy URL for each request', async () => {
        let callCount = 0
        mockGetProxyBaseUrl = vi.fn(() => {
          callCount++
          return `https://proxy-${callCount}.example.com`
        })
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: { get: () => 'application/json' },
          json: async () => ({ content: '' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        await proxiedFetch('https://example.com', { useProxy: true })
        await proxiedFetch('https://example.com', { useProxy: true })

        expect(mockGetProxyBaseUrl).toHaveBeenCalledTimes(2)
      })
    })

    describe('fetch options passthrough', () => {
      it('passes through fetch options for proxied requests', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200,
          headers: {
            get: () => 'application/json'
          },
          json: async () => ({ content: '' })
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const options = { headers: { 'X-Custom': 'value' }, useProxy: true }
        await proxiedFetch('https://example.com', options)

        expect(mockFetch).toHaveBeenCalledWith(
          'https://proxy.example.com/fetchWebsiteContent?url=https%3A%2F%2Fexample.com',
          { headers: { 'X-Custom': 'value' }, method: 'GET' }
        )
      })

      it('passes through fetch options for direct requests', async () => {
        mockFetch.mockResolvedValue({
          ok: true,
          status: 200
        })

        const proxiedFetch = createProxiedFetch({
          getProxyBaseUrl: mockGetProxyBaseUrl,
          fetch: mockFetch
        })

        const options = { method: 'POST', body: 'data' }
        await proxiedFetch('/local', options)

        expect(mockFetch).toHaveBeenCalledWith('/local', options)
      })
    })
  })
})
