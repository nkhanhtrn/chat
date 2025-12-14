<template>
  <Modal
    :visible="visible"
    title="Review"
    size="large"
    :prevent-close="isFlipped"
    @close="handleClose"
  >
    <template #header-actions>
      <div class="header-actions-container">
        <button
          v-if="currentCard"
          class="delete-btn"
          title="Remove from SR"
          @click="deleteCard"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
        <button
          class="nav-btn"
          :disabled="currentIndex === 0"
          title="Previous card"
          @click="goToPrevious"
        >
          ←
        </button>
        <span class="progress-indicator">{{ currentIndex + 1 }} / {{ totalCards }}</span>
        <button
          class="nav-btn"
          :disabled="currentIndex >= totalCards - 1"
          title="Next card"
          @click="goToNext"
        >
          →
        </button>
      </div>
    </template>

    <div v-if="currentCard" class="review-card">
      <!-- Card Front: Question -->
      <div v-if="!isFlipped" class="card-front">
        <div class="question-content">
          "{{ currentCard.question }}"
        </div>
        <router-link
          v-if="currentCard.chatId"
          :to="{ name: 'question', params: { id: currentCard.chatId, questionId: currentCard.messageId } }"
          class="go-to-question-link"
          @click="handleClose"
        >
          Go to question
        </router-link>
        <button class="show-answer-btn" @click="flipCard">
          Show Answer
        </button>
      </div>

      <!-- Card Back: Response Summary -->
      <div v-else class="card-back">
        <div class="answer-content">
          <MarkdownRenderer v-if="currentCard.responseSummary" :content="currentCard.responseSummary" />
          <span v-else>No summary available</span>
        </div>

        <div class="rating-buttons">
          <button class="rating-btn rating-again" @click="rateCard(0)">
            Again
            <span class="rating-hint">&lt; 1 day</span>
          </button>
          <button class="rating-btn rating-hard" @click="rateCard(2)">
            Hard
            <span class="rating-hint">1 day</span>
          </button>
          <button class="rating-btn rating-good" @click="rateCard(4)">
            Good
            <span class="rating-hint">{{ getIntervalText(4) }}</span>
          </button>
          <button class="rating-btn rating-easy" @click="rateCard(5)">
            Easy
            <span class="rating-hint">{{ getIntervalText(5) }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Session Complete -->
    <div v-else-if="sessionComplete" class="session-complete">
      <div class="complete-icon">🎉</div>
      <h3>Session Complete!</h3>
      <p>You've reviewed all {{ totalCards }} cards.</p>
      <button class="done-btn" @click="handleClose">Done</button>
    </div>

    <!-- No Cards -->
    <div v-else class="no-cards">
      <div class="empty-icon">📚</div>
      <p>No cards due for review</p>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from './Modal.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'
import { useSpacedRepetition } from '../../composables/useSpacedRepetition.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { cardsDue, recordReview, removeCard } = useSpacedRepetition()

const currentIndex = ref(0)
const isFlipped = ref(false)
const reviewedCards = ref(new Set())
const sessionComplete = ref(false)

// Get cards that haven't been reviewed in this session
const cardsToReview = computed(() => {
  return cardsDue.value.filter(card => !reviewedCards.value.has(card.messageId))
})

const currentCard = computed(() => {
  if (sessionComplete.value) return null
  return cardsDue.value[currentIndex.value] || null
})

const totalCards = computed(() => {
  return cardsDue.value.length
})

// Reset state when modal opens
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    currentIndex.value = 0
    isFlipped.value = false
    reviewedCards.value = new Set()
    sessionComplete.value = false
  }
})

const flipCard = () => {
  isFlipped.value = true
}

const goToPrevious = () => {
  if (currentIndex.value > 0) {
    currentIndex.value--
    isFlipped.value = false
  }
}

const goToNext = () => {
  if (currentIndex.value < totalCards.value - 1) {
    currentIndex.value++
    isFlipped.value = false
  }
}

const deleteCard = () => {
  if (!currentCard.value) return

  const messageId = currentCard.value.messageId
  removeCard(messageId)

  // Reset flip state
  isFlipped.value = false

  // Adjust index if we're at the end
  if (currentIndex.value >= totalCards.value && currentIndex.value > 0) {
    currentIndex.value--
  }

  // Check if no cards left
  if (totalCards.value === 0) {
    sessionComplete.value = true
  }
}

const rateCard = (quality) => {
  if (!currentCard.value) return

  const messageId = currentCard.value.messageId

  // Record the review
  recordReview(messageId, quality)

  // Mark as reviewed in this session
  reviewedCards.value.add(messageId)
  currentIndex.value++

  // Reset flip state for next card
  isFlipped.value = false

  // Check if session is complete
  if (cardsToReview.value.length === 0) {
    sessionComplete.value = true
  }
}

// Calculate interval text for rating buttons
const getIntervalText = (quality) => {
  if (!currentCard.value) return ''

  const card = currentCard.value
  let interval = card.interval || 1
  const easiness = card.easiness || 2.5
  const repetitions = card.repetitions || 0

  // Simulate SM-2 calculation
  if (quality >= 3) {
    if (repetitions === 0) {
      interval = 1
    } else if (repetitions === 1) {
      interval = 6
    } else {
      interval = Math.round(interval * easiness)
    }
  }

  // Adjust for quality
  if (quality === 5) {
    interval = Math.round(interval * 1.3)
  }

  if (interval === 1) return '1 day'
  if (interval < 30) return `${interval} days`
  if (interval < 365) return `${Math.round(interval / 30)} months`
  return `${Math.round(interval / 365)} years`
}

const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.header-actions-container {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-btn {
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-base);
  transition: all 0.2s;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-bg-secondary);
}

.nav-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.progress-indicator {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}

.review-card {
  display: flex;
  flex-direction: column;
  min-height: 300px;
}

.card-front,
.card-back {
  display: flex;
  flex-direction: column;
  flex: 1;
}

.question-content {
  font-family: 'Georgia', serif;
  font-size: 1.5rem;
  line-height: 1.5;
  color: var(--color-text-message);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-style: italic;
  padding: 2rem;
}

.answer-content {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-base);
  flex: 1;
}

.go-to-question-link {
  display: block;
  text-align: center;
  color: var(--color-accent);
  font-size: 0.875rem;
  text-decoration: none;
  margin-top: 1rem;
}

.go-to-question-link:hover {
  text-decoration: underline;
}

.show-answer-btn {
  margin-top: 1rem;
  padding: 0.875rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.show-answer-btn:hover {
  background: var(--color-accent-hover, var(--color-accent));
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-primary);
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.25rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.2s;
}

.delete-btn:hover {
  color: #e74c3c;
  background: #fdf2f2;
}

.rating-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-top: auto;
}

.rating-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.75rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  background: var(--color-bg-page);
  color: var(--color-text-base);
}

.rating-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 8px var(--shadow-primary);
}

.rating-hint {
  font-size: 0.7rem;
  font-weight: 400;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.rating-again {
  border-color: #e74c3c;
  color: #e74c3c;
}

.rating-again:hover {
  background: #fdf2f2;
}

.rating-hard {
  border-color: #f39c12;
  color: #b37400;
}

.rating-hard:hover {
  background: #fef9e7;
}

.rating-good {
  border-color: #27ae60;
  color: #27ae60;
}

.rating-good:hover {
  background: #eafaf1;
}

.rating-easy {
  border-color: #3498db;
  color: #3498db;
}

.rating-easy:hover {
  background: #ebf5fb;
}

.session-complete,
.no-cards {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 2rem;
  text-align: center;
  min-height: 200px;
}

.complete-icon,
.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
}

.session-complete h3 {
  font-family: 'Georgia', serif;
  font-size: 1.5rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0 0 0.5rem;
}

.session-complete p,
.no-cards p {
  color: var(--color-text-muted);
  margin: 0;
}

.done-btn {
  margin-top: 1.5rem;
  padding: 0.75rem 2rem;
  font-size: 1rem;
  font-weight: 500;
  background: var(--color-accent);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.done-btn:hover {
  background: var(--color-accent-hover, var(--color-accent));
}

/* Mobile responsive */
@media (max-width: 480px) {
  .rating-buttons {
    grid-template-columns: repeat(2, 1fr);
  }

  .question-content {
    font-size: 1rem;
  }
}
</style>
