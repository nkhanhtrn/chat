<template>
  <Modal :visible="visible" title="Link to Question" @close="onCancel" size="medium">
    <div class="search-container">
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search for a question..."
        @keydown.enter="onSelectFirst"
        @keydown.escape="onCancel"
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
          :key="result.id"
          class="result-item"
          :class="{ focused: focusedIndex === index }"
          @click="onSelect(result)"
          @mouseenter="focusedIndex = index"
        >
          <div class="result-text">{{ result.text }}</div>
          <div class="result-meta">
            <span class="result-notebook">
              <span class="notebook-icon">📓</span>
              {{ result.notebookTitle }}
            </span>
            <span v-if="result.ancestors.length > 0" class="result-ancestors">
              <span class="ancestors-separator">·</span>
              <span v-for="(ancestor, i) in result.ancestors" :key="ancestor.id">
                {{ ancestor.text }}<span v-if="i < result.ancestors.length - 1"> → </span>
              </span>
            </span>
          </div>
        </button>
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="onCancel">Cancel</Button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import Modal from './Modal.vue'
import Button from '../Button.vue'
import { useGlobalSearch } from '../../composables/useGlobalSearch.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select', 'cancel'])

const searchInputRef = ref(null)
const focusedIndex = ref(0)

// Use global search with ancestor breadcrumbs
const { query: searchQuery, results } = useGlobalSearch({ includeAncestors: true })

// Focus input when modal opens
watch(() => props.visible, (isVisible) => {
  if (isVisible) {
    searchQuery.value = ''
    focusedIndex.value = 0
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

// Reset focused index when results change
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

function onSelect(result) {
  emit('select', { targetMessageId: result.id, targetText: result.text })
}

function onSelectFirst() {
  if (results.value.length > 0) {
    onSelect(results.value[focusedIndex.value])
  }
}

function onCancel() {
  emit('cancel')
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
  border: 1px solid var(--color-border-input, #ddd);
  border-radius: 4px;
  background: var(--color-bg-input, #fff);
  color: var(--color-text-base, #333);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-accent, #007bff);
  box-shadow: 0 0 0 2px rgba(128, 128, 128, 0.15);
}

.search-input::placeholder {
  color: var(--color-text-placeholder, #999);
}

.results-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--color-border-subtle, #eee);
  border-radius: 4px;
}

.empty-state {
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted, #666);
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
  border-bottom: 1px solid var(--color-border-subtle, #eee);
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
  background-color: var(--color-bg-hover, #f5f5f5);
}

.result-text {
  font-size: 0.95rem;
  color: var(--color-text-strong, #333);
  line-height: 1.4;
}

.result-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--color-text-muted, #666);
  line-height: 1.3;
}

.result-notebook {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  color: var(--color-text-muted, #888);
}

.notebook-icon {
  font-size: 0.75rem;
}

.ancestors-separator {
  color: var(--color-text-muted, #999);
  margin: 0 0.1rem;
}

.result-ancestors {
  color: var(--color-text-muted, #666);
}
</style>
