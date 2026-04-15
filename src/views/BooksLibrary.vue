<template>
  <AppLayout storage-key="books-layout">
    <template #side><div class="side-playground-wrapper"><SideChatPlayground /></div></template>
    <div class="books-page">
      <div class="books-header">
        <h1>My Books</h1>
        <div class="header-actions">
          <div class="view-toggle">
            <button class="toggle-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'">Grid</button>
            <button class="toggle-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'">List</button>
          </div>
          <Button variant="primary" @click="showAddBook = true">+ Add Book</Button>
        </div>
      </div>
      <div class="search-container">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search books..." />
      </div>
      <SlideTransition appear direction="vertical">
        <div v-if="booksStore.books.length === 0" class="empty-state">
          <p>No books yet</p>
          <p class="empty-hint">Add your first book to get started</p>
        </div>
        <div v-else-if="filteredBooks.length === 0" class="empty-state">
          <p>No books match "{{ searchQuery }}"</p>
        </div>
        <div v-else :class="viewMode === 'grid' ? 'books-grid' : 'books-list'">
          <div
            v-for="book in filteredBooks"
            :key="book.id"
            class="book-card"
            @click="openBook(book)"
          >
            <div class="book-cover">
              <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" />
              <div v-else class="cover-placeholder">{{ book.title?.charAt(0) || '?' }}</div>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ book.title || 'Untitled' }}</h3>
              <p v-if="book.author" class="book-author">{{ book.author }}</p>
              <div v-if="book.readingProgress && book.readingProgress > 0" class="book-progress">
                <ProgressBar :value="book.readingProgress" :max="100" />
              </div>
            </div>
            <button class="delete-btn" @click.stop="deleteBook(book.id)" title="Delete">&times;</button>
          </div>
        </div>
      </SlideTransition>
      <!-- TODO: AddBookModal / BookSearchModal integration -->
      <div v-if="showAddBook" class="add-book-overlay" @click.self="showAddBook = false">
        <div class="add-book-dialog">
          <h3>Add a Book</h3>
          <p class="hint">Book upload and search functionality coming soon.</p>
          <Button @click="showAddBook = false">Close</Button>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import Button from '@/components/Button.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { useBooksStore } from '@/stores/books'
import type { Book } from '@/types/book'

const router = useRouter()
const booksStore = useBooksStore()

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>((localStorage.getItem('books-view-mode') as 'grid' | 'list') || 'grid')
const showAddBook = ref(false)

const filteredBooks = computed(() => {
  let books = [...booksStore.books]
  if (searchQuery.value.trim()) {
    const terms = searchQuery.value.toLowerCase().split(/\s+/).filter(Boolean)
    books = books.filter(b => {
      const text = `${b.title} ${b.author}`.toLowerCase()
      return terms.every(t => text.includes(t))
    })
  }
  return books.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
})

const openBook = (book: Book) => {
  router.push({ name: 'book-viewer', params: { bookId: book.id } })
}

const deleteBook = (id: string) => {
  if (confirm('Are you sure you want to delete this book?')) {
    booksStore.deleteBook(id)
  }
}

onMounted(() => {
  if (!booksStore.isInitialized) booksStore.initializeStore()
})

watch(viewMode, (mode) => { localStorage.setItem('books-view-mode', mode) })
</script>

<style scoped>
.side-playground-wrapper { height: 100%; }
.books-page { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); padding: 2rem; }
.books-header { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-base); }
.books-header h1 { font-family: Georgia, serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); margin: 0; }
.header-actions { display: flex; gap: 1rem; align-items: center; }
.view-toggle { display: flex; border: 1px solid var(--color-border-base); border-radius: 4px; overflow: hidden; }
.toggle-btn { padding: 0.3rem 0.6rem; background: transparent; border: none; color: var(--color-text-muted); cursor: pointer; font-size: 0.8rem; }
.toggle-btn.active { background: var(--color-bg-hover); color: var(--color-text-message); }
.search-container { max-width: 1200px; margin: 0 auto 1.5rem; }
.search-input { width: 100%; padding: 0.75rem 1rem; font-size: 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; color: var(--color-text-message); }
.search-input:focus { outline: none; border-color: var(--color-border-accent); }
.books-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
.books-list { display: flex; flex-direction: column; gap: 0.75rem; max-width: 1200px; margin: 0 auto; }
.book-card { display: flex; gap: 1rem; padding: 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; }
.book-card:hover { border-color: var(--color-border-accent); box-shadow: 0 4px 12px var(--shadow-primary); transform: translateY(-2px); }
.book-cover { width: 60px; height: 80px; flex-shrink: 0; border-radius: 4px; overflow: hidden; background: var(--color-bg-base); }
.book-cover img { width: 100%; height: 100%; object-fit: cover; }
.cover-placeholder { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: var(--color-text-muted); background: var(--color-bg-primary-subtle); }
.book-info { flex: 1; min-width: 0; }
.book-title { font-family: Georgia, serif; font-size: 1rem; font-weight: 500; color: var(--color-text-message); margin: 0 0 0.25rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.book-author { font-size: 0.85rem; color: var(--color-text-muted); margin: 0 0 0.5rem; }
.book-progress { max-width: 150px; }
.delete-btn { position: absolute; top: 0.5rem; right: 0.5rem; width: 24px; height: 24px; border: none; background: transparent; color: var(--color-text-muted); font-size: 1.25rem; cursor: pointer; border-radius: 4px; opacity: 0; transition: opacity 0.2s; }
.book-card:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error-text); }
.empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); max-width: 1200px; margin: 0 auto; }
.empty-hint { font-size: 0.9rem; font-style: italic; }
.add-book-overlay { position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.add-book-dialog { background: var(--color-bg-base); padding: 2rem; border-radius: 12px; max-width: 400px; width: 90%; text-align: center; }
.add-book-dialog h3 { font-family: Georgia, serif; color: var(--color-text-message); margin: 0 0 0.5rem; font-weight: 400; }
.add-book-dialog .hint { color: var(--color-text-muted); margin: 0 0 1rem; font-size: 0.9rem; }
@media (max-width: 768px) { .books-page { padding: 1rem; } .books-grid { grid-template-columns: 1fr; } .delete-btn { opacity: 1; } }
</style>
