/** SM-2 review quality values */
export type ReviewQuality = 0 | 2 | 4 | 5

/** Plain object representation of a VocabCard (for serialization) */
export interface VocabCardData {
  id: string
  word: string
  definition: string
  context: string
  messageId: string | null
  highlightId: string | null
  easiness: number
  interval: number
  repetitions: number
  nextReviewDate: number | null
  lastReviewDate: number | null
  createdAt: number
}

/** Params for creating a new vocab card */
export interface VocabCardCreateParams {
  word: string
  definition?: string
  context?: string
  messageId?: string | null
  highlightId?: string | null
}

/** Vocab card with id for display in review lists */
export interface VocabCardDue extends VocabCardData {
  id: string
}
