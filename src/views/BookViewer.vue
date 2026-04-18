<template>
  <AppLayout storage-key="book-layout">
    <template #side>
      <BookTocSidebar
        :toc="toc"
        :book-title="currentBook?.title ?? ''"
        :active-href="activeHref"
        @navigate="handleTocNavigate"
        @back="router.push({ name: 'books' })"
      />
    </template>
    <div class="book-viewer-page">
      <div v-if="loading" class="loading-state">Loading book...</div>
      <div v-else-if="error" class="error-state">{{ error }}</div>
      <div v-else-if="!currentBook" class="empty-state">
        <h2>No book selected</h2>
        <p>Go to your <router-link to="/books">library</router-link> to select a book.</p>
      </div>
      <template v-else>
        <div class="book-header">
          <h2>{{ currentBook.title }}</h2>
          <p v-if="currentBook.author" class="book-author">by {{ currentBook.author }}</p>
          <div v-if="progress > 0" class="progress-wrapper">
            <ProgressBar :value="Math.round(progress * 100)" :max="100" />
          </div>
        </div>
        <div class="viewer-container" ref="viewerContainer">
          <!-- EPUB renders here -->
        </div>
        <div class="page-nav">
          <button class="nav-btn" @click="handlePrevPage" :disabled="!canGoPrev">&larr; Previous</button>
          <span class="page-info">{{ Math.round(progress * 100) }}%</span>
          <button class="nav-btn" @click="handleNextPage" :disabled="!canGoNext">Next &rarr;</button>
        </div>
      </template>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import BookTocSidebar from '@/components/BookTocSidebar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import { useBooksStore } from '@/stores/books'
import { EpubRenderer } from '@/services/epubRenderer'
import type { BookData } from '@/types/book'
import type { NavItem } from 'epubjs'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const loading = ref(false)
const error = ref<string | null>(null)
const viewerContainer = ref<HTMLElement | null>(null)
const progress = ref(0)
const canGoPrev = ref(false)
const canGoNext = ref(true)
const toc = ref<NavItem[]>([])
const activeHref = ref<string | null>(null)

let renderer: EpubRenderer | null = null
let resizeObserver: ResizeObserver | null = null

const currentBook = computed<BookData | undefined>(() => {
  const bookId = (route.params.bookId ?? route.params.id) as string
  if (!bookId) return undefined
  return booksStore.books.find(b => b.id === bookId)
})

async function loadFileData(bookId: string): Promise<ArrayBuffer | null> {
  // Tier 1: In-memory preload cache
  const preloaded = booksStore.getPreloadedBook(bookId)
  if (preloaded) return preloaded.fileData

  // Tier 2: IndexedDB local cache (fast, for previously downloaded books)
  try {
    const { BookStorage } = await import('@/services/BookStorage')
    const cached = await BookStorage.getBookFile(bookId)
    if (cached) return cached
  } catch {}

  // Tier 3: Download from cloud (with progress)
  try {
    const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
    const fileData = await downloadBookFileFromStorage(bookId, (p) => {
      booksStore.$patch({ downloadProgress: { [bookId]: p } })
    })
    if (fileData) {
      const { BookStorage } = await import('@/services/BookStorage')
      await BookStorage.saveBookFile(bookId, fileData)
      return fileData
    }
  } catch (err) {
    console.warn('[BookViewer] Cloud download failed:', err)
  }

  return null
}

function getEpubTheme(): { bg: string; color: string } {
  const style = getComputedStyle(document.documentElement)
  return {
    bg: style.getPropertyValue('--color-bg-page').trim() || '#ffffff',
    color: style.getPropertyValue('--color-text-base').trim() || '#000000',
  }
}

async function renderBook(bookId: string, fileData: ArrayBuffer) {
  // Wait for the container to be in the DOM
  await nextTick()
  if (!viewerContainer.value) {
    error.value = 'Viewer container not available'
    return
  }

  renderer = new EpubRenderer(viewerContainer.value, fileData, {
    theme: getEpubTheme(),
    onLocationChange(location) {
      progress.value = location.percentage
      canGoPrev.value = location.percentage > 0
      canGoNext.value = location.percentage < 0.99

      booksStore.updateReadingPosition(bookId, location.cfi, location.percentage).catch(err => {
        console.warn('Failed to save reading position:', err)
      })
    },
  })

  // initialize() renders the book (display from beginning)
  await renderer.initialize()

  // Populate TOC in sidebar
  toc.value = renderer.getTableOfContents()

  // Navigate to saved reading position (after initial render succeeds)
  const book = booksStore.getBookById(bookId)
  if (book?.lastCfi) {
    try {
      await renderer.display(book.lastCfi)
    } catch {
      // Invalid CFI — stay on first page
    }
  }

  if (book?.readingProgress) {
    progress.value = book.readingProgress / 100
  }

  // Observe container resizes — skip the initial trigger to avoid resetting position
  let resizeSkipped = false
  resizeObserver = new ResizeObserver((entries) => {
    if (!resizeSkipped) {
      resizeSkipped = true
      return
    }
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        renderer?.resize(width, height)
      }
    }
  })
  resizeObserver.observe(viewerContainer.value)
}

async function handleTocNavigate(href: string) {
  if (!renderer) return
  activeHref.value = href
  await renderer.display(href)
}

async function handlePrevPage() {
  await renderer?.prevPage()
}

async function handleNextPage() {
  await renderer?.nextPage()
}

function destroyRenderer() {
  if (renderer) {
    renderer.destroy()
    renderer = null
  }
  toc.value = []
  activeHref.value = null
}

watch(currentBook, (book) => {
  if (book) {
    progress.value = (book.readingProgress ?? 0) / 100
  }
})

onMounted(async () => {
  const bookId = (route.params.bookId ?? route.params.id) as string
  if (!bookId) {
    error.value = 'No book ID provided'
    return
  }

  loading.value = true
  error.value = null
  booksStore.setCurrentBook(bookId)

  try {
    await booksStore.loadBookContent(bookId)

    const fileData = await loadFileData(bookId)
    if (!fileData) {
      error.value = 'Book file not found. It may not have been uploaded yet.'
      return
    }

    loading.value = false
    await renderBook(bookId, fileData)
  } catch (err) {
    console.error('[BookViewer] Failed to load book:', err)
    error.value = `Failed to load book: ${(err as Error).message}`
  } finally {
    loading.value = false
  }
})

onUnmounted(() => {
  destroyRenderer()
})
</script>

<style scoped>
.book-viewer-page { height: 100%; overflow-y: hidden; background: var(--color-bg-page); display: flex; flex-direction: column; }
.loading-state, .error-state, .empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-state h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.empty-state a { color: var(--color-primary); }
.book-header { padding: 1rem 2rem; border-bottom: 1px solid var(--color-border-base); flex-shrink: 0; }
.book-header h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.25rem; }
.book-author { color: var(--color-text-muted); font-size: 0.9rem; margin: 0 0 0.5rem; }
.progress-wrapper { max-width: 300px; }
.viewer-container { flex: 1; overflow: hidden; }
.page-nav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 2rem; border-top: 1px solid var(--color-border-base); flex-shrink: 0; }
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }
@media (max-width: 768px) { .book-header { padding: 0.75rem 1rem; } }
</style>
