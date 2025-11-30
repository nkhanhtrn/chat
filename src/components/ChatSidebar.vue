<template>
  <div :class="['chat-sidebar', { collapsed: isSidebarCollapsed }]">
    <div class="sidebar-header">
      <Button @click="$emit('new-chat')" class="new-chat-button" variant="primary">
        <span class="icon">+</span>
        <span v-show="!isSidebarCollapsed" class="button-text">New Chat</span>
      </Button>
    </div>

    <div class="chat-list">
      <!-- Root messages as main items -->
      <div
        v-for="rootMsg in rootMessages"
        :key="rootMsg.id"
        class="root-message-item"
      >
        <div
          :class="['root-header', {
            active: isInActivePath(rootMsg.id),
            'is-current-root': rootMsg.id === currentRootId
          }]"
        >
          <div
            v-if="hasChildren(rootMsg.id) && !isSidebarCollapsed"
            class="expand-icon"
            @click="toggleRootExpand(rootMsg.id)"
          >
            {{ isRootExpanded(rootMsg.id) ? '▾' : '▸' }}
          </div>
          <div v-else-if="!isSidebarCollapsed" class="expand-icon-placeholder"></div>

          <div
            v-if="isSidebarCollapsed"
            class="root-title"
            @click="handleSelectRoot(rootMsg)"
            :title="rootMsg.questionSummarized || rootMsg.question"
          >
            <span class="root-title-collapsed">
              {{ (rootMsg.questionSummarized || rootMsg.question || 'Q').charAt(0).toUpperCase() }}
            </span>
          </div>
          <InlineEdit
            v-else
            :model-value="rootMsg.questionSummarized || rootMsg.question"
            text-class="root-title"
            input-class="root-title-input"
            @click="handleSelectRoot(rootMsg)"
            @save="(newText) => $emit('rename-question', rootMsg.id, newText)"
            @editing-start="editingMessageId = rootMsg.id"
            @editing-end="editingMessageId = null"
          >{{ rootMsg.questionSummarized || rootMsg.question }}</InlineEdit>
          <Button
            v-show="!isSidebarCollapsed && editingMessageId !== rootMsg.id"
            class="delete-button"
            @click.stop="handleDeleteRoot(rootMsg)"
            title="Delete question"
            variant="danger"
          >
            ×
          </Button>
        </div>

        <!-- Children tree - only show if this root is expanded -->
        <div
          v-if="hasChildren(rootMsg.id) && isRootExpanded(rootMsg.id) && !isSidebarCollapsed"
          class="children-tree"
        >
          <MessageTree
            :parent-id="rootMsg.id"
            :current-message-id="currentMessageId"
            :expanded-path="expandedPath"
            @select="handleSelectChild"
            @toggle-expand="handleToggleExpand"
          />
        </div>
      </div>

      <!-- New Question button when there are existing messages -->
      <div
        v-if="rootMessages.length > 0 && !isSidebarCollapsed"
        @click="$emit('new-question')"
        :class="['new-question-button', { active: isAddingNewQuestion }]"
      >
        <span class="new-question-icon">+</span>
        <span class="new-question-text">Add new question</span>
      </div>

      <div v-if="rootMessages.length === 0 && !isSidebarCollapsed" class="empty-state">
        <p>No questions yet</p>
        <p class="empty-hint">Ask a question to start</p>
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
import { ref, computed, onMounted, watch } from 'vue'
import Button from './Button.vue'
import InlineEdit from './InlineEdit.vue'
import SettingsModal from './SettingsModal.vue'
import MessageTree from './MessageTree.vue'
import { useChatStore } from '../stores/chat.js'

const props = defineProps({
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
  },
  isAddingNewQuestion: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['new-chat', 'select-question', 'delete-question', 'rename-question', 'new-question'])

const chatStore = useChatStore()

const SIDEBAR_COLLAPSED_KEY = 'chatSidebarCollapsed'

const isSidebarCollapsed = ref(false)
const editingMessageId = ref(null)
const showSettings = ref(false)

// Track which root message tree is expanded (only one at a time)
const expandedRootId = ref(null)

// Track the expanded path within the tree (ancestors of current selection)
const expandedPath = ref(new Set())

// Get all root messages from the current chat
const rootMessages = computed(() => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return []

  return currentChat.questions.map(q => {
    const msg = chatStore.messagesById[q.id]
    return msg || { id: q.id, question: q.text, questionSummarized: q.text }
  })
})

// Get the current root message ID (the root of the currently viewed message)
const currentRootId = computed(() => {
  if (!props.currentMessageId) return null

  let msg = chatStore.messagesById[props.currentMessageId]
  while (msg?.parentId) {
    msg = chatStore.messagesById[msg.parentId]
  }
  return msg?.id || null
})

// Check if a message is in the active path (from root to current message)
const isInActivePath = (messageId) => {
  if (messageId === props.currentMessageId) return true
  if (messageId === currentRootId.value) return true
  return expandedPath.value.has(messageId)
}

// Check if a message has children
const hasChildren = (messageId) => {
  const msg = chatStore.messagesById[messageId]
  return msg?.childIds?.length > 0
}

// Check if a root is expanded
const isRootExpanded = (rootId) => {
  return expandedRootId.value === rootId
}

// Toggle root expansion
const toggleRootExpand = (rootId) => {
  if (expandedRootId.value === rootId) {
    expandedRootId.value = null
    expandedPath.value = new Set()
  } else {
    expandedRootId.value = rootId
    // Build expanded path from current message to this root
    buildExpandedPath(rootId)
  }
}

// Build the expanded path from the current message up to the root
const buildExpandedPath = (rootId) => {
  const newPath = new Set()

  if (props.currentMessageId) {
    let msg = chatStore.messagesById[props.currentMessageId]

    // Walk up the tree and check if current message belongs to this root
    const ancestors = []
    while (msg) {
      ancestors.push(msg.id)
      if (!msg.parentId) break
      msg = chatStore.messagesById[msg.parentId]
    }

    // If the root of current message matches, expand the path
    if (ancestors.length > 0 && ancestors[ancestors.length - 1] === rootId) {
      ancestors.forEach(id => {
        if (id !== props.currentMessageId) {
          newPath.add(id)
        }
      })
    }
  }

  expandedPath.value = newPath
}

// Handle toggling expansion within the tree
const handleToggleExpand = (messageId) => {
  if (expandedPath.value.has(messageId)) {
    // Collapse: remove this node and all its descendants from path
    const newPath = new Set(expandedPath.value)
    newPath.delete(messageId)

    // Also remove any descendants
    const removeDescendants = (id) => {
      const msg = chatStore.messagesById[id]
      if (msg?.childIds) {
        msg.childIds.forEach(childId => {
          newPath.delete(childId)
          removeDescendants(childId)
        })
      }
    }
    removeDescendants(messageId)

    expandedPath.value = newPath
  } else {
    // Expand: add this node to path
    expandedPath.value = new Set([...expandedPath.value, messageId])
  }
}

// Handle selecting a root message
const handleSelectRoot = (rootMsg) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  const question = currentChat.questions.find(q => q.id === rootMsg.id)
  if (question) {
    emit('select-question', question)
  }

  // Auto-expand if it has children
  if (hasChildren(rootMsg.id) && expandedRootId.value !== rootMsg.id) {
    expandedRootId.value = rootMsg.id
    expandedPath.value = new Set()
  }
}

// Handle selecting a child message
const handleSelectChild = (childMsg) => {
  // Emit selection with chat context
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (currentChat) {
    // Find the root of this child
    let msg = childMsg
    while (msg?.parentId) {
      msg = chatStore.messagesById[msg.parentId]
    }
    const rootIndex = currentChat.questions.findIndex(q => q.id === msg?.id)

    emit('select-question', {
      id: childMsg.id,
      chatId: currentChat.id,
      rootIndex: rootIndex >= 0 ? rootIndex : 0
    })

    // Rebuild expanded path to show full tree to selected child
    buildExpandedPathToChild(childMsg.id)
  }
}

// Build expanded path from root to a specific child
const buildExpandedPathToChild = (childId) => {
  const newPath = new Set()
  let msg = chatStore.messagesById[childId]

  while (msg?.parentId) {
    newPath.add(msg.parentId)
    msg = chatStore.messagesById[msg.parentId]
  }

  expandedPath.value = newPath
}

// Handle deleting a root message
const handleDeleteRoot = (rootMsg) => {
  emit('delete-question', rootMsg.id, props.currentChatId)
}

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

// Watch for current message changes to update expanded state
watch(() => props.currentMessageId, (newId) => {
  if (newId) {
    // Find the root of the current message
    let msg = chatStore.messagesById[newId]
    while (msg?.parentId) {
      msg = chatStore.messagesById[msg.parentId]
    }

    if (msg) {
      // Auto-expand the root that contains the current message
      expandedRootId.value = msg.id
      buildExpandedPathToChild(newId)
    }
  }
}, { immediate: true })

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

.root-message-item {
  margin-bottom: 0.25rem;
}

.root-header {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  transition: all 0.15s;
  user-select: none;
  border-radius: 4px;
}

.root-header:hover {
  background-color: var(--color-bg-hover);
}

.root-header.active,
.root-header.is-current-root {
  background-color: var(--color-bg-hover);
}

.root-title {
  font-weight: 500;
  color: var(--color-text-secondary);
  font-size: 0.95rem;
  line-height: 1.4;
  flex: 1;
  cursor: pointer;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.root-header.active .root-title,
.root-header.is-current-root .root-title {
  color: var(--color-text-strong);
  font-weight: 600;
}

.root-title:hover {
  color: var(--color-text-strong);
}

.root-title-collapsed {
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

.chat-sidebar.collapsed .root-header {
  justify-content: center;
  padding: 0.5rem;
}

.chat-sidebar.collapsed .root-title {
  flex: none;
}

.root-title-input {
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

.root-title-input:focus {
  border-color: var(--color-primary);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.expand-icon {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: color 0.15s;
}

.expand-icon:hover {
  color: var(--color-text-strong);
}

.expand-icon-placeholder {
  flex-shrink: 0;
  width: 1.25rem;
}

.delete-button {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  font-size: 1rem;
  opacity: 0;
}

.root-header:hover .delete-button {
  opacity: 1;
}

.children-tree {
  padding-left: 1.5rem;
  margin-left: 0.75rem;
  border-left: 1px solid var(--color-border-subtle);
  margin-top: 0.25rem;
}

.new-question-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-top: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  opacity: 0.6;
  border-radius: 4px;
}

.new-question-button:hover,
.new-question-button.active {
  opacity: 1;
  background-color: var(--color-bg-hover);
}

.new-question-icon {
  font-size: 1rem;
  font-weight: bold;
  color: var(--color-text-muted);
}

.new-question-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
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
