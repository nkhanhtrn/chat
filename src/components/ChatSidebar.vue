<template>
  <div :class="['chat-sidebar', { collapsed: isSidebarCollapsed }]">
    <div class="sidebar-header">
      <Button @click="$emit('new-chat')" class="new-chat-button" variant="primary">
        <span class="icon">+</span>
        <span v-show="!isSidebarCollapsed" class="button-text">New Chat</span>
      </Button>
    </div>

    <div class="chat-list">
      <div
        v-for="chat in chats"
        :key="chat.id"
        :class="['chat-thread', { active: chat.id === currentChatId }]"
      >
        <div class="chat-header">
          <div class="collapse-icon" @click="toggleCollapse(chat.id)" v-if="chat.questions.length > 0 && !isSidebarCollapsed">
            {{ isCollapsed(chat.id) ? '▸' : '▾' }}
          </div>
          <div
            v-if="editingChatId !== chat.id"
            class="chat-title"
            @click="$emit('select-chat', chat.id)"
            @dblclick="startEditing(chat.id, chat.title)"
            :title="chat.title"
          >
            <span v-if="isSidebarCollapsed" class="chat-title-collapsed">
              {{ chat.title.charAt(0).toUpperCase() }}
            </span>
            <span v-else>{{ chat.title }}</span>
          </div>
          <input
            v-else
            ref="editInput"
            v-model="editingTitle"
            @blur="finishEditing(chat.id)"
            @keydown.enter="finishEditing(chat.id)"
            @keydown.esc="cancelEditing"
            @click.stop
            class="chat-title-input"
            type="text"
          />
          <Button v-show="!isSidebarCollapsed" class="delete-button" @click.stop="$emit('delete-chat', chat.id)" title="Delete chat" variant="danger">
            ×
          </Button>
        </div>

        <div
          v-if="chat.questions.length > 0 && !isCollapsed(chat.id) && !isSidebarCollapsed"
          class="question-list"
        >
          <div
            v-for="question in chat.questions"
            :key="question.id"
            @click="$emit('select-question', question.id)"
            :class="['question-item', { active: question.id === currentMessageId }]"
          >
            <span class="question-text">{{ question.text }}</span>
          </div>
        </div>
      </div>

      <div v-if="chats.length === 0 && !isSidebarCollapsed" class="empty-state">
        <p>No chats yet</p>
        <p class="empty-hint">Click "New Chat" to start</p>
      </div>
    </div>

    <div class="sidebar-footer">
      <Button
        @click="toggleSidebar"
        class="collapse-sidebar-button"
        :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        variant="secondary"
      >
        {{ isSidebarCollapsed ? '»' : '«' }}
      </Button>
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, watch } from 'vue'
import Button from './Button.vue'

defineProps({
  chats: {
    type: Array,
    required: true
  },
  currentChatId: {
    type: String,
    default: null
  },
  currentMessageId: {
    type: String,
    default: null
  }
})

const emit = defineEmits(['new-chat', 'select-chat', 'select-question', 'delete-chat', 'rename-chat'])

const SIDEBAR_COLLAPSED_KEY = 'chatSidebarCollapsed'

const collapsedChats = ref(new Set())
const editingChatId = ref(null)
const editingTitle = ref('')
const editInput = ref(null)
const isSidebarCollapsed = ref(false)

// Load sidebar collapsed state from localStorage on mount
onMounted(() => {
  const savedState = localStorage.getItem(SIDEBAR_COLLAPSED_KEY)
  if (savedState !== null) {
    isSidebarCollapsed.value = savedState === 'true'
  }
})

// Watch for changes to sidebar collapsed state and save to localStorage
watch(isSidebarCollapsed, (newValue) => {
  localStorage.setItem(SIDEBAR_COLLAPSED_KEY, String(newValue))
})

const toggleCollapse = (chatId) => {
  if (collapsedChats.value.has(chatId)) {
    collapsedChats.value.delete(chatId)
  } else {
    collapsedChats.value.add(chatId)
  }
}

const isCollapsed = (chatId) => {
  return collapsedChats.value.has(chatId)
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}

const startEditing = (chatId, currentTitle) => {
  editingChatId.value = chatId
  editingTitle.value = currentTitle
  nextTick(() => {
    if (editInput.value) {
      const input = Array.isArray(editInput.value) ? editInput.value[0] : editInput.value
      if (input) {
        input.focus()
        input.select()
      }
    }
  })
}

const finishEditing = (chatId) => {
  if (editingTitle.value.trim() && editingTitle.value !== '') {
    emit('rename-chat', chatId, editingTitle.value.trim())
  }
  editingChatId.value = null
  editingTitle.value = ''
}

const cancelEditing = () => {
  editingChatId.value = null
  editingTitle.value = ''
}
</script>

<style scoped>
.chat-sidebar {
  width: 320px;
  height: 100vh;
  background-color: var(--color-bg-elevated);
  border-right: 1px solid var(--color-border-base);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: 'Georgia', serif;
  transition: width 0.3s ease;
}

.chat-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 2px solid var(--color-border-base);
  background-color: var(--color-bg-tertiary);
}

.chat-sidebar.collapsed .sidebar-header {
  padding: 0.4rem 0.75rem;
}

.new-chat-button {
  width: 100%;
}

.new-chat-button .icon {
  font-size: 1.5rem;
  line-height: 1;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0.5rem;
}

.chat-thread {
  margin-bottom: 0.5rem;
}

.chat-thread.active {
  background-color: var(--color-bg-hover);
}

.chat-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  border-left: 3px solid transparent;
  transition: all 0.2s;
  user-select: none;
}

.chat-header:hover {
  background-color: var(--color-bg-tertiary);
}

.chat-thread.active .chat-header {
  background-color: var(--color-bg-active);
  border-left-color: var(--color-primary);
}

.chat-title {
  font-weight: 600;
  color: var(--color-text-strong);
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 1;
  cursor: pointer;
  padding: 0.1rem 0;
}

.chat-title:hover {
  color: var(--color-primary);
}

.chat-title-collapsed {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  font-size: 1.3rem;
  font-weight: 700;
  border-radius: 50%;
  background-color: var(--color-bg-hover);
}

.chat-sidebar.collapsed .chat-header {
  justify-content: center;
  padding: 0.5rem;
}

.chat-sidebar.collapsed .chat-title {
  flex: none;
}

.chat-title-input {
  font-weight: 600;
  color: var(--color-text-strong);
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 1;
  padding: 0.25rem 0.5rem;
  background-color: var(--color-bg-base);
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  font-family: 'Georgia', serif;
}

.chat-title-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.delete-button {
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  font-size: 1.5rem;
  opacity: 0;
}

.chat-header:hover .delete-button {
  opacity: 1;
}

.collapse-icon {
  font-size: 1.2rem;
  color: var(--color-text-muted);
  transition: all 0.2s;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
}

.collapse-icon:hover {
  background-color: var(--color-border-subtle);
  color: var(--color-text-strong);
}

.question-list {
  margin-top: 0.25rem;
  padding-left: 2.25rem;
  border-left: 2px solid var(--color-border-subtle);
  margin-left: 0.75rem;
}

.question-item {
  display: flex;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  transition: all 0.2s;
  border-left: 2px solid transparent;
  margin-left: -2px;
}

.question-item:hover {
  background-color: var(--color-bg-tertiary);
  border-left-color: var(--color-border-strong);
}

.question-item.active {
  background-color: var(--color-bg-selected);
  border-left-color: var(--color-primary);
}

.question-text {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.empty-state p {
  margin: 0.5rem 0;
  font-family: system-ui, -apple-system, sans-serif;
}

.empty-hint {
  font-size: 0.875rem;
  color: var(--color-text-disabled);
}

/* Scrollbar styling */
.chat-list::-webkit-scrollbar {
  width: 8px;
}

.chat-list::-webkit-scrollbar-track {
  background: var(--color-scrollbar-track);
}

.chat-list::-webkit-scrollbar-thumb {
  background: var(--color-scrollbar-thumb);
  border-radius: 4px;
}

.chat-list::-webkit-scrollbar-thumb:hover {
  background: var(--color-scrollbar-thumb-hover);
}

.sidebar-footer {
  padding: 0.75rem;
  border-top: 2px solid var(--color-border-base);
  background-color: var(--color-bg-tertiary);
  display: flex;
  justify-content: flex-end;
  align-items: center;
}

.chat-sidebar.collapsed .sidebar-footer {
  justify-content: center;
}

.collapse-sidebar-button {
  font-size: 1.2rem;
  font-weight: bold;
}
</style>
