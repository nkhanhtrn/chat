<template>
  <AppLayout storage-key="book-layout">
    <template #side>
      <div class="book-sidebar">
        <div class="sidebar-header">
          <button class="back-btn" @click="router.push({ name: 'books' })">&larr; Library</button>
        </div>
        <div class="sidebar-content">
          <SideChatPlayground />
        </div>
      </div>
    </template>
    <div class="book-viewer-page">
      <div v-if="loading" class="loading-state">Loading book...</div>
      <div v-else-if="error" class="error-state">{{ error }}</div>
      <div v-else-if="!currentBook" class="empty-state">
        <h2>No book selected</h2>
        <p>Go to your <router-link to="/books">library</router-link> to select a book.</p>
      </div>
      <div v-else class="book-content">
        <div class="book-header">
          <h2>{{ currentBook.title }}</h2>
          <p v-if="currentBook.author" class="book-author">by {{ currentBook.author }}</p>
          <div v-if="progress > 0" class="progress-wrapper">
            <ProgressBar :value="progress" :max="100" />
          </div>
        </div>
        <div class="viewer-container" ref="viewerContainer">
          <!-- TODO: EpubRenderer integration for actual EPUB rendering -->
          <div class="viewer-placeholder">
            <p>EPUB viewer will render here.</p>
            <p class="hint">Book content rendering is being rebuilt for TypeScript.</p>
          </div>
        </div>
        <div class="page-nav">
          <button class="nav-btn" @click="prevPage" :disabled="!canGoPrev">&larr; Previous</button>
          <button class="nav-btn" @click="nextPage" :disabled="!canGoNext">Next &rarr;</button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { useBooksStore } from '@/stores/books'
import type { Book } from '@/types/book'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const loading = ref(false)
const error = ref<string | null>(null)
const viewerContainer = ref<HTMLElement | null>(null)
const progress = ref(0)
const canGoPrev = ref(false)
const canGoNext = ref(true)

const currentBook = computed<Book | undefined>(() => {
  const bookId = route.params.bookId as string
  if (!bookId) return undefined
  return booksStore.books.find(b => b.id === bookId)
})

const prevPage = () => {
  // TODO: EpubRenderer.prevPage()
}

const nextPage = () => {
  // TODO: EpubRenderer.nextPage()
}

watch(currentBook, (book) => {
  if (book) {
    progress.value = book.readingProgress ?? 0
  }
})

onMounted(async () => {
  const bookId = route.params.bookId as string
  if (!bookId) {
    error.value = 'No book ID provided'
    return
  }

  loading.value = true
  try {
    await booksStore.loadBookContent(bookId)
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.book-sidebar { display: flex; flex-direction: column; height: 100%; }
.sidebar-header { padding: 0.75rem; border-bottom: 1px solid var(--color-border-base); }
.back-btn { padding: 0.3rem 0.6rem; background: transparent; border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-muted); cursor: pointer; font-size: 0.85rem; }
.back-btn:hover { background: var(--color-bg-hover); }
.sidebar-content { flex: 1; overflow: hidden; }
.book-viewer-page { height: 100%; overflow-y: auto; background: var(--color-bg-page); display: flex; flex-direction: column; }
.loading-state, .error-state, .empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-state h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.empty-state a { color: var(--color-primary); }
.book-content { display: flex; flex-direction: column; height: 100%; }
.book-header { padding: 1.5rem 2rem; border-bottom: 1px solid var(--color-border-base); }
.book-header h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.25rem; }
.book-author { color: var(--color-text-muted); font-size: 0.9rem; margin: 0 0 0.75rem; }
.progress-wrapper { max-width: 300px; }
.viewer-container { flex: 1; overflow-y: auto; padding: 2rem; }
.viewer-placeholder { text-align: center; padding: 4rem; color: var(--color-text-muted); }
.viewer-placeholder .hint { font-size: 0.85rem; font-style: italic; }
.page-nav { display: flex; justify-content: space-between; padding: 1rem 2rem; border-top: 1px solid var(--color-border-base); }
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
@media (max-width: 768px) { .book-header { padding: 1rem; } .viewer-container { padding: 1rem; } }
</style>
