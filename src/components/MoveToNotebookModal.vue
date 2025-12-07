<template>
  <Modal :visible="visible" title="Move to..." @close="onCancel" size="small">
    <div class="search-container">
      <input
        ref="searchInputRef"
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search notebooks..."
        @keydown.enter="onSelectFirst"
        @keydown.escape="onCancel"
        @keydown.down.prevent="focusNext"
        @keydown.up.prevent="focusPrev"
      />
    </div>

    <div class="results-container">
      <button class="result-item new-notebook" @click="onCreateNew">
        <span class="new-icon">+</span>
        <span>New notebook</span>
      </button>
      <template v-if="filteredNotebooks.length > 0">
        <button
          v-for="(notebook, index) in filteredNotebooks"
          :key="notebook.id"
          class="result-item"
          :class="{ focused: focusedIndex === index }"
          @click="onSelectNotebook(notebook)"
          @mouseenter="focusedIndex = index"
        >
          <span class="result-title">{{ notebook.title }}</span>
        </button>
      </template>
      <div v-else-if="searchQuery.trim()" class="empty-state">
        No notebooks found
      </div>
    </div>
  </Modal>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import Modal from './Modal.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  notebooks: {
    type: Array,
    default: () => []
  },
  currentNotebookId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['select-new', 'select-existing', 'cancel'])

const searchInputRef = ref(null)
const searchQuery = ref('')
const focusedIndex = ref(0)

// Filter out current notebook and filter by search query
const filteredNotebooks = computed(() => {
  const otherNotebooks = props.notebooks.filter(n => n.id !== props.currentNotebookId)

  if (!searchQuery.value.trim()) {
    return otherNotebooks
  }

  const query = searchQuery.value.toLowerCase().trim()
  return otherNotebooks.filter(n =>
    n.title.toLowerCase().includes(query)
  )
})

// Reset state and focus input when modal opens
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
watch(filteredNotebooks, () => {
  focusedIndex.value = 0
})

function focusNext() {
  if (filteredNotebooks.value.length > 0) {
    focusedIndex.value = (focusedIndex.value + 1) % filteredNotebooks.value.length
  }
}

function focusPrev() {
  if (filteredNotebooks.value.length > 0) {
    focusedIndex.value = (focusedIndex.value - 1 + filteredNotebooks.value.length) % filteredNotebooks.value.length
  }
}

function onSelectNotebook(notebook) {
  emit('select-existing', notebook)
}

function onSelectFirst() {
  if (filteredNotebooks.value.length > 0) {
    onSelectNotebook(filteredNotebooks.value[focusedIndex.value])
  }
}

function onCreateNew() {
  emit('select-new')
}

function onCancel() {
  emit('cancel')
}
</script>

<style scoped>
.search-container {
  margin-bottom: 0.5rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem 0.75rem;
  font-size: 0.9rem;
  border: 1px solid var(--color-border-input, #ddd);
  border-radius: 4px;
  background: var(--color-bg-input, #fff);
  color: var(--color-text-base, #333);
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px var(--shadow-primary, rgba(99, 102, 241, 0.15));
}

.search-input::placeholder {
  color: var(--color-text-placeholder, #999);
}

.results-container {
  max-height: 240px;
  overflow-y: auto;
}

.empty-state {
  padding: 1rem;
  text-align: center;
  color: var(--color-text-muted, #666);
  font-size: 0.85rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  text-align: left;
  width: 100%;
  font-size: 0.9rem;
  color: var(--color-text-strong, #333);
  transition: background-color 0.1s ease;
}

.result-item:hover,
.result-item.focused {
  background-color: var(--color-bg-hover, #f5f5f5);
}

.result-item.new-notebook {
  color: var(--color-primary, #6366f1);
  border-bottom: 1px solid var(--color-border-subtle, #eee);
  border-radius: 0;
  margin-bottom: 0.25rem;
}

.new-icon {
  font-weight: bold;
  font-size: 1rem;
}

.result-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
