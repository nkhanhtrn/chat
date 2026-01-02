<template>
  <AppLayout storage-key="books-layout">
    <template #side>
      <div class="side-playground-wrapper">
        <SideChatPlayground />
      </div>
    </template>
    <div class="books-library">
      <div class="library-header">
        <button
          class="view-toggle mobile-only-btn"
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
        <h1>My Library</h1>
        <div class="header-actions desktop-only">
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
          <button
            class="view-toggle sort-btn"
            @click="sortMode === 'color' ? toggleSortMode() : calculateColorsAndSort()"
            :disabled="isCalculatingColors"
            :title="isCalculatingColors ? 'Calculating colors...' : sortMode === 'color' ? 'Sort by name' : 'Sort by color'"
          >
            <svg v-show="isCalculatingColors" class="view-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" />
            </svg>
            <svg v-show="sortMode === 'color' && !isCalculatingColors" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="none">
              <defs>
                <linearGradient id="colorGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" style="stop-color:#ef4444" />
                  <stop offset="25%" style="stop-color:#f97316" />
                  <stop offset="50%" style="stop-color:#eab308" />
                  <stop offset="75%" style="stop-color:#22c55e" />
                  <stop offset="100%" style="stop-color:#3b82f6" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="9" fill="url(#colorGradient)" opacity="0.9" />
              <circle cx="8" cy="8" r="3" fill="#ef4444" opacity="0.8" />
              <circle cx="16" cy="8" r="3" fill="#eab308" opacity="0.8" />
              <circle cx="12" cy="16" r="3" fill="#22c55e" opacity="0.8" />
              <circle cx="12" cy="10" r="4" fill="#ffffff" opacity="0.3" />
            </svg>
            <span v-show="sortMode !== 'color' && !isCalculatingColors" class="sort-text">Az</span>
          </button>
          <Button variant="primary" @click="openBookModal('upload')" :disabled="isUploading" class="add-book-btn">
            + New Book
          </Button>
        </div>
        <button
          class="view-toggle mobile-only-btn sort-btn"
          @click="sortMode === 'color' ? toggleSortMode() : calculateColorsAndSort()"
          :disabled="isCalculatingColors"
          :title="isCalculatingColors ? 'Calculating colors...' : sortMode === 'color' ? 'Sort by name' : 'Sort by color'"
        >
          <svg v-show="isCalculatingColors" class="view-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="32" />
          </svg>
          <svg v-show="sortMode === 'color' && !isCalculatingColors" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="none">
            <defs>
              <linearGradient id="colorGradientMobile" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#ef4444" />
                <stop offset="25%" style="stop-color:#f97316" />
                <stop offset="50%" style="stop-color:#eab308" />
                <stop offset="75%" style="stop-color:#22c55e" />
                <stop offset="100%" style="stop-color:#3b82f6" />
              </linearGradient>
            </defs>
            <circle cx="12" cy="12" r="9" fill="url(#colorGradientMobile)" opacity="0.9" />
            <circle cx="8" cy="8" r="3" fill="#ef4444" opacity="0.8" />
            <circle cx="16" cy="8" r="3" fill="#eab308" opacity="0.8" />
            <circle cx="12" cy="16" r="3" fill="#22c55e" opacity="0.8" />
            <circle cx="12" cy="10" r="4" fill="#ffffff" opacity="0.3" />
          </svg>
          <span v-show="sortMode !== 'color' && !isCalculatingColors" class="sort-text">Az</span>
        </button>
        <Button variant="primary" @click="openBookModal('upload')" :disabled="isUploading" class="add-book-btn mobile-only-btn">
          +
        </Button>
      </div>

      <div class="search-container">
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          placeholder="Search books by title or author..."
        />
      </div>

      <div v-if="isLoading" class="loading">Loading library...</div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <SlideTransition v-else appear direction="vertical">
        <transition name="view-mode" mode="out-in">
          <div :key="viewMode" class="books-grid" :class="viewMode === 'list' ? 'books-list' : 'books-grid'">
          <!-- Regular books -->
          <div
            v-for="book in filteredBooks"
            :key="book.id"
            class="book-card"
            :class="{
              'is-uploading': isUploading && uploadingBookId === book.id,
              'is-preloading': booksStore.isBookPreloading(book.id),
              'is-disabled': booksStore.isBookPreloading(book.id)
            }"
            @click="openBook(book.id)"
          >
            <div class="book-cover">
              <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title">
              <img v-else :src="getDefaultCover(book.title, book.author)" :alt="book.title" class="default-cover">
              <!-- Upload progress overlay -->
              <div v-if="isUploading && uploadingBookId === book.id" class="upload-overlay">
                <ProgressBar :progress="uploadProgress" />
              </div>
              <!-- Preloading progress overlay -->
              <div v-if="booksStore.isBookPreloading(book.id)" class="upload-overlay">
                <ProgressBar :progress="booksStore.getPreloadProgress(book.id)" />
              </div>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ book.title }}</h3>
              <p class="book-author">{{ book.author }}</p>
              <div class="book-progress">
                <div class="progress-bar">
                  <div class="progress-fill" :style="{ width: (book.totalProgress * 100) + '%' }"></div>
                </div>
                <span class="progress-text">{{ Math.round(book.totalProgress * 100) }}%</span>
            </div>
            </div>
            <div class="book-actions">
              <button class="action-btn menu-btn" @click.stop="openEditModal(book.id)" title="Edit book">
                <span></span>
                <span></span>
                <span></span>
              </button>
            </div>
          </div>

          <div v-if="filteredBooks.length === 0 && !isUploading" class="empty-state">
            <div class="empty-icon">{{ searchQuery.trim() ? '🔍' : '📚' }}</div>
            <p>{{ searchQuery.trim() ? 'No books found matching "' + searchQuery + '"' : 'No books yet' }}</p>
            <p v-if="!searchQuery.trim()" class="empty-hint">Add your first EPUB book to get started</p>
          </div>
        </div>
        </transition>
      </SlideTransition>
    </div>

    <!-- Edit Book Modal -->
    <EditBookModal
      :visible="isEditModalOpen"
      :book="editingBook"
      @close="closeEditModal"
      @save="saveBookChanges"
      @delete="handleModalDelete"
    />

    <!-- Book Search Modal (Public Library) -->
    <BookSearchModal
      :visible="showSearchModal"
      :default-tab="modalDefaultTab"
      @close="showSearchModal = false"
      @download="handleDownloadedBook"
      @upload="handleUploadedBook"
    />
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '../stores/books.js'
import AppLayout from '../components/AppLayout.vue'
import Button from '../components/Button.vue'
import SideChatPlayground from '../components/SideChatPlayground.vue'
import ProgressBar from '../components/ProgressBar.vue'
import SlideTransition from '../components/SlideTransition.vue'
import EditBookModal from '../components/EditBookModal.vue'
import BookSearchModal from '../components/Modal/BookSearchModal.vue'
import { extractEpubMetadata, coverUrlToDataUrl } from '../services/epubRenderer.js'
import { uploadBookToStorage, saveBookFileToIDB } from '../services/bookStorage.js'
import { generateDefaultCover } from '../services/bookCoverGenerator.js'
import { extractDominantColor, generateColorFromText } from '../services/colorExtractor.js'

const router = useRouter()
const booksStore = useBooksStore()

// View mode state (grid or list)
const viewMode = ref(localStorage.getItem('books-view-mode') || 'grid')
// Sort mode: 'name' or 'color'
const sortMode = ref('name')
// Store calculated colors for books: { bookId: {h, s, l} }
const bookColors = ref({})
// Color calculation in progress
const isCalculatingColors = ref(false)

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  localStorage.setItem('books-view-mode', viewMode.value)
}

const toggleSortMode = () => {
  sortMode.value = sortMode.value === 'date' ? 'color' : 'date'
}

const isLoading = ref(false)
const isUploading = ref(false)
const uploadingBookId = ref(null) // ID of the book being uploaded
const uploadProgress = ref(0)
const error = ref(null)
const searchQuery = ref('')

// Public Library search modal state
const showSearchModal = ref(false)
const modalDefaultTab = ref('search')

// Filtered books based on search query and sort mode
const filteredBooks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let books = booksStore.books

  // Apply search filter
  if (query) {
    const searchWords = query.split(/\s+/).filter(w => w.length > 0)
    books = books.filter(book => {
      const title = (book.title || '').toLowerCase()
      const author = (book.author || '').toLowerCase()
      return searchWords.every(word =>
        title.includes(word) || author.includes(word)
      )
    })
  }

  // Apply sorting
  if (sortMode.value === 'color') {
    // Sort by hue, then saturation, then lightness
    return [...books].sort((a, b) => {
      const colorA = bookColors.value[a.id] || { h: 0, s: 0, l: 100 }
      const colorB = bookColors.value[b.id] || { h: 0, s: 0, l: 100 }
      if (colorA.h !== colorB.h) return colorA.h - colorB.h
      if (colorA.s !== colorB.s) return colorA.s - colorB.s
      return colorA.l - colorB.l
    })
  } else {
    // Sort by title alphabetically
    return [...books].sort((a, b) => (a.title || '').localeCompare(b.title || ''))
  }
})

// Cache for generated default covers
const defaultCoverCache = new Map()

function getDefaultCover(title, author) {
  const key = `${title}|${author}`
  if (!defaultCoverCache.has(key)) {
    defaultCoverCache.set(key, generateDefaultCover(title, author))
  }
  return defaultCoverCache.get(key)
}

// Calculate colors for all books and sort by color
async function calculateColorsAndSort() {
  if (isCalculatingColors.value) return

  isCalculatingColors.value = true
  const colors = {}

  try {
    const books = booksStore.books

    for (const book of books) {
      try {
        let color

        if (book.coverUrl) {
          // Extract color from cover image
          color = await extractDominantColor(book.coverUrl)
        } else {
          // Generate color from title for default covers
          color = generateColorFromText(book.title || book.id)
        }

        colors[book.id] = color
      } catch (err) {
        console.warn(`Failed to extract color for book "${book.title}":`, err)
        // Fallback to generated color from title
        colors[book.id] = generateColorFromText(book.title || book.id)
      }
    }

    bookColors.value = colors
    sortMode.value = 'color'
  } finally {
    isCalculatingColors.value = false
  }
}

// Edit modal state
const isEditModalOpen = ref(false)
const editingBookId = ref(null)
const editingBook = computed(() => {
  if (!editingBookId.value) return null
  return booksStore.getBookById(editingBookId.value)
})

onMounted(async () => {
  isLoading.value = true
  error.value = null
  try {
    const result = await booksStore.initializeStore()
    if (result.hasConflict) {
      // For now, just use local data if there's a conflict
      // TODO: Could show a conflict resolution modal
      error.value = 'Sync conflict detected. Using local data.'
    }
  } catch (err) {
    error.value = err.message || 'Failed to load library'
  } finally {
    isLoading.value = false
  }
})

function openBookModal(tab) {
  modalDefaultTab.value = 'upload'
  showSearchModal.value = true
}

/**
 * Handle book uploaded from the modal
 */
async function handleUploadedBook(bookData) {
  isUploading.value = true
  uploadProgress.value = 0
  error.value = null

  try {
    // Create book record first
    const book = await booksStore.addBook({
      title: bookData.title,
      author: bookData.author,
      coverUrl: bookData.coverUrl || null,
      fileSize: bookData.fileSize || 0
    })

    uploadingBookId.value = book.id
    uploadProgress.value = 50

    // Cache the file in IndexedDB
    console.log('[Upload] Saving file to IndexedDB for book:', book.id)
    await saveBookFileToIDB(book.id, bookData.fileData)
    console.log('[Upload] ✓ File saved to IndexedDB')

    uploadProgress.value = 80

    // Update book with storage path (already uploaded by modal)
    if (bookData.storagePath) {
      await booksStore.updateBook(book.id, {
        storagePath: bookData.storagePath
      })
    }

    uploadProgress.value = 100

    // Close the modal after successful upload
    showSearchModal.value = false

    // Clear uploading state after a delay
    setTimeout(() => {
      uploadingBookId.value = null
      uploadProgress.value = 0
      isUploading.value = false
    }, 1500)
  } catch (err) {
    console.error('[Upload] Failed to save uploaded book:', err)
    error.value = err.message || 'Failed to save uploaded book'
    uploadingBookId.value = null
    uploadProgress.value = 0
    isUploading.value = false
  }
}

const openBook = async (bookId) => {
  // If already preloading, ignore
  if (booksStore.isBookPreloading(bookId)) {
    return
  }

  // If already preloaded, navigate immediately
  if (booksStore.isBookPreloaded(bookId)) {
    booksStore.setCurrentBook(bookId)
    await router.push({ name: 'current-content', params: { type: 'book', id: bookId } })
    return
  }

  // Preload the book first, then navigate
  try {
    await booksStore.preloadBook(bookId, (progress) => {
      // Progress is tracked in the store for UI display
    })
    // Book is now fully loaded, navigate
    booksStore.setCurrentBook(bookId)
    await router.push({ name: 'current-content', params: { type: 'book', id: bookId } })
  } catch (err) {
    console.error('Failed to preload book:', err)
    error.value = err.message || 'Failed to open book'
  }
}

const deleteBook = async (bookId) => {
  const book = booksStore.getBookById(bookId)
  const bookTitle = book?.title || 'this book'

  try {
    await booksStore.deleteBook(bookId)
  } catch (err) {
    error.value = err.message || 'Failed to delete book'
  }
}

function openEditModal(bookId) {
  editingBookId.value = bookId
  isEditModalOpen.value = true
}

function closeEditModal() {
  isEditModalOpen.value = false
  editingBookId.value = null
}

async function saveBookChanges(updates) {
  if (!editingBookId.value) return

  try {
    await booksStore.updateBook(editingBookId.value, updates)
    closeEditModal()
  } catch (err) {
    error.value = err.message || 'Failed to save changes'
  }
}

async function handleModalDelete() {
  if (!editingBookId.value) return

  try {
    await booksStore.deleteBook(editingBookId.value)
    closeEditModal()
  } catch (err) {
    error.value = err.message || 'Failed to delete book'
  }
}

/**
 * Handle book downloaded from Public Library
 */
async function handleDownloadedBook(bookData) {
  isUploading.value = true
  uploadProgress.value = 0
  error.value = null

  try {
    // Create book record first
    const book = await booksStore.addBook({
      title: bookData.title,
      author: bookData.author,
      coverUrl: bookData.coverUrl || null,
      fileSize: bookData.fileData?.byteLength || 0
    })

    uploadingBookId.value = book.id
    uploadProgress.value = 10

    // Cache the file in IndexedDB
    console.log('[PublicLibrary] Saving file to IndexedDB for book:', book.id)
    await saveBookFileToIDB(book.id, bookData.fileData)
    console.log('[PublicLibrary] ✓ File saved to IndexedDB')

    uploadProgress.value = 50

    // Upload file to Firebase Storage
    const fileBlob = new Blob([bookData.fileData], { type: 'application/epub+zip' })
    const downloadUrl = await uploadBookToStorage(fileBlob, book.id)

    uploadProgress.value = 80

    // Update book with storage path
    await booksStore.updateBook(book.id, {
      storagePath: downloadUrl
    })

    uploadProgress.value = 100

    // Close the search modal after successful download
    showSearchModal.value = false

    // Clear uploading state after a delay
    setTimeout(() => {
      uploadingBookId.value = null
      uploadProgress.value = 0
      isUploading.value = false
    }, 1500)
  } catch (err) {
    console.error('[PublicLibrary] Failed to save downloaded book:', err)
    error.value = err.message || 'Failed to save downloaded book'
    uploadingBookId.value = null
    uploadProgress.value = 0
    isUploading.value = false
  }
}
</script>

<style scoped>
.side-playground-wrapper {
  height: 100%;
}

.books-library {
  height: 100%;
  overflow-y: auto;
  background-color: var(--color-bg-base);
}

.library-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  max-width: 1200px;
  margin: 0 auto 2rem;
  padding: 2rem 2rem 0;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-base);
}

.library-header h1 {
  margin: 0;
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 2rem;
  font-weight: 400;
  color: var(--color-text-message);
}

.search-container {
  max-width: 1200px;
  margin: 0 auto 1.5rem;
  padding: 0 2rem;
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

.upload-section {
  display: flex;
  align-items: center;
  gap: 1rem;
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

.view-toggle.sort-btn {
  width: auto;
  padding: 0 8px;
  min-width: 36px;
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

.sort-text {
  font-size: 14px;
  font-weight: 600;
  color: var(--color-text-muted);
}

.view-icon.spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
    stroke-dashoffset: 32;
  }
  to {
    transform: rotate(360deg);
    stroke-dashoffset: 0;
  }
}

.loading,
.error {
  text-align: center;
  padding: 3rem;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-error-text);
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 1.5rem;
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 2rem 2rem;
  overflow-y: auto;
}

.books-list {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.books-list .book-card {
  flex-direction: row;
  align-items: center;
  padding: 0;
  min-height: auto;
  border: none;
  border-radius: 0;
  background: transparent;
}

.books-list .book-cover {
  width: 80px;
  height: 120px;
  flex-shrink: 0;
}

.books-list .book-title {
  font-size: 1rem;
}

.books-list .book-card:hover {
  transform: none;
}

.book-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.book-card:hover {
  /* No hover effect */
}

.book-card.is-uploading {
  cursor: default;
}

.book-card.is-uploading:hover {
  transform: none;
}

.book-card.is-disabled {
  pointer-events: none;
  opacity: 0.8;
}

.book-card.is-preloading {
  cursor: wait;
}

.book-cover {
  width: 100%;
  aspect-ratio: 2/3;
  background: var(--color-bg-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.upload-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.8);
}

.book-info {
  padding: 1rem;
  flex: 1;
  display: flex;
  flex-direction: column;
}

.book-title {
  margin: 0 0 0.25rem;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-base);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.book-author {
  margin: 0 0 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.book-progress {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-top: auto;
}

.progress-bar {
  flex: 1;
  height: 4px;
  background: var(--color-bg-hover);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  min-width: 3ch;
  text-align: right;
}

.book-actions {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  display: flex;
  gap: 0.25rem;
}

.action-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
  color: white;
}

.book-card:hover .action-btn {
  opacity: 1;
}

.action-btn:hover {
  background: rgba(0, 0, 0, 0.8);
}

.menu-btn span {
  width: 3px;
  height: 3px;
  background: white;
  border-radius: 50%;
  margin: 1px 0;
}

.empty-state {
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon {
  font-size: 4rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

.empty-state p {
  margin: 0.5rem 0;
  color: var(--color-text-muted);
}

.empty-hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .mobile-only-btn {
    display: flex !important;
  }

  .desktop-only {
    display: none !important;
  }

  .library-header {
    flex-direction: row;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 1rem;
    padding: 0.75rem 1rem;
  }

  .library-header h1 {
    font-size: 1.25rem;
    flex: 1;
    text-align: center;
  }

  .view-toggle {
    width: 36px;
    height: 36px;
  }

  .add-book-btn.mobile-only-btn {
    min-width: 36px;
    width: 36px;
    height: 36px;
    padding: 0;
    font-size: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .search-container {
    padding: 0 1rem;
    margin-bottom: 1rem;
  }

  .search-input {
    padding: 0.875rem 1rem;
    font-size: 1rem;
  }

  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
    gap: 1.25rem;
    padding: 0 1rem 1rem;
  }

  .books-list {
    grid-template-columns: 1fr;
    padding: 0 1rem 1rem;
  }
}

@media (min-width: 769px) {
  .mobile-only-btn {
    display: none !important;
  }
}

/* View mode transition */
.view-mode-enter-active,
.view-mode-leave-active {
  transition: all 0.1s ease;
}

.view-mode-enter-from {
  opacity: 0;
  transform: scale(0.95);
}

.view-mode-leave-to {
  opacity: 0;
  transform: scale(1.05);
}

.view-mode-enter-to,
.view-mode-leave-from {
  opacity: 1;
  transform: scale(1);
}
</style>
