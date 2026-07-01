<template>
  <div class="library">
    <header class="lib-header">
      <h1>Library</h1>
      <div class="lib-header-actions">
        <button class="lib-theme-btn" @click="toggleTheme" :title="'Theme: ' + themeLabel(theme)">
          {{ themeLabel(theme) }}
        </button>
      </div>
    </header>

    <div class="lib-search">
      <input
        v-model="query"
        type="search"
        placeholder="Search title or author…"
      />
    </div>

    <div v-if="booksStore.isLoading" class="lib-status">Loading…</div>

    <ul v-else class="lib-list">
      <li
        v-for="book in filtered"
        :key="book.id"
        class="lib-item"
        @click="open(book.id)"
      >
        <div class="lib-cover">
          <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title" />
        </div>
        <div class="lib-meta">
          <span class="lib-title">{{ book.title || 'Untitled' }}</span>
          <span v-if="book.author" class="lib-author">{{ book.author }}</span>
          <span v-if="book.readingProgress > 0" class="lib-progress-text">
            {{ Math.round(book.readingProgress) }}% read
          </span>
        </div>
      </li>

      <li v-if="filtered.length === 0" class="lib-empty">
        <template v-if="query">No matches.</template>
        <template v-else-if="epubBooks.length === 0">
          No EPUB books yet. Add books from the main app.
        </template>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { getTheme, cycleTheme, themeLabel, type ReaderTheme } from '../theme'

const router = useRouter()
const booksStore = useBooksStore()
const query = ref('')
const theme = ref<ReaderTheme>(getTheme())

const epubBooks = computed(() =>
  booksStore.books
    .filter((b) => (b.category ?? 'book') === 'book' && (b.fileType ?? 'epub') !== 'pdf')
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
)

const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return epubBooks.value
  return epubBooks.value.filter((b) =>
    `${b.title} ${b.author}`.toLowerCase().includes(q)
  )
})

function open(bookId: string): void {
  router.push({ name: 'reader', params: { bookId } })
}

function toggleTheme(): void {
  theme.value = cycleTheme()
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') {
    booksStore.refreshBooks()
  }
}

onMounted(() => {
  booksStore.refreshBooks()
  document.addEventListener('visibilitychange', onVisibility)
})

onUnmounted(() => {
  document.removeEventListener('visibilitychange', onVisibility)
})
</script>

<style scoped>
.library {
  height: 100%;
  overflow-y: auto;
  max-width: 720px;
  margin: 0 auto;
  padding: 1rem;
}

.lib-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0 1rem;
  border-bottom: 1px solid var(--color-border-base, #e0e0e0);
}

.lib-header h1 {
  font-weight: 400;
  font-size: 1.5rem;
  color: var(--color-text-base, #202020);
}

.lib-header-actions {
  display: flex;
  gap: 0.5rem;
}

.lib-theme-btn {
  padding: 0.35rem 0.7rem;
  border: 1px solid var(--color-border-base, #ccc);
  border-radius: 6px;
  background: transparent;
  color: var(--color-text-muted, #888);
  cursor: pointer;
  font-size: 0.8rem;
}

.lib-theme-btn:hover {
  background: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
  color: var(--color-text-base, #202020);
}

.lib-search {
  padding: 0.75rem 0;
}

.lib-search input {
  width: 100%;
  padding: 0.6rem 0.75rem;
  border: 1px solid var(--color-border-base, #ccc);
  border-radius: 6px;
  background: var(--color-bg-elevated, #fff);
  color: var(--color-text-base, #202020);
  font-size: 1rem;
}

.lib-search input:focus {
  outline: none;
  border-color: var(--color-primary, #404040);
}

.lib-status {
  padding: 2rem 0;
  text-align: center;
  color: var(--color-text-muted, #888);
}

.lib-list {
  list-style: none;
}

.lib-item {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  padding: 0.6rem 0.25rem;
  border-bottom: 1px solid var(--color-border-subtle, #eee);
  cursor: pointer;
  min-height: 56px;
}

.lib-item:hover {
  background: var(--color-bg-hover, rgba(0, 0, 0, 0.03));
}

.lib-cover {
  width: 40px;
  height: 56px;
  flex-shrink: 0;
  background: var(--color-bg-hover, #eee);
  overflow: hidden;
}

.lib-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.lib-meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.lib-title {
  font-size: 1rem;
  color: var(--color-text-base, #202020);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-author {
  font-size: 0.85rem;
  color: var(--color-text-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.lib-progress-text {
  font-size: 0.75rem;
  color: var(--color-primary, #404040);
}

.lib-empty {
  list-style: none;
  padding: 2.5rem 0;
  text-align: center;
  color: var(--color-text-muted, #888);
  font-size: 0.9rem;
}
</style>
