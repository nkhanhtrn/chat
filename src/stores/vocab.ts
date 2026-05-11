import { defineStore } from 'pinia'
import { VocabCard } from '@/models/VocabCard'
import type { ReviewQuality, VocabCardData, VocabCardCreateParams } from '@/types/vocab'

export const useVocabStore = defineStore('vocab', {
  state: () => ({
    vocabData: {} as Record<string, VocabCard>,
    scratchpad: '' as string,
  }),

  getters: {
    vocabCardsDueForReview(): VocabCardData[] {
      const now = Date.now()
      return Object.entries(this.vocabData)
        .filter(([, card]) => !card.nextReviewDate || card.nextReviewDate <= now)
        .map(([id, card]) => ({ ...card.toJSON(), id }))
        .sort((a, b) => {
          if (!a.nextReviewDate && !b.nextReviewDate) return a.id.localeCompare(b.id)
          if (!a.nextReviewDate) return -1
          if (!b.nextReviewDate) return 1
          if (a.nextReviewDate !== b.nextReviewDate) return a.nextReviewDate - b.nextReviewDate
          return a.id.localeCompare(b.id)
        })
    },

    vocabCardsDueCount(): number {
      const now = Date.now()
      let count = 0
      for (const card of Object.values(this.vocabData)) {
        if (!card.nextReviewDate || card.nextReviewDate <= now) count++
      }
      return count
    },

    allVocabCards(): VocabCardData[] {
      return Object.values(this.vocabData)
        .sort((a, b) => b.createdAt - a.createdAt)
        .map(c => c.toJSON())
    },
  },

  actions: {
    addVocabCard(params: VocabCardCreateParams): string {
      const card = new VocabCard(params)
      this.vocabData[card.id] = card
      return card.id
    },

    appendToVocabDefinition(vocabId: string, chunk: string): void {
      const card = this.vocabData[vocabId]
      if (card) card.definition += chunk
    },

    updateVocabDefinition(vocabId: string, definition: string): void {
      const card = this.vocabData[vocabId]
      if (card) card.definition = definition
    },

    recordVocabReview(vocabId: string, quality: ReviewQuality): void {
      const card = this.vocabData[vocabId]
      if (card) card.recordReview(quality)
    },

    removeVocabCard(vocabId: string): void {
      delete this.vocabData[vocabId]
    },

    getVocabCard(vocabId: string): VocabCard | null {
      return this.vocabData[vocabId] ?? null
    },

    findVocabCardByWord(word: string): VocabCard | null {
      const normalized = word.toLowerCase().trim()
      for (const card of Object.values(this.vocabData)) {
        if (card.word.toLowerCase().trim() === normalized) return card
      }
      return null
    },

    updateScratchpad(content: string): void {
      this.scratchpad = content
    },

    /** Reconstruct VocabCard objects from plain data (used during initialization) */
    _loadFromData(data: Record<string, VocabCardData>): void {
      this.vocabData = {}
      for (const [id, cardData] of Object.entries(data)) {
        this.vocabData[id] = new VocabCard(cardData)
      }
    },
  },
})
