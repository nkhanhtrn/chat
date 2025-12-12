import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'

/**
 * Composable for vocabulary spaced repetition functionality
 */
export function useVocabulary() {
  const chatStore = useChatStore()

  // Get all vocabulary cards due for review
  const vocabCardsDue = computed(() => chatStore.vocabCardsDueForReview)

  // Get count of due vocab cards
  const vocabDueCount = computed(() => chatStore.vocabCardsDueCount)

  // Get all vocabulary cards
  const allVocabCards = computed(() => chatStore.allVocabCards)

  // Total vocabulary card count
  const totalVocabCount = computed(() => Object.keys(chatStore.vocabData).length)

  // Add a new vocabulary card
  const addVocabCard = ({ word, definition = '', context = '', messageId = null }) => {
    return chatStore.addVocabCard({ word, definition, context, messageId })
  }

  // Append to vocabulary definition (for streaming)
  const appendToDefinition = (vocabId, chunk) => {
    chatStore.appendToVocabDefinition(vocabId, chunk)
  }

  // Update vocabulary definition
  const updateDefinition = (vocabId, definition) => {
    chatStore.updateVocabDefinition(vocabId, definition)
  }

  // Record a review with quality rating
  // quality: 0 = Again, 2 = Hard, 4 = Good, 5 = Easy
  const recordReview = (vocabId, quality) => {
    chatStore.recordVocabReview(vocabId, quality)
  }

  // Remove a vocabulary card
  const removeCard = (vocabId) => {
    chatStore.removeVocabCard(vocabId)
  }

  // Get a vocabulary card by ID
  const getCard = (vocabId) => {
    return chatStore.getVocabCard(vocabId)
  }

  // Find vocabulary card by word
  const findByWord = (word) => {
    return chatStore.findVocabCardByWord(word)
  }

  // Check if word already exists
  const wordExists = (word) => {
    return !!chatStore.findVocabCardByWord(word)
  }

  return {
    vocabCardsDue,
    vocabDueCount,
    allVocabCards,
    totalVocabCount,
    addVocabCard,
    appendToDefinition,
    updateDefinition,
    recordReview,
    removeCard,
    getCard,
    findByWord,
    wordExists
  }
}
