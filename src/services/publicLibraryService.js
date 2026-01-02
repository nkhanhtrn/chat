/**
 * Public Library Service
 * Frontend service for searching and downloading books from Public Library
 * Uses the generic urlFetcher proxy system for all HTTP requests
 */

import { getProxyBaseUrl, invalidateFetchSettingsCache as invalidateUrlFetcherCache, getProxiedImageUrl as _getProxiedImageUrl, getProxiedTextUrl, getProxiedBrowseUrl, fetchBinaryContent } from './urlFetcher.js'
import { loadUserSettings } from './firestore.js'

// Cache for public library base URL to avoid repeated lookups
let publicLibraryBaseUrlCache = null
let publicLibraryBaseUrlCacheTimestamp = 0
const SETTINGS_CACHE_TTL = 30000 // 30 seconds

/**
 * Get the public library base URL from settings (cached)
 * @returns {Promise<string>}
 */
export async function getPublicLibraryBaseUrl() {
  const now = Date.now()
  if (publicLibraryBaseUrlCache && (now - publicLibraryBaseUrlCacheTimestamp) < SETTINGS_CACHE_TTL) {
    return publicLibraryBaseUrlCache
  }

  try {
    const settings = await loadUserSettings()
    if (!settings?.bookApiUrl) {
      throw new Error('Book library URL not configured in settings')
    }
    publicLibraryBaseUrlCache = settings.bookApiUrl
    publicLibraryBaseUrlCacheTimestamp = now
    return publicLibraryBaseUrlCache
  } catch (error) {
    console.error('[PublicLibrary] Failed to load settings or URL not configured:', error)
    throw new Error('Book library URL not configured. Please set it in settings.')
  }
}

/**
 * Invalidate the settings cache
 */
export async function invalidateFetchSettingsCache() {
  await invalidateUrlFetcherCache()
  // Also invalidate public library base URL cache
  publicLibraryBaseUrlCache = null
  publicLibraryBaseUrlCacheTimestamp = 0
}

/**
 * Get the public library API key from settings (cached)
 * @returns {Promise<string|null>}
 */
export async function getPublicLibraryApiKey() {
  try {
    const settings = await loadUserSettings()
    return settings?.bookApiKey || null
  } catch (error) {
    console.warn('[PublicLibrary] Failed to load API key from settings:', error)
    return null
  }
}

/**
 * Export the proxy URL for frontend use
 * @param {string} imageUrl - Original image URL
 * @returns {string} - Proxied URL
 */
export function proxyImageUrl(imageUrl) {
  return _getProxiedImageUrl(imageUrl)
}

/**
 * Get proxied image URL for display (re-export for backward compatibility)
 * @param {string} imageUrl - Original image URL
 * @returns {string|null} - Proxied URL or null
 */
export function getProxiedImageUrl(imageUrl) {
  return _getProxiedImageUrl(imageUrl)
}

/**
 * Clean text content
 */
function cleanText(text) {
  return text?.replace(/\s+/g, ' ').trim() || ''
}

/**
 * Search for books on Public Library by fetching and parsing HTML
 * @param {string} query - Search query
 * @returns {Promise<Array>} - Array of book search results
 */
export async function searchBooks(query) {
  if (!query || query.trim().length === 0) {
    throw new Error('Search query is required')
  }

  const baseUrl = await getPublicLibraryBaseUrl()
  const apiKey = await getPublicLibraryApiKey()
  const searchUrl = `${baseUrl}/search?q=${encodeURIComponent(query.trim())}`

  try {
    // Add API key to URL if available
    const urlWithKey = apiKey ? `${searchUrl}&key=${encodeURIComponent(apiKey)}` : searchUrl
    const proxyUrl = getProxiedTextUrl(urlWithKey)
    const response = await fetch(proxyUrl)

    if (!response.ok) {
      throw new Error(`Proxy error: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''

    let html
    if (contentType.includes('application/json')) {
      const data = await response.json()
      html = data.content || data.html || data.data || JSON.stringify(data)
    } else {
      html = await response.text()
    }

    return parseSearchResults(html, baseUrl)
  } catch (error) {
    console.error('[PublicLibrary] Search error:', error)
    throw new Error(`Search failed: ${error.message}`)
  }
}

/**
 * Parse search results HTML from Public Library
 * @param {string} html - Raw HTML content
 * @param {string} baseUrl - The base URL for the public library
 * @returns {Array} - Parsed book results
 */
function parseSearchResults(html, baseUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results = []

  // Look for all links that go to book detail pages (/md5/ or /db/ paths)
  const bookLinks = doc.querySelectorAll('a[href^="/md5/"], a[href^="/db/"]')

  bookLinks.forEach((link, index) => {
    // Find the parent card/container - look for a broader container
    // Try multiple levels of parents to find one that might contain the image
    let card = link.closest('div[class]')
    if (!card) card = link.parentElement

    // Extract title from the link itself
    const titleEl = link
    let title = cleanText(titleEl?.textContent)

    // Skip if no valid title
    if (!title || title.length < 2) return

    // Try to find cover image - search in broader context
    let coverUrl = null

    // Method 1: Look for img in the card (current container)
    let img = card?.querySelector('img')

    // Method 2: If no img in card, try parent/ancestor containers
    if (!img) {
      let parent = card?.parentElement
      let depth = 0
      while (parent && depth < 5) {
        img = parent.querySelector('img')
        if (img) {
          // Check if this img is reasonably close (within same subtree)
          if (parent.contains(link)) {
            break
          }
          img = null
        }
        parent = parent.parentElement
        depth++
      }
    }

    // Method 3: Look for all images in document and try to match by proximity
    if (!img) {
      const allImages = doc.querySelectorAll('img')
      // For small number of books, try to match images by checking distance
      for (const testImg of allImages) {
        // Get the distance between link and this image
        let testParent = testImg.closest('div[class]')
        if (testParent && testParent.contains(link)) {
          img = testImg
          break
        }
      }
    }

    // Extract cover URL from found image
    if (img) {
      coverUrl = img.src || img.getAttribute('data-src') || img.getAttribute('data-lazy') ||
                 img.getAttribute('srcset')?.split(' ')[0] || null
    }

    // Method 4: Look for data-coverurl attribute on any element
    if (!coverUrl) {
      const coverEl = card?.querySelector('[data-coverurl], [data-cover-url], [data-cover]')
      if (coverEl) {
        coverUrl = coverEl.getAttribute('data-coverurl') ||
                   coverEl.getAttribute('data-cover-url') ||
                   coverEl.getAttribute('data-cover') || null
      }
    }

    // Get the detail page URL
    const detailPath = link.getAttribute('href')
    const detailUrl = detailPath ? `${baseUrl}${detailPath}` : null

    // Check if EPUB format is available
    // Public Library shows format in the card text like "EPUB · 26.5MB"
    const cardText = card.textContent
    const hasEpub = /EPUB/i.test(cardText)
    const isAvailable = /[✓✅]/i.test(cardText.substring(0, 200))

    // Extract author - try multiple approaches
    let author = 'Unknown'

    // Method 1: Look for specific class names
    const authorEl = card.querySelector('[class*="author"], .author')
    if (authorEl) {
      const authorText = cleanText(authorEl.textContent)
      if (authorText && authorText.length < 100 && !authorText.includes('EPUB') && !authorText.includes('MB')) {
        author = authorText
      }
    }

    // Method 2: Look for text that appears near the title but before format info
    if (author === 'Unknown') {
      // Get all text nodes in the card, excluding the title itself
      const allText = card.textContent
      const lines = allText.split('\n').map(l => cleanText(l)).filter(l => l.length > 0)

      // Look for lines that could be author names (usually short, no numbers/filesize info)
      for (const line of lines) {
        // Skip if it contains format info, file sizes, or the title itself
        if (line.includes(title) || line.includes('EPUB') || line.includes('MB') ||
            line.includes('PDF') || /\d{4}/.test(line) || line.includes('Save')) {
          continue
        }
        // Author names are usually 2-50 chars, don't start with special chars
        if (line.length >= 2 && line.length <= 50 && /^[a-zA-Z\u4e00-\u9fa5\s\.\-]+$/.test(line)) {
          author = line
          break
        }
      }
    }

    // Method 3: Look for elements near the title
    if (author === 'Unknown') {
      const titleParent = titleEl.parentElement
      if (titleParent) {
        const siblings = Array.from(titleParent.children)
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
    }

    // Only add if it has EPUB format
    if (hasEpub && detailUrl) {
      results.push({
        id: `public-library-${index}`,
        title,
        author,
        coverUrl,
        detailUrl,
        format: 'EPUB',
        source: 'public-library'
      })
    }
  })

  // If no results found with the above method, try alternative selectors
  if (results.length === 0) {
    // Look for any link with book-like content that mentions EPUB
    const allLinks = doc.querySelectorAll('a[href]')
    let index = 0

    for (const link of allLinks) {
      const href = link.getAttribute('href')
      if (!href || (!href.startsWith('/md5/') && !href.startsWith('/db/'))) continue

      const sibling = link.nextElementSibling || link.previousElementSibling
      const parent = link.parentElement

      if (!parent) continue

      const parentText = parent.textContent
      if (!/EPUB/i.test(parentText)) continue

      const title = cleanText(link.textContent || parent.querySelector('h1, h2, h3, h4')?.textContent)
      if (!title || title.length < 2) continue

      const fallbackCoverUrl = parent.querySelector('img')?.src || null

      results.push({
        id: `public-library-${index++}`,
        title,
        author: 'Unknown',
        coverUrl: fallbackCoverUrl,
        detailUrl: `${baseUrl}${href}`,
        format: 'EPUB',
        source: 'public-library'
      })

      if (results.length >= 20) break
    }
  }

  return results.slice(0, 20) // Limit to 20 results
}

/**
 * Get download links for a book by fetching detail page via browse proxy
 * @param {string} detailUrl - URL to the book detail page
 * @returns {Promise<Object>} - Book details with download links
 */
export async function getBookDownloadLinks(detailUrl) {
  if (!detailUrl) {
    throw new Error('Detail URL is required')
  }

  console.log('[PublicLibrary] Fetching detail page:', detailUrl)

  try {
    // Use the browse proxy to fetch the detail page
    const proxyUrl = getProxiedBrowseUrl(detailUrl)
    console.log('[PublicLibrary] Browse proxy URL:', proxyUrl)

    const response = await fetch(proxyUrl)

    if (!response.ok) {
      throw new Error(`Browse proxy error: HTTP ${response.status}`)
    }

    const contentType = response.headers.get('content-type') || ''
    console.log('[PublicLibrary] Response content-type:', contentType)

    let html
    if (contentType.includes('application/json')) {
      const data = await response.json()
      html = data.content || data.html || data.data || JSON.stringify(data)
    } else {
      html = await response.text()
    }

    console.log('[PublicLibrary] HTML length:', html.length)

    const result = parseBookDetails(html, detailUrl)
    console.log('[PublicLibrary] Found download links:', result.downloadLinks.length)

    return result
  } catch (error) {
    console.error('[PublicLibrary] Details error:', error)
    throw new Error(`Failed to get book details: ${error.message}`)
  }
}

/**
 * Parse book details HTML to extract download links
 * @param {string} html - HTML content from detail page
 * @param {string} pageUrl - The page URL (for resolving relative URLs)
 * @returns {Object} - Book details with download links
 */
function parseBookDetails(html, pageUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const downloadLinks = []

  // Extract origin from pageUrl for resolving relative URLs
  const pageOrigin = new URL(pageUrl).origin

  console.log('[PublicLibrary] Parsing book details...')

  // Priority Method: Look for all "Slow Partner Server" links
  const allLinks = Array.from(doc.querySelectorAll('a[href]'))
  const slowServerLinks = allLinks.filter(link => {
    const href = link.getAttribute('href')
    const text = link.textContent.trim()
    // Match by URL pattern or text content
    return href?.includes('/slow_download/') ||
           text.includes('Slow Partner Server') ||
           text.includes('(no waitlist')
  })

  console.log('[PublicLibrary] Slow Partner Server links found:', slowServerLinks.length)

  slowServerLinks.forEach((link, index) => {
    const href = link.getAttribute('href')
    const text = link.textContent.trim()
    console.log(`[PublicLibrary] Slow Server Link ${index + 1}:`, text, '-', href)

    if (href && !href.startsWith('#') && !href.startsWith('javascript:')) {
      let absoluteUrl = href
      if (href.startsWith('/')) {
        absoluteUrl = `${pageOrigin}${href}`
      }

      // Only add if not already in the list
      if (!downloadLinks.find(l => l.url === absoluteUrl)) {
        downloadLinks.push({
          url: absoluteUrl,
          type: 'EPUB',
          text: text,
          priority: true
        })
      }
    }
  })

  // If no slow server link found, try other methods
  if (downloadLinks.length === 0) {
    // Public Library groups direct download links in specific containers
    // Look for common patterns: download buttons, mirror lists, etc.

    // Method 1: Look for links inside download/mirror containers
    const downloadContainers = doc.querySelectorAll([
      '.download-list',
      '.mirror-list',
      '.downloads',
      '[class*="download"]',
      '[id*="download"]',
      'ul.js-download-list',
      'div.downloads'
    ].join(', '))

    console.log('[PublicLibrary] Download containers found:', downloadContainers.length)

    downloadContainers.forEach(container => {
      const links = container.querySelectorAll('a[href]')
      links.forEach(link => {
        const href = link.getAttribute('href')
        if (!href) return

        // Skip non-download links
        if (href.startsWith('#') || href.startsWith('javascript:')) return

        // Convert relative URLs to absolute
        let absoluteUrl = href
        if (href.startsWith('/')) {
          absoluteUrl = `${pageOrigin}${href}`
        }

        // Extract file type from URL or text
        const text = link.textContent.trim().toLowerCase()
        let type = 'Unknown'
        if (text.includes('epub') || href.includes('.epub')) type = 'EPUB'
        else if (text.includes('pdf') || href.includes('.pdf')) type = 'PDF'
        else if (text.includes('mobi') || href.includes('.mobi')) type = 'MOBI'
        else if (text.includes('azw3') || href.includes('.azw3')) type = 'AZW3'

        // Only add if not already in the list
        if (!downloadLinks.find(l => l.url === absoluteUrl)) {
          downloadLinks.push({
            url: absoluteUrl,
            type: type,
            text: link.textContent.trim() || 'Download'
          })
        }
      })
    })
  }

  // Method 3: If no links found in containers, look for all download-related links
  if (downloadLinks.length === 0) {
    const allLinks = doc.querySelectorAll('a[href]')

    allLinks.forEach(link => {
      const href = link.getAttribute('href')
      const text = link.textContent.toLowerCase()

      // Look for download-related links
      if (href && (
        text.includes('download') ||
        text.includes('get') ||
        text.includes('epub') ||
        text.includes('mirror') ||
        text.includes('libgen') ||
        text.includes('zlibrary') ||
        text.includes('ipfs') ||
        text.includes('torrent') ||
        href.includes('download') ||
        href.includes('/get/') ||
        href.includes('mirror') ||
        href.includes('libgen') ||
        href.includes('zlib')
      )) {
        // Skip anchors and javascript links
        if (href.startsWith('#') || href.startsWith('javascript:')) return

        // Convert relative URLs to absolute
        let absoluteUrl = href
        if (href.startsWith('/')) {
          absoluteUrl = `${pageOrigin}${href}`
        }

        // Only add if not already in the list
        if (!downloadLinks.find(l => l.url === absoluteUrl)) {
          let type = 'Unknown'
          if (text.includes('epub') || href.includes('.epub')) type = 'EPUB'
          else if (text.includes('pdf') || href.includes('.pdf')) type = 'PDF'
          else if (text.includes('mobi') || href.includes('.mobi')) type = 'MOBI'

          downloadLinks.push({
            url: absoluteUrl,
            type: type,
            text: link.textContent.trim() || 'Download'
          })
        }
      }
    })
  }

  // Method 4: Look for direct file extensions (.epub, .pdf, etc.)
  const fileExtensions = ['.epub', '.pdf', '.mobi', '.azw3', '.djvu']
  if (downloadLinks.length === 0) {
    const allLinks = doc.querySelectorAll('a[href]')
    allLinks.forEach(link => {
      const href = link.getAttribute('href')
      if (!href) return

      const hrefLower = href.toLowerCase()
      const hasFileExtension = fileExtensions.some(ext => hrefLower.includes(ext))

      if (hasFileExtension) {
        let absoluteUrl = href
        if (href.startsWith('/')) {
          absoluteUrl = `${pageOrigin}${href}`
        }

        if (!downloadLinks.find(l => l.url === absoluteUrl)) {
          const ext = fileExtensions.find(e => hrefLower.includes(e)) || ''
          const type = ext.replace('.', '').toUpperCase() || 'Unknown'

          downloadLinks.push({
            url: absoluteUrl,
            type: type,
            text: link.textContent.trim() || `Download ${type}`
          })
        }
      }
    })
  }

  console.log('[PublicLibrary] Total download links found:', downloadLinks.length)
  downloadLinks.forEach((link, index) => {
    console.log(`[PublicLibrary] Link ${index + 1}:`, link.type, '-', link.text, '-', link.url)
  })

  return {
    downloadLinks,
    pageUrl
  }
}

/**
 * Download a book file through the binary proxy
 * @param {string} downloadUrl - URL to download the book from
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<ArrayBuffer>} - Book file data as ArrayBuffer
 */
export async function downloadBookFile(downloadUrl, onProgress = null) {
  if (!downloadUrl) {
    throw new Error('Download URL is required')
  }

  console.log('[PublicLibrary] Starting download:', downloadUrl)

  try {
    return await fetchBinaryContent(downloadUrl, onProgress)
  } catch (error) {
    console.error('[PublicLibrary] Download error:', error)
    throw new Error(`Download failed: ${error.message}`)
  }
}

/**
 * Fast download a book using the Public Library API
 * @param {string} detailUrl - The book detail page URL (e.g., /md5/xxxx or /db/xxxx)
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<ArrayBuffer>} - Book file data as ArrayBuffer
 */
export async function fastDownloadBook(detailUrl, onProgress = null) {
  if (!detailUrl) {
    throw new Error('Detail URL is required')
  }

  const baseUrl = await getPublicLibraryBaseUrl()
  const apiKey = await getPublicLibraryApiKey()

  console.log('[PublicLibrary] Fast download for:', detailUrl)

  // Check if API key is configured
  if (!apiKey) {
    throw new Error('API key is required for fast download. Please add your Public Library API key in settings.')
  }

  // Extract the MD5 from the detailUrl
  // URLs can be like:
  // - https://example.com/md5/d6e1dc51a50726f00ec438af21952a45
  // - /md5/d6e1dc51a50726f00ec438af21952a45
  // MD5 is a 32-character hex string
  const md5Pattern = /[a-f0-9]{32}/i
  const md5Match = detailUrl.match(md5Pattern)

  if (!md5Match) {
    throw new Error('Could not extract valid MD5 from URL. The URL should contain a 32-character MD5 hash.')
  }

  const md5 = md5Match[0]

  // Validate MD5 format (32 character hex string)
  if (!/^[a-f0-9]{32}$/i.test(md5)) {
    throw new Error('Invalid MD5 format. Expected 32-character hex string.')
  }

  console.log('[PublicLibrary] MD5:', md5)

  // Construct the fast download API URL
  const fastDownloadUrl = `${baseUrl}/dyn/api/fast_download.json?md5=${encodeURIComponent(md5)}&key=${encodeURIComponent(apiKey)}`

  console.log('[PublicLibrary] Fast download API URL:', fastDownloadUrl)

  onProgress?.(10)

  // Fetch the fast download info via proxy (only for the API call)
  const proxyUrl = getProxiedTextUrl(fastDownloadUrl)
  const response = await fetch(proxyUrl)

  // Get response text for parsing
  const responseText = await response.text()
  console.log('[PublicLibrary] Response status:', response.status)
  console.log('[PublicLibrary] Response body:', responseText.substring(0, 500))

  let data
  try {
    data = JSON.parse(responseText)
  } catch (e) {
    throw new Error('Invalid JSON response from API: ' + responseText.substring(0, 200))
  }

  console.log('[PublicLibrary] Parsed response:', data)

  onProgress?.(30)

  // Check for API error response
  // Public Library API returns errors with download_url: null and error field
  if (data.download_url === null) {
    const errorMsg = data.error || 'Unknown API error'
    throw new Error(`Fast download API error: ${errorMsg}`)
  }

  if (data.error) {
    throw new Error(`Fast download API error: ${data.error}`)
  }

  // Extract download URL from response
  // Public Library returns: { download_url: "...", account_fast_download_info: {...} }
  const downloadUrl = data.download_url

  if (!downloadUrl) {
    throw new Error('No download URL in API response')
  }

  console.log('[PublicLibrary] Download URL from API:', downloadUrl)

  onProgress?.(50)

  // Download the book file DIRECTLY (no proxy)
  console.log('[PublicLibrary] Starting direct download')
  const fileResponse = await fetch(downloadUrl)

  if (!fileResponse.ok) {
    throw new Error(`Download failed: HTTP ${fileResponse.status}`)
  }

  onProgress?.(75)

  const buffer = await fileResponse.arrayBuffer()
  console.log('[PublicLibrary] Downloaded buffer size:', buffer.byteLength)

  onProgress?.(100)

  return buffer
}
