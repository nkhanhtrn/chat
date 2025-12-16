<template>
  <div class="dev-toolbar">
    <Button @click="handleClearCache" class="dev-button" title="Clear localStorage cache" variant="secondary">
      Reset localStorage
    </Button>
    <Button @click="handleTriggerStaleData" class="dev-button" title="Trigger stale data banner" variant="secondary">
      {{ staleDataTriggered ? 'Stale Data Active' : 'Trigger Stale Data' }}
    </Button>
    <Button
      @click="handleInitializeSR"
      class="dev-button"
      :disabled="uninitializedCount === 0"
      title="Add all existing questions to spaced repetition"
      variant="secondary"
    >
      {{ srButtonText }}
    </Button>
    <Button
      @click="handleResetSR"
      class="dev-button"
      :disabled="srCardCount === 0"
      title="Reset all spaced repetition data"
      variant="secondary"
    >
      Reset SR ({{ srCardCount }})
    </Button>
    <Button
      @click="handleGenerateCurrentSummary"
      class="dev-button"
      :disabled="isGeneratingSummary || !canGenerateSummary"
      title="Generate summary for current question"
      variant="secondary"
    >
      {{ summaryButtonText }}
    </Button>
    <Button
      @click="handleClearSummaries"
      class="dev-button"
      :disabled="!canClearSummary"
      :title="clearSummariesTooltip"
      variant="secondary"
    >
      {{ clearSummariesButtonText }}
    </Button>
    <Button
      @click="handleRandomizeSR"
      class="dev-button"
      :disabled="dueCardCount === 0"
      title="Randomize the order of cards due today"
      variant="secondary"
    >
      Shuffle Due ({{ dueCardCount }})
    </Button>
    <Button
      @click="handleSetCreatedAt"
      class="dev-button"
      :disabled="missingCreatedAtCount === 0"
      title="Set createdAt for questions missing it, spread over 1 week"
      variant="secondary"
    >
      Set createdAt ({{ missingCreatedAtCount }})
    </Button>
    <Button
      @click="handleAddHighlightsToVocab"
      class="dev-button"
      :disabled="highlightsWithoutVocabCount === 0"
      title="Add all highlights to vocabulary SR cards"
      variant="secondary"
    >
      Highlights → Vocab ({{ highlightsWithoutVocabCount }})
    </Button>
  </div>
</template>

<script setup>
import { ref, inject, computed } from 'vue'
import { clearAllStorage } from '../services/storage.js'
import { useChatStore } from '../stores/chat.js'
import { useSpacedRepetition } from '../composables/useSpacedRepetition.js'
import Button from './Button.vue'

// Inject the trigger function from App.vue
const triggerStaleDataBanner = inject('triggerStaleDataBanner', null)
const staleDataTriggered = ref(false)

// Spaced repetition
const chatStore = useChatStore()
const {
  uninitializedCount,
  initializeAllExisting,
  getMissingSummaryCountInNotebook,
  getSummaryCountInNotebook,
  clearSummariesInNotebook,
  generateResponseSummary,
  generateSummariesForNotebook
} = useSpacedRepetition()

// Current notebook and message
const currentNotebookId = computed(() => chatStore.currentChatId)
const currentMessageId = computed(() => chatStore.currentMessageId)
const currentMessage = computed(() => currentMessageId.value ? chatStore.messagesById[currentMessageId.value] : null)

// Count of cards in SR system
const srCardCount = computed(() => Object.keys(chatStore.srData).length)

// Count of cards due today
const dueCardCount = computed(() => chatStore.cardsDueCount)

// Count of messages missing createdAt
const missingCreatedAtCount = computed(() => {
  return Object.values(chatStore.messagesById).filter(msg => !msg.createdAt).length
})

// Count of highlights/question-links with notes that don't have vocab cards
const highlightsWithoutVocabCount = computed(() => {
  let count = 0
  for (const message of Object.values(chatStore.messagesById)) {
    if (!message.customContent) continue
    for (const content of message.customContent) {
      if ((content.type === 'highlight' || content.type === 'question-link') && content.hasNote) {
        const existingCard = chatStore.findVocabCardByWord(content.text)
        if (!existingCard) count++
      }
    }
  }
  return count
})

const srButtonText = computed(() => {
  if (uninitializedCount.value === 0) {
    return 'All questions in SR'
  }
  return `Add ${uninitializedCount.value} to SR`
})

// Summary generation state
const isGeneratingSummary = ref(false)
const summaryProgress = ref({ completed: 0, total: 0 })

// Whether we're in question view (has currentMessageId) or notebook view
const isQuestionView = computed(() => Boolean(currentMessageId.value))

const currentMessageNeedsSummary = computed(() => {
  if (!currentMessage.value) return false
  return currentMessage.value.response && !currentMessage.value.responseSummary
})

const notebookMissingSummaryCount = computed(() => {
  if (!currentNotebookId.value) return 0
  return getMissingSummaryCountInNotebook(currentNotebookId.value)
})

// Button should be enabled if:
// - In question view: current message needs summary
// - In notebook view: notebook has messages missing summaries
const canGenerateSummary = computed(() => {
  if (!currentNotebookId.value) return false
  if (isQuestionView.value) {
    return currentMessageNeedsSummary.value
  }
  return notebookMissingSummaryCount.value > 0
})

const summaryButtonText = computed(() => {
  if (!currentNotebookId.value) {
    return 'No notebook'
  }
  if (isGeneratingSummary.value) {
    if (isQuestionView.value) {
      return 'Generating...'
    }
    return `Gen ${summaryProgress.value.completed}/${summaryProgress.value.total}...`
  }
  if (isQuestionView.value) {
    if (!currentMessage.value?.response) {
      return 'No response'
    }
    if (currentMessage.value.responseSummary) {
      return 'Summary exists'
    }
    return 'Gen summary'
  }
  // Notebook view
  if (notebookMissingSummaryCount.value === 0) {
    return 'All summaries done'
  }
  return `Gen ${notebookMissingSummaryCount.value} summaries`
})

// Count of summaries in current notebook
const notebookSummaryCount = computed(() => {
  if (!currentNotebookId.value) return 0
  return getSummaryCountInNotebook(currentNotebookId.value)
})

// Whether current message has a summary
const currentMessageHasSummary = computed(() => {
  return Boolean(currentMessage.value?.responseSummary)
})

// Button should be enabled if:
// - In question view: current message has a summary
// - In notebook view: notebook has summaries
const canClearSummary = computed(() => {
  if (!currentNotebookId.value) return false
  if (isQuestionView.value) {
    return currentMessageHasSummary.value
  }
  return notebookSummaryCount.value > 0
})

const clearSummariesButtonText = computed(() => {
  if (!currentNotebookId.value) {
    return 'No notebook'
  }
  if (isQuestionView.value) {
    if (!currentMessageHasSummary.value) {
      return 'No summary'
    }
    return 'Clear summary'
  }
  // Notebook view
  if (notebookSummaryCount.value === 0) {
    return 'No summaries'
  }
  return `Clear ${notebookSummaryCount.value} summaries`
})

const clearSummariesTooltip = computed(() => {
  if (isQuestionView.value) {
    return 'Clear summary for current question'
  }
  return 'Clear all summaries in current notebook'
})


const handleClearCache = () => {
  if (confirm('Are you sure you want to clear all localStorage cache? This will delete all your chat history.')) {
    clearAllStorage()
    window.location.reload()
  }
}

const handleTriggerStaleData = () => {
  if (triggerStaleDataBanner) {
    triggerStaleDataBanner()
    staleDataTriggered.value = true
  }
}

const handleInitializeSR = () => {
  if (uninitializedCount.value === 0) return
  initializeAllExisting()
}

const handleResetSR = () => {
  const count = srCardCount.value
  if (count === 0) return

  if (confirm(`Are you sure you want to reset all ${count} spaced repetition cards? This will clear all review progress.`)) {
    // Clear all SR data (keeps summaries on messages)
    chatStore.srData = {}
    chatStore._persistState()
  }
}

const handleGenerateCurrentSummary = async () => {
  if (isGeneratingSummary.value || !canGenerateSummary.value) return

  isGeneratingSummary.value = true

  try {
    if (isQuestionView.value) {
      // Generate for current message only
      const message = currentMessage.value
      if (!message?.response) return

      // Initialize SR card if not already in SR system
      if (!chatStore.srData[currentMessageId.value]) {
        chatStore.initializeSRCard(currentMessageId.value)
      }

      const summary = await generateResponseSummary(message.response, chatStore.currentModel)
      chatStore.updateSRResponseSummary(currentMessageId.value, summary)
    } else {
      // Generate for entire notebook
      summaryProgress.value = { completed: 0, total: notebookMissingSummaryCount.value }
      await generateSummariesForNotebook(
        currentNotebookId.value,
        chatStore.currentModel,
        (progress) => {
          summaryProgress.value = { completed: progress.completed, total: progress.total }
        }
      )
    }
  } catch (error) {
    console.error('Failed to generate summary:', error)
  } finally {
    isGeneratingSummary.value = false
    summaryProgress.value = { completed: 0, total: 0 }
  }
}

const handleClearSummaries = () => {
  if (!canClearSummary.value) return

  if (isQuestionView.value) {
    // Clear summary for current question only
    if (confirm('Are you sure you want to clear the summary for this question?')) {
      chatStore.updateSRResponseSummary(currentMessageId.value, null)
    }
  } else {
    // Clear all summaries in notebook
    if (confirm(`Are you sure you want to clear all ${notebookSummaryCount.value} summaries in this notebook?`)) {
      clearSummariesInNotebook(currentNotebookId.value)
    }
  }
}

const handleRandomizeSR = () => {
  const dueCount = chatStore.cardsDueCount
  if (dueCount === 0) return

  // Get all cards due today (nextReviewDate <= end of today)
  const now = Date.now()
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)
  const endOfTodayMs = endOfToday.getTime()

  const dueCardIds = []
  for (const [messageId, srInfo] of Object.entries(chatStore.srData)) {
    if (!chatStore.messagesById[messageId]) continue
    // Card is due today if nextReviewDate is not set or <= end of today
    if (!srInfo.nextReviewDate || srInfo.nextReviewDate <= endOfTodayMs) {
      dueCardIds.push(messageId)
    }
  }

  if (dueCardIds.length === 0) return

  // Shuffle the array (Fisher-Yates)
  for (let i = dueCardIds.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[dueCardIds[i], dueCardIds[j]] = [dueCardIds[j], dueCardIds[i]]
  }

  // Assign new nextReviewDate values based on shuffled order
  // Use timestamps in the past, spaced 1ms apart to maintain order
  const baseTime = now - dueCardIds.length - 1
  for (let i = 0; i < dueCardIds.length; i++) {
    const card = chatStore.srData[dueCardIds[i]]
    card.nextReviewDate = baseTime + i
  }

  chatStore._persistState()
}

const handleSetCreatedAt = () => {
  const messagesWithoutCreatedAt = Object.values(chatStore.messagesById).filter(msg => !msg.createdAt)
  if (messagesWithoutCreatedAt.length === 0) return

  const count = messagesWithoutCreatedAt.length
  if (!confirm(`Set createdAt for ${count} questions, spread over the past week?`)) return

  const now = Date.now()
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000
  const startTime = now - oneWeekMs

  // Spread messages evenly over the week
  const interval = oneWeekMs / count

  messagesWithoutCreatedAt.forEach((msg, index) => {
    msg.createdAt = Math.floor(startTime + (index * interval))
  })

  chatStore._persistState()
}

const handleAddHighlightsToVocab = () => {
  const count = highlightsWithoutVocabCount.value
  if (count === 0) return

  let added = 0
  for (const message of Object.values(chatStore.messagesById)) {
    if (!message.customContent) continue
    for (const content of message.customContent) {
      if ((content.type === 'highlight' || content.type === 'question-link') && content.hasNote) {
        const existingCard = chatStore.findVocabCardByWord(content.text)
        if (!existingCard) {
          chatStore.addVocabCard({
            word: content.text,
            definition: '',
            context: '',
            messageId: message.id,
            highlightId: content.id
          })
          added++
        }
      }
    }
  }

  console.log(`Added ${added} highlights with notes to vocabulary`)
}

</script>

<style scoped>
.dev-toolbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: #1a1a2e;
  border-bottom: 1px solid #333;
  box-sizing: border-box;
}
</style>
