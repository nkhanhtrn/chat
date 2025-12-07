<template>
  <div :class="['chat-sidebar', { collapsed: isSidebarCollapsed }]">
    <div class="sidebar-header">
      <div class="header-buttons">
        <button
          @click="handleGoBack"
          class="back-button"
          :class="{ disabled: !chatStore.previousLocation }"
          :disabled="!chatStore.previousLocation"
          title="Back to previous question"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        </button>
        <button
          @click="$emit('back-home')"
          class="back-home-button"
          :class="{ 'drop-target': isNotebooksDropTarget }"
          title="Back to Notebooks"
          @dragover.prevent="handleDragOverNotebooks"
          @dragleave="handleDragLeaveNotebooks"
          @drop="handleDropOnNotebooks"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
          <span v-if="!isSidebarCollapsed" class="button-text">Notebooks</span>
        </button>
      </div>
      <!-- Notebook title -->
      <div v-if="!isSidebarCollapsed && currentNotebook" class="notebook-title-container">
        <InlineEdit
          :model-value="currentNotebook.title"
          text-class="notebook-title"
          input-class="notebook-title-input"
          @save="handleNotebookRename"
        />
      </div>
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
            :is-streaming="isMessageStreaming(rootMsg.id)"
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
    <MoveToNotebookModal
      :visible="showMoveModal"
      :notebooks="chatStore.chatList"
      :current-notebook-id="currentChatId"
      @select-new="handleMoveToNewNotebook"
      @select-existing="handleMoveToExistingNotebook"
      @cancel="handleCancelMove"
    />
  </div>
</template>

<script setup>
import { ref, computed, provide, toRef } from 'vue'
import { useRouter } from 'vue-router'
import Button from './Button.vue'
import SettingsModal from './Modal/SettingsModal.vue'
import MoveToNotebookModal from './Modal/MoveToNotebookModal.vue'
import MessageTree from './MessageTree.vue'
import DraggableTreeItem from './DraggableTreeItem.vue'
import InlineEdit from './InlineEdit.vue'
import { useChatStore } from '../stores/chat.js'
import { useSidebarCollapse } from '../composables/useSidebarCollapse.js'
import { useTreeExpansion } from '../composables/useTreeExpansion.js'
import { useSidebarSearch } from '../composables/useSidebarSearch.js'

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
const router = useRouter()

// Use composables
const { isCollapsed: isSidebarCollapsed, toggle: toggleSidebar } = useSidebarCollapse('chatSidebarCollapsed')

const {
  expandedRootId,
  expandedPath,
  buildPathToChild: buildExpandedPathToChild,
  findRootId,
  isInActivePath: treeIsInActivePath,
  isRootExpanded,
  toggleExpand,
  toggleRoot,
  expandToMessage
} = useTreeExpansion({
  getMessageById: (id) => chatStore.messagesById[id],
  currentMessageId: toRef(props, 'currentMessageId')
})

// Wrapper to always expand on click (never collapse when selecting)
const handleToggleExpand = (messageId) => {
  toggleExpand(messageId, { expandOnly: true })
}

// Chat questions computed for search
const chatQuestions = computed(() => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  return currentChat?.questions || []
})

const {
  query: searchQuery,
  results: searchResultsWithPath,
  isSearchActive,
  clear: clearSearch
} = useSidebarSearch({
  getMessageById: (id) => chatStore.messagesById[id],
  chatQuestions
})

const showSettings = ref(false)
const isNotebooksDropTarget = ref(false)
const showMoveModal = ref(false)
const pendingMoveMessageId = ref(null)

// Previous location is now tracked in the store via chatStore.previousLocation

// Drag state - shared with MessageTree via provide
const draggedItem = ref(null)
const dropTarget = ref(null)

provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

// Get current notebook
const currentNotebook = computed(() => {
  return props.chats.find(c => c.id === props.currentChatId)
})

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
  return props.currentMessageId ? findRootId(props.currentMessageId) : null
})

// Check if a message is in the active path (wrapper for composable)
const isInActivePath = (messageId) => {
  return treeIsInActivePath(messageId, props.currentMessageId)
}

// Check if a message has children
const hasChildren = (messageId) => {
  const msg = chatStore.messagesById[messageId]
  return msg?.childIds?.length > 0
}

// Check if a message is currently streaming
const isMessageStreaming = (messageId) => {
  return chatStore.streamingMessageId === messageId
}

// Handle clicking a search result
const handleSearchResultClick = (result) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  // Emit selection
  emit('select-question', {
    id: result.id,
    chatId: currentChat.id,
    rootIndex: result.rootIndex
  })

  // Expand the tree to show the selected message
  expandToMessage(result.id)

  // Clear search
  clearSearch()
}

// Handle clicking a root message - select and always expand on first click
const handleRootClick = (rootMsg) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  const question = currentChat.questions.find(q => q.id === rootMsg.id)
  if (question) {
    emit('select-question', question)
  }

  // Always expand on click (never collapse when selecting)
  toggleRoot(rootMsg.id, { expandOnly: true })
}

// Handle selecting a child message
const handleSelectChild = (childMsg) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (currentChat) {
    const rootId = findRootId(childMsg.id)
    const rootIndex = currentChat.questions.findIndex(q => q.id === rootId)

    emit('select-question', {
      id: childMsg.id,
      chatId: currentChat.id,
      rootIndex: rootIndex >= 0 ? rootIndex : 0
    })

    // Rebuild expanded path to show full tree to selected child (includes the child itself)
    buildExpandedPathToChild(childMsg.id)
  }
}

// Handle deleting a root message
const handleDeleteRoot = (rootMsg) => {
  emit('delete-question', rootMsg.id, props.currentChatId)
}

// Handle deleting a child message (subquestion) - uses store action
const handleDeleteChild = (childMsg) => {
  const { navigateTo } = chatStore.deleteChildMessage(childMsg.id)
  if (navigateTo) {
    emit('select-question', { id: navigateTo })
  }
}

// Handle renaming a root message
const handleRename = (item, newText) => {
  emit('rename-question', item.id, newText)
}

// Handle renaming the notebook
const handleNotebookRename = (newTitle) => {
  if (props.currentChatId) {
    chatStore.renameChat(props.currentChatId, newTitle)
  }
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

// Handle drag over notebooks button
const handleDragOverNotebooks = (event) => {
  if (!draggedItem.value) return
  isNotebooksDropTarget.value = true
  event.dataTransfer.dropEffect = 'move'
}

// Handle drag leave notebooks button
const handleDragLeaveNotebooks = () => {
  isNotebooksDropTarget.value = false
}

// Handle drop on notebooks button - show modal to choose destination
const handleDropOnNotebooks = (event) => {
  event.preventDefault()
  isNotebooksDropTarget.value = false

  if (!draggedItem.value) return

  const messageId = draggedItem.value.id
  const message = chatStore.messagesById[messageId]
  if (!message) return

  // Store the message ID and show the modal
  pendingMoveMessageId.value = messageId
  showMoveModal.value = true

  // Clear drag state
  draggedItem.value = null
  dropTarget.value = null
}

// Handle moving to a new notebook
const handleMoveToNewNotebook = () => {
  if (!pendingMoveMessageId.value) return

  // Store current notebook as previous before moving
  const sourceNotebookId = props.currentChatId

  const result = chatStore.moveMessageToNewNotebook(pendingMoveMessageId.value, props.currentChatId)

  // Close modal and clear state
  showMoveModal.value = false
  pendingMoveMessageId.value = null

  // Navigate to the new notebook and the moved question
  if (result) {
    // Track previous location in store for back navigation
    chatStore.previousLocation = { messageId: props.currentMessageId, chatId: sourceNotebookId }
    router.push({ name: 'question', params: { id: result.newChatId, questionId: result.messageId } })
  }
}

// Handle moving to an existing notebook
const handleMoveToExistingNotebook = (notebook) => {
  if (!pendingMoveMessageId.value) return

  // Store current notebook as previous before moving
  const sourceNotebookId = props.currentChatId

  const result = chatStore.moveMessageToExistingNotebook(
    pendingMoveMessageId.value,
    props.currentChatId,
    notebook.id
  )

  // Close modal and clear state
  showMoveModal.value = false
  pendingMoveMessageId.value = null

  // Navigate to the target notebook and the moved question
  if (result) {
    // Track previous location in store for back navigation
    chatStore.previousLocation = { messageId: props.currentMessageId, chatId: sourceNotebookId }
    router.push({ name: 'question', params: { id: result.targetChatId, questionId: result.messageId } })
  }
}

// Handle going back to previous location
const handleGoBack = () => {
  const loc = chatStore.navigateBack()
  if (!loc) return

  // Use router for navigation (works across notebooks)
  router.push({ name: 'question', params: { id: loc.chatId, questionId: loc.messageId } })
}

// Handle canceling the move
const handleCancelMove = () => {
  showMoveModal.value = false
  pendingMoveMessageId.value = null
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

.header-buttons {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.back-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.back-button:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.back-button.disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.back-home-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-muted);
  font-size: 0.875rem;
  font-family: inherit;
  cursor: pointer;
  transition: background-color 0.15s, color 0.15s;
}

.back-home-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-secondary);
}

.back-home-button.drop-target {
  background-color: var(--color-primary, #6366f1);
  color: white;
  box-shadow: 0 0 0 2px var(--color-primary, #6366f1);
}

.back-home-button svg {
  flex-shrink: 0;
}

.back-home-button .button-text {
  font-weight: 500;
}

.chat-sidebar.collapsed .back-home-button {
  justify-content: center;
  padding: 0.5rem;
}

/* Notebook title */
.notebook-title-container {
  margin: 1rem 0;
  padding: 0;
  text-align: center;
}

.notebook-title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-strong);
  display: inline-block;
  line-height: 1.4;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}

.notebook-title:hover {
  color: var(--color-primary);
}

:deep(.notebook-title-input) {
  width: 100%;
  padding: 0.25rem 0.5rem;
  font-size: 1rem;
  font-weight: 600;
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
