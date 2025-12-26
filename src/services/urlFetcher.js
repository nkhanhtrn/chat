/**
 * URL Fetcher Service
 * Detects URLs in text and fetches their content via backend proxy
 */

// URL detection regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

// Backend API URL (configure based on environment)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

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
 * Fetch URL content via backend API
 * @param {string} url - URL to fetch
 * @param {Object} options - Options
 * @param {number} options.maxLength - Max content length (default 8000)
 * @returns {Promise<string>} - Fetched text content
 */
export async function fetchUrlContent(url, options = {}) {
  const { maxLength = 8000 } = options

  const response = await fetch(`${API_BASE_URL}/api/fetch`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, maxLength })
  })

  if (!response.ok) {
    throw new Error(`Backend error: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Fetch failed')
  }

  return data.content
}

/**
 * Fetch multiple URLs in parallel
 * @param {string[]} urls - Array of URLs to fetch
 * @param {Object} options - Options passed to fetchUrlContent
 * @returns {Promise<Object>} - Map of url -> { success: boolean, content: string, error?: string }
 */
export async function fetchMultipleUrls(urls, options = {}) {
  const results = {}

  await Promise.all(
    urls.map(async url => {
      try {
        const content = await fetchUrlContent(url, options)
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
