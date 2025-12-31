<template>
  <div class="session-tabs">
    <button
      class="browse-btn"
      @click="$emit('browse')"
      title="Browse all sessions"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    </button>
    <div class="tabs-container">
      <div
        v-for="session in sessions"
        :key="session.id"
        :class="['tab', { active: session.id === activeSessionId }]"
        @click="$emit('select', session.id)"
        @dblclick="startRenaming(session)"
      >
        <input
          v-if="renamingSessionId === session.id"
          :ref="el => renamingSessionId === session.id && (renameInputRef = el)"
          v-model="renameValue"
          @blur="finishRenaming(session)"
          @keydown.enter="finishRenaming(session)"
          @keydown.esc="cancelRenaming"
          @click.stop
          class="rename-input"
        />
        <span v-else class="tab-name">{{ session.name }}</span>
        <button
          v-if="sessions.length > 1 && session.id === activeSessionId"
          class="close-btn"
          @click.stop="$emit('close', session.id)"
          title="Close session"
        >
          ×
        </button>
      </div>
    </div>
    <button
      class="new-tab-btn"
      @click="$emit('new')"
      title="New session"
    >
      +
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick } from 'vue'

const props = defineProps({
  sessions: { type: Array, default: () => [] },
  activeSessionId: { type: String, default: null }
})

const emit = defineEmits(['select', 'close', 'new', 'rename', 'browse'])

// Renaming state
const renamingSessionId = ref(null)
const renameValue = ref('')
const renameInputRef = ref(null)

function startRenaming(session) {
  renamingSessionId.value = session.id
  renameValue.value = session.name
  nextTick(() => {
    renameInputRef.value?.focus()
    renameInputRef.value?.select()
  })
}

function finishRenaming(session) {
  if (renamingSessionId.value === session.id) {
    const newName = renameValue.value.trim()
    if (newName && newName !== session.name) {
      emit('rename', session.id, newName)
    }
    renamingSessionId.value = null
    renameValue.value = ''
  }
}

function cancelRenaming() {
  renamingSessionId.value = null
  renameValue.value = ''
}
</script>

<style scoped>
.session-tabs {
  display: flex;
  align-items: center;
  padding: 0.5rem 0 0 0.5rem;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border-base);
  min-height: 42px;
}

.browse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px 0 0 6px;
  transition: all 0.15s;
  flex-shrink: 0;
}

.browse-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
}

.browse-btn svg {
  width: 15px;
  height: 15px;
}

.tabs-container {
  display: flex;
  flex: 1;
  gap: 3px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-bottom: none;
  border-radius: 6px 6px 0 0;
  cursor: pointer;
  user-select: none;
  min-width: 90px;
  max-width: 160px;
  transition: all 0.15s;
  position: relative;
  top: 1px;
}

.tab:hover {
  background: var(--color-bg-hover);
}

.tab.active {
  background: var(--color-bg-page);
  border-color: var(--color-border-strong);
}

.tab-name {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.tab.active .tab-name {
  color: var(--color-text-message);
}

.rename-input {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 0.85rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 3px;
  color: var(--color-text-base);
  padding: 0.15rem 0.4rem;
  width: 100%;
  flex: 1;
}

.rename-input:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 3px;
  flex-shrink: 0;
  opacity: 0.6;
}

.close-btn:hover {
  background: var(--color-bg-hover);
  opacity: 1;
}

.new-tab-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 0 6px 6px 0;
  flex-shrink: 0;
  transition: all 0.15s;
}

.new-tab-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
}
</style>
