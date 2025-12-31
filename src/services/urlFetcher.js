/**
 * URL Fetcher Service
 * Detects URLs in text and fetches their content via backend proxy
 *
 * Fallback chain:
 * 1. Custom fetch URL (if set in settings)
 * 2. Local server (API_BASE_URL)
 * 3. Public CORS proxy services
 */

import { loadUserSettings } from './firestore.js'

// URL detection regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

// Backend API URL (configure based on environment)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'


// Cache for settings to avoid repeated lookups
let settingsCache = null
let settingsCacheTimestamp = 0
const SETTINGS_CACHE_TTL = 30000 // 30 seconds

/**
 * Get the custom fetch URL from settings (cached)
 * @returns {Promise<string|null>}
 */
export async function getCustomFetchUrl() {
  const now = Date.now()
  if (settingsCache && (now - settingsCacheTimestamp) < SETTINGS_CACHE_TTL) {
    return settingsCache.customFetchUrl || null
  }

  try {
    const settings = await loadUserSettings()
    settingsCache = settings || {}
    settingsCacheTimestamp = now
    return settings?.customFetchUrl || null
  } catch (error) {
    console.warn('Failed to load settings for custom fetch URL:', error)
    return null
  }
}

/**
 * Invalidate the settings cache (call when settings change)
 */
export function invalidateFetchSettingsCache() {
  settingsCache = null
  settingsCacheTimestamp = 0
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
 * @param {string} customFetchUrl - Custom fetch service URL
 * @returns {Promise<string>}
 */
async function fetchViaCustomService(url, customFetchUrl) {
  const fetchUrl = `${customFetchUrl}?url=${encodeURIComponent(url)}`
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
 * Fetch via local server
 * @param {string} url - URL to fetch
 * @returns {Promise<string>}
 */
async function fetchViaLocalServer(url) {
  const response = await fetch(`${API_BASE_URL}/api/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url })
  })

  if (!response.ok) {
    throw new Error(`Local server error: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Local server fetch failed')
  }

  return data.content
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
 * Fetch URL content with fallback chain:
 * 1. Custom fetch URL (if set)
 * 2. Local server
 *
 * @param {string} url - URL to fetch
 * @returns {Promise<string>} - Fetched content (raw HTML)
 */
export async function fetchUrlContent(url) {
  const errors = []
  let content = null

  // 1. Try custom fetch URL first (if set)
  const customFetchUrl = await getCustomFetchUrl()
  if (customFetchUrl) {
    try {
      content = await fetchViaCustomService(url, customFetchUrl)
    } catch (error) {
      console.warn('Custom fetch service failed:', error.message)
      errors.push(`Custom service: ${error.message}`)
    }
  }

  // 2. Try local server
  if (!content) {
    try {
      content = await fetchViaLocalServer(url)
    } catch (error) {
      console.warn('Local server failed:', error.message)
      errors.push(`Local server: ${error.message}`)
    }
  }

  // All methods failed
  if (!content) {
    throw new Error(`All fetch methods failed for ${url}. Errors: ${errors.join('; ')}`)
  }

  return content
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
