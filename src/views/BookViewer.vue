<template>
  <AppLayout storage-key="book-viewer-layout">
    <template #side>
      <div class="toc-sidebar">
        <input
          v-model="searchQuery"
          type="text"
          class="toc-search-input"
          placeholder="Search chapters..."
        />
        <div class="toc-list">
          <div
            v-for="(chapter, index) in filteredChapters"
            :key="index"
            class="toc-item"
            :class="{ active: currentChapterIndex === chapters.indexOf(chapter) }"
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
          <button class="nav-btn" @click="prevPage" title="Previous page">
            ◀
          </button>
          <span class="progress">{{ progressPercent }}%</span>
          <button class="nav-btn" @click="nextPage" title="Next page">
            ▶
          </button>
        </div>
        <div class="toolbar-right">
          <button class="nav-btn" @click="toggleTOC" title="Toggle table of contents">
            ☰
          </button>
        </div>
      </div>

      <div ref="viewerContainer" class="viewer-container">
        <div v-if="isLoading || error" class="loading-overlay">
          <div v-if="isLoading" class="loading">
            <ProgressBar v-if="downloadProgress > 0" :progress="downloadProgress" />
            <span v-else>Loading book...</span>
          </div>
          <div v-else-if="error" class="error">{{ error }}</div>
        </div>
      </div>
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
const error = ref(null)
const searchQuery = ref('')

const filteredChapters = computed(() => {
  if (!searchQuery.value.trim()) {
    return chapters.value
  }
  const query = searchQuery.value.toLowerCase()
  return chapters.value.filter(chapter =>
    chapter.label.toLowerCase().includes(query)
  )
})

const currentBook = computed(() => booksStore.currentBook)
const progressPercent = computed(() => {
  return currentBook.value ? Math.round(currentBook.value.totalProgress * 100) : 0
})

// Enable pagination buttons - epub.js will handle boundaries internally
const canGoPrev = computed(() => true)
const canGoNext = computed(() => true)

let saveInterval = null
let settingsObserver = null

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

  // Watch for CSS variable changes (settings) and refresh EPUB theme
  setupSettingsWatcher()
})

onUnmounted(() => {
  if (renderer.value) {
    renderer.value.destroy()
  }
  if (saveInterval) {
    clearInterval(saveInterval)
  }
  if (settingsObserver) {
    settingsObserver.disconnect()
  }
})

function setupSettingsWatcher() {
  // Watch for changes to CSS variables on documentElement
  settingsObserver = new MutationObserver(() => {
    if (renderer.value?.refreshTheme) {
      renderer.value.refreshTheme()
    }
  })

  settingsObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'data-theme']
  })
}

async function loadBook(bookId) {
  isLoading.value = true
  downloadProgress.value = 0
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

    // Get or download book file (IndexedDB cache → Firebase Storage → IndexedDB cache)
    const fileData = await getOrDownloadBookFile(bookId, book.storagePath)

    downloadProgress.value = 90

    if (!fileData) {
      throw new Error('Failed to load book file')
    }

    // Initialize the renderer
    renderer.value = new EpubRenderer(viewerContainer.value, fileData)
    await renderer.value.initialize()

    downloadProgress.value = 100

    // Get table of contents
    const toc = renderer.value.getTableOfContents()
    chapters.value = toc

    // Restore last position if available
    if (book.lastReadCfi) {
      await renderer.value.gotoCfi(book.lastReadCfi)
    }

    // Update current chapter index and progress
    updateCurrentChapter()
    updateProgress()

    // Clear progress after a short delay
    setTimeout(() => {
      clearInterval(progressInterval)
      downloadProgress.value = 0
      isLoading.value = false
    }, 500)
  } catch (err) {
    clearInterval(progressInterval)
    console.error('Failed to load book:', err)
    error.value = err.message || 'Failed to load book'
    downloadProgress.value = 0
    isLoading.value = false
  }
}

async function gotoChapter(href) {
  if (!renderer.value) return

  try {
    await renderer.value.goto(href)
    updateCurrentChapter()
    updateProgress()
  } catch (err) {
    console.error('Failed to navigate to chapter:', err)
  }
}

async function prevPage() {
  if (!renderer.value) return
  try {
    await renderer.value.prev()
    updateCurrentChapter()
    // Small delay to let epub.js update the location
    setTimeout(updateProgress, 100)
  } catch (err) {
    console.error('Failed to go to previous page:', err)
  }
}

async function nextPage() {
  if (!renderer.value) return
  try {
    await renderer.value.next()
    updateCurrentChapter()
    // Small delay to let epub.js update the location
    setTimeout(updateProgress, 100)
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

function updateProgress() {
  if (!renderer.value || !currentBook.value) return

  const progress = renderer.value.getProgress()
  const cfi = renderer.value.getCurrentCfi()

  if (cfi && currentBook.value.id) {
    // Update the store immediately for UI feedback
    booksStore.updateReadingPosition(currentBook.value.id, cfi, progress)
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
  router.push({ name: 'books' }).catch(() => {
    // Fallback: go back in history
    router.back()
  })
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
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0 1rem;
}

/* Center the EPUB iframe */
.viewer-container :deep(iframe) {
  margin: 0 auto;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-bg-base);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-error-text);
}

/* Table of Contents Sidebar */
.toc-sidebar {
  padding: 1rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.toc-search-input {
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

.toc-search-input:focus {
  outline: none;
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 3px var(--shadow-primary);
}

.toc-search-input::placeholder {
  color: var(--color-text-muted);
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
  font-size: 0.85rem;
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
