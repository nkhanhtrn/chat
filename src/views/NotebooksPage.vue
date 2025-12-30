<template>
  <AppLayout storage-key="home-layout">
    <div class="homepage">
      <div class="homepage-header">
        <h1>My Notebooks</h1>
        <div class="header-actions">
          <button
            class="view-toggle"
            @click="toggleViewMode"
            :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'"
          >
            <svg v-if="viewMode === 'grid'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <svg v-else class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
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

      <SlideTransition appear direction="vertical">
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

        <div v-else class="notebooks-container" :class="viewMode === 'list' ? 'notebooks-list' : 'notebooks-grid'">
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
      </SlideTransition>

    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import AppLayout from '../components/AppLayout.vue'
import Button from '../components/Button.vue'
import SlideTransition from '../components/SlideTransition.vue'
import { useGlobalSearch } from '../composables/useGlobalSearch.js'

const router = useRouter()
const chatStore = useChatStore()

// View mode state (grid or list)
const viewMode = ref(localStorage.getItem('notebooks-view-mode') || 'grid')

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  localStorage.setItem('notebooks-view-mode', viewMode.value)
}

// Drag and drop state
const draggedId = ref(null)
const dropTargetId = ref(null)
const dropTargetIndex = ref(null)

// Use global search with notebook title matching
const { query: searchQuery, results: searchResults } = useGlobalSearch({ includeNotebooks: true })

onMounted(() => {
  console.log('HomePage mounted')
  console.log('chatStore.chats:', chatStore.chats)
  console.log('chatStore.chatList:', chatStore.chatList)
})

const createNewNotebook = () => {
  const newChat = chatStore.createNewChat()
  router.push({ name: 'current-content', params: { type: 'notebook', id: newChat.id } })
}

const openNotebook = (id) => {
  chatStore.switchToChat(id)
  router.push({ name: 'current-content', params: { type: 'notebook', id } })
}

const openQuestion = (result) => {
  // Switch to the chat first (this doesn't navigate to a specific message)
  if (chatStore.currentChatId !== result.chatId) {
    chatStore.switchToChat(result.chatId)
  }
  // Navigate to the unified content viewer with the specific question
  router.push({
    name: 'current-content-question',
    params: { type: 'notebook', id: result.chatId, questionId: result.id }
  })
}

const deleteNotebook = (id) => {
  if (confirm('Are you sure you want to delete this notebook?')) {
    chatStore.deleteChat(id)
  }
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
  height: 100%;
  overflow-y: auto;
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

.view-toggle {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  background: transparent;
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
}

.view-toggle:hover {
  background-color: var(--color-bg-page);
  border-color: var(--color-border-accent);
  color: var(--color-text-message);
}

.view-icon {
  width: 18px;
  height: 18px;
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

.notebooks-container {
  max-width: 1200px;
  margin: 0 auto;
}

.notebooks-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
}

.notebooks-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.notebooks-list .notebook-card {
  padding: 1rem 1.25rem;
}

.notebooks-list .notebook-icon {
  font-size: 1.5rem;
}

.notebooks-list .notebook-title {
  font-size: 1rem;
}

.notebooks-list .notebook-card:hover {
  transform: none;
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
    display: none;
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
