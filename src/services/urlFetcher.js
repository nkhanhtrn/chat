/**
 * URL Fetcher Service
 * Generic proxy service for fetching URLs through backend
 *
 * Requires a custom fetch URL to be set in settings.
 */

import { Settings } from './Settings.js'

// URL detection regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

// Domains that should never be proxied (internal services, APIs)
const NO_PROXY_DOMAINS = [
  'firestore.googleapis.com',
  'firebaseio.com',
  'firebase.googleapis.com',
  'gstatic.com',
  'googleapis.com',
  'us-central1-nk-cloud-323802.cloudfunctions.net'
]

/**
 * Check if a URL should bypass the proxy
 * @param {string} url - URL to check
 * @returns {boolean} - True if URL should bypass proxy
 */
export function shouldBypassProxy(url) {
  if (!url) return false
  try {
    const hostname = new URL(url).hostname.toLowerCase()
    // Check exact matches and subdomains
    return NO_PROXY_DOMAINS.some(domain => {
      return hostname === domain || hostname.endsWith(`.${domain}`)
    })
  } catch {
    return false
  }
}

// Cache for settings to avoid repeated lookups
let settingsCache = null
let settingsCacheTimestamp = 0
const SETTINGS_CACHE_TTL = 30000 // 30 seconds

// Cached proxy base URL (updated when settings change)
let cachedProxyBaseUrl = null

/**
 * Get the custom fetch URL from settings (cached)
 * @returns {Promise<string|null>}
 */
export async function getCustomFetchUrl() {
  const now = Date.now()
  if (settingsCache && (now - settingsCacheTimestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.customFetchUrl || null
  }

  const customFetchUrl = Settings.getString('customFetchUrl')
  settingsCache = { customFetchUrl }
  settingsCacheTimestamp = now
  return customFetchUrl || null
}

/**
 * Invalidate the settings cache (call when settings change)
 */
export async function invalidateFetchSettingsCache() {
  settingsCache = null
  settingsCacheTimestamp = 0
  // Update cached proxy URL
  const url = await getCustomFetchUrl()
  cachedProxyBaseUrl = url
}

/**
 * Get the proxy base URL (synchronous, uses cached value)
 * @returns {string|null} - Proxy URL or null if not configured
 */
export function getProxyBaseUrl() {
  return cachedProxyBaseUrl || null
}

/**
 * Initialize the proxy base URL cache on module load
 * This ensures the cache is populated on app startup, not just when settings change
 */
getCustomFetchUrl().then(url => {
  cachedProxyBaseUrl = url
}).catch(() => {
  // Silently fail - proxy is optional for AI services
})

/**
 * Get proxied image URL for display
 * @param {string} imageUrl - Original image URL
 * @returns {string|null} - Proxied URL or null if proxy not configured or should bypass
 */
export function getProxiedImageUrl(imageUrl) {
  if (!imageUrl) return null
  if (shouldBypassProxy(imageUrl)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/fetchBinaryContent?url=${encodeURIComponent(imageUrl)}`
}

/**
 * Get proxied URL for text/HTML content
 * @param {string} url - Original URL
 * @returns {string|null} - Proxied URL or null if proxy not configured or should bypass
 */
export function getProxiedTextUrl(url) {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`
}

/**
 * Get proxied URL for browsing
 * @param {string} url - Original URL
 * @returns {string|null} - Proxied URL or null if proxy not configured or should bypass
 */
export function getProxiedBrowseUrl(url) {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/browse?url=${encodeURIComponent(url)}`
}

/**
 * Get proxied URL for binary download
 * @param {string} url - Original URL
 * @returns {string|null} - Proxied URL or null if proxy not configured or should bypass
 */
export function getProxiedBinaryUrl(url) {
  if (shouldBypassProxy(url)) return null
  const proxyUrl = getProxyBaseUrl()
  if (!proxyUrl) return null
  return `${proxyUrl}/browseBinary?url=${encodeURIComponent(url)}`
}

/**
 * Fetch text/HTML content through proxy
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - Text content
 */
export async function fetchTextContent(url) {
  // Check if should bypass proxy
  if (shouldBypassProxy(url)) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      const data = await response.json()
      return data.content || data.html || data.data || JSON.stringify(data)
    }
    return await response.text()
  }

  const proxyUrl = getProxiedTextUrl(url)
  if (!proxyUrl) {
    throw new Error('Proxy URL not configured. Please set a custom fetch URL in settings.')
  }

  const response = await fetch(proxyUrl)

  if (!response.ok) {
    throw new Error(`Proxy error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''

  if (contentType.includes('application/json')) {
    const data = await response.json()
    return data.content || data.html || data.data || JSON.stringify(data)
  }

  return await response.text()
}

/**
 * Fetch binary content through proxy
 * @param {string} url - URL to fetch
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<ArrayBuffer>} - Binary data
 */
export async function fetchBinaryContent(url, onProgress = null) {
  // Check if should bypass proxy
  if (shouldBypassProxy(url)) {
    onProgress?.(10)
    const response = await fetch(url)
    onProgress?.(50)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    onProgress?.(80)
    const buffer = await response.arrayBuffer()
    onProgress?.(100)
    return buffer
  }

  const proxyUrl = getProxiedBinaryUrl(url)
  if (!proxyUrl) {
    throw new Error('Proxy URL not configured. Please set a custom fetch URL in settings.')
  }

  onProgress?.(10)

  const response = await fetch(proxyUrl)
  onProgress?.(50)

  if (!response.ok) {
    throw new Error(`Binary proxy error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''

  // Check if we got HTML (might be a download page)
  if (contentType.includes('text/html') || contentType.includes('html')) {
    const html = await response.text()

    // Try to find direct download link in the page
    const actualUrl = findDirectDownloadLink(html, url)

    if (actualUrl) {
      const fileProxyUrl = getProxiedBinaryUrl(actualUrl)
      if (!fileProxyUrl) {
        throw new Error('Proxy URL not configured. Please set a custom fetch URL in settings.')
      }

      const fileResponse = await fetch(fileProxyUrl)
      onProgress?.(80)

      if (!fileResponse.ok) {
        throw new Error(`File download error: HTTP ${fileResponse.status}`)
      }

      return await fileResponse.arrayBuffer()
    } else {
      throw new Error('Could not find direct download link')
    }
  }

  onProgress?.(80)
  const buffer = await response.arrayBuffer()
  onProgress?.(100)

  return buffer
}

/**
 * Find direct download link in a download page HTML
 * @param {string} html - HTML content
 * @param {string} pageUrl - Page URL
 * @returns {string|null} - Direct download URL or null
 */
function findDirectDownloadLink(html, pageUrl) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Look for direct file links
  const fileExtensions = ['.epub', '.pdf', '.mobi', '.azw3', '.djvu']
  for (const ext of fileExtensions) {
    const links = doc.querySelectorAll(`a[href$="${ext}"]`)
    if (links.length > 0) {
      let href = links[0].getAttribute('href')
      if (href.startsWith('/')) {
        const origin = new URL(pageUrl).origin
        return `${origin}${href}`
      }
      return href
    }
  }

  // Look for links with "download" in text/href
  const downloadLinks = doc.querySelectorAll('a[href*="download"], a[href*="get"]')
  for (const link of downloadLinks) {
    const href = link.getAttribute('href')
    if (href) {
      if (href.startsWith('/')) {
        const origin = new URL(pageUrl).origin
        return `${origin}${href}`
      }
      return href
    }
  }

  return null
}

/**
 * Detect URLs in text
 * @param {string} text - Text to search for URLs
 * @returns {string[]} - Array of unique URLs found
 */
export function detectUrls(text) {
  const matches = text.match(URL_REGEX) || []
  return [...new Set(matches)]
}

/**
 * Fetch via custom fetch service (GET request with URL as query param)
 * Supports responses in format:
 * - JSON: { success: true, content: "..." } or { content: "..." }
 * - Plain text: raw HTML content
 *
 * @param {string} url - URL to fetch
 * @param {string} customFetchUrl - Custom fetch service base URL (domain only)
 * @returns {Promise<string>}
 */
async function fetchViaCustomService(url, customFetchUrl) {
  // Remove trailing slash and append the endpoint path
  const baseUrl = customFetchUrl.replace(/\/$/, '')
  const fetchUrl = `${baseUrl}/fetchWebsiteContent?url=${encodeURIComponent(url)}`
  const response = await fetch(fetchUrl)

  if (!response.ok) {
    throw new Error(`Custom fetch service error: HTTP ${response.status}`)
  }

  const contentType = response.headers.get('content-type') || ''

  // Handle JSON response
  if (contentType.includes('application/json')) {
    const data = await response.json()

    // Support { success, content } or { content } or { data } formats
    if (data.success === false) {
      throw new Error(data.error || data.message || 'Custom fetch failed')
    }

    return data.content || data.data || data.html || data.body || JSON.stringify(data)
  }

  // Handle plain text/HTML response
  return await response.text()
}

/**
 * Clean HTML by removing scripts, styles, and other non-content elements
 * @param {string} html - Raw HTML content
 * @returns {string} - Clean text content
 */
export function cleanHtml(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  // Remove unwanted elements
  doc.querySelectorAll('script, style, noscript, iframe, nav, header, footer, aside, svg, form, [hidden]').forEach(el => el.remove())

  // Try to find main content
  const mainContent = doc.querySelector('main, article, .content, #content, .post, .article') || doc.body

  // Get text content and clean up whitespace
  return (mainContent?.textContent || '')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()
}

/**
 * Fetch URL content through custom fetch service.
 * Requires a custom fetch URL to be configured in settings.
 *
 * URLs in NO_PROXY_DOMAINS will be fetched directly without proxy.
 *
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - Fetched content (raw HTML)
 * @throws {Error} If no custom fetch URL is configured or fetch fails
 */
export async function fetchUrlContent(url) {
  // Bypass proxy for certain domains (Firebase, Google APIs, etc.)
  if (shouldBypassProxy(url)) {
    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
    return await response.text()
  }

  const customFetchUrl = await getCustomFetchUrl()

  if (!customFetchUrl) {
    throw new Error(
      'No custom fetch URL configured. Please set a custom fetch URL in settings to fetch external content.'
    )
  }

  try {
    return await fetchViaCustomService(url, customFetchUrl)
  } catch (error) {
    console.warn('Custom fetch service failed:', error.message)
    throw new Error(`Failed to fetch ${url}: ${error.message}`)
  }
}

/**
 * Fetch multiple URLs in parallel
 * @param {string[]} urls - Array of URLs to fetch
 * @returns {Promise<Object>} - Map of url -> { success: boolean, content: string, error?: string }
 */
export async function fetchMultipleUrls(urls) {
  const results = {}

  await Promise.all(
    urls.map(async url => {
      try {
        const content = await fetchUrlContent(url)
        results[url] = { success: true, content }
      } catch (error) {
        results[url] = { success: false, content: '', error: error.message }
      }
    })
  )

  return results
}

/**
 * Format fetched content for inclusion in a prompt
 * @param {Object} fetchedContents - Map of url -> content
 * @returns {string} - Formatted string with all URL contents
 */
export function formatFetchedContentForPrompt(fetchedContents) {
  const entries = Object.entries(fetchedContents).filter(
    ([, content]) => content && content.trim()
  )

  if (entries.length === 0) return ''

  return entries
    .map(
      ([url, content]) =>
        `--- Content from ${url} ---\n${content}\n--- End of ${url} ---`
    )
    .join('\n\n')
}
