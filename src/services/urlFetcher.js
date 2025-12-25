/**
 * URL Fetcher Service
 * Detects URLs in text and fetches their content via CORS proxy
 */

// URL detection regex - matches http/https URLs
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/gi

// Free CORS proxy services with their URL templates
// {url} will be replaced with the encoded URL
// Ordered by reliability (most reliable first)
const CORS_PROXIES = [
  {
    name: 'corsproxy.io',
    template: 'https://corsproxy.io/?{url}',
    parseResponse: data => data
  },
  {
    name: 'allorigins',
    template: 'https://api.allorigins.win/get?url={url}',
    parseResponse: data => data.contents
  },
  {
    name: 'allorigins-raw',
    template: 'https://api.allorigins.win/raw?url={url}',
    parseResponse: data => data
  },
  {
    name: 'codetabs',
    template: 'https://api.codetabs.com/v1/proxy?quest={url}',
    parseResponse: data => data
  },
  {
    name: 'corsh',
    template: 'https://corsh.vercel.app/?url={url}',
    parseResponse: data => data
  },
  {
    name: 'thingproxy',
    template: 'https://thingproxy.freeboard.io/fetch/{rawurl}',
    parseResponse: data => data,
    useRawUrl: true
  }
]

// Timeout for proxy requests (ms)
const PROXY_TIMEOUT = 10000

// Round-robin index
let currentProxyIndex = 0

/**
 * Get the next proxy in round-robin order
 * @returns {Object} - Proxy configuration
 */
function getNextProxy() {
  const proxy = CORS_PROXIES[currentProxyIndex]
  currentProxyIndex = (currentProxyIndex + 1) % CORS_PROXIES.length
  return proxy
}

/**
 * Reset the proxy index (for testing)
 */
export function resetProxyIndex() {
  currentProxyIndex = 0
}

/**
 * Get the number of proxies (for testing)
 */
export function getProxyCount() {
  return CORS_PROXIES.length
}

/**
 * Detect URLs in text
 * @param {string} text - Text to search for URLs
 * @returns {string[]} - Array of unique URLs found
 */
export function detectUrls(text) {
  const matches = text.match(URL_REGEX) || []
  return [...new Set(matches)] // Remove duplicates
}

/**
 * Extract readable text from HTML
 * @param {string} html - HTML content
 * @returns {string} - Extracted text content
 */
export function extractTextFromHtml(html) {
  // Create a temporary element to parse HTML
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // Remove script, style, nav, header, footer elements
  const elementsToRemove = doc.querySelectorAll(
    'script, style, nav, header, footer, aside, noscript, iframe'
  )
  elementsToRemove.forEach(el => el.remove())

  // Try to find main content
  const mainContent =
    doc.querySelector('main, article, .content, #content, .post, .article') ||
    doc.body

  // Get text content
  let text = mainContent?.textContent || ''

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n/g, '\n\n')
    .trim()

  return text
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url, timeout) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, { signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error.name === 'AbortError') {
      throw new Error('Request timeout')
    }
    throw error
  }
}

/**
 * Fetch URL content via CORS proxy with round-robin and fallback
 * @param {string} url - URL to fetch
 * @param {Object} options - Options
 * @param {number} options.maxLength - Max content length (default 8000)
 * @param {number} options.timeout - Timeout per proxy in ms (default PROXY_TIMEOUT)
 * @returns {Promise<string>} - Fetched and extracted text content
 */
export async function fetchUrlContent(url, options = {}) {
  const { maxLength = 8000, timeout = PROXY_TIMEOUT } = options
  const encodedUrl = encodeURIComponent(url)

  // Try proxies starting from current round-robin position
  let lastError = null
  const errors = []

  for (let i = 0; i < CORS_PROXIES.length; i++) {
    const proxy = getNextProxy()
    const proxyUrl = proxy.template
      .replace('{url}', encodedUrl)
      .replace('{rawurl}', url)

    try {
      const response = await fetchWithTimeout(proxyUrl, timeout)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      // Parse response based on proxy type
      let content
      const contentType = response.headers.get('content-type') || ''

      if (contentType.includes('application/json')) {
        const data = await response.json()
        content = proxy.parseResponse(data) || ''
      } else {
        // Raw HTML response
        content = await response.text()
      }

      // Check if we got actual content
      if (!content || content.trim().length === 0) {
        throw new Error('Empty response')
      }

      // Extract text content from HTML
      content = extractTextFromHtml(content)

      // Check if extraction yielded content
      if (!content || content.trim().length === 0) {
        throw new Error('No text content extracted')
      }

      // Truncate if too long
      if (content.length > maxLength) {
        content = content.substring(0, maxLength) + '\n\n[Content truncated...]'
      }

      return content
    } catch (error) {
      lastError = error
      errors.push(`${proxy.name}: ${error.message}`)
      console.warn(`Proxy ${proxy.name} failed for ${url}:`, error.message)
      // Continue to next proxy
    }
  }

  // All proxies failed
  throw new Error(`Failed to fetch URL. Tried ${CORS_PROXIES.length} proxies: ${errors.join(', ')}`)
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
