<template>
  <div class="session-browser">
    <div class="browser-header">
      <h2>All Sessions</h2>
    </div>

    <div class="search-bar">
      <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"></circle>
        <path d="m21 21-4.35-4.35"></path>
      </svg>
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search sessions..."
        autofocus
      />
    </div>

    <div class="sessions-list">
      <div
        v-for="session in filteredSessions"
        :key="session.id"
        class="session-item"
        :class="{ active: session.id === activeSessionId }"
        @click="$emit('select', session.id)"
      >
        <div class="session-info">
          <div class="session-name">
            <span v-if="editingSessionId === session.id">
              <input
                :ref="el => editingSessionId === session.id && (renameInputRef = el)"
                v-model="editName"
                @blur="finishRename(session)"
                @keydown.enter="finishRename(session)"
                @keydown.esc="cancelRename"
                @click.stop
                class="rename-input-inline"
              />
            </span>
            <span v-else @dblclick="startRename(session)">
              {{ session.name }}
            </span>
          </div>
          <div class="session-meta">
            {{ session.messages?.length || 0 }} messages
            <span class="separator">•</span>
            {{ formatDate(session.updatedAt) }}
          </div>
          <div v-if="session.canvasWindows?.length > 0" class="session-windows">
            {{ session.canvasWindows.length }} window{{ session.canvasWindows.length === 1 ? '' : 's' }}
          </div>
        </div>
        <button
          v-if="sessions.length > 1"
          class="delete-session-btn"
          @click.stop="$emit('delete', session.id)"
          title="Delete session"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      <div v-if="filteredSessions.length === 0" class="no-results">
        {{ searchQuery ? 'No sessions match your search' : 'No sessions yet' }}
      </div>
    </div>

    <div class="browser-footer">
      <button class="new-session-btn" @click="$emit('new')">
        + New Session
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, nextTick } from 'vue'

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  activeSessionId: { type: String, default: null }
})

const emit = defineEmits(['close', 'select', 'delete', 'new', 'rename'])

const searchQuery = ref('')
const editingSessionId = ref(null)
const editName = ref('')
const renameInputRef = ref(null)

const filteredSessions = computed(() => {
  if (!searchQuery.value.trim()) {
    return props.sessions
  }
  const query = searchQuery.value.toLowerCase()
  return props.sessions.filter(s =>
    s.name.toLowerCase().includes(query)
  )
})

function formatDate(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function startRename(session) {
  editingSessionId.value = session.id
  editName.value = session.name
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function finishRename(session) {
  if (editingSessionId.value === session.id) {
    const newName = editName.value.trim()
    if (newName && newName !== session.name) {
      emit('rename', session.id, newName)
    }
    editingSessionId.value = null
    editName.value = ''
  }
}

function cancelRename() {
  editingSessionId.value = null
  editName.value = ''
}
</script>

<style scoped>
.session-browser {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-surface);
}

.browser-header {
  display: flex;
  align-items: center;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-base);
}

.browser-header h2 {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 1.15rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0;
}

.search-bar {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem 1.25rem;
  border-bottom: 1px solid var(--color-border-base);
  background: var(--color-bg-page);
}

.search-icon {
  width: 18px;
  height: 18px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  border: none;
  background: transparent;
  font-family: inherit;
  font-size: 0.95rem;
  color: var(--color-text-base);
  outline: none;
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.sessions-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
}

.session-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.85rem 0.9rem;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}

.session-item:hover {
  background: var(--color-bg-hover);
}

.session-item.active {
  background: var(--color-bg-primary-subtle);
  border: 1px solid var(--color-border-accent);
}

.session-info {
  flex: 1;
  min-width: 0;
}

.session-name {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-message);
  margin-bottom: 0.35rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.rename-input-inline {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 0.95rem;
  font-weight: 500;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  color: var(--color-text-base);
  padding: 0.2rem 0.5rem;
  width: 100%;
}

.rename-input-inline:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.session-meta {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.separator {
  opacity: 0.5;
}

.session-windows {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
}

.delete-session-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  opacity: 0;
  transition: opacity 0.15s, background 0.15s;
}

.session-item:hover .delete-session-btn {
  opacity: 0.6;
}

.delete-session-btn:hover {
  opacity: 1 !important;
  background: var(--color-bg-hover);
  color: var(--color-error-text);
}

.no-results {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-style: italic;
}

.browser-footer {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border-base);
  background: var(--color-bg-page);
}

.new-session-btn {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border-strong);
  background: var(--color-bg-surface);
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.new-session-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-accent);
}

/* Scrollbar */
.sessions-list::-webkit-scrollbar {
  width: 8px;
}

.sessions-list::-webkit-scrollbar-track {
  background: transparent;
}

.sessions-list::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: 4px;
}

.sessions-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}
</style>
