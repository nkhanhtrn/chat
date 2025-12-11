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
      :disabled="isInitializingSR || uninitializedCount === 0"
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
const { uninitializedCount, initializeAllExisting } = useSpacedRepetition()
const isInitializingSR = ref(false)
const srProgress = ref({ completed: 0, total: 0, delayRemaining: 0, status: 'idle' })
const abortController = ref(null)

// Count of cards in SR system
const srCardCount = computed(() => Object.keys(chatStore.srData).length)

const srButtonText = computed(() => {
  if (isInitializingSR.value) {
    const { completed, total, delayRemaining, status } = srProgress.value
    if (status === 'generating') {
      return `Generating ${completed + 1}/${total}...`
    } else if (status === 'waiting') {
      const seconds = Math.ceil(delayRemaining / 1000)
      return `${completed}/${total} - next in ${seconds}s`
    }
    return `${completed}/${total}`
  }
  if (uninitializedCount.value === 0) {
    return 'All questions in SR'
  }
  return `Add ${uninitializedCount.value} to SR`
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

const handleInitializeSR = async () => {
  if (isInitializingSR.value || uninitializedCount.value === 0) return

  isInitializingSR.value = true
  abortController.value = new AbortController()
  srProgress.value = { completed: 0, total: uninitializedCount.value, delayRemaining: 0, status: 'generating' }

  try {
    await initializeAllExisting(
      chatStore.currentModel,
      (progress) => {
        srProgress.value = progress
      },
      abortController.value.signal
    )
  } catch (error) {
    if (error.message !== 'Cancelled') {
      console.error('Failed to initialize SR cards:', error)
    }
  } finally {
    isInitializingSR.value = false
    abortController.value = null
    srProgress.value = { completed: 0, total: 0, delayRemaining: 0, status: 'idle' }
  }
}

const handleResetSR = () => {
  const count = srCardCount.value
  if (count === 0) return

  if (confirm(`Are you sure you want to reset all ${count} spaced repetition cards? This will clear all review progress.`)) {
    // Clear all SR data
    chatStore.srData = {}
    chatStore._persistState()
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
