<template>
  <div class="current-content-viewer">
    <!-- Book Viewer -->
    <BookViewer
      v-if="contentType === 'book' && contentId"
      :book-id="contentId"
      :key="`book-${contentId}`"
    />

    <!-- Notebook Viewer -->
    <ChatView
      v-else-if="contentType === 'notebook' && contentId"
      :notebook-id="contentId"
      :question-id="questionId"
      :key="`notebook-${contentId}-${questionId || 'overview'}`"
    />

    <!-- No Content Selected -->
    <div v-else class="no-content-state">
      <div class="no-content-icon">
        <svg viewBox="0 0 24 24" fill="currentColor" width="64" height="64">
          <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
        </svg>
      </div>
      <h2>No Content Selected</h2>
      <p>Select a notebook or book to view it here</p>
      <div class="no-content-actions">
        <button class="action-btn" @click="goToNotebooks">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z"/>
          </svg>
          Browse Notebooks
        </button>
        <button class="action-btn" @click="goToBooks">
          <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
            <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
          </svg>
          Browse Books
        </button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import { useBooksStore } from '../stores/books.js'
import BookViewer from '../views/BookViewer.vue'
import ChatView from '../views/ChatView.vue'

const route = useRoute()
const router = useRouter()
const chatStore = useChatStore()
const booksStore = useBooksStore()

// Determine content type and ID from route params
const contentType = computed(() => route.params.type || null)
const contentId = computed(() => route.params.id || null)
const questionId = computed(() => route.params.questionId || null)

const goToNotebooks = () => {
  router.push({ name: 'notebooks' })
}

const goToBooks = () => {
  router.push({ name: 'books' })
}

// Initialize stores based on content type
watch(() => [contentType.value, contentId.value], ([type, id]) => {
  if (type === 'notebook' && id) {
    // Ensure the notebook is set as current in the chat store
    if (chatStore.currentChatId !== id) {
      chatStore.switchToChat(id)
    }
  } else if (type === 'book' && id) {
    // Ensure the book is set as current in the books store
    if (booksStore.currentBookId !== id) {
      booksStore.setCurrentBook(id)
    }
  }
}, { immediate: true })
</script>

<style scoped>
.current-content-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  overflow: hidden;
}

.no-content-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  padding: 2rem;
  text-align: center;
  color: var(--color-text-muted);
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif;
}

.no-content-icon {
  margin-bottom: 1.5rem;
  opacity: 0.3;
}

.no-content-icon svg {
  color: var(--color-text-muted);
}

.no-content-state h2 {
  font-size: 1.75rem;
  font-weight: 400;
  color: var(--color-text-secondary);
  margin: 0 0 0.5rem;
}

.no-content-state > p {
  font-size: 1rem;
  color: var(--color-text-muted);
  margin: 0 0 2rem;
  font-style: italic;
}

.no-content-actions {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
  justify-content: center;
}

.action-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-base);
  font-family: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-primary);
}

.action-btn svg {
  flex-shrink: 0;
}

@media (max-width: 768px) {
  .no-content-state h2 {
    font-size: 1.35rem;
  }

  .no-content-actions {
    flex-direction: column;
    align-items: stretch;
  }

  .action-btn {
    justify-content: center;
  }
}
</style>
