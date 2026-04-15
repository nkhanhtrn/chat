<template>
  <Modal :visible="visible" :title="dateTitle" size="medium" @close="$emit('close')">
    <div v-if="questions.length > 0">
      <div v-for="q in questions" :key="q.id" class="day-question" @click="$emit('open-question', q)">{{ q.question }}</div>
    </div>
    <p v-else>No questions this day.</p>
  </Modal>
</template>
<script setup lang="ts">
import { computed } from 'vue'
import Modal from './Modal.vue'

const props = defineProps<{
  visible?: boolean
  date?: Date | null
  questions?: Array<Record<string, unknown>>
}>()

defineEmits<{ close: []; 'open-question': [data: Record<string, unknown>] }>()

const dateTitle = computed(() => props.date?.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) ?? '')
</script>
<style scoped>
.day-question { padding: 0.5rem; cursor: pointer; border-bottom: 1px solid var(--color-border-subtle); }
.day-question:hover { background: var(--color-bg-hover); }
</style>
