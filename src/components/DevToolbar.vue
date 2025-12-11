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
      @click="handleGenerateSummaries"
      class="dev-button"
      :disabled="isGeneratingSummaries || missingSummaryCount === 0"
      title="Generate summaries for all SR cards missing them"
      variant="secondary"
    >
      {{ summaryButtonText }}
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
const { uninitializedCount, initializeAllExisting, missingSummaryCount, generateAllMissingSummaries } = useSpacedRepetition()

// Summary generation state
const isGeneratingSummaries = ref(false)
const summaryProgress = ref({ completed: 0, total: 0, status: 'idle' })

// Count of cards in SR system
const srCardCount = computed(() => Object.keys(chatStore.srData).length)

const srButtonText = computed(() => {
  if (uninitializedCount.value === 0) {
    return 'All questions in SR'
  }
  return `Add ${uninitializedCount.value} to SR`
})

const summaryButtonText = computed(() => {
  if (isGeneratingSummaries.value) {
    const { completed, total, status } = summaryProgress.value
    if (status === 'generating') {
      return `Generating ${completed + 1}/${total}...`
    } else if (status === 'waiting') {
      return `${completed}/${total} - waiting...`
    }
    return `${completed}/${total}`
  }
  if (missingSummaryCount.value === 0) {
    return 'All summaries done'
  }
  return `Gen ${missingSummaryCount.value} summaries`
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

const handleGenerateSummaries = async () => {
  if (isGeneratingSummaries.value || missingSummaryCount.value === 0) return

  isGeneratingSummaries.value = true
  summaryProgress.value = { completed: 0, total: missingSummaryCount.value, status: 'generating' }

  try {
    await generateAllMissingSummaries(
      chatStore.currentModel,
      (progress) => {
        summaryProgress.value = progress
      }
    )
  } catch (error) {
    console.error('Failed to generate summaries:', error)
  } finally {
    isGeneratingSummaries.value = false
    summaryProgress.value = { completed: 0, total: 0, status: 'idle' }
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
