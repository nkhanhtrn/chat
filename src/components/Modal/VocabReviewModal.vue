<template>
  <Modal
    :visible="visible"
    title="Vocabulary Review"
    size="large"
    :prevent-close="isFlipped"
    @close="handleClose"
  >
    <template #header-actions>
      <span class="progress-indicator">{{ currentIndex + 1 }} / {{ totalCards }}</span>
    </template>

    <div v-if="currentCard" class="review-card">
      <!-- Card Front: Word -->
      <div v-if="!isFlipped" class="card-front">
        <div class="word-content">
          {{ currentCard.word }}
        </div>
        <div v-if="currentCard.context" class="context-content">
          "...{{ currentCard.context }}..."
        </div>
        <button class="show-answer-btn" @click="flipCard">
          Show Definition
        </button>
      </div>

      <!-- Card Back: Definition -->
      <div v-else class="card-back">
        <div class="word-header">{{ currentCard.word }}</div>
        <div class="definition-content">
          <MarkdownRenderer v-if="currentCard.definition" :content="currentCard.definition" />
          <span v-else class="no-definition">No definition available</span>
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
      <p>You've reviewed all {{ totalCards }} vocabulary cards.</p>
      <button class="done-btn" @click="handleClose">Done</button>
    </div>

    <!-- No Cards -->
    <div v-else class="no-cards">
      <div class="empty-icon">📖</div>
      <p>No vocabulary cards due for review</p>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import Modal from './Modal.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'
import { useVocabulary } from '../../composables/useVocabulary.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

const { vocabCardsDue, recordReview } = useVocabulary()

const currentIndex = ref(0)
const isFlipped = ref(false)
const reviewedCards = ref(new Set())
const sessionComplete = ref(false)

// Get cards that haven't been reviewed in this session
const cardsToReview = computed(() => {
  return vocabCardsDue.value.filter(card => !reviewedCards.value.has(card.id))
})

const currentCard = computed(() => {
  if (sessionComplete.value) return null
  return cardsToReview.value[0] || null
})

const totalCards = computed(() => {
  return vocabCardsDue.value.length
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

const rateCard = (quality) => {
  if (!currentCard.value) return

  const vocabId = currentCard.value.id

  // Record the review
  recordReview(vocabId, quality)

  // Mark as reviewed in this session
  reviewedCards.value.add(vocabId)
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
.progress-indicator {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  margin-right: 0.5rem;
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

.word-content {
  font-family: 'Georgia', serif;
  font-size: 2rem;
  font-weight: bold;
  line-height: 1.3;
  color: var(--color-text-message);
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 2rem;
}

.context-content {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  text-align: center;
  padding: 0 2rem 1rem;
  font-style: italic;
  max-height: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.word-header {
  font-family: 'Georgia', serif;
  font-size: 1.25rem;
  font-weight: bold;
  color: var(--color-text-message);
  margin-bottom: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-base);
}

.definition-content {
  font-size: 1rem;
  line-height: 1.6;
  color: var(--color-text-base);
  flex: 1;
  overflow-y: auto;
  max-height: 300px;
}

.no-definition {
  color: var(--color-text-muted);
  font-style: italic;
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

.rating-buttons {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  margin-top: auto;
  padding-top: 1rem;
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

  .word-content {
    font-size: 1.5rem;
  }
}
</style>
