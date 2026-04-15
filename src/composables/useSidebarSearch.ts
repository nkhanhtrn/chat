import { ref, computed } from 'vue'
import type { ComputedRef } from 'vue'

interface QuestionLike { id: string }
interface MessageLike { id: string; parentId: string | null; childIds: string[]; questionSummarized: string | null; question: string }

export function useSidebarSearch(options: {
  getMessageById: (id: string) => MessageLike | null
  chatQuestions: ComputedRef<QuestionLike[]>
}) {
  const { getMessageById, chatQuestions } = options
  const query = ref('')

  const getAncestorPath = (messageId: string): Array<{ id: string; text: string }> => {
    const ancestors: Array<{ id: string; text: string }> = []
    let msg = getMessageById(messageId)
    while (msg?.parentId) {
      const parent = getMessageById(msg.parentId)
      if (parent) ancestors.unshift({ id: parent.id, text: parent.questionSummarized || parent.question || 'Untitled' })
      msg = parent
    }
    return ancestors
  }

  const searchMessageTree = (messageId: string, searchWords: string[], rootIndex: number): Array<Record<string, unknown>> => {
    const results: Array<Record<string, unknown>> = []
    const message = getMessageById(messageId)
    if (!message) return results
    const questionText = message.questionSummarized || message.question || ''
    if (searchWords.every(word => questionText.toLowerCase().includes(word))) {
      results.push({ id: message.id, text: questionText, rootIndex, ancestors: getAncestorPath(message.id) })
    }
    if (message.childIds) {
      for (const childId of message.childIds) results.push(...searchMessageTree(childId, searchWords, rootIndex))
    }
    return results
  }

  const results = computed(() => {
    const trimmed = query.value.trim().toLowerCase()
    if (!trimmed) return []
    const words = trimmed.split(/\s+/).filter(w => w.length > 0)
    const all: Array<Record<string, unknown>> = []
    const questions = chatQuestions.value ?? []
    questions.forEach((q, index) => { all.push(...searchMessageTree(q.id, words, index)) })
    return all
  })

  const isSearchActive = computed(() => query.value.trim().length > 0)
  const clear = () => { query.value = '' }

  return { query, results, isSearchActive, clear, getAncestorPath }
}
