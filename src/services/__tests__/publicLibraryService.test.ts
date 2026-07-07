import { describe, it, expect, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  getCustomFetchUrl: vi.fn(),
  _getProxiedImageUrl: vi.fn(),
  getProxiedTextUrl: vi.fn(),
  getProxiedBrowseUrl: vi.fn(),
  fetchBinaryContent: vi.fn(),
  invalidateUrlFetcherCache: vi.fn(),
}))

vi.mock('../urlFetcher', () => ({
  getCustomFetchUrl: mocks.getCustomFetchUrl,
  getProxiedImageUrl: mocks._getProxiedImageUrl,
  getProxiedTextUrl: mocks.getProxiedTextUrl,
  getProxiedBrowseUrl: mocks.getProxiedBrowseUrl,
  fetchBinaryContent: mocks.fetchBinaryContent,
  invalidateFetchSettingsCache: mocks.invalidateUrlFetcherCache,
}))

vi.mock('../settings', () => ({
  Settings: {
    getString: vi.fn((key: string) => {
      if (key === 'bookApiUrl') return 'https://library.example.org'
      if (key === 'bookApiKey') return ''
      return ''
    }),
  },
}))

import {
  searchBooks,
  getPublicLibraryBaseUrl,
  getPublicLibraryApiKey,
  getProxiedImageUrl,
} from '../publicLibraryService'

function makeSearchHtml(books: { title: string; href: string; author?: string; cover?: string; format?: string }[]): string {
  const items = books.map(b => {
    const img = b.cover ? `<img src="${b.cover}">` : ''
    const fmt = b.format || 'EPUB'
    const author = b.author || ''
    return `<div class="book-card">
      ${img}
      <a href="${b.href}">${b.title}</a>
      <span class="author">${author}</span>
      <span>${fmt}</span>
    </div>`
  }).join('\n')
  return `<html><body>${items}</body></html>`
}

describe('publicLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.getCustomFetchUrl.mockResolvedValue('https://proxy.example.com')
  })

  describe('getPublicLibraryBaseUrl', () => {
    it('returns bookApiUrl from settings', async () => {
      const url = await getPublicLibraryBaseUrl()
      expect(url).toBe('https://library.example.org')
    })
  })

  describe('getPublicLibraryApiKey', () => {
    it('returns null when no key set', () => {
      expect(getPublicLibraryApiKey()).toBeNull()
    })
  })

  describe('getProxiedImageUrl', () => {
    it('delegates to urlFetcher getProxiedImageUrl', () => {
      mocks._getProxiedImageUrl.mockReturnValue('https://proxy.example.com/fetchBinaryContent?url=...')
      expect(getProxiedImageUrl('https://img.example.com/cover.jpg')).toBe('https://proxy.example.com/fetchBinaryContent?url=...')
    })

    it('returns null when proxy returns null', () => {
      mocks._getProxiedImageUrl.mockReturnValue(null)
      expect(getProxiedImageUrl('https://img.example.com/cover.jpg')).toBeNull()
    })
  })

  describe('searchBooks', () => {
    it('parses search results with EPUB format', async () => {
      const html = makeSearchHtml([
        { title: 'Test Book One', href: '/md5/abc123', author: 'Jane Author', cover: 'https://img.example.com/1.jpg' },
        { title: 'Test Book Two', href: '/md5/def456', author: 'John Writer' },
      ])

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Test Book One')
      expect(results[0].author).toBe('Jane Author')
      expect(results[0].coverUrl).toBe('https://img.example.com/1.jpg')
      expect(results[0].detailUrl).toBe('https://library.example.org/md5/abc123')
      expect(results[0].format).toBe('EPUB')
      expect(results[1].title).toBe('Test Book Two')
    })

    it('includes PDF-only results with PDF format', async () => {
      const html = makeSearchHtml([
        { title: 'PDF Only', href: '/md5/pdf1', format: 'PDF' },
      ])

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].format).toBe('PDF')
    })

    it('skips results with no recognized format', async () => {
      const html = makeSearchHtml([
        { title: 'MOBI Only', href: '/md5/mobi1', format: 'MOBI' },
      ])

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(0)
    })

    it('skips results with short titles', async () => {
      const html = makeSearchHtml([
        { title: 'A', href: '/md5/abc' },
      ])

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(0)
    })

    it('limits results to 20', async () => {
      const books = Array.from({ length: 25 }, (_, i) => ({
        title: `Book ${i}`,
        href: `/md5/hash${i}`,
      }))
      const html = makeSearchHtml(books)

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(20)
    })

    it('handles JSON response from proxy', async () => {
      const innerHtml = makeSearchHtml([
        { title: 'JSON Book', href: '/md5/json1', author: 'JSON Author' },
      ])

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'application/json' },
        json: () => Promise.resolve({ content: innerHtml }),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('JSON Book')
    })

    it('throws on empty query', async () => {
      await expect(searchBooks('')).rejects.toThrow('Search query is required')
      await expect(searchBooks('   ')).rejects.toThrow('Search query is required')
    })

    it('throws when proxy URL not configured', async () => {
      mocks.getCustomFetchUrl.mockResolvedValue(null)
      await expect(searchBooks('test')).rejects.toThrow('Proxy URL not configured')
    })

    it('throws on proxy HTTP error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
      })

      await expect(searchBooks('test')).rejects.toThrow()
    })

    it('prefers EPUB format when both EPUB and PDF are present', async () => {
      const html = `<html><body>
        <div class="book-card">
          <a href="/md5/dual1">Dual Format Book</a>
          <span>EPUB 2.1 MB</span>
          <span>PDF 5.3 MB</span>
        </div>
      </body></html>`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].format).toBe('EPUB')
    })

    it('detects PDF format in search results', async () => {
      const html = `<html><body>
        <div class="book-card">
          <a href="/md5/pdf1">PDF Book</a>
          <span>PDF 3.2 MB</span>
        </div>
      </body></html>`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].format).toBe('PDF')
    })

    it('uses fallback parser when no div-wrapped results found', async () => {
      const html = `<html><body>
        <p><a href="/md5/fallback1">Fallback Book</a> EPUB 2.1 MB</p>
      </body></html>`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Fallback Book')
      expect(results[0].author).toBe('Unknown')
    })

    it('fallback parser detects PDF format', async () => {
      const html = `<html><body>
        <p><a href="/md5/fallbackpdf">Fallback PDF Book</a> PDF 4.5 MB</p>
      </body></html>`

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        headers: { get: () => 'text/html' },
        text: () => Promise.resolve(html),
      })

      const results = await searchBooks('test')
      expect(results).toHaveLength(1)
      expect(results[0].title).toBe('Fallback PDF Book')
      expect(results[0].format).toBe('PDF')
    })
  })
})
