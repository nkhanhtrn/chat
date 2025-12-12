<template>
  <Modal :visible="visible" :title="formattedDate" size="large" @close="$emit('close')">
    <div class="day-summary">
      <div class="summary-stat">
        <span class="stat-number">{{ questions.length }}</span>
        <span class="stat-label">{{ questions.length === 1 ? 'question' : 'questions' }}</span>
      </div>
      <div class="summary-stat">
        <span class="stat-number">{{ groupedQuestions.length }}</span>
        <span class="stat-label">{{ groupedQuestions.length === 1 ? 'notebook' : 'notebooks' }}</span>
      </div>
    </div>

    <div class="day-questions">
      <div v-if="groupedQuestions.length === 0" class="no-questions">
        <div class="empty-icon">📭</div>
        <p>No questions on this day</p>
      </div>

      <div v-for="group in groupedQuestions" :key="group.chatId" class="notebook-group">
        <div class="notebook-header">
          <span class="notebook-icon">📓</span>
          <h3 class="notebook-name">{{ group.chatName }}</h3>
          <span class="notebook-count">{{ group.questions.length }}</span>
        </div>
        <ul class="question-list">
          <li
            v-for="question in group.questions"
            :key="question.id"
            class="question-item"
            @click="$emit('open-question', { chatId: group.chatId, questionId: question.id })"
          >
            <div class="question-content">
              <span class="question-text">{{ question.question }}</span>
              <span class="question-time">{{ formatTime(question.createdAt) }}</span>
            </div>
            <span class="question-arrow">→</span>
          </li>
        </ul>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  date: {
    type: Date,
    default: null
  },
  questions: {
    type: Array,
    default: () => []
  }
})

defineEmits(['close', 'open-question'])

const formattedDate = computed(() => {
  if (!props.date) return ''
  return props.date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
})

// Group questions by notebook
const groupedQuestions = computed(() => {
  const groups = {}

  for (const q of props.questions) {
    if (!groups[q.chatId]) {
      groups[q.chatId] = {
        chatId: q.chatId,
        chatName: q.chatName,
        questions: []
      }
    }
    groups[q.chatId].questions.push(q)
  }

  // Sort questions within each group by time
  for (const group of Object.values(groups)) {
    group.questions.sort((a, b) => a.createdAt - b.createdAt)
  }

  // Return as array, sorted by notebook name
  return Object.values(groups).sort((a, b) => a.chatName.localeCompare(b.chatName))
})

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}
</script>

<style scoped>
.day-summary {
  display: flex;
  gap: 1.5rem;
  padding: 1rem 1.25rem;
  margin: -1rem -1rem 1rem -1rem;
  background: linear-gradient(135deg, var(--color-accent), color-mix(in srgb, var(--color-accent) 80%, #000));
  border-radius: 6px 6px 0 0;
}

.summary-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat-number {
  font-size: 1.75rem;
  font-weight: 600;
  color: white;
  line-height: 1;
}

.stat-label {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.85);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

.day-questions {
  max-height: 55vh;
  overflow-y: auto;
  padding-right: 0.25rem;
}

.day-questions::-webkit-scrollbar {
  width: 6px;
}

.day-questions::-webkit-scrollbar-track {
  background: transparent;
}

.day-questions::-webkit-scrollbar-thumb {
  background: var(--color-border-base);
  border-radius: 3px;
}

.day-questions::-webkit-scrollbar-thumb:hover {
  background: var(--color-border-accent);
}

.no-questions {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-text-muted);
}

.no-questions .empty-icon {
  font-size: 3rem;
  margin-bottom: 0.75rem;
}

.no-questions p {
  margin: 0;
  font-style: italic;
}

.notebook-group {
  margin-bottom: 1.25rem;
}

.notebook-group:last-child {
  margin-bottom: 0;
}

.notebook-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.notebook-icon {
  font-size: 1.125rem;
}

.notebook-name {
  font-family: 'Georgia', serif;
  font-size: 0.9375rem;
  font-weight: 500;
  color: var(--color-text-message);
  margin: 0;
  flex: 1;
}

.notebook-count {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--color-text-muted);
  background: var(--color-bg-hover);
  padding: 0.125rem 0.5rem;
  border-radius: 10px;
}

.question-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.375rem;
}

.question-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-hover);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.question-item:hover {
  background: var(--color-bg-page);
  border-color: var(--color-border-accent);
  box-shadow: 0 2px 8px var(--shadow-primary);
  transform: translateX(2px);
}

.question-item:hover .question-arrow {
  opacity: 1;
  transform: translateX(0);
  color: var(--color-accent);
}

.question-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.question-text {
  font-size: 0.9375rem;
  color: var(--color-text-base);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.4;
}

.question-time {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.question-arrow {
  flex-shrink: 0;
  font-size: 1rem;
  color: var(--color-text-muted);
  opacity: 0;
  transform: translateX(-4px);
  transition: all 0.15s ease;
}

@media (max-width: 480px) {
  .day-summary {
    gap: 1rem;
    padding: 0.875rem 1rem;
  }

  .stat-number {
    font-size: 1.5rem;
  }

  .question-item {
    padding: 0.5rem 0.625rem;
  }

  .question-text {
    font-size: 0.875rem;
  }

  .question-arrow {
    display: none;
  }
}
</style>
