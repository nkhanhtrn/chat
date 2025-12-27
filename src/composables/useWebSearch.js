import { ref, computed } from 'vue'

/**
 * Composable for managing web search state in StudioChat
 */
export function useWebSearch() {
  // Search state
  const isSearching = ref(false)
  const searchQuery = ref('')
  const searchStatus = ref('')

  /**
   * Create callbacks for web search events
   * @param {Object} options - Options with message update callback
   * @param {Function} options.updateMessage - Function to update current message
   * @param {Function} options.scrollToBottom - Function to scroll chat to bottom
   * @returns {Object} Callbacks object for taskRouter
   */
  function createSearchCallbacks({ updateMessage, scrollToBottom }) {
    return {
      onWebSearchStart: (query) => {
        isSearching.value = true
        searchQuery.value = query
        searchStatus.value = 'Searching...'
        updateMessage({ webSearchQuery: query })
        scrollToBottom()
      },

      onWebSearchProgress: (progress) => {
        if (progress.phase === 'search_complete') {
          searchStatus.value = `Found ${progress.resultsCount} results`
          updateMessage({
            webSearchTotal: progress.resultsCount,
            webSearchPending: progress.results,
            webSearchResults: []
          })
        } else if (progress.phase === 'fetching') {
          searchStatus.value = `Fetching ${progress.total} pages...`
        } else if (progress.phase === 'error') {
          searchStatus.value = `Search failed: ${progress.error}`
        }
        scrollToBottom()
      },

      onWebSearchResult: (result, index, getMessage) => {
        const msg = getMessage()
        if (!msg.webSearchResults) {
          msg.webSearchResults = []
        }
        // Insert at correct index to maintain order
        msg.webSearchResults[index] = result
        // Update status
        const fetchedCount = msg.webSearchResults.filter(r => r).length
        const total = msg.webSearchTotal || 3
        searchStatus.value = `Fetched ${fetchedCount}/${total} pages...`
        scrollToBottom()
      },

      onWebSearchComplete: (results, updateMessageResults) => {
        isSearching.value = false
        searchQuery.value = ''
        searchStatus.value = ''
        updateMessageResults(results.filter(r => r))
        scrollToBottom()
      }
    }
  }

  /**
   * Reset search state
   */
  function reset() {
    isSearching.value = false
    searchQuery.value = ''
    searchStatus.value = ''
  }

  return {
    // State
    isSearching,
    searchQuery,
    searchStatus,

    // Actions
    createSearchCallbacks,
    reset
  }
}
