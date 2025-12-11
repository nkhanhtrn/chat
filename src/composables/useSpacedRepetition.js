import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { sendChatMessage } from '../services/api.js'
import { getSRSummaryPrompts } from '../services/extraPrompt.js'

/**
 * Composable for spaced repetition functionality
 */
export function useSpacedRepetition() {
  const chatStore = useChatStore()

  // Get all cards due for review
  const cardsDue = computed(() => chatStore.cardsDueForReview)

  // Get count of due cards
  const dueCount = computed(() => chatStore.cardsDueCount)

  // Record a review with quality rating
  // quality: 0 = Again, 2 = Hard, 4 = Good, 5 = Easy
  const recordReview = (messageId, quality) => {
    chatStore.recordSRReview(messageId, quality)
  }

  // Initialize a card for spaced repetition
  const initializeCard = (messageId, responseSummary = '') => {
    chatStore.initializeSRCard(messageId, responseSummary)
  }

  // Generate response summary using LLM
  const generateResponseSummary = async (response, model) => {
    const messages = getSRSummaryPrompts(response)

    let summary = ''
    try {
      await sendChatMessage(
        model,
        messages,
        (chunk) => {
          summary += chunk
        }
      )
      return summary.trim()
    } catch (error) {
      console.error('Failed to generate response summary:', error)
      // Fallback: use first paragraph or first 200 chars
      const firstParagraph = response.split('\n\n')[0]
      return firstParagraph.length > 200
        ? firstParagraph.slice(0, 200) + '...'
        : firstParagraph
    }
  }

  // Initialize card with LLM-generated summary
  const initializeCardWithSummary = async (messageId, response, model) => {
    // Initialize immediately with empty summary
    chatStore.initializeSRCard(messageId, '')

    // Generate summary asynchronously
    const summary = await generateResponseSummary(response, model)
    chatStore.updateSRResponseSummary(messageId, summary)

    return summary
  }

  // Update response summary for existing card
  const updateResponseSummary = (messageId, summary) => {
    chatStore.updateSRResponseSummary(messageId, summary)
  }

  // Remove card from SR system
  const removeCard = (messageId) => {
    chatStore.removeSRCard(messageId)
  }

  // Get SR data for a specific message
  const getCardData = (messageId) => {
    return chatStore.srData[messageId] || null
  }

  // Get all messages that have responses but are not in SR system
  const getUninitializedMessages = () => {
    const uninitialized = []
    for (const [messageId, message] of Object.entries(chatStore.messagesById)) {
      if (message.response && !chatStore.srData[messageId]) {
        uninitialized.push({ messageId, message })
      }
    }
    return uninitialized
  }

  // Count of messages not yet in SR system
  const uninitializedCount = computed(() => {
    let count = 0
    for (const [messageId, message] of Object.entries(chatStore.messagesById)) {
      if (message.response && !chatStore.srData[messageId]) {
        count++
      }
    }
    return count
  })

  // Delay helper that can be cancelled
  const delay = (ms, signal) => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(resolve, ms)
      if (signal) {
        signal.addEventListener('abort', () => {
          clearTimeout(timeout)
          reject(new Error('Cancelled'))
        })
      }
    })
  }

  // Initialize all existing questions into SR system with delay between calls
  // onProgress callback receives: { completed, total, delayRemaining, status }
  // status: 'generating' | 'waiting' | 'done'
  const DELAY_BETWEEN_CALLS_MS = 500 // 0.5 seconds between API calls

  const initializeAllExisting = async (model, onProgress = null, abortSignal = null) => {
    const uninitialized = getUninitializedMessages()
    const total = uninitialized.length
    let completed = 0

    for (let i = 0; i < uninitialized.length; i++) {
      if (abortSignal?.aborted) {
        throw new Error('Cancelled')
      }

      const { messageId, message } = uninitialized[i]

      // Report generating status
      if (onProgress) {
        onProgress({ completed, total, delayRemaining: 0, status: 'generating' })
      }

      await initializeCardWithSummary(messageId, message.response, model)
      completed++

      // Add delay between calls (except for the last one)
      if (i < uninitialized.length - 1) {
        // Countdown the delay
        const delayMs = DELAY_BETWEEN_CALLS_MS
        const intervalMs = 100 // Update every 100ms
        let remaining = delayMs

        while (remaining > 0) {
          if (abortSignal?.aborted) {
            throw new Error('Cancelled')
          }

          if (onProgress) {
            onProgress({ completed, total, delayRemaining: remaining, status: 'waiting' })
          }

          await delay(Math.min(intervalMs, remaining), abortSignal)
          remaining -= intervalMs
        }
      }
    }

    if (onProgress) {
      onProgress({ completed, total, delayRemaining: 0, status: 'done' })
    }

    return completed
  }

  return {
    cardsDue,
    dueCount,
    uninitializedCount,
    recordReview,
    initializeCard,
    initializeCardWithSummary,
    generateResponseSummary,
    updateResponseSummary,
    removeCard,
    getCardData,
    getUninitializedMessages,
    initializeAllExisting
  }
}
