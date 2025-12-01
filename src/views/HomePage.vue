<template>
  <div class="homepage">
    <div class="homepage-header">
      <h1>My Notebooks</h1>
      <Button variant="primary" @click="createNewNotebook">
        + New Notebook
      </Button>
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
        v-for="chat in chatStore.chatList"
        :key="chat.id"
        class="notebook-card"
        @click="openNotebook(chat.id)"
      >
        <div class="notebook-icon">📓</div>
        <div class="notebook-info">
          <h3 class="notebook-title">{{ chat.title || 'Untitled Notebook' }}</h3>
          <p class="notebook-meta">
            {{ chat.questions.length }} {{ chat.questions.length === 1 ? 'question' : 'questions' }}
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
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import Button from '../components/Button.vue'

const router = useRouter()
const chatStore = useChatStore()

const searchQuery = ref('')

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []

  // Split query into individual words for multi-word search
  const searchWords = query.split(/\s+/).filter(w => w.length > 0)
  const results = []

  // Helper to recursively search through message tree
  const searchMessageTree = (messageId, chat, rootId, rootIndex) => {
    const message = chatStore.getMessageById(messageId)
    if (!message) return

    const questionText = message.questionSummarized || message.question || ''
    const lowerText = questionText.toLowerCase()
    // Match if ALL search words are found
    if (searchWords.every(word => lowerText.includes(word))) {
      results.push({
        id: message.id,
        text: questionText,
        chatId: chat.id,
        rootId,
        rootIndex,
        notebookTitle: chat.title || 'Untitled Notebook',
        type: 'question'
      })
    }

    // Search children recursively
    if (message.childIds) {
      for (const childId of message.childIds) {
        searchMessageTree(childId, chat, rootId, rootIndex)
      }
    }
  }

  for (const chat of chatStore.chatList) {
    // Search notebook title
    const notebookTitle = chat.title || 'Untitled Notebook'
    const lowerTitle = notebookTitle.toLowerCase()
    // Match if ALL search words are found
    if (searchWords.every(word => lowerTitle.includes(word))) {
      results.push({
        id: chat.id,
        text: notebookTitle,
        chatId: chat.id,
        notebookTitle,
        type: 'notebook'
      })
    }

    // Search questions within notebook
    for (const question of chat.questions) {
      searchMessageTree(question.id, chat, question.id, question.rootIndex)
    }
  }
  return results
})

onMounted(() => {
  console.log('HomePage mounted')
  console.log('chatStore.chats:', chatStore.chats)
  console.log('chatStore.chatList:', chatStore.chatList)
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
</style>
