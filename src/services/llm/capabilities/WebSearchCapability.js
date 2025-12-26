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
import { fetchUrlContent } from '../../urlFetcher.js'

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
            const content = await fetchUrlContent(searchResult.url, { maxLength: 6000 })
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

  async execute(context, pipeInput = null) {
    const transformedInput = this.receiveInput(pipeInput, context)
    const processResult = await this.process(transformedInput)
    const pipeOutput = this.produceOutput(processResult)

    return {
      ...processResult,
      pipe: pipeOutput
    }
  }

  // ===========================================================================
  // LEGACY INTERFACE
  // ===========================================================================

  getRouterDescription() {
    return {
      name: 'WEBSEARCH',
      description: 'search the web for current information',
      conditions: [
        'Need current/real-time information (prices, news, weather)',
        'Information after knowledge cutoff',
        'Facts that need verification from sources',
        'Research requiring multiple web sources'
      ],
      antiConditions: [
        'Static calculations or conversions',
        'Questions about provided content/attachments',
        'Creative tasks not requiring facts'
      ],
      outputSchema: {
        searchQuery: 'string (what to search for)'
      },
      examples: [
        {
          input: 'what is the current Bitcoin price',
          output: {
            capability: 'websearch',
            taskDescription: 'Search for current Bitcoin price',
            searchQuery: 'Bitcoin BTC price USD today',
            expectedOutput: 'Current price information'
          }
        }
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
