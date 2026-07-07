import {
  invalidateFetchSettingsCache as invalidateUrlFetcherCache,
  getProxiedImageUrl as _getProxiedImageUrl,
  getProxiedTextUrl,
  getProxiedBrowseUrl,
  fetchBinaryContent,
  getCustomFetchUrl,
} from './urlFetcher'
import { Settings } from './settings'

export interface BookSearchResult {
  id: string
  title: string
  author: string
  coverUrl: string | null
  detailUrl: string | null
  format: string
  source: string
  fileSize?: string
}

let publicLibraryBaseUrlCache: string | null = null
let publicLibraryBaseUrlCacheTimestamp = 0
const SETTINGS_CACHE_TTL = 30000

export async function getPublicLibraryBaseUrl(): Promise<string> {
  const now = Date.now()
  if (publicLibraryBaseUrlCache && now - publicLibraryBaseUrlCacheTimestamp < SETTINGS_CACHE_TTL) {
    return publicLibraryBaseUrlCache
  }

  const bookApiUrl = Settings.getString('bookApiUrl')
  if (!bookApiUrl) {
    throw new Error('Book library URL not configured in settings')
  }
  publicLibraryBaseUrlCache = bookApiUrl
  publicLibraryBaseUrlCacheTimestamp = now
  return publicLibraryBaseUrlCache
}

export async function invalidateFetchSettingsCache(): Promise<void> {
  await invalidateUrlFetcherCache()
  publicLibraryBaseUrlCache = null
  publicLibraryBaseUrlCacheTimestamp = 0
}

export function getPublicLibraryApiKey(): string | null {
  return Settings.getString('bookApiKey') || null
}

export function getProxiedImageUrl(imageUrl: string): string | null {
  return _getProxiedImageUrl(imageUrl)
}

function cleanText(text: string | null | undefined): string {
  return text?.replace(/\s+/g, ' ').trim() || ''
}

export async function searchBooks(query: string): Promise<BookSearchResult[]> {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required')
  }

  const baseUrl = await getPublicLibraryBaseUrl()
  const apiKey = getPublicLibraryApiKey()
  const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query.trim())}`

  try {
    const urlWithKey = apiKey ? `${searchUrl}&key=${encodeURIComponent(apiKey)}` : searchUrl
    const proxyBase = await getCustomFetchUrl()
    if (!proxyBase) throw new Error('Proxy URL not configured')
    const proxyUrl = `${proxyBase}/fetchWebsiteContent?url=${encodeURIComponent(urlWithKey)}`
    const response = await fetch(proxyUrl)

    if (!response.ok) {
      throw new Error(`Proxy error: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    let html: string
    if (contentType.includes('application/json')) {
      const data = await response.json()
      html = data.content || data.html || data.data || JSON.stringify(data)
    } else {
      html = await response.text()
    }

    return parseSearchResults(html, baseUrl)
  } catch (error) {
    console.error('[PublicLibrary] Search error:', error)
    throw new Error(`Search failed: ${(error as Error).message}`)
  }
}

function parseSearchResults(html: string, baseUrl: string): BookSearchResult[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results: BookSearchResult[] = []

  const bookLinks = doc.querySelectorAll('a[href^="/md5/"], a[href^="/db/"]')

  bookLinks.forEach((link, index) => {
    let card = link.closest('div[class]')
    if (!card) card = link.parentElement

    const titleEl = link
    let title = cleanText(titleEl?.textContent)

    if (!title || title.length < 2) return

    let coverUrl: string | null = null

    let img = card?.querySelector('img')

    if (!img) {
      let parent = card?.parentElement
      let depth = 0
      while (parent && depth < 5) {
        img = parent.querySelector('img')
        if (img) {
          if (parent.contains(link)) break
          img = null
        }
        parent = parent.parentElement
        depth++
      }
    }

    if (!img) {
      const allImages = doc.querySelectorAll('img')
      for (const testImg of allImages) {
        const testParent = testImg.closest('div[class]')
        if (testParent && testParent.contains(link)) {
          img = testImg
          break
        }
      }
    }

    if (img) {
      coverUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') ||
        img.getAttribute('srcset')?.split(' ')[0] || null
    }

    if (!coverUrl) {
      const coverEl = card?.querySelector('[data-coverurl], [data-cover-url], [data-cover]')
      if (coverEl) {
        coverUrl = coverEl.getAttribute('data-coverurl') ||
          coverEl.getAttribute('data-cover-url') ||
          coverEl.getAttribute('data-cover') || null
      }
    }

    const detailPath = link.getAttribute('href')
    const detailUrl = detailPath ? `${baseUrl}${detailPath}` : null

    const cardText = card?.textContent || ''
    const hasEpub = /EPUB/i.test(cardText)
    const hasPdf = /PDF/i.test(cardText)
    const format = hasEpub ? 'EPUB' : hasPdf ? 'PDF' : null

    let author = 'Unknown'

    const authorEl = card?.querySelector('[class*="author"], .author')
    if (authorEl) {
      const authorText = cleanText(authorEl.textContent)
      if (authorText && authorText.length < 100 && !authorText.includes('EPUB') && !authorText.includes('MB')) {
        author = authorText
      }
    }

    if (author === 'Unknown') {
      const allText = card?.textContent || ''
      const lines = allText.split('\n').map(l => cleanText(l)).filter(l => l.length > 0)

      for (const line of lines) {
        if (line.includes(title) || line.includes('EPUB') || line.includes('MB') ||
          line.includes('PDF') || /\d{4}/.test(line) || line.includes('Save')) {
          continue
        }
        if (line.length >= 2 && line.length <= 50 && /^[a-zA-Z\u4e00-\u9fa5\s\.\-]+$/.test(line)) {
          author = line
          break
        }
      }
    }

    if (author === 'Unknown' && titleEl.parentElement) {
      const siblings = Array.from(titleEl.parentElement.children)
      for (const sibling of siblings) {
        if (sibling !== titleEl && sibling.textContent) {
          const text = cleanText(sibling.textContent)
          if (text.length > 2 && text.length < 60 && !text.includes('EPUB')) {
            author = text
            break
          }
        }
      }
    }

    const sizeMatch = cardText.match(/(\d+\.?\d*)\s*(MB|KB|GB)/i)
    const fileSize = sizeMatch ? `${sizeMatch[1]} ${sizeMatch[2]}` : undefined

    if (format && detailUrl) {
      results.push({
        id: `public-library-${index}`,
        title,
        author,
        coverUrl,
        detailUrl,
        format,
        source: 'public-library',
        fileSize,
      })
    }
  })

  if (results.length === 0) {
    const allLinks = doc.querySelectorAll('a[href]')
    let fallbackIndex = 0

    for (const link of allLinks) {
      const href = link.getAttribute('href')
      if (!href || (!href.startsWith('/md5/') && !href.startsWith('/db/'))) continue

      const parent = link.parentElement
      if (!parent) continue

      const parentText = parent.textContent || ''
      const hasEpub = /EPUB/i.test(parentText)
      const hasPdf = /PDF/i.test(parentText)
      if (!hasEpub && !hasPdf) continue
      const fallbackFormat = hasEpub ? 'EPUB' : 'PDF'

      const fallbackTitle = cleanText(link.textContent || parent.querySelector('h1, h2, h3, h4')?.textContent)
      if (!fallbackTitle || fallbackTitle.length < 2) continue

      const fallbackCoverUrl = parent.querySelector('img')?.src || null
      const fallbackSizeMatch = parentText.match(/(\d+\.?\d*)\s*(MB|KB|GB)/i)
      const fallbackFileSize = fallbackSizeMatch ? `${fallbackSizeMatch[1]} ${fallbackSizeMatch[2]}` : undefined

      results.push({
        id: `public-library-${fallbackIndex++}`,
        title: fallbackTitle,
        author: 'Unknown',
        coverUrl: fallbackCoverUrl,
        detailUrl: `${baseUrl}${href}`,
        format: fallbackFormat,
        source: 'public-library',
        fileSize: fallbackFileSize,
      })

      if (results.length >= 20) break
    }
  }

  return results.slice(0, 20)
}

export async function fastDownloadBook(
  detailUrl: string,
  onProgress: ((progress: number) => void) | null = null,
): Promise<ArrayBuffer> {
  if (!detailUrl) {
    throw new Error('Detail URL is required')
  }

  const baseUrl = await getPublicLibraryBaseUrl()
  const apiKey = getPublicLibraryApiKey()

  if (!apiKey) {
    throw new Error('API key is required for fast download. Please add your Public Library API key in settings.')
  }

  const md5Match = detailUrl.match(/[a-f0-9]{32}/i)
  if (!md5Match) {
    throw new Error('Could not extract valid MD5 from URL.')
  }

  const md5 = md5Match[0]
  const fastDownloadUrl = `${baseUrl}/dyn/api/fast_download.json?md5=${encodeURIComponent(md5)}&key=${encodeURIComponent(apiKey)}`

  onProgress?.(10)

  const proxyBase = await getCustomFetchUrl()
  if (!proxyBase) throw new Error('Proxy URL not configured')
  const proxyUrl = `${proxyBase}/fetchWebsiteContent?url=${encodeURIComponent(fastDownloadUrl)}`
  const response = await fetch(proxyUrl)

  const responseText = await response.text()

  let data: Record<string, unknown>
  try {
    data = JSON.parse(responseText)
  } catch {
    throw new Error('Invalid JSON response from API: ' + responseText.substring(0, 200))
  }

  onProgress?.(30)

  if (data.download_url === null) {
    throw new Error(`Fast download API error: ${(data.error as string) || 'Unknown API error'}`)
  }

  if (data.error) {
    throw new Error(`Fast download API error: ${data.error}`)
  }

  const downloadUrl = data.download_url as string
  if (!downloadUrl) {
    throw new Error('No download URL in API response')
  }

  onProgress?.(50)

  // Route through the proxy — the mirror host returned by the fast-download
  // API does not send CORS headers, so a direct browser fetch is blocked by
  // the Same-Origin Policy. fetchBinaryContent funnels it through the
  // configured browseBinary endpoint (same path as downloadBookFile below).
  return await fetchBinaryContent(downloadUrl, onProgress)
}
