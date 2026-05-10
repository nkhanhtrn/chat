<template>
  <Modal :visible="visible" :title="dateTitle" size="medium" @close="$emit('close')">
    <div v-if="groupedQuestions.length > 0">
      <div v-for="group in groupedQuestions" :key="group.notebookName" class="notebook-group">
        <div class="notebook-group-header">{{ group.notebookName }}</div>
        <div
          v-for="q in group.questions"
          :key="q.id"
          class="day-question"
          @click="$emit('open-question', q)"
        >
          {{ q.questionSummarized || q.question }}
        </div>
      </div>
    </div>
    <p v-else class="no-questions">No notes on this day.</p>
  </Modal>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Modal from './Modal.vue'

interface QuestionItem {
  id: string
  question: string
  questionSummarized: string | null
  chatId: string
  notebookName: string
}

interface NotebookGroup {
  notebookName: string
  chatId: string
  questions: QuestionItem[]
}

const props = withDefaults(defineProps<{
  visible?: boolean
  date?: Date | null
  questions?: QuestionItem[]
}>(), {
  visible: false,
  date: null,
  questions: () => []
})

defineEmits<{
  close: []
  'open-question': [data: { id: string; chatId: string }]
}>()

const dateTitle = computed(() =>
  props.date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ?? ''
)

const groupedQuestions = computed((): NotebookGroup[] => {
  const map = new Map<string, NotebookGroup>()
  for (const q of props.questions) {
    if (!map.has(q.chatId)) {
      map.set(q.chatId, { notebookName: q.notebookName, chatId: q.chatId, questions: [] })
    }
    map.get(q.chatId)!.questions.push(q)
  }
  return Array.from(map.values())
})
</script>

<style scoped>
.notebook-group { margin-bottom: 0.75rem; }
.notebook-group:last-child { margin-bottom: 0; }
.notebook-group-header {
  font-weight: 600;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  padding: 0.35rem 0.5rem;
  background: var(--color-bg-page);
  border-radius: 4px;
  margin-bottom: 0.25rem;
}
.day-question {
  padding: 0.5rem 0.5rem 0.5rem 1rem;
  cursor: pointer;
  border-bottom: 1px solid var(--color-border-subtle);
  font-size: 0.9rem;
  color: var(--color-text-message);
}
.day-question:hover { background: var(--color-bg-hover); }
.day-question:last-child { border-bottom: none; }
.no-questions { color: var(--color-text-muted); font-style: italic; text-align: center; padding: 2rem 0; }
</style>
