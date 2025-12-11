// Spaced Repetition Card class using SM-2 algorithm
export default class SRCard {
  static DAY_IN_MS = 24 * 60 * 60 * 1000

  constructor({
    messageId,
    easiness = 2.5,
    interval = 1,
    repetitions = 0,
    nextReviewDate = null,
    lastReviewDate = null,
    responseSummary = ''
  }) {
    this.messageId = messageId
    this.easiness = easiness
    this.interval = interval
    this.repetitions = repetitions
    this.nextReviewDate = nextReviewDate ?? Date.now() // Due immediately for new cards
    this.lastReviewDate = lastReviewDate
    this.responseSummary = responseSummary
  }

  // Check if this card is due for review
  get isDue() {
    return !this.nextReviewDate || this.nextReviewDate <= Date.now()
  }

  // Get days until next review (negative if overdue)
  get daysUntilReview() {
    if (!this.nextReviewDate) return 0
    return Math.ceil((this.nextReviewDate - Date.now()) / SRCard.DAY_IN_MS)
  }

  // Record a review using SM-2 algorithm
  // quality: 0 = Again (complete failure), 2 = Hard, 4 = Good, 5 = Easy
  recordReview(quality) {
    const now = Date.now()

    // SM-2 Algorithm
    if (quality < 3) {
      // Failed review - reset progress
      this.repetitions = 0
      this.interval = 1
    } else {
      // Successful review
      if (this.repetitions === 0) {
        this.interval = 1
      } else if (this.repetitions === 1) {
        this.interval = 6
      } else {
        this.interval = Math.round(this.interval * this.easiness)
      }
      this.repetitions++
    }

    // Update easiness factor (minimum 1.3)
    // EF' = EF + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    this.easiness = Math.max(
      1.3,
      this.easiness + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
    )

    // Set next review date
    this.lastReviewDate = now
    this.nextReviewDate = now + (this.interval * SRCard.DAY_IN_MS)
  }

  // Update the response summary
  setResponseSummary(summary) {
    this.responseSummary = summary
  }

  // Serialize to plain object for storage
  toJSON() {
    return {
      messageId: this.messageId,
      easiness: this.easiness,
      interval: this.interval,
      repetitions: this.repetitions,
      nextReviewDate: this.nextReviewDate,
      lastReviewDate: this.lastReviewDate,
      responseSummary: this.responseSummary
    }
  }
}
