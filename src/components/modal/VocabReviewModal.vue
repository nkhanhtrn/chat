<template>
  <Modal :visible="visible && cards.length === 0" title="Vocabulary" size="medium" @close="$emit('close')">
    <div class="vocab-empty">
      <p>No vocabulary cards yet.</p>
      <p class="vocab-empty-hint">Select text in a notebook or book and use Dictionary to save words.</p>
    </div>
  </Modal>
  <DictionaryModal
    :visible="visible && cards.length > 0"
    :word="currentCard?.word || ''"
    :definition="currentCard?.definition || ''"
    :context="currentCard?.context || ''"
    @close="$emit('close')"
  >
    <template #footer>
      <div class="vocab-card-actions">
        <div class="vocab-card-meta">
          <span class="vocab-card-counter">{{ index + 1 }} / {{ cards.length }}</span>
          <span v-if="currentCard" class="vocab-card-date">{{ formatDate(currentCard.createdAt) }}</span>
          <button v-if="currentCard" class="vocab-card-delete" @click="handleRemove(currentCard.id)" title="Remove">&times;</button>
        </div>
        <div class="vocab-nav">
          <button class="vocab-nav-btn" :disabled="index === 0" @click="index--">&larr; Previous</button>
          <button class="vocab-nav-btn" :disabled="index >= cards.length - 1" @click="index++">Next &rarr;</button>
        </div>
      </div>
    </template>
  </DictionaryModal>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import Modal from './Modal.vue'
import DictionaryModal from './DictionaryModal.vue'
import { useVocabulary } from '@/composables/useVocabulary'

defineProps<{ visible?: boolean }>()
defineEmits<{ close: [] }>()

const { allVocabCards, removeCard } = useVocabulary()

const cards = computed(() => allVocabCards.value)
const index = ref(0)

const currentCard = computed(() => cards.value[index.value] ?? cards.value[0])

watch(cards, (c) => {
  if (index.value >= c.length) index.value = Math.max(0, c.length - 1)
})

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleRemove(id: string) {
  removeCard(id)
}
</script>

<style scoped>
.vocab-empty {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
}
.vocab-empty-hint {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  opacity: 0.7;
}

.vocab-card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}

.vocab-card-meta {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.vocab-card-counter {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.vocab-card-date {
  font-size: 0.75rem;
  color: var(--color-text-muted);
}

.vocab-card-delete {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1.1rem;
  line-height: 1;
  padding: 0 0.25rem;
  border-radius: 3px;
  transition: all 0.15s;
}
.vocab-card-delete:hover {
  color: var(--color-error-text, #c00);
  background: var(--color-error-bg, rgba(255,0,0,0.05));
}

.vocab-nav {
  display: flex;
  gap: 0.5rem;
}

.vocab-nav-btn {
  padding: 0.35rem 0.7rem;
  font-size: 0.85rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.15s;
}
.vocab-nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.vocab-nav-btn:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
