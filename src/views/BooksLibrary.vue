<template>
  <AppLayout storage-key="books-layout">
    <template #side><div class="side-playground-wrapper"><SideChatPlayground /></div></template>
    <div class="books-library">
      <div class="library-header">
        <button class="view-toggle mobile-only-btn" @click="toggleViewMode" :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'">
          <svg v-show="viewMode === 'grid'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-show="viewMode === 'list'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <h1>My Library</h1>
        <div class="header-actions desktop-only">
          <button class="view-toggle" @click="toggleViewMode" :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'">
            <svg v-show="viewMode === 'grid'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <svg v-show="viewMode === 'list'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <Button variant="primary" @click="triggerFilePicker" :disabled="uploading" class="add-book-btn">+ New Book</Button>
        </div>
        <Button variant="primary" @click="triggerFilePicker" :disabled="uploading" class="add-book-btn mobile-only-btn">+</Button>
        <input ref="fileInput" type="file" accept=".epub,.pdf" class="file-input" @change="handleFileSelect" />
      </div>

      <div class="search-container">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search books by title or author..." />
      </div>

      <SlideTransition appear direction="vertical">
        <transition name="view-mode" mode="out-in">
          <div :key="viewMode" :class="viewMode === 'list' ? 'books-list' : 'books-grid'">
            <div
              v-for="book in filteredBooks"
              :key="book.id"
              class="book-card"
              @click="openBook(book)"
            >
              <div class="book-cover">
                <img v-if="book.coverUrl" :src="book.coverUrl" :alt="book.title">
                <img v-else :src="getDefaultCover(book.title, book.author)" :alt="book.title" class="default-cover">
                <div v-if="booksStore.isBookUploading(book.id)" class="upload-overlay">
                  <ProgressBar :progress="Math.round(booksStore.getUploadProgress(book.id) * 100)" />
                </div>
                <div v-else-if="booksStore.isBookDownloading(book.id)" class="upload-overlay">
                  <ProgressBar :progress="Math.round(booksStore.getDownloadProgress(book.id) * 100)" />
                </div>
              </div>
              <div class="book-info">
                <h3 class="book-title">{{ book.title }}</h3>
                <p class="book-author">{{ book.author }}</p>
                <div class="book-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: ((book.readingProgress || 0)) + '%' }"></div>
                  </div>
                  <span class="progress-text">{{ Math.round(book.readingProgress || 0) }}%</span>
                </div>
              </div>
              <div class="book-actions">
                <button class="action-btn menu-btn" @click.stop="openEditMenu(book.id)" title="Edit book">
                  <span></span><span></span><span></span>
                </button>
              </div>
            </div>

            <div v-if="filteredBooks.length === 0 && !uploading" class="empty-state">
              <div class="empty-icon">{{ searchQuery.trim() ? '🔍' : '📚' }}</div>
              <p>{{ searchQuery.trim() ? 'No books found matching "' + searchQuery + '"' : 'No books yet' }}</p>
              <p v-if="!searchQuery.trim()" class="empty-hint">Add your first book (EPUB or PDF) to get started</p>
            </div>
          </div>
        </transition>
      </SlideTransition>

      <!-- Edit context menu -->
      <div v-if="editMenuBookId" class="context-menu-overlay" @click="closeEditMenu">
        <div class="context-menu" :style="editMenuStyle" @click.stop>
          <button class="context-menu-item" @click="startEdit">Edit Title/Author</button>
          <button class="context-menu-item danger" @click="confirmDelete">Delete Book</button>
        </div>
      </div>

      <!-- Inline edit modal -->
      <div v-if="isEditing" class="modal-overlay" @click.self="cancelEdit">
        <div class="modal-dialog">
          <h3>Edit Book</h3>
          <label class="edit-label">Title</label>
          <input ref="editTitleInput" v-model="editTitle" class="edit-input" @keydown.enter="saveEdit" />
          <label class="edit-label">Author</label>
          <input v-model="editAuthor" class="edit-input" @keydown.enter="saveEdit" @keydown.escape="cancelEdit" />
          <div class="modal-actions">
            <button class="modal-btn" @click="cancelEdit">Cancel</button>
            <button class="modal-btn primary" @click="saveEdit">Save</button>
          </div>
        </div>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import Button from '@/components/Button.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import { useBooksStore } from '@/stores/books'
import { extractEpubInfo } from '@/services/epubRenderer'
import { extractPdfInfo } from '@/services/pdfRenderer'
import type { BookData } from '@/types/book'

const router = useRouter()
const booksStore = useBooksStore()

const searchQuery = ref('')
const viewMode = ref<'grid' | 'list'>((localStorage.getItem('books-view-mode') as 'grid' | 'list') || 'grid')
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

// Edit state
const editMenuBookId = ref<string | null>(null)
const editMenuStyle = ref({})
const isEditing = ref(false)
const editBookId = ref<string | null>(null)
const editTitle = ref('')
const editAuthor = ref('')
const editTitleInput = ref<HTMLInputElement | null>(null)

const filteredBooks = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let books = [...booksStore.books]
  if (query) {
    const words = query.split(/\s+/).filter(Boolean)
    books = books.filter(b => {
      const text = `${b.title} ${b.author}`.toLowerCase()
      return words.every(w => text.includes(w))
    })
  }
  return books.sort((a, b) => (a.title || '').localeCompare(b.title || ''))
})

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  localStorage.setItem('books-view-mode', viewMode.value)
}

// Default cover generator
const defaultCoverCache = new Map<string, string>()
function getDefaultCover(title: string, author: string): string {
  const key = `${title}|${author}`
  if (!defaultCoverCache.has(key)) {
    defaultCoverCache.set(key, generateDefaultCover(title, author))
  }
  return defaultCoverCache.get(key)!
}

function generateDefaultCover(title: string, _author: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 300
  const ctx = canvas.getContext('2d')!

  // Generate color from title
  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360
  const s = 40 + (Math.abs(hash >> 8) % 20)
  const l = 35 + (Math.abs(hash >> 16) % 15)

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 200, 300)
  grad.addColorStop(0, `hsl(${h}, ${s}%, ${l}%)`)
  grad.addColorStop(1, `hsl(${(h + 30) % 360}, ${s}%, ${l - 10}%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 200, 300)

  // Title text
  ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
  ctx.font = 'bold 20px Georgia, serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const words = (title || 'Untitled').split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 12) {
      lines.push(line.trim())
      line = word
    } else {
      line += ' ' + word
    }
  }
  if (line.trim()) lines.push(line.trim())
  const startY = 150 - (lines.length - 1) * 15
  lines.forEach((l, i) => ctx.fillText(l, 100, startY + i * 30))

  return canvas.toDataURL()
}

const openBook = async (book: BookData) => {
  // Mark as current book for nav
  booksStore.setCurrentBook(book.id)

  const navigate = () => {
    router.push({ name: 'current-content', params: { type: 'book', id: book.id } })
  }

  // Check if book file is already cached locally
  try {
    const { BookStorage } = await import('@/services/BookStorage')
    const cached = await BookStorage.getBookFile(book.id).catch(() => null)
    if (cached || booksStore.getPreloadedBook(book.id)) {
      navigate()
      return
    }
  } catch {}

  // Not cached — download from cloud first
  booksStore.$patch({ downloadingIds: new Set([book.id]), downloadProgress: { [book.id]: 0 } })
  try {
    const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
    const fileData = await downloadBookFileFromStorage(book.id, (p) => {
      booksStore.$patch({ downloadProgress: { [book.id]: p } })
    })
    if (fileData) {
      const { BookStorage } = await import('@/services/BookStorage')
      await BookStorage.saveBookFile(book.id, fileData)
      navigate()
    } else {
      console.warn('[BooksLibrary] Book file not available in cloud')
    }
  } catch (err) {
    console.error('[BooksLibrary] Failed to download book:', err)
  } finally {
    setTimeout(() => {
      booksStore.$patch({
        downloadingIds: new Set(),
        downloadProgress: { [book.id]: 0 },
      })
    }, 500)
  }
}

function triggerFilePicker() {
  fileInput.value?.click()
}

async function handleFileSelect(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  input.value = ''

  uploading.value = true
  try {
    const arrayBuffer = await file.arrayBuffer()
    const isPdf = file.name.toLowerCase().endsWith('.pdf')
    const fallbackTitle = file.name.replace(/\.(epub|pdf)$/i, '')
    let title = fallbackTitle
    let author = ''
    let coverData: ArrayBuffer | null = null
    let totalPages: number | undefined

    if (isPdf) {
      try {
        const info = await extractPdfInfo(arrayBuffer)
        title = info.title || fallbackTitle
        author = info.author
        coverData = info.coverData
        totalPages = info.totalPages
      } catch (err) {
        console.warn('[BooksLibrary] Failed to extract PDF info:', err)
      }

      await booksStore.addBook({
        title, author, fileSize: file.size,
        fileData: arrayBuffer, coverData,
        fileType: 'pdf', totalPages,
      })
    } else {
      try {
        const info = await extractEpubInfo(arrayBuffer)
        title = info.title || fallbackTitle
        author = info.author
        coverData = info.coverData
      } catch (err) {
        console.warn('[BooksLibrary] Failed to extract EPUB info:', err)
      }

      await booksStore.addBook({
        title, author, fileSize: file.size,
        fileData: arrayBuffer, coverData,
        fileType: 'epub',
      })
    }
  } catch (err) {
    console.error('[BooksLibrary] Failed to add book:', err)
    alert('Failed to add book: ' + (err as Error).message)
  } finally {
    uploading.value = false
  }
}

// Edit menu
function openEditMenu(bookId: string) {
  const book = booksStore.getBookById(bookId)
  if (!book) return
  editMenuBookId.value = bookId
  editMenuStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
}

function closeEditMenu() {
  editMenuBookId.value = null
}

function startEdit() {
  const bookId = editMenuBookId.value
  if (!bookId) return
  const book = booksStore.getBookById(bookId)
  if (!book) return

  editBookId.value = bookId
  editTitle.value = book.title || ''
  editAuthor.value = book.author || ''
  isEditing.value = true
  closeEditMenu()

  setTimeout(() => editTitleInput.value?.focus(), 50)
}

async function saveEdit() {
  if (!editBookId.value) return
  const title = editTitle.value.trim()
  const author = editAuthor.value.trim()
  if (title) {
    await booksStore.updateBook(editBookId.value, { title, author })
  }
  cancelEdit()
}

function cancelEdit() {
  isEditing.value = false
  editBookId.value = null
}

async function confirmDelete() {
  const bookId = editMenuBookId.value
  closeEditMenu()
  if (!bookId) return
  const book = booksStore.getBookById(bookId)
  if (confirm(`Delete "${book?.title || 'this book'}"?`)) {
    await booksStore.deleteBook(bookId)
  }
}

onMounted(() => {
  if (!booksStore.isInitialized) booksStore.initializeStore()
})
</script>

<style scoped>
.side-playground-wrapper { height: 100%; }
.books-library { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); }

.library-header {
  display: flex; justify-content: space-between; align-items: center;
  max-width: 1200px; margin: 0 auto 2rem; padding: 2rem 2rem 0; padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-base);
}
.library-header h1 { margin: 0; font-family: Georgia, 'Palatino Linotype', serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); }

.header-actions { display: flex; align-items: center; gap: 0.75rem; }
.view-toggle {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px; background: transparent;
  border: 1px solid var(--color-border-base); border-radius: 6px;
  color: var(--color-text-muted); cursor: pointer; transition: all 0.2s;
}
.view-toggle:hover { background-color: var(--color-bg-page); border-color: var(--color-border-accent); color: var(--color-text-message); }
.view-icon { width: 18px; height: 18px; }
.file-input { display: none; }

.search-container { max-width: 1200px; margin: 0 auto 1.5rem; padding: 0 2rem; }
.search-input {
  width: 100%; padding: 0.75rem 1rem; font-size: 1rem;
  background-color: var(--color-bg-page); border: 1px solid var(--color-border-base);
  border-radius: 8px; color: var(--color-text-message); transition: border-color 0.2s, box-shadow 0.2s;
}
.search-input:focus { outline: none; border-color: var(--color-border-accent); box-shadow: 0 0 0 3px var(--shadow-primary); }
.search-input::placeholder { color: var(--color-text-muted); }

/* Grid view */
.books-grid {
  display: grid; grid-template-columns: repeat(6, 1fr);
  gap: 1.5rem; max-width: 1200px; margin: 0 auto; padding: 0 2rem 2rem; overflow-y: auto;
}

/* List view */
.books-list {
  display: grid; grid-template-columns: repeat(2, 1fr);
  gap: 1rem; max-width: 1200px; margin: 0 auto; padding: 0 2rem 2rem;
}
.books-list .book-card { flex-direction: row; align-items: center; padding: 0; min-height: auto; border: none; border-radius: 0; background: transparent; }
.books-list .book-cover { width: 80px; height: 120px; flex-shrink: 0; }
.books-list .book-title { font-size: 1rem; }
.books-list .book-card:hover { transform: none; }

/* Book card */
.book-card {
  position: relative; display: flex; flex-direction: column;
  background: var(--color-bg-base); border: 1px solid var(--color-border-base);
  border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s;
}

.book-cover {
  width: 100%; aspect-ratio: 2/3; background: var(--color-bg-hover);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
}
.book-cover img { width: 100%; height: 100%; object-fit: cover; }

.book-info { padding: 1rem; flex: 1; display: flex; flex-direction: column; }
.book-title {
  margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--color-text-base);
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.book-author { margin: 0 0 0.75rem; font-size: 0.875rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.book-progress { display: flex; align-items: center; gap: 0.5rem; margin-top: auto; }
.progress-bar { flex: 1; height: 4px; background: var(--color-bg-hover); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); transition: width 0.3s ease; }
.progress-text { font-size: 0.75rem; color: var(--color-text-muted); min-width: 3ch; text-align: right; }

/* Upload progress */
.upload-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.8);
}

/* Action button (3-dot menu) */
.book-actions { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem; }
.action-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; background: rgba(0, 0, 0, 0.6);
  border: none; border-radius: 6px; cursor: pointer; opacity: 0; transition: all 0.2s; color: white;
}
.book-card:hover .action-btn { opacity: 1; }
.action-btn:hover { background: rgba(0, 0, 0, 0.8); }
.menu-btn span { width: 3px; height: 3px; background: white; border-radius: 50%; margin: 1px 0; }

/* Context menu */
.context-menu-overlay { position: fixed; inset: 0; z-index: 100; }
.context-menu {
  position: absolute; background: var(--color-bg-elevated); border: 1px solid var(--color-border-base);
  border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); min-width: 160px; overflow: hidden;
}
.context-menu-item {
  display: block; width: 100%; padding: 0.6rem 1rem; background: none; border: none;
  color: var(--color-text-base); font-size: 0.9rem; text-align: left; cursor: pointer;
  font-family: system-ui, -apple-system, sans-serif;
}
.context-menu-item:hover { background: var(--color-bg-hover); }
.context-menu-item.danger { color: var(--color-error-text); }

/* Edit modal */
.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-dialog { background: var(--color-bg-base); padding: 1.5rem; border-radius: 12px; max-width: 400px; width: 90%; }
.modal-dialog h3 { font-family: Georgia, serif; color: var(--color-text-message); margin: 0 0 1rem; font-weight: 400; }
.edit-label { display: block; font-size: 0.85rem; color: var(--color-text-muted); margin: 0.75rem 0 0.25rem; }
.edit-input {
  width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base);
  border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.95rem;
}
.edit-input:focus { outline: none; border-color: var(--color-border-accent); }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }
.modal-btn {
  padding: 0.4rem 1rem; border: 1px solid var(--color-border-base); border-radius: 4px;
  background: var(--color-bg-elevated); color: var(--color-text-base); cursor: pointer;
  font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif;
}
.modal-btn:hover { background: var(--color-bg-hover); }
.modal-btn.primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.modal-btn.primary:hover { background: var(--color-primary-hover); }

/* Empty state */
.empty-state {
  grid-column: 1 / -1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center;
}
.empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { margin: 0.5rem 0; color: var(--color-text-muted); }
.empty-hint { font-size: 0.875rem; opacity: 0.7; }

/* View mode transition */
.view-mode-enter-active, .view-mode-leave-active { transition: all 0.1s ease; }
.view-mode-enter-from { opacity: 0; transform: scale(0.95); }
.view-mode-leave-to { opacity: 0; transform: scale(1.05); }
.view-mode-enter-to, .view-mode-leave-from { opacity: 1; transform: scale(1); }

/* Responsive */
@media (min-width: 769px) {
  .mobile-only-btn { display: none !important; }
}
@media (max-width: 768px) {
  .mobile-only-btn { display: flex !important; }
  .desktop-only { display: none !important; }
  .library-header { flex-direction: row; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 1rem; padding: 0.75rem 1rem; }
  .library-header h1 { font-size: 1.25rem; flex: 1; text-align: center; }
  .add-book-btn.mobile-only-btn { min-width: 36px; width: 36px; height: 36px; padding: 0; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; }
  .search-container { padding: 0 1rem; margin-bottom: 1rem; }
  .books-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); gap: 1.25rem; padding: 0 1rem 1rem; }
  .books-list { grid-template-columns: 1fr; padding: 0 1rem 1rem; }
}
</style>
