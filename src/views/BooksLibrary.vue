<template>
  <AppLayout storage-key="books-layout">
    <div class="books-library">
      <div class="library-header">
        <h1>My Library</h1>
        <div class="upload-section">
          <Button variant="primary" @click="triggerFileInput" :disabled="isUploading">
            + Add Book
          </Button>
          <input
            ref="fileInput"
            type="file"
            accept=".epub"
            @change="handleFileUpload"
            style="display: none"
          >
        </div>
      </div>

      <div v-if="isLoading" class="loading">Loading library...</div>

      <div v-else-if="error" class="error">{{ error }}</div>

      <SlideTransition v-else appear direction="vertical">
        <div class="books-grid">
          <!-- Show uploading book first if uploading -->
          <div
            v-if="uploadingBook"
            key="uploading"
            class="book-card is-uploading"
          >
            <div class="book-cover">
              <img v-if="uploadingBook.coverUrl" :src="uploadingBook.coverUrl" :alt="uploadingBook.title">
              <div v-else class="cover-placeholder">📖</div>
              <!-- Upload progress overlay -->
              <div class="upload-overlay">
                <ProgressBar :progress="uploadProgress" :status="uploadStatus" />
              </div>
            </div>
            <div class="book-info">
              <h3 class="book-title">{{ uploadingBook.title }}</h3>
              <p class="book-author">{{ uploadingBook.author }}</p>
            </div>
          </div>

          <!-- Regular books -->
          <div
            v-for="book in booksStore.booksSortedByDate.filter(b => b.id !== uploadingBook?.id)"
            :key="book.id"
            class="book-card"
            @click="openBook(book.id)"
          >
            <div class="book-cover">
              <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title">
              <div v-else class="cover-placeholder">📖</div>
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
            <button class="delete-btn" @click.stop="deleteBook(book.id)" title="Delete book">×</button>
          </div>

          <div v-if="booksStore.books.length === 0 && !uploadingBook" class="empty-state">
            <div class="empty-icon">📚</div>
            <p>No books yet</p>
            <p class="empty-hint">Add your first EPUB book to get started</p>
          </div>
        </div>
      </SlideTransition>
    </div>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useBooksStore } from '../stores/books.js'
import AppLayout from '../components/AppLayout.vue'
import Button from '../components/Button.vue'
import ProgressBar from '../components/ProgressBar.vue'
import SlideTransition from '../components/SlideTransition.vue'
import { extractEpubMetadata, coverUrlToDataUrl } from '../services/epubRenderer.js'
import { uploadBookToStorage } from '../services/bookStorage.js'

const router = useRouter()
const booksStore = useBooksStore()

const fileInput = ref(null)
const isLoading = ref(false)
const isUploading = ref(false)
const uploadingBook = ref(null) // The book being uploaded
const uploadStatus = ref('')
const uploadProgress = ref(0)
const error = ref(null)

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

const triggerFileInput = () => {
  fileInput.value.click()
}

const handleFileUpload = async (event) => {
  const file = event.target.files[0]
  if (!file) return

  // Validate file type
  if (!file.name.toLowerCase().endsWith('.epub')) {
    error.value = 'Please select an EPUB file (.epub)'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  uploadStatus.value = 'Reading file...'
  error.value = null

  // Create a temporary book object for the UI
  uploadingBook.value = {
    id: 'uploading',
    title: file.name.replace('.epub', ''),
    author: 'Loading...',
    coverUrl: null,
    totalProgress: 0
  }

  try {
    uploadProgress.value = 10
    uploadStatus.value = 'Extracting metadata...'

    // Extract metadata from EPUB
    const metadata = await extractEpubMetadata(file)

    uploadProgress.value = 30
    uploadStatus.value = 'Processing cover...'

    // Convert cover to data URL if available
    let coverDataUrl = null
    if (metadata.coverUrl) {
      coverDataUrl = await coverUrlToDataUrl(metadata.coverUrl)
    }

    // Update the uploading book with extracted metadata
    uploadingBook.value = {
      ...uploadingBook.value,
      title: metadata.title,
      author: metadata.author,
      coverUrl: coverDataUrl
    }

    uploadProgress.value = 50
    uploadStatus.value = 'Creating book record...'

    // Create book record (will be assigned ID in store)
    const bookData = {
      title: metadata.title,
      author: metadata.author,
      coverUrl: coverDataUrl,
      fileSize: file.size
    }

    // Add to store (this creates the book with an ID)
    const book = await booksStore.addBook(bookData)

    // Update uploadingBook with the real ID
    uploadingBook.value.id = book.id

    uploadProgress.value = 70
    uploadStatus.value = 'Uploading to cloud...'

    // Upload file to Firebase Storage
    const downloadUrl = await uploadBookToStorage(file, book.id)

    uploadProgress.value = 90
    uploadStatus.value = 'Finishing...'

    // Update book with storage path
    await booksStore.updateBook(book.id, {
      storagePath: downloadUrl
    })

    uploadProgress.value = 100
    uploadStatus.value = 'Done!'

    // Reset input
    event.target.value = ''

    // Clear uploading book after a delay
    setTimeout(() => {
      uploadingBook.value = null
      uploadStatus.value = ''
      uploadProgress.value = 0
    }, 1500)
  } catch (err) {
    console.error('Failed to upload book:', err)
    error.value = err.message || 'Failed to upload book'
    uploadingBook.value = null
    uploadStatus.value = ''
    uploadProgress.value = 0
  } finally {
    isUploading.value = false
  }
}

const openBook = (bookId) => {
  booksStore.setCurrentBook(bookId)
  router.push({ name: 'book-viewer', params: { id: bookId } })
}

const deleteBook = async (bookId) => {
  const book = booksStore.getBookById(bookId)
  const bookTitle = book?.title || 'this book'

  if (confirm(`Delete "${bookTitle}"?`)) {
    try {
      await booksStore.deleteBook(bookId)
    } catch (err) {
      error.value = err.message || 'Failed to delete book'
    }
  }
}
</script>

<style scoped>
.books-library {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.library-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 2rem 1rem;
  background: var(--color-bg-page);
}

.library-header h1 {
  margin: 0;
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 2rem;
  font-weight: 400;
  color: var(--color-text-message);
}

.upload-section {
  display: flex;
  align-items: center;
  gap: 1rem;
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
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1.5rem;
  padding: 1rem 2rem 2rem;
  overflow-y: auto;
}

.book-card {
  position: relative;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 12px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.book-card:hover {
  border-color: var(--color-border-accent);
  box-shadow: 0 4px 12px var(--shadow-primary);
  transform: translateY(-2px);
}

.book-card.is-uploading {
  cursor: default;
}

.book-card.is-uploading:hover {
  transform: none;
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

.cover-placeholder {
  font-size: 4rem;
  opacity: 0.5;
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

.delete-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  width: 28px;
  height: 28px;
  padding: 0;
  background: rgba(0, 0, 0, 0.6);
  border: none;
  border-radius: 50%;
  color: white;
  font-size: 1.25rem;
  line-height: 1;
  cursor: pointer;
  opacity: 0;
  transition: all 0.2s;
}

.book-card:hover .delete-btn {
  opacity: 1;
}

.delete-btn:hover {
  background: var(--color-error-bg);
  color: var(--color-error-text);
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
  .library-header {
    padding: 1rem;
    flex-direction: column;
    gap: 1rem;
    align-items: stretch;
  }

  .library-header h1 {
    font-size: 1.5rem;
    text-align: center;
  }

  .books-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
    gap: 1rem;
    padding: 1rem;
  }
}
</style>
