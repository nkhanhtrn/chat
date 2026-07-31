<template>
  <AppLayout storage-key="sidebar">
    <div class="papers-library">
      <div class="library-header">
        <button class="view-toggle mobile-only-btn" @click="toggleViewMode" :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'">
          <svg v-show="viewMode === 'grid'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
          </svg>
          <svg v-show="viewMode === 'list'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
          </svg>
        </button>
        <h1>Research Papers</h1>
        <div class="header-actions desktop-only">
          <button class="view-toggle" @click="toggleViewMode" :title="viewMode === 'grid' ? 'Switch to list view' : 'Switch to grid view'">
            <svg v-show="viewMode === 'grid'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
            <svg v-show="viewMode === 'list'" class="view-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <Button variant="primary" @click="showAddModal = true" :disabled="uploading" class="add-paper-btn">+ New Paper</Button>
        </div>
        <Button variant="primary" @click="showAddModal = true" :disabled="uploading" class="add-paper-btn mobile-only-btn">+</Button>
      </div>

      <div class="search-container">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search papers by title, author, DOI, keywords..." />
        <div v-if="allKeywords.length > 0" class="keyword-filter">
          <button
            class="keyword-filter-btn"
            :class="{ active: !keywordFilter }"
            @click="keywordFilter = null"
          >All</button>
          <button
            v-for="kw in allKeywords"
            :key="kw"
            class="keyword-filter-btn"
            :class="{ active: keywordFilter === kw }"
            @click="keywordFilter = keywordFilter === kw ? null : kw"
          >{{ kw }}</button>
        </div>
      </div>

      <SlideTransition appear direction="vertical">
        <transition name="view-mode" mode="out-in">
          <div :key="viewMode" :class="viewMode === 'list' ? 'papers-list' : 'papers-grid'">
            <div
              v-for="paper in filteredPapers"
              :key="paper.id"
              class="paper-card"
              @click="openPaper(paper)"
            >
              <div class="paper-cover">
                <img v-if="paper.coverUrl" :src="paper.coverUrl" :alt="paper.title">
                <img v-else :src="getPaperCover(paper.title)" :alt="paper.title" class="default-cover">
                <span class="format-badge pdf">PDF</span>
                <div v-if="booksStore.isBookUploading(paper.id)" class="upload-overlay">
                  <ProgressBar :progress="Math.round(booksStore.getUploadProgress(paper.id) * 100)" />
                </div>
                <div v-else-if="booksStore.isBookDownloading(paper.id)" class="upload-overlay">
                  <ProgressBar :progress="Math.round(booksStore.getDownloadProgress(paper.id) * 100)" />
                </div>
              </div>
              <div class="paper-info">
                <h3 class="paper-title">{{ paper.title }}</h3>
                <p class="paper-author">{{ paper.author }}</p>
                <p v-if="paper.meta?.journal" class="paper-journal">{{ paper.meta.journal }}<span v-if="paper.meta.year"> ({{ paper.meta.year }})</span></p>
                <div v-if="paper.meta?.keywords?.length" class="paper-keywords">
                  <span v-for="kw in paper.meta.keywords.slice(0, 3)" :key="kw" class="paper-keyword">{{ kw }}</span>
                  <span v-if="paper.meta.keywords.length > 3" class="paper-keyword-more">+{{ paper.meta.keywords.length - 3 }}</span>
                </div>
                <div class="paper-progress">
                  <div class="progress-bar">
                    <div class="progress-fill" :style="{ width: ((paper.readingProgress || 0)) + '%' }"></div>
                  </div>
                  <span class="progress-text">{{ Math.round(paper.readingProgress || 0) }}%</span>
                </div>
              </div>
              <div class="paper-actions">
                <button class="action-btn menu-btn" @click.stop="openEditMenu(paper.id)" title="Edit paper">
                  <span></span><span></span><span></span>
                </button>
              </div>
            </div>

            <div v-if="filteredPapers.length === 0 && !uploading" class="empty-state">
              <div class="empty-icon">{{ searchQuery.trim() || keywordFilter ? '🔍' : '📄' }}</div>
              <p>{{ searchQuery.trim() || keywordFilter ? 'No papers found' : 'No papers yet' }}</p>
              <p v-if="!searchQuery.trim() && !keywordFilter" class="empty-hint">Add your first research paper to get started</p>
            </div>
          </div>
        </transition>
      </SlideTransition>

      <div v-if="editMenuPaperId" class="context-menu-overlay" @click="closeEditMenu">
        <div class="context-menu" :style="editMenuStyle" @click.stop>
          <button class="context-menu-item" @click="startEdit">Edit Metadata</button>
          <button class="context-menu-item danger" @click="confirmDelete">Delete Paper</button>
        </div>
      </div>

      <PaperUploadModal
        :visible="showAddModal"
        @close="showAddModal = false"
        @upload="handleUpload"
      />

      <div v-if="isEditing" class="modal-overlay" @click.self="cancelEdit">
        <div class="modal-dialog">
          <h3>Edit Paper</h3>
          <label class="edit-label">Title</label>
          <input ref="editTitleInput" v-model="editTitle" class="edit-input" @keydown.enter="saveEdit" />
          <label class="edit-label">Authors</label>
          <input v-model="editAuthor" class="edit-input" @keydown.enter="saveEdit" @keydown.escape="cancelEdit" />
          <label class="edit-label">Journal / Conference</label>
          <input v-model="editJournal" class="edit-input" @keydown.enter="saveEdit" />
          <label class="edit-label">Year</label>
          <input v-model.number="editYear" type="number" class="edit-input" @keydown.enter="saveEdit" />
          <label class="edit-label">DOI</label>
          <input v-model="editDoi" class="edit-input" @keydown.enter="saveEdit" />
          <label class="edit-label">Abstract</label>
          <textarea v-model="editAbstract" class="edit-textarea" rows="3"></textarea>
          <label class="edit-label">Keywords (comma-separated)</label>
          <input v-model="editKeywords" class="edit-input" placeholder="keyword1, keyword2" />
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
import Button from '@/components/Button.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import { useBooksStore } from '@/stores/books'
import PaperUploadModal from '@/components/modal/PaperUploadModal.vue'
import type { PaperUploadData } from '@/components/modal/PaperUploadModal.vue'
import type { BookData } from '@/types/book'

const router = useRouter()
const booksStore = useBooksStore()

const searchQuery = ref('')
const keywordFilter = ref<string | null>(null)
const viewMode = ref<'grid' | 'list'>((localStorage.getItem('papers-view-mode') as 'grid' | 'list') || 'list')
const uploading = ref(false)
const showAddModal = ref(false)

const editMenuPaperId = ref<string | null>(null)
const editMenuStyle = ref({})
const isEditing = ref(false)
const editPaperId = ref<string | null>(null)
const editTitle = ref('')
const editAuthor = ref('')
const editJournal = ref('')
const editYear = ref<number | null>(null)
const editDoi = ref('')
const editAbstract = ref('')
const editKeywords = ref('')
const editTitleInput = ref<HTMLInputElement | null>(null)

const allKeywords = computed(() => {
  const kw = new Set<string>()
  for (const p of booksStore.papers) {
    if (p.meta?.keywords) {
      for (const k of p.meta.keywords) {
        if (k) kw.add(k)
      }
    }
  }
  return [...kw].sort()
})

const filteredPapers = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  let papers = [...booksStore.papersSortedByDate]

  if (keywordFilter.value) {
    papers = papers.filter(p => p.meta?.keywords?.includes(keywordFilter.value!))
  }

  if (query) {
    const words = query.split(/\s+/).filter(Boolean)
    papers = papers.filter(p => {
      const text = `${p.title} ${p.author} ${p.meta?.doi ?? ''} ${(p.meta?.keywords ?? []).join(' ')} ${p.meta?.journal ?? ''} ${p.meta?.abstract ?? ''}`.toLowerCase()
      return words.every(w => text.includes(w))
    })
  }
  return papers
})

const toggleViewMode = () => {
  viewMode.value = viewMode.value === 'grid' ? 'list' : 'grid'
  localStorage.setItem('papers-view-mode', viewMode.value)
}

const paperCoverCache = new Map<string, string>()
function getPaperCover(title: string): string {
  if (!paperCoverCache.has(title)) {
    paperCoverCache.set(title, generatePaperCover(title))
  }
  return paperCoverCache.get(title)!
}

function generatePaperCover(title: string): string {
  const canvas = document.createElement('canvas')
  canvas.width = 200
  canvas.height = 280
  const ctx = canvas.getContext('2d')!

  let hash = 0
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash)
  }
  const h = Math.abs(hash) % 360

  const grad = ctx.createLinearGradient(0, 0, 200, 280)
  grad.addColorStop(0, `hsl(${h}, 30%, 20%)`)
  grad.addColorStop(1, `hsl(${(h + 40) % 360}, 25%, 12%)`)
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, 200, 280)

  ctx.strokeStyle = `hsla(${h}, 40%, 60%, 0.3)`
  ctx.lineWidth = 1
  for (let y = 30; y < 250; y += 12) {
    ctx.beginPath()
    ctx.moveTo(20, y)
    ctx.lineTo(180, y)
    ctx.stroke()
  }

  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
  ctx.font = 'bold 13px system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const words = (title || 'Untitled').split(' ')
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 16) {
      lines.push(line.trim())
      line = word
    } else {
      line += ' ' + word
    }
  }
  if (line.trim()) lines.push(line.trim())
  const startY = 120 - (lines.length - 1) * 10
  lines.forEach((l, i) => ctx.fillText(l, 100, startY + i * 20))

  return canvas.toDataURL()
}

const openPaper = async (paper: BookData) => {
  booksStore.setCurrentBook(paper.id)

  const navigate = () => {
    router.push({ name: 'book-viewer', params: { bookId: paper.id } })
  }

  try {
    const { BookStorage } = await import('@/services/BookStorage')
    const cached = await BookStorage.getBookFile(paper.id).catch(() => null)
    if (cached || booksStore.getPreloadedBook(paper.id)) {
      navigate()
      return
    }
  } catch {}

  booksStore.$patch({ downloadingIds: new Set([paper.id]), downloadProgress: { [paper.id]: 0 } })
  try {
    const { downloadBookFileFromStorage } = await import('@/services/firestore/firestore-books')
    const fileData = await downloadBookFileFromStorage(paper.id, (p) => {
      booksStore.$patch({ downloadProgress: { [paper.id]: p } })
    })
    if (fileData) {
      const { BookStorage } = await import('@/services/BookStorage')
      await BookStorage.saveBookFile(paper.id, fileData)
      navigate()
    }
  } catch (err) {
    console.error('[PapersLibrary] Failed to download paper:', err)
  } finally {
    setTimeout(() => {
      booksStore.$patch({
        downloadingIds: new Set(),
        downloadProgress: { [paper.id]: 0 },
      })
    }, 500)
  }
}

async function handleUpload(data: PaperUploadData) {
  uploading.value = true
  try {
    await booksStore.addBook({
      title: data.title,
      author: data.author,
      fileSize: data.fileSize,
      fileData: data.fileData,
      coverData: data.coverData,
      fileType: data.fileType,
      category: 'paper',
      meta: data.meta ?? data.paperMeta,
    })
    showAddModal.value = false
  } catch (err) {
    console.error('[PapersLibrary] Failed to add paper:', err)
    alert('Failed to add paper: ' + (err as Error).message)
  } finally {
    uploading.value = false
  }
}

function openEditMenu(paperId: string) {
  editMenuPaperId.value = paperId
  editMenuStyle.value = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
}

function closeEditMenu() {
  editMenuPaperId.value = null
}

function startEdit() {
  const paperId = editMenuPaperId.value
  if (!paperId) return
  const paper = booksStore.getBookById(paperId)
  if (!paper) return

  editPaperId.value = paperId
  editTitle.value = paper.title || ''
  editAuthor.value = paper.author || ''
  editJournal.value = paper.meta?.journal ?? ''
  editYear.value = paper.meta?.year ?? null
  editDoi.value = paper.meta?.doi ?? ''
  editAbstract.value = paper.meta?.abstract ?? ''
  editKeywords.value = (paper.meta?.keywords ?? []).join(', ')
  isEditing.value = true
  closeEditMenu()

  setTimeout(() => editTitleInput.value?.focus(), 50)
}

async function saveEdit() {
  if (!editPaperId.value) return
  const title = editTitle.value.trim()
  if (!title) return

  const keywords = editKeywords.value.split(',').map(k => k.trim()).filter(Boolean)

  await booksStore.updateBook(editPaperId.value, {
    title,
    author: editAuthor.value.trim(),
    meta: {
      doi: editDoi.value.trim() || null,
      journal: editJournal.value.trim() || null,
      year: editYear.value,
      abstract: editAbstract.value.trim() || null,
      keywords,
      bibtex: null,
      citationCount: null,
      language: null,
    },
  })
  cancelEdit()
}

function cancelEdit() {
  isEditing.value = false
  editPaperId.value = null
}

async function confirmDelete() {
  const paperId = editMenuPaperId.value
  closeEditMenu()
  if (!paperId) return
  const paper = booksStore.getBookById(paperId)
  if (confirm(`Delete "${paper?.title || 'this paper'}"?`)) {
    await booksStore.deleteBook(paperId)
  }
}

onMounted(() => {
  if (!booksStore.isInitialized) booksStore.initializeStore()
})
</script>

<style scoped>
.papers-library { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); }

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

.search-container { max-width: 1200px; margin: 0 auto 1rem; padding: 0 2rem; display: flex; flex-direction: column; gap: 0.5rem; }
.search-input {
  width: 100%; padding: 0.75rem 1rem; font-size: 1rem;
  background-color: var(--color-bg-page); border: 1px solid var(--color-border-base);
  border-radius: 8px; color: var(--color-text-message); transition: border-color 0.2s, box-shadow 0.2s;
  box-sizing: border-box;
}
.search-input:focus { outline: none; border-color: var(--color-border-accent); box-shadow: 0 0 0 3px var(--shadow-primary); }
.search-input::placeholder { color: var(--color-text-muted); }

.keyword-filter {
  display: flex; gap: 0.25rem; flex-wrap: wrap;
}
.keyword-filter-btn {
  padding: 0.2rem 0.6rem; border: 1px solid var(--color-border-base); border-radius: 4px;
  background: transparent; color: var(--color-text-muted); font-size: 0.75rem; font-weight: 500;
  cursor: pointer; transition: all 0.15s ease; font-family: system-ui, -apple-system, sans-serif;
}
.keyword-filter-btn:hover { border-color: var(--color-border-accent); color: var(--color-text-base); }
.keyword-filter-btn.active { border-color: #0ea5e9; color: #0ea5e9; background: rgba(14, 165, 233, 0.1); }

.papers-grid {
  display: grid; grid-template-columns: repeat(5, 1fr);
  gap: 1.5rem; max-width: 1200px; margin: 0 auto; padding: 0 2rem 2rem;
}

.papers-list {
  display: flex; flex-direction: column; gap: 0.75rem;
  max-width: 1200px; margin: 0 auto; padding: 0 2rem 2rem;
}

.paper-card {
  position: relative; display: flex; flex-direction: column;
  background: var(--color-bg-base); border: 1px solid var(--color-border-base);
  border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s;
}
.paper-card:hover { border-color: var(--color-border-accent); transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.08); }

.papers-list .paper-card {
  flex-direction: row; align-items: stretch; min-height: auto;
}
.papers-list .paper-cover { width: 100px; min-height: 140px; flex-shrink: 0; }
.papers-list .paper-info { flex: 1; padding: 0.75rem 1rem; }
.papers-list .paper-title { font-size: 0.95rem; }
.papers-list .paper-card:hover { transform: none; }

.paper-cover {
  width: 100%; aspect-ratio: 3/4; background: var(--color-bg-hover);
  display: flex; align-items: center; justify-content: center; overflow: hidden;
  position: relative;
}
.paper-cover img { width: 100%; height: 100%; object-fit: cover; }

.format-badge {
  position: absolute; top: 0.35rem; left: 0.35rem;
  padding: 0.1rem 0.4rem; font-size: 0.6rem; font-weight: 700;
  letter-spacing: 0.03em; border-radius: 3px; color: #fff;
  z-index: 2; text-transform: uppercase; line-height: 1.4;
}
.format-badge.pdf { background: #ef4444; }

.paper-info { padding: 0.75rem 1rem; flex: 1; display: flex; flex-direction: column; }
.paper-title {
  margin: 0 0 0.25rem; font-size: 0.9rem; font-weight: 600; color: var(--color-text-base);
  overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  line-height: 1.3;
}
.paper-author { margin: 0 0 0.35rem; font-size: 0.8rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.paper-journal { margin: 0 0 0.35rem; font-size: 0.75rem; color: #0ea5e9; font-style: italic; }

.paper-keywords {
  display: flex; flex-wrap: wrap; gap: 0.2rem; margin-bottom: 0.5rem;
}
.paper-keyword {
  padding: 0.1rem 0.4rem; font-size: 0.65rem; background: var(--color-primary-subtle, rgba(99, 102, 241, 0.1));
  color: var(--color-primary, #6366f1); border-radius: 3px; font-weight: 500;
}
.paper-keyword-more { font-size: 0.65rem; color: var(--color-text-muted); }

.paper-progress { display: flex; align-items: center; gap: 0.5rem; margin-top: auto; }
.progress-bar { flex: 1; height: 4px; background: var(--color-bg-hover); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--color-primary); transition: width 0.3s ease; }
.progress-text { font-size: 0.75rem; color: var(--color-text-muted); min-width: 3ch; text-align: right; }

.upload-overlay {
  position: absolute; inset: 0;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0, 0, 0, 0.8);
}

.paper-actions { position: absolute; top: 0.5rem; right: 0.5rem; display: flex; gap: 0.25rem; }
.action-btn {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  width: 28px; height: 28px; padding: 0; background: rgba(0, 0, 0, 0.6);
  border: none; border-radius: 6px; cursor: pointer; opacity: 0; transition: all 0.2s; color: white;
}
.paper-card:hover .action-btn { opacity: 1; }
.action-btn:hover { background: rgba(0, 0, 0, 0.8); }
.menu-btn span { width: 3px; height: 3px; background: white; border-radius: 50%; margin: 1px 0; }

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

.modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
.modal-dialog { background: var(--color-bg-base); padding: 1.5rem; border-radius: 12px; max-width: 480px; width: 90%; max-height: 80vh; overflow-y: auto; }
.modal-dialog h3 { font-family: Georgia, serif; color: var(--color-text-message); margin: 0 0 1rem; font-weight: 400; }
.edit-label { display: block; font-size: 0.85rem; color: var(--color-text-muted); margin: 0.75rem 0 0.25rem; }
.edit-input {
  width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base);
  border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.95rem;
  box-sizing: border-box;
}
.edit-textarea {
  width: 100%; padding: 0.5rem 0.75rem; border: 1px solid var(--color-border-base);
  border-radius: 4px; background: var(--color-bg-elevated); color: var(--color-text-base); font-size: 0.9rem;
  resize: vertical; box-sizing: border-box; font-family: inherit;
}
.edit-input:focus, .edit-textarea:focus { outline: none; border-color: var(--color-border-accent); }
.modal-actions { display: flex; justify-content: flex-end; gap: 0.5rem; margin-top: 1.25rem; }
.modal-btn {
  padding: 0.4rem 1rem; border: 1px solid var(--color-border-base); border-radius: 4px;
  background: var(--color-bg-elevated); color: var(--color-text-base); cursor: pointer;
  font-size: 0.9rem; font-family: system-ui, -apple-system, sans-serif;
}
.modal-btn:hover { background: var(--color-bg-hover); }
.modal-btn.primary { background: var(--color-primary); color: white; border-color: var(--color-primary); }
.modal-btn.primary:hover { background: var(--color-primary-hover); }

.empty-state {
  grid-column: 1 / -1; display: flex; flex-direction: column;
  align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center;
}
.empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { margin: 0.5rem 0; color: var(--color-text-muted); }
.empty-hint { font-size: 0.875rem; opacity: 0.7; }

.view-mode-enter-active, .view-mode-leave-active { transition: all 0.1s ease; }
.view-mode-enter-from { opacity: 0; transform: scale(0.95); }
.view-mode-leave-to { opacity: 0; transform: scale(1.05); }
.view-mode-enter-to, .view-mode-leave-from { opacity: 1; transform: scale(1); }

@media (min-width: 769px) {
  .mobile-only-btn { display: none !important; }
}
@media (max-width: 768px) {
  .mobile-only-btn { display: flex !important; }
  .desktop-only { display: none !important; }
  .library-header { flex-direction: row; align-items: center; justify-content: space-between; gap: 0.5rem; margin-bottom: 1rem; padding: 0.75rem 1rem; }
  .library-header h1 { font-size: 1.25rem; flex: 1; text-align: center; }
  .add-paper-btn.mobile-only-btn { min-width: 36px; width: 36px; height: 36px; padding: 0; font-size: 1.25rem; display: flex; align-items: center; justify-content: center; }
  .search-container { padding: 0 1rem; margin-bottom: 1rem; }
  .papers-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 1rem; padding: 0 1rem 1rem; }
  .papers-list { padding: 0 1rem 1rem; }
  .papers-list .paper-cover { width: 80px; min-height: 110px; }
}
</style>
