/**
 * WebSearchCapability - Handles web search as a step in multi-step plans
 *
 * Pipe interface:
 * - Input: Accepts text (search query can be derived from piped text)
 * - Process: Searches web and fetches content
 * - Output: Produces 'search-results' type with fetched content
 *
 * This capability:
 * - Searches the web for information
 * - Fetches and returns content from results
 * - Outputs structured data for subsequent steps
 */

import { BaseCapability, createPipeData } from './BaseCapability.js'
import { searchWeb } from '../../webSearch.js'
import { fetchUrlContent, cleanHtml } from '../../urlFetcher.js'

export class WebSearchCapability extends BaseCapability {
  name = 'websearch'
  priority = 70  // High priority when explicitly requested

  // ===========================================================================
  // PIPE INTERFACE
  // ===========================================================================

  receiveInput(pipeInput, context) {
    return {
      data: pipeInput?.data ?? null,
      context
    }
  }

  async process(input) {
    const { context } = input
    const {
      analysis,
      signal,
      callbacks = {}
    } = context

    const { onWebSearchStart, onWebSearchProgress, onWebSearchResult, onWebSearchComplete } = callbacks
    const query = analysis.searchQuery || analysis.taskDescription

    if (onWebSearchStart) onWebSearchStart(query)

    try {
      const searchResults = await searchWeb(query, { maxResults: 3 })

      if (onWebSearchProgress) {
        onWebSearchProgress({
          phase: 'search_complete',
          resultsCount: searchResults.length,
          results: searchResults.map(r => ({ url: r.url, title: r.title, snippet: r.snippet }))
        })
      }

      if (signal?.aborted) {
        return { success: false, result: null, error: 'Aborted' }
      }

      // Fetch content from each result
      const fetchedResults = await Promise.all(
        searchResults.map(async (searchResult, i) => {
          try {
            const rawContent = await fetchUrlContent(searchResult.url)
            const content = cleanHtml(rawContent)
            const result = {
              url: searchResult.url,
              title: searchResult.title,
              content,
              success: true
            }
            if (onWebSearchResult) onWebSearchResult(result, i)
            return result
          } catch (err) {
            const result = {
              url: searchResult.url,
              title: searchResult.title,
              content: searchResult.snippet || '',
              success: false,
              error: err.message
            }
            if (onWebSearchResult) onWebSearchResult(result, i)
            return result
          }
        })
      )

      if (onWebSearchComplete) onWebSearchComplete(fetchedResults)

      return {
        success: true,
        result: fetchedResults,
        error: null,
        metadata: { query, resultCount: fetchedResults.length }
      }
    } catch (err) {
      if (onWebSearchProgress) {
        onWebSearchProgress({ phase: 'error', error: err.message })
      }
      return {
        success: false,
        result: null,
        error: err.message
      }
    }
  }

  produceOutput(processResult) {
    const { success, result, error } = processResult
    return createPipeData(success ? result : { error }, this.name)
  }

  /**
   * Web search always chains to text capability for response generation
   */
  getChainTo(processResult, context) {
    // Chain to text capability to generate a summary of search results
    return processResult.success ? 'text' : null
  }

  // ===========================================================================
  // LEGACY INTERFACE
  // ===========================================================================

  getRouterDescription() {
    return {
      name: 'websearch',
      description: 'Searches the web for CURRENT information. Use when the user needs real-time or recent data that may not be in training data.',
      conditions: [
        'User explicitly asks to search the internet/web',
        'Current/real-time information (prices, weather, news)',
        'Recent events or updates after knowledge cutoff',
        'Facts that need verification from web sources',
        'Research requiring multiple current sources'
      ],
      examples: [
        { input: 'Search the internet for Python tutorials' },
        { input: 'What is the current Bitcoin price?' },
        { input: 'What\'s the weather in Tokyo?' },
        { input: 'Latest news about AI' }
      ]
    }
  }

  canHandle(analysis) {
    return analysis.capability === 'websearch' ||
           (analysis.needsWebSearch === true && analysis.searchQuery)
  }

  getSystemPrompt() {
    return 'You are a web search assistant.'
  }

  formatOutput(result) {
    if (!result || !Array.isArray(result)) {
      return { type: 'text', content: 'No results', displayHint: 'plain' }
    }
    return {
      type: 'websearch',
      content: result,
      displayHint: 'sources'
    }
  }
}

export default WebSearchCapability
