import { ref, computed } from 'vue'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'

export function useGlobalSearch(options: { includeNotebooks?: boolean; includeAncestors?: boolean } = {}) {
  const { includeNotebooks = false, includeAncestors = false } = options
  const notebookStore = useNotebookStore()
  const treeStore = useMessageTreeStore()
  const query = ref('')

  const getAncestorPath = (messageId: string): Array<{ id: string; text: string }> => {
    if (!includeAncestors) return []
    const ancestors: Array<{ id: string; text: string }> = []
    let msg = treeStore.getMessageById(messageId)
    while (msg?.parentId) {
      const parent = treeStore.getMessageById(msg.parentId)
      if (parent) {
        ancestors.unshift({ id: parent.id, text: parent.questionSummarized || parent.question || 'Untitled' })
      }
      msg = parent
    }
    return ancestors
  }

  const searchMessageTree = (
    messageId: string, searchWords: string[], chat: { id: string; title: string }, rootId: string, rootIndex: number
  ): Array<Record<string, unknown>> => {
    const results: Array<Record<string, unknown>> = []
    const message = treeStore.getMessageById(messageId)
    if (!message) return results

    const questionText = message.questionSummarized || message.question || ''
    const lowerText = questionText.toLowerCase()

    if (searchWords.every(word => lowerText.includes(word))) {
      results.push({
        id: message.id, text: questionText, chatId: chat.id, rootId, rootIndex,
        notebookId: chat.id, notebookTitle: chat.title || 'Untitled Notebook',
        ancestors: getAncestorPath(message.id), type: 'question',
      })
    }

    if (message.childIds) {
      for (const childId of message.childIds) {
        results.push(...searchMessageTree(childId, searchWords, chat, rootId, rootIndex))
      }
    }
    return results
  }

  const results = computed(() => {
    const trimmedQuery = query.value.trim().toLowerCase()
    if (!trimmedQuery) return []

    const searchWords = trimmedQuery.split(/\s+/).filter(w => w.length > 0)
    const allResults: Array<Record<string, unknown>> = []

    for (const chat of notebookStore.chatList) {
      const notebookTitle = chat.title || 'Untitled Notebook'

      if (includeNotebooks) {
        const lowerTitle = notebookTitle.toLowerCase()
        if (searchWords.every(word => lowerTitle.includes(word))) {
          allResults.push({ id: chat.id, text: notebookTitle, chatId: chat.id, notebookId: chat.id, notebookTitle, ancestors: [], type: 'notebook' })
        }
      }

      for (const question of chat.questions) {
        allResults.push(...searchMessageTree(question.id, searchWords, { id: chat.id, title: notebookTitle }, question.id, question.rootIndex))
      }
    }
    return allResults
  })

  const isSearchActive = computed(() => query.value.trim().length > 0)
  const clear = () => { query.value = '' }

  return { query, results, isSearchActive, clear }
}
