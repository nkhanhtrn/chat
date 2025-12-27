/**
 * Web Search Service
 * Performs web searches directly via urlFetcher (no backend needed)
 */

import { fetchUrlContent } from './urlFetcher.js'

/**
 * Parse Brave Search HTML results
 */
function parseBraveResults(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results = []

  // Brave search results - look for result cards
  const resultDivs = doc.querySelectorAll('[data-type="web"], .snippet.fdb')

  resultDivs.forEach((div) => {
    const linkEl = div.querySelector('a.result-header, a[href^="http"]:not([href*="brave.com"])')
    const titleEl = div.querySelector('.snippet-title, .title, h2 span, h3')
    const snippetEl = div.querySelector('.snippet-description, .snippet-content')

    if (linkEl) {
      const url = linkEl.getAttribute('href') || ''
      const title = (titleEl?.textContent || linkEl.textContent || '').replace(/\s+/g, ' ').trim()
      const snippet = (snippetEl?.textContent || '').replace(/\s+/g, ' ').trim()

      if (url && title && title.length > 3 &&
          !url.includes('brave.com') &&
          !url.includes('/search?') &&
          url.startsWith('http')) {
        if (!results.some(r => r.url === url)) {
          results.push({ title: title.substring(0, 150), url, snippet: snippet.substring(0, 300) })
        }
      }
    }
  })

  return results.slice(0, 10)
}

/**
 * Parse DuckDuckGo HTML Lite results
 */
function parseDDGResults(html) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results = []

  // DDG HTML lite uses simple structure
  const links = doc.querySelectorAll('a.result__a')

  links.forEach((link) => {
    let url = link.getAttribute('href') || ''
    const title = link.textContent?.trim() || ''

    // Extract real URL from DDG redirect
    if (url.includes('uddg=')) {
      const match = url.match(/uddg=([^&]+)/)
      if (match) url = decodeURIComponent(match[1])
    }

    const snippetEl = link.closest('.result')?.querySelector('.result__snippet')
    const snippet = snippetEl?.textContent?.trim() || ''

    if (url && title && url.startsWith('http')) {
      results.push({ title, url, snippet })
    }
  })

  return results.slice(0, 10)
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
  const errors = []

  // Try DuckDuckGo HTML first (more reliable structure)
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await fetchUrlContent(ddgUrl)
    const results = parseDDGResults(html)
    if (results.length > 0) {
      return results.slice(0, maxResults)
    }
  } catch (err) {
    errors.push(`DDG: ${err.message}`)
  }

  // Fallback to Brave Search
  try {
    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`
    const html = await fetchUrlContent(braveUrl)
    const results = parseBraveResults(html)
    if (results.length > 0) {
      return results.slice(0, maxResults)
    }
  } catch (err) {
    errors.push(`Brave: ${err.message}`)
  }

  throw new Error(`Search failed: ${errors.join(', ') || 'No results found'}`)
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
