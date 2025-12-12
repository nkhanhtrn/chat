<template>
  <Modal :visible="visible" :title="formattedDate" size="large" @close="$emit('close')">
    <div class="day-questions">
      <div v-if="groupedQuestions.length === 0" class="no-questions">
        <p>No questions on this day</p>
      </div>

      <div v-for="group in groupedQuestions" :key="group.chatId" class="notebook-group">
        <div class="notebook-header" @click="toggleCollapse(group.chatId)">
          <span class="collapse-icon">{{ collapsed[group.chatId] ? '▶' : '▼' }}</span>
          <span class="notebook-icon">📓</span>
          <h3 class="notebook-name">{{ group.chatName }}</h3>
          <span class="notebook-count">{{ group.questions.length }}</span>
        </div>
        <ul v-show="!collapsed[group.chatId]" class="question-list">
          <li
            v-for="question in group.questions"
            :key="question.id"
            class="question-item"
            @click="$emit('open-question', { chatId: group.chatId, questionId: question.id })"
          >
            <span class="question-text">{{ question.question }}</span>
            <span class="question-time">{{ formatTime(question.createdAt) }}</span>
          </li>
        </ul>
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { computed, reactive } from 'vue'
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

const groupedQuestions = computed(() => {
  const groups = {}
  for (const q of props.questions) {
    (groups[q.chatId] ??= { chatId: q.chatId, chatName: q.chatName, questions: [] }).questions.push(q)
  }
  return Object.values(groups)
    .map(g => (g.questions.sort((a, b) => a.createdAt - b.createdAt), g))
    .sort((a, b) => a.chatName.localeCompare(b.chatName))
})

function formatTime(timestamp) {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit'
  })
}

const collapsed = reactive({})

function toggleCollapse(chatId) {
  collapsed[chatId] = !collapsed[chatId]
}
</script>

<style scoped>
.day-questions {
  max-height: 55vh;
  overflow-y: auto;
}

.no-questions {
  text-align: center;
  padding: 3rem 2rem;
  color: var(--color-text-muted);
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
  cursor: pointer;
  user-select: none;
}

.collapse-icon {
  font-size: 0.625rem;
  color: var(--color-text-muted);
}

.notebook-icon {
  font-size: 1rem;
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
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.625rem 0.75rem;
  background: var(--color-bg-hover);
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.question-item:hover {
  background: var(--color-bg-page);
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
  flex-shrink: 0;
  font-size: 0.75rem;
  color: var(--color-text-muted);
}
</style>
