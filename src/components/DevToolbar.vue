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
      @click="handleGenerateNotebookSummaries"
      class="dev-button"
      :disabled="isGeneratingNotebookSummaries || notebookMissingSummaryCount === 0 || !currentNotebookId"
      title="Generate summaries for all questions in current notebook"
      variant="secondary"
    >
      {{ notebookSummaryButtonText }}
    </Button>
    <Button
      @click="handleClearNotebookSummaries"
      class="dev-button"
      :disabled="notebookSummaryCount === 0 || !currentNotebookId"
      title="Clear all summaries in current notebook"
      variant="secondary"
    >
      {{ clearSummariesButtonText }}
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
  generateSummariesForNotebook,
  getSummaryCountInNotebook,
  clearSummariesInNotebook
} = useSpacedRepetition()

// Current notebook
const currentNotebookId = computed(() => chatStore.currentChatId)

// Count of cards in SR system
const srCardCount = computed(() => Object.keys(chatStore.srData).length)

const srButtonText = computed(() => {
  if (uninitializedCount.value === 0) {
    return 'All questions in SR'
  }
  return `Add ${uninitializedCount.value} to SR`
})

// Notebook-specific summary generation state
const isGeneratingNotebookSummaries = ref(false)
const notebookSummaryProgress = ref({ completed: 0, total: 0, status: 'idle' })

const notebookMissingSummaryCount = computed(() => {
  if (!currentNotebookId.value) return 0
  return getMissingSummaryCountInNotebook(currentNotebookId.value)
})

const notebookSummaryButtonText = computed(() => {
  if (!currentNotebookId.value) {
    return 'No notebook'
  }
  if (isGeneratingNotebookSummaries.value) {
    const { completed, total, status } = notebookSummaryProgress.value
    if (status === 'generating') {
      return `Notebook ${completed + 1}/${total}...`
    } else if (status === 'waiting') {
      return `Notebook ${completed}/${total} - waiting...`
    }
    return `Notebook ${completed}/${total}`
  }
  if (notebookMissingSummaryCount.value === 0) {
    return 'Notebook summaries done'
  }
  return `Gen ${notebookMissingSummaryCount.value} notebook summaries`
})

// Count of summaries in current notebook
const notebookSummaryCount = computed(() => {
  if (!currentNotebookId.value) return 0
  return getSummaryCountInNotebook(currentNotebookId.value)
})

const clearSummariesButtonText = computed(() => {
  if (!currentNotebookId.value) {
    return 'No notebook'
  }
  if (notebookSummaryCount.value === 0) {
    return 'No summaries'
  }
  return `Clear ${notebookSummaryCount.value} summaries`
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

const handleGenerateNotebookSummaries = async () => {
  if (isGeneratingNotebookSummaries.value || notebookMissingSummaryCount.value === 0 || !currentNotebookId.value) return

  isGeneratingNotebookSummaries.value = true
  notebookSummaryProgress.value = { completed: 0, total: notebookMissingSummaryCount.value, status: 'generating' }

  try {
    await generateSummariesForNotebook(
      currentNotebookId.value,
      chatStore.currentModel,
      (progress) => {
        notebookSummaryProgress.value = progress
      }
    )
  } catch (error) {
    console.error('Failed to generate notebook summaries:', error)
  } finally {
    isGeneratingNotebookSummaries.value = false
    notebookSummaryProgress.value = { completed: 0, total: 0, status: 'idle' }
  }
}

const handleClearNotebookSummaries = () => {
  if (!currentNotebookId.value || notebookSummaryCount.value === 0) return

  if (confirm(`Are you sure you want to clear all ${notebookSummaryCount.value} summaries in this notebook?`)) {
    clearSummariesInNotebook(currentNotebookId.value)
  }
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
