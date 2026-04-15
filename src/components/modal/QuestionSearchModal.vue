<template>
  <Modal :visible="visible" title="Link to Question" size="medium" @close="$emit('cancel')">
    <div class="search-container">
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search for a question..."
        @keydown.enter="onSelectFocused"
        @keydown.escape="$emit('cancel')"
        @keydown.down.prevent="focusNext"
        @keydown.up.prevent="focusPrev"
      />
    </div>

    <div class="results-container">
      <div v-if="!searchQuery.trim()" class="empty-state">
        Type to search for questions
      </div>
      <div v-else-if="results.length === 0" class="empty-state">
        No questions found
      </div>
      <div v-else class="results-list">
        <button
          v-for="(result, index) in results"
          :key="result.id as string"
          class="result-item"
          :class="{ focused: focusedIndex === index }"
          @click="onSelect(result)"
          @mouseenter="focusedIndex = index"
        >
          <div class="result-text">{{ result.text }}</div>
          <div class="result-meta">
            <span class="result-notebook">{{ result.notebookTitle }}</span>
            <span v-if="(result.ancestors as Array<{ id: string; text: string }>).length > 0" class="result-ancestors">
              <span class="ancestors-separator">&middot;</span>
              <template v-for="(ancestor, i) in (result.ancestors as Array<{ id: string; text: string }>)" :key="ancestor.id">
                {{ ancestor.text }}<span v-if="i < (result.ancestors as Array<{ id: string; text: string }>).length - 1"> &rarr; </span>
              </template>
            </span>
          </div>
        </button>
      </div>
    </div>

    <template #footer>
      <button class="cancel-btn" @click="$emit('cancel')">Cancel</button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import Modal from './Modal.vue'
import { useGlobalSearch } from '@/composables/useGlobalSearch'

const props = defineProps<{ visible?: boolean }>()

const emit = defineEmits<{
  select: [data: { targetMessageId: string }]
  cancel: []
}>()

const searchInputRef = ref<HTMLInputElement | null>(null)
const focusedIndex = ref(0)

const { query: searchQuery, results } = useGlobalSearch({ includeAncestors: true })

watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    searchQuery.value = ''
    focusedIndex.value = 0
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

watch(results, () => {
  focusedIndex.value = 0
})

function focusNext() {
  if (results.value.length > 0) {
    focusedIndex.value = (focusedIndex.value + 1) % results.value.length
  }
}

function focusPrev() {
  if (results.value.length > 0) {
    focusedIndex.value = (focusedIndex.value - 1 + results.value.length) % results.value.length
  }
}

function onSelect(result: Record<string, unknown>) {
  emit('select', { targetMessageId: result.id as string })
}

function onSelectFocused() {
  if (results.value.length > 0) {
    onSelect(results.value[focusedIndex.value])
  }
}
</script>

<style scoped>
.search-container {
  margin-bottom: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  font-size: 0.95rem;
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  background: var(--color-bg-input, var(--color-bg-page));
  color: var(--color-text-base);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 2px var(--shadow-primary, rgba(0, 0, 0, 0.1));
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.results-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.9rem;
}

.results-list {
  display: flex;
  flex-direction: column;
}

.result-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.25rem;
  padding: 0.6rem 0.75rem;
  background: transparent;
  border: none;
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: pointer;
  text-align: left;
  width: 100%;
  transition: background-color 0.1s ease;
}

.result-item:last-child {
  border-bottom: none;
}

.result-item:hover,
.result-item.focused {
  background-color: var(--color-bg-hover);
}

.result-text {
  font-size: 0.95rem;
  color: var(--color-text-strong);
  line-height: 1.4;
}

.result-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  line-height: 1.3;
}

.result-notebook {
  color: var(--color-text-muted);
}

.ancestors-separator {
  color: var(--color-text-muted);
  margin: 0 0.1rem;
}

.result-ancestors {
  color: var(--color-text-muted);
}

.cancel-btn {
  padding: 0.4rem 1rem;
  font-size: 0.875rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  color: var(--color-text-secondary);
  cursor: pointer;
}

.cancel-btn:hover {
  background: var(--color-bg-hover);
}
</style>
