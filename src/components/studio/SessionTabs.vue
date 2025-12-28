<template>
  <div class="session-tabs">
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

const emit = defineEmits(['select', 'close', 'new', 'rename'])

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
  padding: 0.25rem 0.5rem 0;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-base);
  min-height: 32px;
}

.tabs-container {
  display: flex;
  flex: 1;
  gap: 2px;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.6rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-bottom: none;
  border-radius: 4px 4px 0 0;
  cursor: pointer;
  user-select: none;
  min-width: 80px;
  max-width: 150px;
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
  font-size: 0.8rem;
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
  font-size: 0.8rem;
  background: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 2px;
  color: var(--color-text-base);
  padding: 0.1rem 0.3rem;
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
  width: 16px;
  height: 16px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 2px;
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
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: all 0.15s;
}

.new-tab-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
}
</style>
