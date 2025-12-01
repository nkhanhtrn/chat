<template>
  <div :class="['chat-sidebar', { collapsed: isSidebarCollapsed }]">
    <div class="sidebar-header">
      <Button @click="$emit('back-home')" class="back-home-button" variant="secondary">
        <span v-if="isSidebarCollapsed" class="icon">
          <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
        </span>
        <template v-else>
          <span class="icon">←</span>
          <span class="button-text">Notebooks</span>
        </template>
      </Button>
      <!-- Search input -->
      <div v-if="!isSidebarCollapsed" class="search-container">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search questions..."
          @keydown.escape="searchQuery = ''"
        />
        <button
          v-if="searchQuery"
          class="search-clear-btn"
          @click="searchQuery = ''"
          title="Clear search"
        >×</button>
      </div>
    </div>

    <div class="chat-list">
      <!-- Search Results View -->
      <div v-if="searchQuery.trim() && !isSidebarCollapsed" class="search-results-container">
        <div class="search-results-header">
          <span class="search-results-count">{{ searchResultsWithPath.length }} result{{ searchResultsWithPath.length !== 1 ? 's' : '' }}</span>
        </div>
        <div v-if="searchResultsWithPath.length > 0" class="search-results-list">
          <div
            v-for="result in searchResultsWithPath"
            :key="result.id"
            class="search-result-item"
            @click="handleSearchResultClick(result)"
          >
            <!-- Ancestor path (breadcrumb) -->
            <div v-if="result.ancestors.length > 0" class="search-result-path">
              <span
                v-for="(ancestor, index) in result.ancestors"
                :key="ancestor.id"
                class="path-segment"
              >
                <span class="path-text" :title="ancestor.text">{{ ancestor.text }}</span>
                <span v-if="index < result.ancestors.length - 1" class="path-separator">›</span>
              </span>
            </div>
            <!-- Matched question -->
            <div
              class="search-result-question"
              :class="{ 'is-root': result.ancestors.length === 0 }"
            >
              {{ result.text }}
            </div>
          </div>
        </div>
        <div v-else class="search-no-results">
          No questions found
        </div>
      </div>

      <!-- Normal Tree View -->
      <template v-else>
        <!-- Root messages as main items - draggable -->
        <div class="root-messages-container">
          <DraggableTreeItem
            v-for="(rootMsg, index) in rootMessages"
            :key="rootMsg.id"
            :item="rootMsg"
            :index="index"
            :parent-id="null"
            :is-active="isInActivePath(rootMsg.id)"
            :is-expanded="isRootExpanded(rootMsg.id) && hasChildren(rootMsg.id) && !isSidebarCollapsed"
            :draggable="!isSidebarCollapsed"
            :hide-drop-zones="isSidebarCollapsed"
            :editable="!isSidebarCollapsed"
            :show-delete-button="!isSidebarCollapsed"
            :item-class="{ 'root-header': true, 'is-current-root': rootMsg.id === currentRootId }"
            @click="handleRootClick"
            @drop="handleDrop"
            @rename="handleRename"
            @delete="handleDeleteRoot"
          >
            <!-- Override default slot only when collapsed -->
            <template v-if="isSidebarCollapsed" #default>
              <div
                class="root-title"
                :title="rootMsg.questionSummarized || rootMsg.question"
              >
                <span class="root-title-collapsed">
                  {{ (rootMsg.questionSummarized || rootMsg.question || 'Q').charAt(0).toUpperCase() }}
                </span>
              </div>
            </template>

            <!-- Children tree -->
            <template #children>
              <MessageTree
                v-if="!isSidebarCollapsed"
                :parent-id="rootMsg.id"
                :current-message-id="currentMessageId"
                :expanded-path="expandedPath"
                :editable="!isSidebarCollapsed"
                :show-delete-button="!isSidebarCollapsed"
                @select="handleSelectChild"
                @toggle-expand="handleToggleExpand"
                @move-to-parent="handleMoveToParent"
                @rename="handleRename"
                @delete="handleDeleteChild"
              />
            </template>
          </DraggableTreeItem>
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
      </template>
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
import { ref, computed, onMounted, watch, provide } from 'vue'
import Button from './Button.vue'
import SettingsModal from './SettingsModal.vue'
import MessageTree from './MessageTree.vue'
import DraggableTreeItem from './DraggableTreeItem.vue'
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

const emit = defineEmits(['back-home', 'select-question', 'delete-question', 'rename-question', 'new-question'])

const chatStore = useChatStore()

const SIDEBAR_COLLAPSED_KEY = 'chatSidebarCollapsed'

const isSidebarCollapsed = ref(false)
const showSettings = ref(false)
const searchQuery = ref('')

// Track which root message tree is expanded (only one at a time)
const expandedRootId = ref(null)

// Track the expanded path within the tree (ancestors of current selection)
const expandedPath = ref(new Set())

// Drag state - shared with MessageTree via provide
const draggedItem = ref(null)
const dropTarget = ref(null)

provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

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

// Search results with ancestor path
const searchResultsWithPath = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []

  const results = []
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return []

  // Helper to get ancestor path for a message
  const getAncestorPath = (messageId) => {
    const ancestors = []
    let msg = chatStore.messagesById[messageId]

    // Walk up the parent chain
    while (msg?.parentId) {
      const parent = chatStore.messagesById[msg.parentId]
      if (parent) {
        ancestors.unshift({
          id: parent.id,
          text: parent.questionSummarized || parent.question || 'Untitled'
        })
      }
      msg = parent
    }
    return ancestors
  }

  // Recursively search through message tree
  const searchMessageTree = (messageId, rootIndex) => {
    const message = chatStore.messagesById[messageId]
    if (!message) return

    const questionText = message.questionSummarized || message.question || ''
    if (questionText.toLowerCase().includes(query)) {
      results.push({
        id: message.id,
        text: questionText,
        rootIndex,
        ancestors: getAncestorPath(message.id)
      })
    }

    // Search children recursively
    if (message.childIds) {
      for (const childId of message.childIds) {
        searchMessageTree(childId, rootIndex)
      }
    }
  }

  // Search through all root questions
  currentChat.questions.forEach((question, index) => {
    searchMessageTree(question.id, index)
  })

  return results
})

// Handle clicking a search result
const handleSearchResultClick = (result) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  // Find the root of this message
  let msg = chatStore.messagesById[result.id]
  while (msg?.parentId) {
    msg = chatStore.messagesById[msg.parentId]
  }

  // Emit selection
  emit('select-question', {
    id: result.id,
    chatId: currentChat.id,
    rootIndex: result.rootIndex
  })

  // Expand the tree to show the selected message
  if (msg) {
    expandedRootId.value = msg.id
    buildExpandedPathToChild(result.id)
  }

  // Clear search
  searchQuery.value = ''
}

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

// Handle clicking a root message - select and toggle expand
const handleRootClick = (rootMsg) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  const question = currentChat.questions.find(q => q.id === rootMsg.id)
  if (question) {
    emit('select-question', question)
  }

  // Toggle expand/collapse
  if (expandedRootId.value === rootMsg.id) {
    expandedRootId.value = null
    expandedPath.value = new Set()
  } else {
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

// Handle deleting a child message (subquestion)
const handleDeleteChild = (childMsg) => {
  const message = chatStore.messagesById[childMsg.id]
  if (!message) return

  // Remove from parent's childIds
  if (message.parentId) {
    const parent = chatStore.messagesById[message.parentId]
    if (parent?.childIds) {
      const idx = parent.childIds.indexOf(childMsg.id)
      if (idx !== -1) {
        parent.childIds.splice(idx, 1)
      }
    }
  }

  // Remove questionLinks that point to the message being deleted (and its children)
  const removeLinksToMessage = (id) => {
    const msg = chatStore.messagesById[id]
    if (!msg) return

    // Use backlinks to find and remove questionLinks pointing to this message
    if (msg.linkedFrom) {
      msg.linkedFrom.forEach(({ sourceMessageId, linkId }) => {
        const sourceMsg = chatStore.messagesById[sourceMessageId]
        if (sourceMsg?.customContent) {
          const index = sourceMsg.customContent.findIndex(item => item.id === linkId)
          if (index !== -1) {
            sourceMsg.customContent.splice(index, 1)
          }
        }
      })
    }

    // Process children recursively
    if (msg.childIds) {
      msg.childIds.forEach(childId => removeLinksToMessage(childId))
    }
  }
  removeLinksToMessage(childMsg.id)

  // Recursively delete the message and its children
  chatStore._removeMessageTree(childMsg.id)

  // If deleted message was current, navigate to parent
  if (props.currentMessageId === childMsg.id && message.parentId) {
    emit('select-question', { id: message.parentId })
  }

  chatStore._persistState()
}

// Handle renaming a root message
const handleRename = (item, newText) => {
  emit('rename-question', item.id, newText)
}

// Handle drop event from DraggableTreeItem
const handleDrop = (dropData) => {
  const { messageId, targetId, position, targetIndex } = dropData

  if (position === 'above') {
    // Move to root level, before target
    chatStore.moveMessage(messageId, null, targetIndex)
  } else {
    // Move as first child of target
    chatStore.moveMessage(messageId, targetId, 0)
  }
}

// Handle moving a child message to its grandparent (promoting it up)
const handleMoveToParent = (data) => {
  chatStore.moveMessage(data.messageId, data.newParentId, data.newIndex)
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

.back-home-button {
  width: 100%;
}

.back-home-button .icon {
  font-size: 1.2rem;
  line-height: 1;
}

.chat-list {
  flex: 1;
  overflow-y: auto;
  padding: 1rem 0.5rem;
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

.root-header.is-dragging {
  opacity: 0.5;
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

.root-messages-container {
  min-height: 20px;
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

/* Search styles */
.search-container {
  position: relative;
  margin-top: 0.75rem;
}

.search-input {
  width: 100%;
  padding: 0.5rem 2rem 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-family: inherit;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  color: var(--color-text-secondary);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 2px var(--shadow-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-clear-btn {
  position: absolute;
  right: 0.5rem;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  padding: 0;
  border: none;
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  font-size: 1rem;
  line-height: 1;
  cursor: pointer;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
}

.search-clear-btn:hover {
  background-color: var(--color-bg-subtle);
  color: var(--color-text-secondary);
}

/* Search results */
.search-results-container {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.search-results-header {
  padding: 0 0.25rem;
}

.search-results-count {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.search-results-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.search-result-item {
  padding: 0.5rem 0.75rem;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
}

.search-result-item:hover {
  background-color: var(--color-bg-hover);
}

.search-result-path {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.25rem;
  margin-bottom: 0.25rem;
}

.path-segment {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.path-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  max-width: 120px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.path-separator {
  font-size: 0.7rem;
  color: var(--color-text-disabled);
}

.search-result-question {
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.search-result-question.is-root {
  font-weight: 500;
}

.search-no-results {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}
</style>
