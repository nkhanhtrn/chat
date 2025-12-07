import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat.js'

/**
 * Composable for searching across all notebooks
 *
 * @param {Object} options
 * @param {boolean} options.includeNotebooks - Whether to include notebook title matches (default: false)
 * @param {boolean} options.includeAncestors - Whether to include ancestor breadcrumbs (default: false)
 * @returns {Object} - Search state and methods
 */
export function useGlobalSearch({ includeNotebooks = false, includeAncestors = false } = {}) {
  const chatStore = useChatStore()
  const query = ref('')

  /**
   * Get the ancestor path for a message (for breadcrumb display)
   */
  const getAncestorPath = (messageId) => {
    if (!includeAncestors) return []

    const ancestors = []
    let msg = chatStore.getMessageById(messageId)

    while (msg?.parentId) {
      const parent = chatStore.getMessageById(msg.parentId)
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
   */
  const searchMessageTree = (messageId, searchWords, chat, rootId, rootIndex) => {
    const results = []
    const message = chatStore.getMessageById(messageId)
    if (!message) return results

    const questionText = message.questionSummarized || message.question || ''
    const lowerText = questionText.toLowerCase()

    // Match if ALL search words are found
    if (searchWords.every(word => lowerText.includes(word))) {
      results.push({
        id: message.id,
        text: questionText,
        chatId: chat.id,
        rootId,
        rootIndex,
        notebookId: chat.id,
        notebookTitle: chat.title || 'Untitled Notebook',
        ancestors: getAncestorPath(message.id),
        type: 'question'
      })
    }

    // Search children recursively
    if (message.childIds) {
      for (const childId of message.childIds) {
        results.push(...searchMessageTree(childId, searchWords, chat, rootId, rootIndex))
      }
    }

    return results
  }

  /**
   * Computed search results across ALL notebooks
   */
  const results = computed(() => {
    const trimmedQuery = query.value.trim().toLowerCase()
    if (!trimmedQuery) return []

    // Split query into individual words for multi-word search
    const searchWords = trimmedQuery.split(/\s+/).filter(w => w.length > 0)
    const allResults = []

    for (const chat of chatStore.chatList) {
      const notebookTitle = chat.title || 'Untitled Notebook'

      // Optionally search notebook titles
      if (includeNotebooks) {
        const lowerTitle = notebookTitle.toLowerCase()
        if (searchWords.every(word => lowerTitle.includes(word))) {
          allResults.push({
            id: chat.id,
            text: notebookTitle,
            chatId: chat.id,
            notebookId: chat.id,
            notebookTitle,
            ancestors: [],
            type: 'notebook'
          })
        }
      }

      // Search questions within notebook
      for (const question of chat.questions) {
        if (question) {
          allResults.push(...searchMessageTree(
            question.id,
            searchWords,
            chat,
            question.id,
            question.rootIndex
          ))
        }
      }
    }

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
    clear
  }
}
