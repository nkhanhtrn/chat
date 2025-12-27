/**
 * Web Search Handler
 *
 * Handles web search operations and content fetching for the task router.
 */

import { searchWeb } from '../webSearch.js'
import { fetchUrlContent, cleanHtml } from '../urlFetcher.js'

/**
 * Perform web search and fetch content from results
 * @param {string} query - Search query
 * @param {Object} callbacks - Callback functions for progress updates
 * @param {AbortSignal|null} signal - Abort signal
 * @returns {Promise<Array>} Array of search results with content
 */
export const performWebSearch = async (query, callbacks = {}, signal = null) => {
  const {
    onWebSearchStart,
    onWebSearchProgress,
    onWebSearchResult,
    onWebSearchComplete
  } = callbacks

  let webSearchResults = []

  if (onWebSearchStart) {
    onWebSearchStart(query)
  }

  try {
    const searchResults = await searchWeb(query, { maxResults: 3 })

    const searchResultsMeta = searchResults.map(r => ({
      url: r.url,
      title: r.title,
      snippet: r.snippet
    }))

    if (onWebSearchProgress) {
      onWebSearchProgress({ phase: 'search_complete', resultsCount: searchResults.length, results: searchResultsMeta })
    }

    if (signal?.aborted) return []

    if (onWebSearchProgress) {
      onWebSearchProgress({ phase: 'fetching', total: searchResults.length, results: searchResultsMeta })
    }

    const fetchPromises = searchResults.map(async (searchResult, i) => {
      try {
        const rawContent = await fetchUrlContent(searchResult.url)
        const pageContent = cleanHtml(rawContent)
        const result = {
          query,
          url: searchResult.url,
          title: searchResult.title,
          content: pageContent,
          success: true
        }
        if (onWebSearchResult) onWebSearchResult(result, i)
        return result
      } catch (fetchError) {
        const result = {
          query,
          url: searchResult.url,
          title: searchResult.title,
          content: searchResult.snippet || 'Could not fetch page content',
          success: false,
          error: fetchError.message
        }
        if (onWebSearchResult) onWebSearchResult(result, i)
        return result
      }
    })

    webSearchResults = await Promise.all(fetchPromises)
  } catch (searchError) {
    console.warn(`Search failed for query "${query}":`, searchError.message)
    if (onWebSearchProgress) {
      onWebSearchProgress({ phase: 'error', error: searchError.message })
    }
  }

  if (onWebSearchComplete) {
    onWebSearchComplete(webSearchResults)
  }

  return webSearchResults
}

/**
 * Format web search results for inclusion in prompt
 * @param {Array} results - Array of search results
 * @returns {string} Formatted string for prompt
 */
export const formatWebSearchContent = (results) => {
  if (!results || results.length === 0) return ''

  return results.map((r, i) => {
    return `--- Source ${i + 1}: ${r.title} ---\nURL: ${r.url}\n\n${r.content}\n--- End of Source ${i + 1} ---`
  }).join('\n\n')
}

export default {
  performWebSearch,
  formatWebSearchContent
}
