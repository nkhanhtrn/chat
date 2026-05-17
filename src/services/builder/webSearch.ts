import { fetchUrlContent, fetchTextContent } from '@/services/urlFetcher'

export interface SearchResult {
  title: string
  url: string
  snippet: string
  content?: string
}

function parseDDGResults(html: string): SearchResult[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results: SearchResult[] = []

  const links = doc.querySelectorAll('a.result__a')
  links.forEach((link) => {
    let url = link.getAttribute('href') || ''
    const title = link.textContent?.trim() || ''

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

function parseBraveResults(html: string): SearchResult[] {
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')
  const results: SearchResult[] = []

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

export async function searchWeb(query: string, maxResults = 5): Promise<SearchResult[]> {
  const errors: string[] = []

  try {
    const ddgUrl = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`
    const html = await fetchUrlContent(ddgUrl)
    const results = parseDDGResults(html)
    if (results.length > 0) return results.slice(0, maxResults)
  } catch (err: any) {
    errors.push(`DDG: ${err.message}`)
  }

  try {
    const braveUrl = `https://search.brave.com/search?q=${encodeURIComponent(query)}`
    const html = await fetchUrlContent(braveUrl)
    const results = parseBraveResults(html)
    if (results.length > 0) return results.slice(0, maxResults)
  } catch (err: any) {
    errors.push(`Brave: ${err.message}`)
  }

  throw new Error(`Search failed: ${errors.join(', ') || 'No results found'}`)
}

export async function fetchResultContent(results: SearchResult[]): Promise<SearchResult[]> {
  const enriched = await Promise.all(
    results.map(async (r) => {
      try {
        const html = await fetchTextContent(r.url)
        const parser = new DOMParser()
        const doc = parser.parseFromString(html, 'text/html')
        doc.querySelectorAll('script, style, noscript, iframe, nav, header, footer, aside, svg, form, [hidden]')
          .forEach(el => el.remove())
        const main = doc.querySelector('main, article, .content, #content, .post, .article') || doc.body
        const content = (main?.textContent || '').replace(/\s+/g, ' ').replace(/\n\s*\n/g, '\n\n').trim()
        return { ...r, content: content.substring(0, 3000) }
      } catch {
        return r
      }
    })
  )
  return enriched
}

export function formatSearchResultsForPrompt(results: SearchResult[]): string {
  if (!results || results.length === 0) return ''

  const formatted = results.map((r, i) => {
    let entry = `${i + 1}. ${r.title}\n   URL: ${r.url}`
    if (r.content) {
      entry += `\n   Content: ${r.content}`
    } else if (r.snippet) {
      entry += `\n   ${r.snippet}`
    }
    return entry
  }).join('\n\n')

  return `--- Web Search Results ---\n${formatted}\n--- End of Search Results ---`
}

const SEARCH_MARKER_RE = /<!--\s*@search:\s*(.+?)\s*-->/

export function extractSearchQuery(response: string): { query: string; cleanResponse: string } | null {
  const match = response.match(SEARCH_MARKER_RE)
  if (!match) return null
  return {
    query: match[1].trim(),
    cleanResponse: response.replace(SEARCH_MARKER_RE, '').trim(),
  }
}
