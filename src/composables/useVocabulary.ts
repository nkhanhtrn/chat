import { computed } from 'vue'
import { useVocabStore } from '@/stores/vocab'
import type { ReviewQuality } from '@/types/vocab'

export function useVocabulary() {
  const vocabStore = useVocabStore()

  const vocabCardsDue = computed(() => vocabStore.vocabCardsDueForReview)
  const vocabDueCount = computed(() => vocabStore.vocabCardsDueCount)
  const allVocabCards = computed(() => vocabStore.allVocabCards)
  const totalVocabCount = computed(() => Object.keys(vocabStore.vocabData).length)

  const addVocabCard = (params: { word: string; definition?: string; context?: string; messageId?: string | null }) => {
    return vocabStore.addVocabCard(params)
  }

  const appendToDefinition = (vocabId: string, chunk: string) => {
    vocabStore.appendToVocabDefinition(vocabId, chunk)
  }

  const updateDefinition = (vocabId: string, definition: string) => {
    vocabStore.updateVocabDefinition(vocabId, definition)
  }

  const recordReview = (vocabId: string, quality: ReviewQuality) => {
    vocabStore.recordVocabReview(vocabId, quality)
  }

  const removeCard = (vocabId: string) => {
    vocabStore.removeVocabCard(vocabId)
  }

  const getCard = (vocabId: string) => {
    return vocabStore.getVocabCard(vocabId)
  }

  const findByWord = (word: string) => {
    return vocabStore.findVocabCardByWord(word)
  }

  const wordExists = (word: string) => {
    return !!vocabStore.findVocabCardByWord(word)
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
    wordExists,
  }
}
