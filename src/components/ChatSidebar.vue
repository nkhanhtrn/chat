<template>
  <div class="chat-sidebar">
    <!-- Search input -->
    <div class="sidebar-header">
      <div class="search-input-wrapper">
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
      <div v-if="searchQuery.trim()" class="search-results-container">
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
        <!-- Notebook title and question tree -->
        <div class="root-messages-container">
          <div v-if="currentNotebook" class="overview-header-item" @click="navigateToNotebookOverview">
            <svg class="overview-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
              <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
            </svg>
            <span class="overview-text">{{ currentNotebook.title }}</span>
          </div>
          <QuestionTree
            ref="questionTreeRef"
            :root-messages="rootMessages"
            :current-message-id="currentMessageId"
            :expand-all="fullPage"
            @select="handleTreeSelect"
            @delete-root="handleDeleteRoot"
            @delete-child="handleDeleteChild"
            @rename="handleRename"
            @drop="handleDrop"
          />
        </div>

        <!-- New Question button when there are existing messages -->
        <div
          v-if="rootMessages.length > 0"
          @click="$emit('new-question')"
          :class="['new-question-button', { active: isAddingNewQuestion }]"
        >
          <span class="new-question-icon">+</span>
          <span class="new-question-text">Add new question</span>
        </div>

        <div v-if="rootMessages.length === 0" class="empty-state">
          <p>No questions yet</p>
          <p class="empty-hint">Ask a question to start</p>
        </div>
      </template>
    </div>

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
import { ref, computed, provide, inject, toRef, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import MoveToNotebookModal from './Modal/MoveToNotebookModal.vue'
import QuestionTree from './QuestionTree.vue'
import { useChatStore } from '../stores/chat.js'
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
  },
  fullPage: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['select-question', 'delete-question', 'rename-question', 'new-question'])

const chatStore = useChatStore()
const router = useRouter()

const {
  findRootId,
  isInActivePath: treeIsInActivePath
} = useTreeExpansion({
  getMessageById: (id) => chatStore.messagesById[id],
  currentMessageId: toRef(props, 'currentMessageId')
})

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

const isNotebooksDropTarget = ref(false)
const showMoveModal = ref(false)
const pendingMoveMessageId = ref(null)

// Previous location is now tracked in the store via chatStore.previousLocation

// Drag state - inject from parent (ChatView) or create new, then provide to children
const draggedItem = inject('draggedItem', ref(null))
const dropTarget = inject('dropTarget', ref(null))

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

// Ref for the QuestionTree component
const questionTreeRef = ref(null)

// Handle clicking a search result
const handleSearchResultClick = async (result) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  // Emit selection
  emit('select-question', {
    id: result.id,
    chatId: currentChat.id,
    rootIndex: result.rootIndex
  })

  // Clear search first so QuestionTree renders
  clearSearch()

  // Wait for Vue to update the DOM, then expand the tree
  await nextTick()
  if (questionTreeRef.value) {
    questionTreeRef.value.expandToMessage(result.id)
  }
}

// Handle selection from QuestionTree component
const handleTreeSelect = (selection) => {
  const currentChat = props.chats.find(c => c.id === props.currentChatId)
  if (!currentChat) return

  const rootId = selection.rootId || selection.id
  const rootIndex = currentChat.questions.findIndex(q => q.id === rootId)

  emit('select-question', {
    id: selection.id,
    chatId: currentChat.id,
    rootIndex: rootIndex >= 0 ? rootIndex : 0
  })
}

// Check if question needs delete confirmation (has children or custom content)
const needsDeleteConfirmation = (messageId) => {
  const stats = chatStore.getMessageTreeStats(messageId)
  return stats.descendantCount > 0 || stats.customContentCount > 0
}

// Handle deleting a root message
const handleDeleteRoot = (rootMsg) => {
  if (needsDeleteConfirmation(rootMsg.id)) {
    if (!confirm('This question has custom content. Are you sure you want to delete it?')) return
  }
  emit('delete-question', rootMsg.id, props.currentChatId)
}

// Handle deleting a child message (subquestion) - uses store action
const handleDeleteChild = (childMsg) => {
  if (needsDeleteConfirmation(childMsg.id)) {
    if (!confirm('This question has custom content. Are you sure you want to delete it?')) return
  }
  const { navigateTo } = chatStore.deleteChildMessage(childMsg.id)
  if (navigateTo) {
    emit('select-question', { id: navigateTo })
  }
}

// Handle renaming a root message
const handleRename = (item, newText) => {
  emit('rename-question', item.id, newText)
}

// Navigate to notebook overview (no question selected)
const navigateToNotebookOverview = () => {
  router.push({ name: 'notebook', params: { id: props.currentChatId } })
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

// Handle canceling the move
const handleCancelMove = () => {
  showMoveModal.value = false
  pendingMoveMessageId.value = null
}
</script>

<style scoped>
.chat-sidebar {
  width: 100%;
  height: 100%;
  background-color: var(--color-bg-base);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: system-ui, -apple-system, sans-serif;
}

.sidebar-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

/* Overview header item */
.overview-header-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.overview-header-item:hover {
  background-color: var(--color-bg-hover);
}

.overview-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.overview-text {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-strong);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-header-item:hover .overview-text {
  color: var(--color-primary);
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

.search-input-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
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

/* Full page mode styles */
.chat-sidebar.full-page {
  width: 100%;
  height: 100vh;
  max-width: none;
  border-right: none;
}

.chat-sidebar.full-page .sidebar-header {
  padding: 1.5rem 2rem;
  max-width: 900px;
  margin: 0 auto;
  width: 100%;
}

.chat-sidebar.full-page .notebook-title-container {
  margin: 1.5rem 0;
}

.chat-sidebar.full-page .notebook-title {
  font-size: 1.5rem;
}

.chat-sidebar.full-page .chat-list {
  max-width: 900px;
  margin: 0 auto;
  padding: 1.5rem 2rem;
}

.chat-sidebar.full-page .root-header {
  padding: 0.75rem 1rem;
  margin-bottom: 0.25rem;
}

.chat-sidebar.full-page .root-title {
  font-size: 1.05rem;
}

.chat-sidebar.full-page .search-container {
  max-width: 400px;
}

.chat-sidebar.full-page .search-input {
  font-size: 0.95rem;
  padding: 0.6rem 2.5rem 0.6rem 1rem;
}
</style>
