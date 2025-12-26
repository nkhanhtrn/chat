/**
 * Web Search Service
 * Performs web searches via DuckDuckGo HTML and parses results
 */

// CORS proxies for search requests
const SEARCH_PROXIES = [
  {
    name: 'corsproxy.io',
    template: 'https://corsproxy.io/?{url}'
  },
  {
    name: 'allorigins-raw',
    template: 'https://api.allorigins.win/raw?url={url}'
  }
]

const SEARCH_TIMEOUT = 15000

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
 * Parse DuckDuckGo HTML search results
 * @param {string} html - Raw HTML from DuckDuckGo
 * @returns {Array<{title: string, url: string, snippet: string}>}
 */
function parseDuckDuckGoResults(html) {
  const results = []
  const doc = new DOMParser().parseFromString(html, 'text/html')

  // DuckDuckGo HTML lite results are in .result elements
  const resultElements = doc.querySelectorAll('.result, .results_links')

  resultElements.forEach((el) => {
    const linkEl = el.querySelector('a.result__a, a.result-link')
    const snippetEl = el.querySelector('.result__snippet, .result-snippet')

    if (linkEl) {
      const title = linkEl.textContent?.trim() || ''
      let url = linkEl.getAttribute('href') || ''

      // DuckDuckGo uses redirect URLs, extract the real URL
      if (url.includes('uddg=')) {
        const match = url.match(/uddg=([^&]+)/)
        if (match) {
          url = decodeURIComponent(match[1])
        }
      }

      const snippet = snippetEl?.textContent?.trim() || ''

      if (title && url) {
        results.push({ title, url, snippet })
      }
    }
  })

  // Fallback: try to find any links that look like search results
  if (results.length === 0) {
    const allLinks = doc.querySelectorAll('a[href*="http"]')
    allLinks.forEach((link) => {
      const href = link.getAttribute('href') || ''
      const text = link.textContent?.trim() || ''

      // Skip internal DDG links
      if (href.includes('duckduckgo.com') || !text || text.length < 10) return

      // Extract URL from DDG redirect
      let url = href
      if (href.includes('uddg=')) {
        const match = href.match(/uddg=([^&]+)/)
        if (match) {
          url = decodeURIComponent(match[1])
        }
      }

      if (url.startsWith('http') && !results.some(r => r.url === url)) {
        results.push({
          title: text.substring(0, 100),
          url,
          snippet: ''
        })
      }
    })
  }

  return results.slice(0, 10) // Limit to 10 results
}

/**
 * Perform a web search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @param {number} options.maxResults - Maximum results to return (default 5)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, options = {}) {
  const { maxResults = 5 } = options

  // Use DuckDuckGo HTML lite
  const searchUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
  let lastError = null

  for (const proxy of SEARCH_PROXIES) {
    const proxyUrl = proxy.template.replace('{url}', encodeURIComponent(searchUrl))

    try {
      const response = await fetchWithTimeout(proxyUrl, SEARCH_TIMEOUT)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const html = await response.text()
      const results = parseDuckDuckGoResults(html)

      if (results.length > 0) {
        return results.slice(0, maxResults)
      }

      // If no results parsed, try next proxy
      throw new Error('No results parsed')
    } catch (error) {
      lastError = error
      console.warn(`Search proxy ${proxy.name} failed:`, error.message)
    }
  }

  throw new Error(`Web search failed: ${lastError?.message || 'Unknown error'}`)
}

/**
 * Format search results for inclusion in a prompt
 * @param {Array<{title: string, url: string, snippet: string}>} results
 * @returns {string}
 */
export function formatSearchResultsForPrompt(results) {
  if (!results || results.length === 0) return ''

  const formatted = results.map((r, i) => {
    let entry = `${i + 1}. ${r.title}\n   URL: ${r.url}`
    if (r.snippet) {
      entry += `\n   ${r.snippet}`
    }
    return entry
  }).join('\n\n')

  return `--- Web Search Results ---\n${formatted}\n--- End of Search Results ---`
}
