<template>
  <div class="window-browser">
    <input
      v-model="searchQuery"
      type="text"
      class="search-input"
      placeholder="Search..."
      autofocus
    />

    <div class="windows-list">
      <div
        v-for="window in filteredWindows"
        :key="window.id"
        class="window-item"
        @click="handleClickWindow(window)"
      >
        <span class="window-icon">{{ getWindowEmoji(window) }}</span>
        <span class="window-title">{{ window.title || getWindowTypeLabel(window.type) }}</span>
        <button
          class="delete-btn"
          @click.stop="$emit('delete', window.id)"
          title="Delete"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <div v-if="filteredWindows.length === 0" class="no-results">
        {{ searchQuery ? 'No results' : 'No windows' }}
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  windows: { type: Array, default: () => [] }
})

const emit = defineEmits(['close', 'restore', 'delete', 'rename'])

const searchQuery = ref('')

const filteredWindows = computed(() => {
  const windows = Array.isArray(props.windows) ? [...props.windows] : []

  if (!searchQuery.value.trim()) {
    return windows
  }

  const query = searchQuery.value.toLowerCase()
  return windows.filter(w => {
    const title = (w.title || '').toLowerCase()
    const type = (w.type || '').toLowerCase()
    return title.includes(query) || type.includes(query)
  })
})

function getWindowTypeLabel(type) {
  const labelMap = {
    codeResult: 'Code',
    tool: 'Tool',
    visualization: 'Viz',
    svg: 'SVG',
    mermaid: 'Diagram',
    chart: 'Chart',
    text: 'Text'
  }
  return labelMap[type] || 'Window'
}

function getWindowEmoji(window) {
  return window.content?.emoji || getWindowTypeEmoji(window.type)
}

function getWindowTypeEmoji(type) {
  const emojiMap = {
    codeResult: '💻',
    tool: '🔧',
    visualization: '📊',
    svg: '🖼️',
    mermaid: '🔀',
    chart: '📈',
    text: '📄'
  }
  return emojiMap[type] || '🪟'
}

function handleClickWindow(window) {
  // Clicking on any window in the browser opens it (sets to 'open' state)
  emit('restore', window.id)
}
</script>

<style scoped>
.window-browser {
  position: absolute;
  top: 2.8rem;
  right: 0.75rem;
  width: 260px;
  max-height: calc(100% - 3.5rem);
  display: flex;
  flex-direction: column;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  overflow: hidden;
}

.search-input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: none;
  border-bottom: 1px solid var(--color-border-base);
  background: var(--color-bg-page);
  font-family: inherit;
  font-size: 0.85rem;
  color: var(--color-text-base);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.windows-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.4rem;
}

.window-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
}

.window-item:hover {
  background: var(--color-bg-hover);
}

.window-icon {
  font-size: 0.9rem;
  flex-shrink: 0;
}

.window-title {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.delete-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.window-item:hover .delete-btn {
  opacity: 0.6;
}

.delete-btn:hover {
  opacity: 1 !important;
  color: var(--color-error-text);
  background: var(--color-error-subtle);
}

.no-results {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-style: italic;
}

.windows-list::-webkit-scrollbar {
  width: 6px;
}

.windows-list::-webkit-scrollbar-track {
  background: transparent;
}

.windows-list::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: 3px;
}

.windows-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}
</style>
