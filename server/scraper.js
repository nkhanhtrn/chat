import { JSDOM } from 'jsdom'

const FETCH_TIMEOUT = 15000
const SEARCH_TIMEOUT = 15000

/**
 * Fetch with timeout
 */
async function fetchWithTimeout(url, options = {}, timeout = FETCH_TIMEOUT) {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeout)

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        ...options.headers
      }
    })
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
 * Extract readable text from HTML
 */
function extractTextFromHtml(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document

  // Remove unwanted elements
  const selectorsToRemove = [
    'script', 'style', 'nav', 'header', 'footer',
    'aside', 'noscript', 'iframe', 'svg', 'form',
    '.nav', '.header', '.footer', '.sidebar', '.ad', '.advertisement'
  ]

  selectorsToRemove.forEach(selector => {
    doc.querySelectorAll(selector).forEach(el => el.remove())
  })

  // Try to find main content
  const mainContent =
    doc.querySelector('main, article, .content, #content, .post, .article, .entry-content, .post-content') ||
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
 * Fetch URL and extract text content
 * Focus on extracting readable data, not API structures
 */
export async function fetchUrl(url, options = {}) {
  const { maxLength = 8000 } = options

  const response = await fetchWithTimeout(url)

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`)
  }

  const contentType = response.headers.get('content-type') || ''
  const text = await response.text()

  let content

  // For HTML pages - extract readable text content
  if (contentType.includes('text/html') || text.trim().startsWith('<')) {
    content = extractTextFromHtml(text)
  } else {
    // For other content (JSON, plain text, etc.) - just use as-is
    // LLM can interpret raw data formats well
    content = text
  }

  if (content.length > maxLength) {
    content = content.substring(0, maxLength) + '\n\n[Content truncated...]'
  }

  return content
}

/**
 * Clean up title text
 */
function cleanTitle(text) {
  return text?.replace(/\s+/g, ' ').trim() || ''
}

/**
 * Parse Brave Search HTML results
 */
function parseBraveResults(html) {
  const dom = new JSDOM(html)
  const doc = dom.window.document
  const results = []

  // Brave search results - look for result cards
  const resultDivs = doc.querySelectorAll('[data-type="web"], .snippet.fdb')

  resultDivs.forEach((div) => {
    // Find the main result link (usually has the actual URL)
    const linkEl = div.querySelector('a.result-header, a[href^="http"]:not([href*="brave.com"])')
    const titleEl = div.querySelector('.snippet-title, .title, h2 span, h3')
    const snippetEl = div.querySelector('.snippet-description, .snippet-content')

    if (linkEl) {
      const url = linkEl.getAttribute('href') || ''
      const title = cleanTitle(titleEl?.textContent || linkEl.textContent)
      const snippet = cleanTitle(snippetEl?.textContent)

      // Skip internal/irrelevant links
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
  const dom = new JSDOM(html)
  const doc = dom.window.document
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
 * Perform web search - tries multiple search engines
 */
export async function searchWeb(query, options = {}) {
  const { maxResults = 5 } = options
  const errors = []

  // Try Brave Search first
  try {
    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`
    const response = await fetchWithTimeout(braveUrl, {}, SEARCH_TIMEOUT)

    if (response.ok) {
      const html = await response.text()
      const results = parseBraveResults(html)
      if (results.length > 0) {
        return results.slice(0, maxResults)
      }
    }
  } catch (err) {
    errors.push(`Brave: ${err.message}`)
  }

  // Fallback to DuckDuckGo HTML
  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const response = await fetchWithTimeout(ddgUrl, {}, SEARCH_TIMEOUT)

    if (response.ok) {
      const html = await response.text()
      const results = parseDDGResults(html)
      if (results.length > 0) {
        return results.slice(0, maxResults)
      }
    }
  } catch (err) {
    errors.push(`DDG: ${err.message}`)
  }

  throw new Error(`Search failed: ${errors.join(', ') || 'No results found'}`)
}
