import type { ReviewQuality, VocabCardData } from '@/types/vocab'

const DAY_IN_MS = 24 * 60 * 60 * 1000

export class VocabCard {
  id: string
  word: string
  definition: string
  context: string
  pronunciation: string
  messageId: string | null
  highlightId: string | null
  easiness: number
  interval: number
  repetitions: number
  nextReviewDate: number | null
  lastReviewDate: number | null
  createdAt: number

  constructor(data: Partial<VocabCardData> & { word: string }) {
    this.id = data.id ?? crypto.randomUUID()
    this.word = data.word
    this.definition = data.definition ?? ''
    this.context = data.context ?? ''
    this.pronunciation = data.pronunciation ?? ''
    this.messageId = data.messageId ?? null
    this.highlightId = data.highlightId ?? null
    this.easiness = data.easiness ?? 2.5
    this.interval = data.interval ?? 1
    this.repetitions = data.repetitions ?? 0
    this.nextReviewDate = data.nextReviewDate ?? Date.now()
    this.lastReviewDate = data.lastReviewDate ?? null
    this.createdAt = data.createdAt ?? Date.now()
  }

  get isDue(): boolean {
    return !this.nextReviewDate || this.nextReviewDate <= Date.now()
  }

  get daysUntilReview(): number {
    if (!this.nextReviewDate) return 0
    return Math.ceil((this.nextReviewDate - Date.now()) / DAY_IN_MS)
  }

  recordReview(quality: ReviewQuality): void {
    const now = Date.now()

    if (quality < 3) {
      this.repetitions = 0
      this.interval = 1
    } else {
      if (this.repetitions === 0) {
        this.interval = 1
      } else if (this.repetitions === 1) {
        this.interval = 6
      } else {
        this.interval = Math.round(this.interval * this.easiness)
      }
      this.repetitions++
    }

    this.easiness = Math.max(
      1.3,
      this.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    )

    this.lastReviewDate = now
    this.nextReviewDate = now + this.interval * DAY_IN_MS
  }

  updateDefinition(definition: string): void {
    this.definition = definition
  }

  toJSON(): VocabCardData {
    return {
      id: this.id,
      word: this.word,
      definition: this.definition,
      context: this.context,
      pronunciation: this.pronunciation,
      messageId: this.messageId,
      highlightId: this.highlightId,
      easiness: this.easiness,
      interval: this.interval,
      repetitions: this.repetitions,
      nextReviewDate: this.nextReviewDate,
      lastReviewDate: this.lastReviewDate,
      createdAt: this.createdAt
    }
  }
}
