/**
 * Web Search Service
 * Performs web searches via backend proxy
 */

// Backend API URL (configure based on environment)
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

/**
 * Perform a web search
 * @param {string} query - Search query
 * @param {Object} options - Options
 * @param {number} options.maxResults - Maximum results to return (default 5)
 * @returns {Promise<Array<{title: string, url: string, snippet: string}>>}
 */
export async function searchWeb(query, options = {}) {
  const { maxResults = 5 } = options

  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, maxResults })
  })

  if (!response.ok) {
    throw new Error(`Backend error: HTTP ${response.status}`)
  }

  const data = await response.json()

  if (!data.success) {
    throw new Error(data.error || 'Search failed')
  }

  return data.results
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
