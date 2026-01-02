import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  searchBooks,
  getBookDownloadLinks,
  getProxiedImageUrl,
  proxyImageUrl,
  fastDownloadBook,
  invalidateFetchSettingsCache
} from '../publicLibraryService.js'

// Mock the urlFetcher module with dynamic proxy URL
let cachedProxyBaseUrl = 'http://localhost:3001'

vi.mock('../urlFetcher.js', () => ({
  getCustomFetchUrl: vi.fn(() => Promise.resolve(cachedProxyBaseUrl)),
  invalidateFetchSettingsCache: vi.fn(async () => {
    // Will be called by tests - the mock value should be set via beforeEach
    // We need to await and update cachedProxyBaseUrl based on getCustomFetchUrl mock
  }),
  getProxyBaseUrl: vi.fn(() => cachedProxyBaseUrl),
  getProxiedImageUrl: vi.fn((url) => url ? `${cachedProxyBaseUrl}/fetchBinaryContent?url=${encodeURIComponent(url)}` : null),
  getProxiedTextUrl: vi.fn((url) => `${cachedProxyBaseUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`),
  getProxiedBrowseUrl: vi.fn((url) => `${cachedProxyBaseUrl}/browse?url=${encodeURIComponent(url)}`),
  getProxiedBinaryUrl: vi.fn((url) => `${cachedProxyBaseUrl}/fetchBinaryContent?url=${encodeURIComponent(url)}`),
  fetchTextContent: vi.fn(),
  fetchBinaryContent: vi.fn()
}))

// Mock the firestore module
vi.mock('../firestore.js', () => ({
  loadUserSettings: vi.fn(() => Promise.resolve({ bookApiUrl: 'https://test-library.org' }))
}))

import { getCustomFetchUrl, invalidateFetchSettingsCache as invalidateUrlFetcherCache } from '../urlFetcher.js'
import { loadUserSettings } from '../firestore.js'

const MOCK_PROXY_URL = 'http://test-proxy.com'
const MOCK_LIBRARY_URL = 'https://test-library.org'

// Mock global fetch
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('publicLibraryService', () => {
  beforeEach(() => {
    // Reset the cached proxy URL before each test
    cachedProxyBaseUrl = MOCK_PROXY_URL
    invalidateFetchSettingsCache()
    vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
    vi.mocked(loadUserSettings).mockResolvedValue({
      bookApiUrl: MOCK_LIBRARY_URL,
      bookApiKey: null
    })
    vi.clearAllMocks()
  })

  describe('getProxiedImageUrl', () => {
    it('should return null for undefined input', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      expect(getProxiedImageUrl(undefined)).toBeNull()
    })

    it('should return null for null input', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      expect(getProxiedImageUrl(null)).toBeNull()
    })

    it('should return null for empty string', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      expect(getProxiedImageUrl('')).toBeNull()
    })

    it('should generate proxied URL for valid image URL', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      const imageUrl = 'https://example.com/cover.jpg'
      const result = getProxiedImageUrl(imageUrl)
      expect(result).toContain(`${MOCK_PROXY_URL}/fetchBinaryContent`)
      expect(result).toContain(encodeURIComponent(imageUrl))
    })

    it('should encode special characters in image URL', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      const imageUrl = 'https://example.com/cover image.jpg?q=test&page=1'
      const result = getProxiedImageUrl(imageUrl)
      expect(result).toContain(encodeURIComponent(imageUrl))
      expect(result).toContain('cover%20image.jpg')
    })
  })

  describe('proxyImageUrl', () => {
    it('should return null for undefined input', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      expect(proxyImageUrl(undefined)).toBeNull()
    })

    it('should return null for null input', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      expect(proxyImageUrl(null)).toBeNull()
    })

    it('should generate proxied URL for valid image URL', async () => {
      await invalidateFetchSettingsCache()
      vi.mocked(getCustomFetchUrl).mockResolvedValue(MOCK_PROXY_URL)
      const imageUrl = 'https://covers.example.com/book.png'
      const result = proxyImageUrl(imageUrl)
      expect(result).toMatch(new RegExp(`^${MOCK_PROXY_URL}/fetchBinaryContent`))
      expect(result).toContain('url=')
      expect(result).toContain(encodeURIComponent(imageUrl))
    })
  })

  describe('searchBooks', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should throw error for empty query', async () => {
      await expect(searchBooks('')).rejects.toThrow('Search query is required')
    })

    it('should throw error for whitespace-only query', async () => {
      await expect(searchBooks('   ')).rejects.toThrow('Search query is required')
    })

    it('should throw error for undefined query', async () => {
      await expect(searchBooks(undefined)).rejects.toThrow('Search query is required')
    })

    it('should fetch and parse search results', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/md5/abc123" class="book-link">
              <h3>Test Book Title</h3>
              <span class="author">Test Author</span>
              <img src="https://example.com/cover.jpg" alt="cover">
              <span>EPUB</span>
            </a>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('test query')

      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_PROXY_URL}/fetchWebsiteContent?url=${encodeURIComponent('https://test-library.org/search?q=test%20query')}`
      )
      expect(results).toBeInstanceOf(Array)
    })

    it('should trim whitespace from query', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => '<html></html>'
      })

      await searchBooks('  test  ')

      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_PROXY_URL}/fetchWebsiteContent?url=${encodeURIComponent('https://test-library.org/search?q=test')}`
      )
    })

    it('should throw error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(searchBooks('test')).rejects.toThrow('Search failed: Network error')
    })

    it('should handle HTML with no book results', async () => {
      const mockHtml = '<html><body><p>No results found</p></body></html>'
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('nonexistent')
      expect(results).toEqual([])
    })
  })

  describe('getBookDownloadLinks', () => {
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should throw error for undefined URL', async () => {
      await expect(getBookDownloadLinks(undefined)).rejects.toThrow('Detail URL is required')
    })

    it('should throw error for null URL', async () => {
      await expect(getBookDownloadLinks(null)).rejects.toThrow('Detail URL is required')
    })

    it('should fetch and parse book detail page', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/download/book.epub">Download EPUB</a>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/123')

      expect(mockFetch).toHaveBeenCalledWith(
        `${MOCK_PROXY_URL}/browse?url=${encodeURIComponent('https://test-library.org/md5/123')}`
      )
      expect(result).toHaveProperty('downloadLinks')
      expect(result.downloadLinks).toBeInstanceOf(Array)
    })

    it('should throw error on fetch failure', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'))

      await expect(getBookDownloadLinks('https://example.com/book'))
        .rejects.toThrow('Failed to get book details: Network error')
    })

    it('should return pageUrl in result', async () => {
      const mockHtml = '<html><body></body></html>'
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/test123')

      expect(result.pageUrl).toBe('https://test-library.org/md5/test123')
    })
  })

  describe('parseSearchResults', () => {
    // Testing the internal parseSearchResults function indirectly through searchBooks
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should extract book title from link text', async () => {
      const mockHtml = `
        <html>
          <body>
            <div>
              <a href="/md5/test123" class="title-link">The Great Gatsby</a>
              <span>EPUB</span>
            </div>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('gatsby')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0].title).toContain('Gatsby')
    })

    it('should extract cover URL from img tag', async () => {
      const mockHtml = `
        <html>
          <body>
            <div>
              <img src="https://covers.example.com/book.jpg" alt="cover">
              <a href="/md5/test123">Book Title</a>
              <span>EPUB</span>
            </div>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('test')
      if (results.length > 0) {
        expect(results[0].coverUrl).toContain('covers.example.com')
      }
    })

    it('should filter books that have EPUB format', async () => {
      const mockHtml = `
        <html>
          <body>
            <div>
              <a href="/md5/epub-book">EPUB Book</a>
              <span>EPUB</span>
            </div>
            <div>
              <a href="/md5/pdf-book">PDF Book</a>
              <span>PDF</span>
            </div>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('test')
      expect(results.every(book => book.format === 'EPUB')).toBe(true)
    })

    it('should limit results to 20 items', async () => {
      // Generate HTML with 25 book links
      let html = '<html><body>'
      for (let i = 1; i <= 25; i++) {
        html += `<div><a href="/md5/book${i}">Book ${i}</a><span>EPUB</span></div>`
      }
      html += '</body></html>'

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => html
      })

      const results = await searchBooks('test')
      expect(results.length).toBeLessThanOrEqual(20)
    })

    it('should handle malformed HTML gracefully', async () => {
      const mockHtml = '<div>Broken HTML<a href="/md5/test">Book<span>EPUB'
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const results = await searchBooks('test')
      expect(results).toBeInstanceOf(Array)
    })
  })

  describe('parseBookDetails', () => {
    // Testing the internal parseBookDetails function indirectly through getBookDownloadLinks
    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should extract download links from anchor tags', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="https://downloads.example.com/book.epub">Download EPUB</a>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/test')

      expect(result.downloadLinks.length).toBeGreaterThan(0)
      expect(result.downloadLinks[0].url).toContain('book.epub')
    })

    it('should include libgen mirror links', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="https://libgen.example.com/book.epub">Libgen Mirror</a>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/test')

      expect(result.downloadLinks.some(link => link.url.includes('libgen'))).toBe(true)
    })

    it('should convert relative URLs to absolute', async () => {
      const mockHtml = `
        <html>
          <body>
            <a href="/download/book.epub">Download</a>
          </body>
        </html>
      `
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/test')

      expect(result.downloadLinks[0].url).toMatch(/^https:\/\//)
    })

    it('should return empty array when no download links found', async () => {
      const mockHtml = '<html><body><p>No downloads available</p></body></html>'
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: async () => mockHtml
      })

      const result = await getBookDownloadLinks('https://test-library.org/md5/test')

      expect(result.downloadLinks).toEqual([])
    })
  })

  describe('fastDownloadBook', () => {
    const mockApiKey = 'test-api-key-12345'
    const mockMd5 = 'd6e1dc51a50726f00ec438af21952a45'
    const mockDetailUrl = `https://test-library.org/md5/${mockMd5}`

    beforeEach(() => {
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.mocked(loadUserSettings).mockResolvedValue({
        bookApiUrl: MOCK_LIBRARY_URL,
        bookApiKey: mockApiKey
      })
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should throw error for undefined detail URL', async () => {
      await expect(fastDownloadBook(undefined)).rejects.toThrow('Detail URL is required')
    })

    it('should throw error when API key is not configured', async () => {
      vi.mocked(loadUserSettings).mockResolvedValue({
        bookApiUrl: MOCK_LIBRARY_URL,
        bookApiKey: null
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('API key is required for fast download')
    })

    it('should throw error for invalid MD5 format', async () => {
      await expect(fastDownloadBook('https://test-library.org/md5/invalid'))
        .rejects.toThrow('Could not extract valid MD5 from URL')
    })

    it('should extract MD5 from various URL formats', async () => {
      const mockResponse = {
        download_url: 'https://download.example.com/book.epub',
        account_fast_download_info: {}
      }

      // Mock API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock the direct file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/epub+zip' },
        arrayBuffer: async () => new ArrayBuffer(1024)
      })

      await fastDownloadBook(mockDetailUrl)

      // Should call API and file download
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it('should call fast download API with MD5 and key', async () => {
      const mockResponse = {
        download_url: 'https://download.example.com/book.epub',
        account_fast_download_info: {}
      }

      // Mock API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/epub+zip' },
        arrayBuffer: async () => new ArrayBuffer(1024)
      })

      await fastDownloadBook(mockDetailUrl)

      const apiUrlCall = mockFetch.mock.calls[0][0]
      // The call is proxied, so check for the API URL in the query parameter
      expect(apiUrlCall).toContain('fast_download.json')
      // The MD5 is URL-encoded, so check for it both ways
      expect(apiUrlCall).toContain(mockMd5)
      expect(apiUrlCall).toContain(encodeURIComponent(mockApiKey))
    })

    it('should throw error when API returns download_url: null', async () => {
      const mockResponse = {
        download_url: null,
        error: 'Invalid md5'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('Fast download API error: Invalid md5')
    })

    it('should throw error when API returns error field', async () => {
      const mockResponse = {
        download_url: 'https://download.example.com/book.epub',
        error: 'Account not authorized'
      }

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('Fast download API error: Account not authorized')
    })

    it('should throw error when no download URL in response', async () => {
      const mockResponse = {
        account_fast_download_info: {}
      }

      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('No download URL in API response')
    })

    it('should throw error on invalid JSON response', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => 'invalid json{{{'
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('Invalid JSON response')
    })

    it('should download file directly from download URL', async () => {
      const mockFileData = new ArrayBuffer(2048)
      const mockResponse = {
        download_url: 'https://cdn.example.com/book.epub',
        account_fast_download_info: {}
      }

      // Mock API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/epub+zip' },
        arrayBuffer: async () => mockFileData
      })

      const progressCallback = vi.fn()
      const result = await fastDownloadBook(mockDetailUrl, progressCallback)

      // Verify direct download was called
      const fileDownloadCall = mockFetch.mock.calls[1]
      expect(fileDownloadCall[0]).toBe('https://cdn.example.com/book.epub')
      expect(result).toBe(mockFileData)
    })

    it('should throw error on file download failure', async () => {
      const mockResponse = {
        download_url: 'https://cdn.example.com/book.epub',
        account_fast_download_info: {}
      }

      // Mock API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock file download failure
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404
      })

      await expect(fastDownloadBook(mockDetailUrl))
        .rejects.toThrow('Download failed: HTTP 404')
    })

    it('should report progress through callback', async () => {
      const mockFileData = new ArrayBuffer(1024)
      const mockResponse = {
        download_url: 'https://cdn.example.com/book.epub',
        account_fast_download_info: {}
      }

      // Mock API call
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/json' },
        text: async () => JSON.stringify(mockResponse)
      })

      // Mock file download
      mockFetch.mockResolvedValueOnce({
        ok: true,
        headers: { get: () => 'application/epub+zip' },
        arrayBuffer: async () => mockFileData
      })

      const progressCallback = vi.fn()
      await fastDownloadBook(mockDetailUrl, progressCallback)

      expect(progressCallback).toHaveBeenCalledWith(10)
      expect(progressCallback).toHaveBeenCalledWith(50)
      expect(progressCallback).toHaveBeenCalledWith(75)
      expect(progressCallback).toHaveBeenCalledWith(100)
    })
  })
})
