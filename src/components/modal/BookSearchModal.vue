<template>
  <Modal
    :visible="visible"
    title="Add Book"
    size="xlarge"
    @close="onClose"
  >
    <div class="book-search-modal">
      <div class="tabs">
        <button
          class="tab"
          :class="{ active: activeTab === 'search' }"
          @click="activeTab = 'search'"
        >
          Search
        </button>
        <button
          class="tab"
          :class="{ active: activeTab === 'upload' }"
          @click="activeTab = 'upload'"
        >
          Upload
        </button>
      </div>

      <!-- Search Tab -->
      <div v-show="activeTab === 'search'" class="tab-content">
        <div class="search-section">
          <input
            ref="searchInputRef"
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="Search by title, author..."
            @keydown.enter="handleSearch"
            :disabled="isSearching"
          >
          <Button
            variant="primary"
            class="search-submit-btn"
            @click="handleSearch"
            :disabled="!searchQuery.trim() || isSearching"
          >
            {{ isSearching ? 'Searching...' : 'Search' }}
          </Button>
        </div>

        <div v-if="searchError" class="error-message">
          {{ searchError }}
          <button class="error-dismiss" @click="searchError = null">×</button>
        </div>

        <div v-if="downloadError" class="error-message">
          {{ downloadError }}
          <button class="error-dismiss" @click="downloadError = null">×</button>
        </div>

        <div class="scrollable-content">
          <div v-if="isSearching" class="loading-state">
            <div class="spinner"></div>
            <p>Searching Public Library...</p>
          </div>

          <div v-if="!isSearching && hasSearched" class="results-section">
            <div v-if="results.length === 0" class="empty-state">
              <div class="empty-icon">🔍</div>
              <p>No books found matching "{{ searchQuery }}"</p>
              <p class="empty-hint">Try a different search term or check the spelling</p>
            </div>

            <template v-else>
              <div class="results-info">
                <span class="results-count">{{ results.length }} books found</span>
                <span class="page-info">Page {{ currentPage }} of {{ totalPages }}</span>
              </div>

              <div class="results-grid">
                <div
                  v-for="book in paginatedResults"
                  :key="book.id"
                  class="book-result-card"
                  :class="{ downloading: downloadingBookId === book.id }"
                  @click="handleDownload(book)"
                >
                  <div class="book-cover">
                    <img
                      v-if="book.coverUrl"
                      :src="getProxiedImageUrl(book.coverUrl)"
                      :alt="book.title"
                      @error="handleCoverError($event)"
                    >
                    <div v-else class="cover-placeholder">📖</div>

                    <div v-if="downloadingBookId === book.id" class="download-overlay">
                      <div class="spinner"></div>
                      <span class="progress-text">{{ downloadProgress }}%</span>
                    </div>
                  </div>

                  <div class="book-info">
                    <h3 class="book-title" :title="book.title">{{ book.title }}</h3>
                    <p class="book-author">{{ book.author }}</p>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>

        <div class="pagination-footer">
          <div class="pagination">
            <Button
              variant="secondary"
              :disabled="currentPage === 1 || !hasSearched"
              @click="currentPage--"
              class="pagination-btn"
            >
              ← Prev
            </Button>

            <div class="page-numbers">
              <button
                v-for="page in visiblePages"
                :key="page"
                class="page-number"
                :class="{ active: page === currentPage }"
                @click="currentPage = page"
              >
                {{ page }}
              </button>
            </div>

            <Button
              variant="secondary"
              :disabled="currentPage === totalPages || !hasSearched"
              @click="currentPage++"
              class="pagination-btn"
            >
              Next →
            </Button>
          </div>
        </div>
      </div>

      <!-- Upload Tab -->
      <div v-show="activeTab === 'upload'" class="tab-content">
        <div
          class="drop-zone"
          :class="{
            'drag-over': isDragOver,
            'uploading': isUploading
          }"
          @click="triggerFileInput"
          @dragover.prevent="isDragOver = true"
          @dragleave.prevent="isDragOver = false"
          @drop.prevent="handleDrop"
        >
          <input
            ref="fileInput"
            type="file"
            accept=".epub,.pdf"
            @change="handleFileSelect"
            style="display: none"
          >
          <div v-if="isUploading" class="uploading-state">
            <div class="spinner"></div>
            <p>Processing...</p>
            <div class="upload-progress">
              <div class="progress-bar">
                <div class="progress-fill" :style="{ width: uploadProgress + '%' }"></div>
              </div>
              <span class="progress-text">{{ uploadProgress }}%</span>
            </div>
          </div>
          <div v-else class="drop-zone-content">
            <div class="drop-icon">📚</div>
            <p class="drop-text">Drop your EPUB or PDF file here</p>
            <p class="drop-hint">or click to browse</p>
            <p class="drop-format">Supports .epub and .pdf files</p>
          </div>
        </div>

        <div v-if="uploadError" class="error-message">
          {{ uploadError }}
          <button class="error-dismiss" @click="uploadError = null">×</button>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="footer-actions">
        <Button variant="secondary" @click="onClose">
          Close
        </Button>
      </div>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import Modal from './Modal.vue'
import Button from '@/components/Button.vue'
import { extractEpubInfo } from '@/services/epubRenderer'
import { extractPdfInfo } from '@/services/pdfRenderer'
import {
  searchBooks,
  getProxiedImageUrl,
  fastDownloadBook,
} from '@/services/publicLibraryService'
import type { BookSearchResult } from '@/services/publicLibraryService'

export interface BookUploadData {
  title: string
  author: string
  coverData: ArrayBuffer | null
  fileData: ArrayBuffer
  fileSize: number
  fileType: 'epub' | 'pdf'
}

const props = withDefaults(defineProps<{
  visible?: boolean
}>(), {
  visible: false,
})

const emit = defineEmits<{
  close: []
  upload: [data: BookUploadData]
  download: [data: BookUploadData]
}>()

const activeTab = ref('search')

const fileInput = ref<HTMLInputElement | null>(null)
const isDragOver = ref(false)
const isUploading = ref(false)
const uploadProgress = ref(0)
const uploadError = ref<string | null>(null)

const searchInputRef = ref<HTMLInputElement | null>(null)
const searchQuery = ref('')
const isSearching = ref(false)
const hasSearched = ref(false)
const results = ref<BookSearchResult[]>([])
const searchError = ref<string | null>(null)

const downloadingBookId = ref<string | null>(null)
const downloadProgress = ref(0)
const downloadError = ref<string | null>(null)

const currentPage = ref(1)
const itemsPerPage = 4

const totalPages = computed(() => Math.ceil(results.value.length / itemsPerPage))

const paginatedResults = computed(() => {
  const start = (currentPage.value - 1) * itemsPerPage
  return results.value.slice(start, start + itemsPerPage)
})

const visiblePages = computed(() => {
  const pages: number[] = []
  const maxVisible = 5
  let start = Math.max(1, currentPage.value - Math.floor(maxVisible / 2))
  const end = Math.min(totalPages.value, start + maxVisible)
  if (end - start < maxVisible) {
    start = Math.max(1, end - maxVisible)
  }
  for (let i = start; i <= end; i++) {
    pages.push(i)
  }
  return pages
})

watch(() => props.visible, (isVisible) => {
  if (!isVisible) {
    searchQuery.value = ''
    hasSearched.value = false
    results.value = []
    searchError.value = null
    currentPage.value = 1

    downloadingBookId.value = null
    downloadProgress.value = 0
    downloadError.value = null

    isDragOver.value = false
    isUploading.value = false
    uploadProgress.value = 0
    uploadError.value = null
    activeTab.value = 'search'
  }
})

watch([() => props.visible, activeTab], ([isVisible, tab]) => {
  if (isVisible && tab === 'search') {
    nextTick(() => {
      searchInputRef.value?.focus()
    })
  }
})

function triggerFileInput() {
  if (isUploading.value) return
  fileInput.value?.click()
}

function handleFileSelect(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (file) processFile(file)
  ;(event.target as HTMLInputElement).value = ''
}

function handleDrop(event: DragEvent) {
  isDragOver.value = false
  if (isUploading.value) return
  const file = event.dataTransfer?.files?.[0]
  if (file) processFile(file)
}

async function processFile(file: File) {
  const isPdf = file.name.toLowerCase().endsWith('.pdf')
  if (!isPdf && !file.name.toLowerCase().endsWith('.epub')) {
    uploadError.value = 'Please select an EPUB or PDF file'
    return
  }

  isUploading.value = true
  uploadProgress.value = 0
  uploadError.value = null

  try {
    const arrayBuffer = await file.arrayBuffer()
    uploadProgress.value = 30

    let title = file.name.replace(/\.(epub|pdf)$/i, '')
    let author = ''
    let coverData: ArrayBuffer | null = null
    const fileType: 'epub' | 'pdf' = isPdf ? 'pdf' : 'epub'

    if (isPdf) {
      try {
        const info = await extractPdfInfo(arrayBuffer)
        title = info.title || title
        author = info.author
        coverData = info.coverData
      } catch (err) {
        console.warn('[BookUpload] Failed to extract PDF info:', err)
      }
    } else {
      try {
        const info = await extractEpubInfo(arrayBuffer)
        title = info.title || title
        author = info.author
        coverData = info.coverData
      } catch (err) {
        console.warn('[BookUpload] Failed to extract EPUB info:', err)
      }
    }

    uploadProgress.value = 100

    emit('upload', {
      title,
      author,
      coverData,
      fileData: arrayBuffer,
      fileSize: file.size,
      fileType,
    })

    setTimeout(() => {
      isUploading.value = false
      uploadProgress.value = 0
    }, 1000)
  } catch (err) {
    console.error('[BookUpload] Failed:', err)
    uploadError.value = (err as Error).message || 'Failed to process book'
    isUploading.value = false
    uploadProgress.value = 0
  }
}

async function handleSearch() {
  const query = searchQuery.value.trim()
  if (!query) return

  isSearching.value = true
  hasSearched.value = false
  searchError.value = null
  results.value = []
  currentPage.value = 1

  try {
    const searchResults = await searchBooks(query)
    results.value = searchResults
    hasSearched.value = true
  } catch (err) {
    console.error('[BookSearch] Error:', err)
    searchError.value = (err as Error).message || 'Failed to search for books'
    hasSearched.value = true
  } finally {
    isSearching.value = false
  }
}

function handleCoverError(event: Event) {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
  const placeholder = img.parentElement?.querySelector('.cover-placeholder') as HTMLElement | null
  if (placeholder) placeholder.style.display = 'flex'
}

async function handleDownload(book: BookSearchResult) {
  if (downloadingBookId.value) return

  downloadingBookId.value = book.id
  downloadProgress.value = 0
  downloadError.value = null

  try {
    const arrayBuffer = await fastDownloadBook(book.detailUrl, (progress: number) => {
      downloadProgress.value = progress
    })

    let coverData: ArrayBuffer | null = null
    if (book.coverUrl) {
      const proxiedUrl = getProxiedImageUrl(book.coverUrl)
      if (proxiedUrl) {
        try {
          const response = await fetch(proxiedUrl)
          if (response.ok) coverData = await response.arrayBuffer()
        } catch (err) {
          console.warn('[BookSearch] Failed to fetch cover:', err)
        }
      }
    }

    downloadProgress.value = 100

    emit('download', {
      title: book.title,
      author: book.author,
      coverData,
      fileData: arrayBuffer,
      fileSize: arrayBuffer.byteLength,
      fileType: 'epub',
    })

    setTimeout(() => {
      downloadingBookId.value = null
      downloadProgress.value = 0
    }, 1000)
  } catch (err) {
    console.error('[BookSearch] Download failed:', err)
    downloadError.value = (err as Error).message || 'Failed to download book'
    downloadingBookId.value = null
    downloadProgress.value = 0
  }
}

function onClose() {
  emit('close')
}
</script>

<style scoped>
.book-search-modal {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.tabs {
  display: flex;
  gap: 0;
}

.tab {
  padding: 0.5rem 1rem;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-muted, #999);
  transition: all 0.15s ease;
}

.tab:hover {
  color: var(--color-text-base, #333);
}

.tab.active {
  border-bottom-color: var(--color-primary, #6366f1);
  color: var(--color-primary, #6366f1);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  height: 500px;
}

.search-section {
  display: flex;
  gap: 0.5rem;
  flex-shrink: 0;
}

.search-input {
  flex: 1;
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border-input, #ddd);
  border-radius: 8px;
  font-size: 1rem;
  background: var(--color-bg-input, #fff);
  color: var(--color-text-base, #333);
  transition: all 0.15s ease;
}

.search-input:focus {
  outline: none;
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.search-input:disabled {
  background-color: var(--color-bg-hover, #f5f5f5);
  opacity: 0.6;
}

.scrollable-content {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  gap: 1rem;
}

.loading-state p {
  color: var(--color-text-muted, #999);
  font-size: 0.875rem;
}

.results-section .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem 1rem;
  text-align: center;
}

.results-section .empty-state p {
  margin: 0.5rem 0;
  color: var(--color-text-muted, #999);
}

.results-section .empty-hint {
  font-size: 0.875rem;
  opacity: 0.7;
}

.results-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.25rem 0;
  margin-top: 0.5rem;
  margin-bottom: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-muted, #999);
}

.results-count {
  font-weight: 500;
}

.page-info {
  color: var(--color-text-muted, #999);
}

.results-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.75rem;
}

.book-result-card {
  display: flex;
  flex-direction: column;
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 6px;
  overflow: hidden;
  background: var(--color-bg-base, #fff);
  transition: all 0.15s ease;
  cursor: pointer;
  position: relative;
}

.book-result-card:hover {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
  transform: translateY(-2px);
}

.book-result-card.downloading {
  border-color: var(--color-primary, #6366f1);
  box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.2));
}

.book-result-card .book-cover {
  width: 100%;
  aspect-ratio: 2/3;
  min-height: 140px;
  background: var(--color-bg-hover, #f5f5f5);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
}

.book-result-card .book-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-placeholder {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  font-size: 1.2rem;
  color: var(--color-text-muted, #999);
}

.book-result-card .book-info {
  padding: 0.2rem 0.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.book-result-card .book-title {
  margin: 0;
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--color-text-base, #333);
  overflow: hidden;
  text-overflow: ellipsis;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.3;
  max-height: 2.4em;
}

.book-result-card .book-author {
  margin: 0;
  font-size: 0.6rem;
  font-weight: 400;
  color: var(--color-text-muted, #999);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pagination-footer {
  flex-shrink: 0;
  padding-top: 0.25rem;
}

.pagination {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 0.35rem 0;
}

.pagination-btn {
  min-width: 70px;
  padding: 0.35rem 0.75rem;
}

.page-numbers {
  display: flex;
  gap: 0.25rem;
}

.page-number {
  min-width: 24px;
  height: 32px;
  padding: 0 0.25rem;
  border: none;
  background: transparent;
  color: var(--color-text-muted, #999);
  font-size: 0.875rem;
  cursor: pointer;
  transition: color 0.15s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.page-number:hover {
  color: var(--color-text-base, #333);
}

.page-number.active {
  color: var(--color-primary, #6366f1);
  font-weight: 500;
}

.download-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(2px);
}

.download-overlay .spinner {
  width: 32px;
  height: 32px;
  border: 3px solid rgba(255, 255, 255, 0.3);
  border-top-color: #fff;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

.download-overlay .progress-text {
  color: #fff;
  font-size: 0.875rem;
  font-weight: 500;
}

.error-message {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  background-color: #fee;
  border: 1px solid #fcc;
  border-radius: 6px;
  color: #c33;
  font-size: 0.875rem;
}

.error-dismiss {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  color: #c33;
  padding: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone {
  border: 2px dashed var(--color-border-base, #ddd);
  border-radius: 12px;
  padding: 3rem 2rem;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s ease;
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.drop-zone:hover {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-bg-hover, #f5f5f5);
}

.drop-zone.drag-over {
  border-color: var(--color-primary, #6366f1);
  background: var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
}

.drop-zone.uploading {
  cursor: default;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.drop-icon {
  font-size: 4rem;
  opacity: 0.5;
}

.drop-text {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-base, #333);
}

.drop-hint {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-muted, #999);
}

.drop-format {
  margin: 0.5rem 0 0;
  font-size: 0.8rem;
  color: var(--color-text-muted, #999);
}

.uploading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  width: 100%;
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 300px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: var(--color-bg-hover, #f0f0f0);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--color-primary, #6366f1);
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 0.875rem;
  color: var(--color-text-muted, #999);
  min-width: 3ch;
  text-align: right;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--color-bg-hover, #f0f0f0);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.footer-actions {
  display: flex;
  gap: 0.5rem;
  margin-left: auto;
}

@media (max-width: 600px) {
  .results-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 0.5rem;
  }

  .book-result-card .book-title {
    font-size: 0.65rem;
  }

  .book-result-card .book-author {
    font-size: 0.55rem;
  }

  .drop-zone {
    padding: 2rem 1rem;
    min-height: 200px;
  }

  .drop-icon {
    font-size: 3rem;
  }

  .drop-text {
    font-size: 1rem;
  }
}
</style>
