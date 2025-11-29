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
            v-if="isSidebarCollapsed"
            class="chat-title"
            @click="$emit('select-chat', chat.id)"
            :title="chat.title"
          >
            <span class="chat-title-collapsed">
              {{ chat.title.charAt(0).toUpperCase() }}
            </span>
          </div>
          <InlineEdit
            v-else
            :model-value="chat.title"
            text-class="chat-title"
            input-class="chat-title-input"
            @click="$emit('select-chat', chat.id)"
            @save="(newTitle) => $emit('rename-chat', chat.id, newTitle)"
            @editing-start="editingChatId = chat.id"
            @editing-end="editingChatId = null"
          >{{ chat.title }}</InlineEdit>
          <Button v-show="!isSidebarCollapsed && editingChatId !== chat.id" class="delete-button" @click.stop="$emit('delete-chat', chat.id)" title="Delete chat" variant="danger">
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
            @click="$emit('select-question', question)"
            :class="['question-item', { active: question.id === currentMessageId }]"
          >
            <InlineEdit
              :model-value="question.text"
              text-class="question-text"
              input-class="question-text-input"
              @save="(newText) => $emit('rename-question', question.id, newText)"
              @editing-start="editingQuestionId = question.id"
              @editing-end="editingQuestionId = null"
            >{{ question.text }}</InlineEdit>
            <Button v-show="editingQuestionId !== question.id" class="delete-button question-delete" @click.stop="$emit('delete-question', question.id, chat.id)" title="Delete question" variant="danger">
              ×
            </Button>
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
        v-if="!isSidebarCollapsed"
        @click="showSettings = true"
        class="settings-button"
        title="Settings"
        variant="secondary"
      >
        <svg class="settings-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>
      </Button>
      <Button
        @click="toggleSidebar"
        class="collapse-sidebar-button"
        :title="isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'"
        variant="secondary"
      >
        {{ isSidebarCollapsed ? '»' : '«' }}
      </Button>
    </div>

    <SettingsModal v-model="showSettings" />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import Button from './Button.vue'
import InlineEdit from './InlineEdit.vue'
import SettingsModal from './SettingsModal.vue'

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

const emit = defineEmits(['new-chat', 'select-chat', 'select-question', 'delete-chat', 'delete-question', 'rename-chat', 'rename-question'])

const SIDEBAR_COLLAPSED_KEY = 'chatSidebarCollapsed'

const collapsedChats = ref(new Set())
const isSidebarCollapsed = ref(false)
const editingChatId = ref(null)
const editingQuestionId = ref(null)
const showSettings = ref(false)

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
</script>

<style scoped>
.chat-sidebar {
  width: 320px;
  height: 100vh;
  background-color: var(--color-bg-base);
  border-right: 1px solid var(--color-border-subtle);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
  transition: width 0.2s ease;
}

.chat-sidebar.collapsed {
  width: 64px;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
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
  margin-bottom: 0;
}

.chat-thread.active {
}

.chat-header {
  display: flex;
  gap: 0.75rem;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  transition: all 0.15s;
  user-select: none;
}

.chat-header:hover {
  background-color: var(--color-bg-hover);
}

.chat-thread.active .chat-header {
  background-color: var(--color-bg-hover);
}

.chat-title {
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: 1rem;
  line-height: 1.4;
  flex: 1;
  cursor: pointer;
}

.chat-thread.active .chat-title {
  color: var(--color-text-strong);
  font-weight: 600;
}

.chat-title:hover {
  color: var(--color-text-strong);
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
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  opacity: 0;
}

.chat-header:hover .delete-button {
  opacity: 1;
}

.collapse-icon {
  font-size: 1.1rem;
  color: var(--color-text-muted);
  transition: all 0.15s;
  flex-shrink: 0;
  width: 1.5rem;
  height: 1.5rem;
  text-align: center;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.collapse-icon:hover {
  color: var(--color-text-strong);
}

.question-list {
  padding-left: 1.25rem;
  margin-left: 0.5rem;
  border-left: 1px solid var(--color-border-subtle);
}

.question-item {
  display: flex;
  padding: 0.4rem 0.75rem;
  cursor: pointer;
  transition: all 0.15s;
}

.question-item:hover {
  background-color: var(--color-bg-hover);
}

.question-item.active {
  background-color: var(--color-bg-hover);
}

.question-item:hover .question-delete {
  opacity: 1;
}

.question-delete {
  flex-shrink: 0;
}

.question-text {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  line-height: 1.5;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.question-item.active .question-text {
  color: var(--color-text-secondary);
}

.question-text-input {
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
  flex: 1;
  padding: 0.2rem 0.4rem;
  width: 100%;
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
  border-top: 1px solid var(--color-border-subtle);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.settings-button,
.collapse-sidebar-button {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  font-weight: normal;
  color: var(--color-text-muted);
}

.settings-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.chat-sidebar.collapsed .sidebar-footer {
  justify-content: center;
}
</style>
