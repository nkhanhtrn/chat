<template>
  <div class="homepage">
    <div class="homepage-header">
      <h1>My Notebooks</h1>
      <div class="header-actions">
        <div v-if="currentUser" class="user-info">
          <span class="user-email">{{ currentUser.email }}</span>
          <button class="sign-out-btn" @click="handleSignOut" title="Sign out">
            Sign Out
          </button>
        </div>
        <button v-else class="sign-in-btn" @click="showLoginModal = true">
          Sign In
        </button>
        <Button variant="primary" @click="createNewNotebook">
          + New Notebook
        </Button>
      </div>
    </div>

    <div class="search-container">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="Search questions..."
      />
    </div>

    <!-- Search Results -->
    <div v-if="searchQuery.trim()" class="search-results">
      <h2 class="search-results-title">
        Search Results
        <span class="result-count">({{ searchResults.length }})</span>
      </h2>
      <div v-if="searchResults.length > 0" class="results-list">
        <div
          v-for="result in searchResults"
          :key="result.type + '-' + result.id"
          class="result-item"
          :class="{ 'result-notebook-item': result.type === 'notebook' }"
          @click="result.type === 'notebook' ? openNotebook(result.chatId) : openQuestion(result)"
        >
          <div class="result-type-icon">{{ result.type === 'notebook' ? '📓' : '💬' }}</div>
          <div class="result-content">
            <div class="result-question">{{ result.text }}</div>
            <div v-if="result.type === 'question'" class="result-notebook">{{ result.notebookTitle }}</div>
            <div v-else class="result-notebook">Notebook</div>
          </div>
        </div>
      </div>
      <div v-else class="no-results">
        No questions found matching "{{ searchQuery }}"
      </div>
    </div>

    <div v-else class="notebooks-grid">
      <div
        v-for="(chat, index) in chatStore.chatList"
        :key="chat.id"
        class="notebook-card"
        :class="{
          'dragging': draggedId === chat.id,
          'drop-target': dropTargetId === chat.id
        }"
        draggable="true"
        @click="openNotebook(chat.id)"
        @dragstart="handleDragStart($event, chat.id)"
        @dragend="handleDragEnd"
        @dragover="handleDragOver($event, chat.id, index)"
        @dragleave="handleDragLeave"
        @drop="handleDrop($event, index)"
      >
        <div class="notebook-icon">📓</div>
        <div class="notebook-info">
          <h3 class="notebook-title">{{ chat.title || 'Untitled Notebook' }}</h3>
          <p class="notebook-meta">
            {{ chat.messageCount }} {{ chat.messageCount === 1 ? 'question' : 'questions' }}
          </p>
        </div>
        <button
          class="delete-btn"
          @click.stop="deleteNotebook(chat.id)"
          title="Delete notebook"
        >
          ×
        </button>
      </div>

      <div
        v-if="chatStore.chatList.length === 0"
        class="empty-state"
      >
        <div class="empty-icon">📚</div>
        <p>No notebooks yet</p>
        <p class="empty-hint">Create your first notebook to get started</p>
      </div>
    </div>

    <!-- Footer buttons -->
    <div class="homepage-footer">
      <button class="settings-btn" @click="showSettingsModal = true" title="Settings">
        <svg class="settings-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 15.5A3.5 3.5 0 0 1 8.5 12 3.5 3.5 0 0 1 12 8.5a3.5 3.5 0 0 1 3.5 3.5 3.5 3.5 0 0 1-3.5 3.5m7.43-2.53c.04-.32.07-.64.07-.97s-.03-.66-.07-1l2.11-1.63c.19-.15.24-.42.12-.64l-2-3.46c-.12-.22-.39-.31-.61-.22l-2.49 1c-.52-.39-1.06-.73-1.69-.98l-.37-2.65A.506.506 0 0 0 14 2h-4c-.25 0-.46.18-.5.42l-.37 2.65c-.63.25-1.17.59-1.69.98l-2.49-1c-.22-.09-.49 0-.61.22l-2 3.46c-.13.22-.07.49.12.64L4.57 11c-.04.34-.07.67-.07 1s.03.65.07.97l-2.11 1.66c-.19.15-.25.42-.12.64l2 3.46c.12.22.39.3.61.22l2.49-1.01c.52.4 1.06.74 1.69.99l.37 2.65c.04.24.25.42.5.42h4c.25 0 .46-.18.5-.42l.37-2.65c.63-.26 1.17-.59 1.69-.99l2.49 1.01c.22.08.49 0 .61-.22l2-3.46c.12-.22.07-.49-.12-.64l-2.11-1.66z"/></svg>
      </button>
      <button class="calendar-btn" @click="openCalendar" title="Activity Calendar">
        <svg class="calendar-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM9 10H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2zm-8 4H7v2h2v-2zm4 0h-2v2h2v-2zm4 0h-2v2h2v-2z"/></svg>
      </button>
      <button class="review-btn" @click="showReviewModal = true" title="Review cards">
        <svg class="review-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
        <span v-if="dueCount > 0" class="review-badge">{{ dueCount }}</span>
      </button>
    </div>

    <!-- Login Modal -->
    <LoginModal
      :visible="showLoginModal"
      @close="showLoginModal = false"
      @success="handleLoginSuccess"
    />

    <!-- Settings Modal -->
    <SettingsModal v-model="showSettingsModal" />

    <!-- Review Modal -->
    <ReviewModal
      :visible="showReviewModal"
      @close="showReviewModal = false"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import Button from '../components/Button.vue'
import LoginModal from '../components/Modal/LoginModal.vue'
import SettingsModal from '../components/Modal/SettingsModal.vue'
import ReviewModal from '../components/Modal/ReviewModal.vue'
import { onAuthChange, signOutUser } from '../services/auth.js'
import { useGlobalSearch } from '../composables/useGlobalSearch.js'
import { useSpacedRepetition } from '../composables/useSpacedRepetition.js'

const router = useRouter()
const chatStore = useChatStore()
const { dueCount } = useSpacedRepetition()

const showLoginModal = ref(false)
const showSettingsModal = ref(false)
const showReviewModal = ref(false)
const currentUser = ref(null)

// Drag and drop state
const draggedId = ref(null)
const dropTargetId = ref(null)
const dropTargetIndex = ref(null)

// Auth state listener
let unsubscribeAuth = null

// Use global search with notebook title matching
const { query: searchQuery, results: searchResults } = useGlobalSearch({ includeNotebooks: true })

onMounted(() => {
  console.log('HomePage mounted')
  console.log('chatStore.chats:', chatStore.chats)
  console.log('chatStore.chatList:', chatStore.chatList)

  // Listen for auth state changes
  unsubscribeAuth = onAuthChange((user) => {
    currentUser.value = user
    if (user) {
      console.log('User signed in:', user.email)
    } else {
      console.log('User signed out')
    }
  })
})

onUnmounted(() => {
  // Clean up auth listener
  if (unsubscribeAuth) {
    unsubscribeAuth()
  }
})

const createNewNotebook = () => {
  const newChat = chatStore.createNewChat()
  router.push({ name: 'notebook', params: { id: newChat.id } })
}

const openNotebook = (id) => {
  chatStore.switchToChat(id)
  router.push({ name: 'notebook', params: { id } })
}

const openQuestion = (result) => {
  // Switch to the chat first (this doesn't navigate to a specific message)
  if (chatStore.currentChatId !== result.chatId) {
    chatStore.switchToChat(result.chatId)
  }
  // Let the router handle the rest - the router watcher in ChatView will update the store
  router.push({ name: 'question', params: { id: result.chatId, questionId: result.id } })
}

const deleteNotebook = (id) => {
  if (confirm('Are you sure you want to delete this notebook?')) {
    chatStore.deleteChat(id)
  }
}

const handleSignOut = async () => {
  try {
    await signOutUser()
    console.log('Successfully signed out')
  } catch (error) {
    console.error('Sign out error:', error)
    alert('Failed to sign out. Please try again.')
  }
}

const handleLoginSuccess = (user) => {
  console.log('Login successful:', user.email)
  // The auth state listener will update currentUser automatically
  // You could add a success message or notification here
}

const openCalendar = () => {
  router.push({ name: 'calendar' })
}

// Drag and drop handlers for notebook reordering
const handleDragStart = (event, id) => {
  draggedId.value = id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', id)
}

const handleDragEnd = () => {
  draggedId.value = null
  dropTargetId.value = null
  dropTargetIndex.value = null
}

const handleDragOver = (event, id, index) => {
  event.preventDefault()
  if (draggedId.value && draggedId.value !== id) {
    dropTargetId.value = id
    dropTargetIndex.value = index
  }
}

const handleDragLeave = () => {
  dropTargetId.value = null
  dropTargetIndex.value = null
}

const handleDrop = (event, targetIndex) => {
  event.preventDefault()
  if (!draggedId.value) return

  const chatIds = chatStore.chatList.map(c => c.id)
  const draggedIndex = chatIds.indexOf(draggedId.value)

  if (draggedIndex === -1 || draggedIndex === targetIndex) {
    handleDragEnd()
    return
  }

  // Create new order by removing dragged item and inserting at target position
  const newOrder = [...chatIds]
  newOrder.splice(draggedIndex, 1)
  newOrder.splice(targetIndex, 0, draggedId.value)

  chatStore.reorderChats(newOrder)
  handleDragEnd()
}
</script>

<style scoped>
.homepage {
  min-height: 100vh;
  background-color: var(--color-bg-base);
  padding: 2rem;
}

.homepage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto 2rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-base);
}

.homepage-header h1 {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 2rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
}

.user-email {
  font-size: 0.875rem;
  color: var(--color-text-base);
}

.sign-out-btn {
  padding: 0.375rem 0.75rem;
  font-size: 0.875rem;
  background: transparent;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.sign-out-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.homepage-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  padding: 0.75rem;
  display: flex;
  gap: 0.5rem;
}

.settings-btn,
.calendar-btn,
.review-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.settings-btn:hover,
.calendar-btn:hover,
.review-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-accent);
}

.settings-icon,
.calendar-icon,
.review-icon {
  width: 20px;
  height: 20px;
  display: block;
}

.review-badge {
  position: absolute;
  top: -6px;
  right: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.7rem;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  background: var(--color-accent);
  color: white;
  border-radius: 9px;
}

.sign-in-btn {
  padding: 0.5rem 1rem;
  font-size: 0.9375rem;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-base);
  cursor: pointer;
  transition: all 0.2s;
  font-weight: 500;
}

.sign-in-btn:hover {
  background: var(--color-accent);
  color: white;
  border-color: var(--color-accent);
  transform: translateY(-1px);
  box-shadow: 0 2px 8px var(--shadow-primary);
}

.search-container {
  max-width: 1200px;
  margin: 0 auto 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-family: inherit;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  color: var(--color-text-message);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 3px var(--shadow-primary);
}

.search-input::placeholder {
  color: var(--color-text-muted);
}

.search-results {
  max-width: 1200px;
  margin: 0 auto;
}

.search-results-title {
  font-family: 'Georgia', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0 0 1rem;
}

.result-count {
  color: var(--color-text-muted);
  font-weight: 300;
}

.results-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.result-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 1rem;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
}

.result-item:hover {
  border-color: var(--color-border-accent);
  box-shadow: 0 2px 8px var(--shadow-primary);
}

.result-type-icon {
  font-size: 1.25rem;
  flex-shrink: 0;
}

.result-content {
  flex: 1;
  min-width: 0;
}

.result-question {
  font-family: 'Georgia', serif;
  font-size: 1rem;
  color: var(--color-text-message);
  margin-bottom: 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.result-notebook {
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.no-results {
  text-align: center;
  padding: 2rem;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-style: italic;
}

.notebooks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
}

.notebook-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.5rem;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s;
  position: relative;
}

.notebook-card:hover {
  border-color: var(--color-border-accent);
  box-shadow: 0 4px 12px var(--shadow-primary);
  transform: translateY(-2px);
}

.notebook-card.dragging {
  opacity: 0.5;
  transform: scale(0.98);
}

.notebook-card.drop-target {
  border-color: var(--color-accent);
  box-shadow: 0 0 0 2px var(--color-accent);
}

.notebook-icon {
  font-size: 2.5rem;
  flex-shrink: 0;
}

.notebook-info {
  flex: 1;
  min-width: 0;
}

.notebook-title {
  font-family: 'Georgia', serif;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-message);
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.notebook-meta {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
}

.delete-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--color-text-muted);
  font-size: 1.25rem;
  cursor: pointer;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  transition: opacity 0.2s, background-color 0.2s;
}

.notebook-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
}

.empty-state p {
  margin: 0.5rem 0;
  font-family: 'Georgia', serif;
}

.empty-hint {
  font-size: 0.9rem;
  font-style: italic;
}

/* Mobile/small screen responsive styles */
@media (max-width: 768px) {
  .homepage {
    padding: 1rem;
    padding-bottom: 4rem; /* Space for fixed settings button */
  }

  .homepage-header {
    flex-direction: column;
    align-items: stretch;
    gap: 0.75rem;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
  }

  .homepage-header h1 {
    font-size: 1.5rem;
    text-align: center;
  }

  .header-actions {
    width: 100%;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .header-actions > :deep(button),
  .header-actions > button,
  .sign-in-btn {
    width: 100%;
    justify-content: center;
  }

  .user-info {
    width: 100%;
    justify-content: space-between;
    padding: 0.625rem 0.875rem;
  }

  .user-email {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    flex: 1;
    min-width: 0;
  }

  .sign-out-btn {
    flex-shrink: 0;
  }

  .search-container {
    margin-bottom: 1rem;
  }

  .search-input {
    padding: 0.875rem 1rem;
    font-size: 1rem;
  }

  .notebooks-grid {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .notebook-card {
    padding: 1rem;
  }

  .notebook-icon {
    font-size: 2rem;
  }

  .notebook-title {
    font-size: 1rem;
  }

  .delete-btn {
    opacity: 1; /* Always show on mobile for touch */
  }

  .empty-state {
    padding: 3rem 1.5rem;
  }

  .empty-icon {
    font-size: 3rem;
  }

  .homepage-footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    padding: 0.75rem 1rem;
    background: var(--color-bg-base);
    border-top: 1px solid var(--color-border-base);
    display: flex;
    justify-content: center;
    gap: 0.75rem;
  }

  .settings-btn,
  .calendar-btn,
  .review-btn {
    width: auto;
    height: auto;
    padding: 0.625rem 1.5rem;
    gap: 0.5rem;
  }

  .settings-btn::after {
    content: 'Settings';
    font-size: 0.875rem;
  }

  .calendar-btn::after {
    content: 'Calendar';
    font-size: 0.875rem;
  }

  .review-btn::after {
    content: 'Review';
    font-size: 0.875rem;
  }

  .review-badge {
    position: static;
    margin-left: 0.25rem;
  }

  /* Search results mobile adjustments */
  .search-results-title {
    font-size: 1.125rem;
  }

  .result-item {
    padding: 0.875rem;
  }

  .result-question {
    font-size: 0.9375rem;
  }
}
</style>
