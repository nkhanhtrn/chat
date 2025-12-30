<template>
  <AppLayout storage-key="book-viewer-layout">
    <template #side>
      <div class="toc-sidebar">
        <h3>Contents</h3>
        <div class="toc-list">
          <div
            v-for="(chapter, index) in chapters"
            :key="index"
            class="toc-item"
            :class="{ active: currentChapterIndex === index }"
            @click="gotoChapter(chapter.href)"
          >
            {{ chapter.label }}
          </div>
        </div>
      </div>
    </template>

    <div class="book-viewer">
      <div class="viewer-toolbar">
        <button class="nav-btn" @click="goBack" title="Back to Library">
          ← Library
        </button>
        <div class="toolbar-center">
          <button class="nav-btn" @click="prevPage" :disabled="!canGoPrev" title="Previous page">
            ◀
          </button>
          <span class="progress">{{ progressPercent }}%</span>
          <button class="nav-btn" @click="nextPage" :disabled="!canGoNext" title="Next page">
            ▶
          </button>
        </div>
        <div class="toolbar-right">
          <button class="nav-btn" @click="toggleTOC" title="Toggle table of contents">
            ☰
          </button>
        </div>
      </div>

      <div v-if="isLoading" class="loading">
        <ProgressBar v-if="downloadProgress > 0" :progress="downloadProgress" :status="downloadStatus" />
        <span v-else>Loading book...</span>
      </div>
      <div v-else-if="error" class="error">{{ error }}</div>
      <div v-else ref="viewerContainer" class="viewer-container"></div>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBooksStore } from '../stores/books.js'
import AppLayout from '../components/AppLayout.vue'
import ProgressBar from '../components/ProgressBar.vue'
import { EpubRenderer } from '../services/epubRenderer.js'
import { getOrDownloadBookFile } from '../services/bookStorage.js'

const router = useRouter()
const route = useRoute()
const booksStore = useBooksStore()

const viewerContainer = ref(null)
const chapters = ref([])
const currentChapterIndex = ref(0)
const renderer = ref(null)
const isLoading = ref(true)
const downloadProgress = ref(0)
const downloadStatus = ref('')
const error = ref(null)

const currentBook = computed(() => booksStore.currentBook)
const progressPercent = computed(() => {
  return currentBook.value ? Math.round(currentBook.value.totalProgress * 100) : 0
})

// For pagination buttons (simplified - just enables/disables based on progress)
const canGoPrev = computed(() => progressPercent.value > 0)
const canGoNext = computed(() => progressPercent.value < 100)

let saveInterval = null

onMounted(async () => {
  await booksStore.initializeStore()

  const bookId = route.params.id
  if (!bookId) {
    error.value = 'No book ID provided'
    isLoading.value = false
    return
  }

  // Set current book in store
  booksStore.setCurrentBook(bookId)

  // Load the book
  await loadBook(bookId)

  // Set up auto-save interval
  saveInterval = setInterval(saveReadingPosition, 5000)
})

onUnmounted(() => {
  if (renderer.value) {
    renderer.value.destroy()
  }
  if (saveInterval) {
    clearInterval(saveInterval)
  }
})

async function loadBook(bookId) {
  isLoading.value = true
  downloadProgress.value = 0
  downloadStatus.value = 'Loading book...'
  error.value = null

  // Simulate progress while loading
  const progressInterval = setInterval(() => {
    if (downloadProgress.value < 70) {
      downloadProgress.value += 5
    }
  }, 100)

  try {
    const book = currentBook.value
    if (!book) {
      throw new Error('Book not found')
    }

    downloadProgress.value = 70
    downloadStatus.value = 'Downloading from cloud...'

    // Get or download book file (IndexedDB cache → Firebase Storage → IndexedDB cache)
    const fileData = await getOrDownloadBookFile(bookId, book.storagePath)

    downloadProgress.value = 90
    downloadStatus.value = 'Preparing reader...'

    if (!fileData) {
      throw new Error('Failed to load book file')
    }

    // Initialize the renderer
    renderer.value = new EpubRenderer(viewerContainer.value, fileData)
    await renderer.value.initialize()

    downloadProgress.value = 100
    downloadStatus.value = 'Ready!'

    // Get table of contents
    const toc = renderer.value.getTableOfContents()
    chapters.value = toc

    // Restore last position if available
    if (book.lastReadCfi) {
      await renderer.value.gotoCfi(book.lastReadCfi)
    }

    // Update current chapter index
    updateCurrentChapter()

    // Clear progress after a short delay
    setTimeout(() => {
      clearInterval(progressInterval)
      downloadProgress.value = 0
      downloadStatus.value = ''
      isLoading.value = false
    }, 500)
  } catch (err) {
    clearInterval(progressInterval)
    console.error('Failed to load book:', err)
    error.value = err.message || 'Failed to load book'
    downloadProgress.value = 0
    downloadStatus.value = ''
    isLoading.value = false
  }
}

async function gotoChapter(href) {
  if (!renderer.value) return

  try {
    await renderer.value.goto(href)
    updateCurrentChapter()
  } catch (err) {
    console.error('Failed to navigate to chapter:', err)
  }
}

async function prevPage() {
  if (!renderer.value || !canGoPrev.value) return
  try {
    await renderer.value.prev()
    updateCurrentChapter()
  } catch (err) {
    console.error('Failed to go to previous page:', err)
  }
}

async function nextPage() {
  if (!renderer.value || !canGoNext.value) return
  try {
    await renderer.value.next()
    updateCurrentChapter()
  } catch (err) {
    console.error('Failed to go to next page:', err)
  }
}

function updateCurrentChapter() {
  if (!renderer.value || chapters.value.length === 0) return

  const currentCfi = renderer.value.getCurrentCfi()
  if (!currentCfi) return

  // Find current chapter by matching CFI
  for (let i = 0; i < chapters.value.length; i++) {
    const chapter = chapters.value[i]
    if (currentCfi.includes(chapter.href)) {
      currentChapterIndex.value = i
      break
    }
  }
}

function saveReadingPosition() {
  if (!renderer.value || !currentBook.value) return

  const cfi = renderer.value.getCurrentCfi()
  const progress = renderer.value.getProgress()

  if (cfi && currentBook.value.id) {
    booksStore.updateReadingPosition(currentBook.value.id, cfi, progress)
  }
}

function goBack() {
  router.push({ name: 'books' })
}

function toggleTOC() {
  // This would toggle the side panel visibility
  // For now, the side panel is controlled by AppLayout's expand/collapse
  // We could emit an event or call a method on AppLayout
  const layout = document.querySelector('.app-layout')
  if (layout) {
    // Trigger the expand button click
    const expandBtn = layout.querySelector('.expand-btn')
    if (expandBtn) {
      expandBtn.click()
    }
  }
}

// Watch for route changes (e.g., navigating to a different book)
watch(() => route.params.id, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Clean up old renderer
    if (renderer.value) {
      renderer.value.destroy()
      renderer.value = null
    }
    // Load new book
    await loadBook(newId)
  }
})
</script>

<style scoped>
.book-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.viewer-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-base);
  gap: 1rem;
}

.nav-btn {
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-button);
  border: 1px solid var(--color-border-button);
  border-radius: 6px;
  color: var(--color-text-base);
  cursor: pointer;
  transition: all 0.2s;
  font-size: 0.875rem;
}

.nav-btn:hover:not(:disabled) {
  background: var(--color-bg-button-hover);
  border-color: var(--color-border-button-hover);
}

.nav-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.toolbar-center {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.progress {
  font-size: 0.875rem;
  color: var(--color-text-muted);
  min-width: 3ch;
  text-align: center;
}

.viewer-container {
  flex: 1;
  overflow: hidden;
  position: relative;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-error-text);
}

/* Table of Contents Sidebar */
.toc-sidebar {
  padding: 1rem;
  overflow-y: auto;
}

.toc-sidebar h3 {
  margin: 0 0 1rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-base);
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.toc-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.toc-item:hover {
  background: var(--color-bg-hover);
}

.toc-item.active {
  background: var(--color-bg-hover);
  color: var(--color-primary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .viewer-toolbar {
    padding: 0.5rem;
    font-size: 0.875rem;
  }

  .nav-btn {
    padding: 0.4rem 0.6rem;
  }
}
</style>
