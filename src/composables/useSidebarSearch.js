import { ref, computed } from 'vue'

/**
 * Composable for managing sidebar search functionality
 * Handles search query, filtering, and result formatting with ancestor paths
 *
 * @param {Object} options
 * @param {Function} options.getMessageById - Function to get message by ID
 * @param {import('vue').ComputedRef<Array>} options.chatQuestions - Computed ref of current chat's root questions
 * @returns {Object} - Search state and methods
 */
export function useSidebarSearch({ getMessageById, chatQuestions }) {
  const query = ref('')

  /**
   * Get the ancestor path for a message (for breadcrumb display)
   * @param {string} messageId - Message ID
   * @returns {Array<{id: string, text: string}>} - Array of ancestors from root to parent
   */
  const getAncestorPath = (messageId) => {
    const ancestors = []
    let msg = getMessageById(messageId)

    while (msg?.parentId) {
      const parent = getMessageById(msg.parentId)
      if (parent) {
        ancestors.unshift({
          id: parent.id,
          text: parent.questionSummarized || parent.question || 'Untitled'
        })
      }
      msg = parent
    }
    return ancestors
  }

  /**
   * Search through a message tree recursively
   * @param {string} messageId - Starting message ID
   * @param {string[]} searchWords - Array of search words (all must match)
   * @param {number} rootIndex - Index of the root message
   * @returns {Array} - Array of matching results
   */
  const searchMessageTree = (messageId, searchWords, rootIndex) => {
    const results = []
    const message = getMessageById(messageId)
    if (!message) return results

    const questionText = message.questionSummarized || message.question || ''
    const lowerText = questionText.toLowerCase()

    // Match if ALL search words are found
    if (searchWords.every(word => lowerText.includes(word))) {
      results.push({
        id: message.id,
        text: questionText,
        rootIndex,
        ancestors: getAncestorPath(message.id)
      })
    }

    // Search children recursively
    if (message.childIds) {
      for (const childId of message.childIds) {
        results.push(...searchMessageTree(childId, searchWords, rootIndex))
      }
    }

    return results
  }

  /**
   * Computed search results with ancestor paths
   */
  const results = computed(() => {
    const trimmedQuery = query.value.trim().toLowerCase()
    if (!trimmedQuery) return []

    // Split query into individual words for multi-word search
    const searchWords = trimmedQuery.split(/\s+/).filter(w => w.length > 0)
    const allResults = []

    // Search through all root questions
    const questions = chatQuestions.value || []
    questions.forEach((question, index) => {
      allResults.push(...searchMessageTree(question.id, searchWords, index))
    })

    return allResults
  })

  /**
   * Check if search is active (has non-empty query)
   */
  const isSearchActive = computed(() => query.value.trim().length > 0)

  /**
   * Clear the search query
   */
  const clear = () => {
    query.value = ''
  }

  return {
    query,
    results,
    isSearchActive,
    clear,
    getAncestorPath
  }
}
