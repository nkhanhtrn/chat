<template>
  <div class="viewer">
    <header class="v-header">
      <button class="v-btn" @click="back" title="Back to library">‹ Library</button>
      <span class="v-title">{{ currentBook?.title || 'Reader' }}</span>
      <button class="v-btn" @click="showToc = !showToc" title="Contents">☰</button>
    </header>

    <div class="v-progress">
      <div class="v-progress-fill" :style="{ width: Math.round(progress * 100) + '%' }"></div>
    </div>

    <div class="v-body">
      <div v-if="loading" class="v-status">Loading book…</div>
      <div v-else-if="error" class="v-status v-error">{{ error }}</div>
      <div v-show="!loading && !error" class="v-container" ref="container"></div>
    </div>

    <nav v-if="!loading && !error" class="v-nav">
      <button class="v-btn" @click="prev" :disabled="!canPrev">‹ Prev</button>
      <span class="v-pct">{{ Math.round(progress * 100) }}%</span>
      <button class="v-btn" @click="next" :disabled="!canNext">Next ›</button>
    </nav>

    <div v-if="showToc" class="v-toc-overlay" @click.self="showToc = false">
      <div class="v-toc-panel">
        <div class="v-toc-head">
          <span>Contents</span>
          <button class="v-btn" @click="showToc = false">✕</button>
        </div>
        <div class="v-toc-body">
          <BookTocSidebar
            :toc="toc"
            :book-title="currentBook?.title ?? ''"
            hide-header
            @navigate="onTocNav"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useBooksStore } from '@/stores/books'
import { EpubRenderer } from '@/services/epubRenderer'
import { getFirebaseAuth } from '@/services/firebase'
import BookTocSidebar from '@/components/BookTocSidebar.vue'
import { downloadEpubFile } from '../lib/bookDownload'
import type { TocItem } from '@/types/book'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()

const container = ref<HTMLElement | null>(null)
const loading = ref(false)
const error = ref<string | null>(null)
const progress = ref(0)
const canPrev = ref(false)
const canNext = ref(true)
const toc = ref<TocItem[]>([])
const showToc = ref(false)

let renderer: EpubRenderer | null = null
let resizeObserver: ResizeObserver | null = null

const bookId = computed(() => route.params.bookId as string)
const currentBook = computed(() => booksStore.books.find((b) => b.id === bookId.value) ?? null)

async function loadFileData(id: string): Promise<ArrayBuffer | null> {
  const preloaded = booksStore.getPreloadedBook(id)
  if (preloaded) return preloaded.fileData

  try {
    const { BookStorage } = await import('@/services/BookStorage')
    const cached = await BookStorage.getBookFile(id).catch(() => null)
    if (cached) return cached
  } catch {
    /* ignore */
  }

  try {
    const uid = getFirebaseAuth().currentUser?.uid
    if (uid) {
      const data = await downloadEpubFile(id, uid)
      if (data) {
        const { BookStorage } = await import('@/services/BookStorage')
        await BookStorage.saveBookFile(id, data)
        return data
      }
    }
  } catch (err) {
    console.warn('[Reader] cloud download failed:', err)
  }

  return null
}

function epubTheme(): { bg: string; color: string; accent: string } {
  const style = getComputedStyle(document.documentElement)
  return {
    bg: style.getPropertyValue('--color-bg-page').trim() || '#ffffff',
    color: style.getPropertyValue('--color-text-base').trim() || '#000000',
    accent: style.getPropertyValue('--color-primary').trim() || '#404040',
  }
}

async function render(id: string, fileData: ArrayBuffer): Promise<void> {
  await nextTick()
  if (!container.value) {
    error.value = 'Viewer container not available'
    return
  }

  renderer = new EpubRenderer(container.value, fileData, {
    theme: epubTheme(),
    onLocationChange(loc) {
      progress.value = loc.percentage
      canPrev.value = !loc.atStart
      canNext.value = !loc.atEnd
      booksStore.updateReadingPosition(id, loc.cfi, loc.percentage).catch((err) => {
        console.warn('[Reader] failed to save position:', err)
      })
    },
  })

  await renderer.initialize()
  toc.value = renderer.getTableOfContents()

  const book = booksStore.getBookById(id)
  if (book?.lastCfi) {
    try {
      await renderer.display(book.lastCfi)
    } catch {
      /* invalid CFI — stay on first page */
    }
  }

  if (book?.readingProgress) {
    progress.value = book.readingProgress / 100
  }

  let resizeSkipped = false
  if (typeof ResizeObserver !== 'undefined') {
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
    resizeObserver.observe(container.value)
  }
}

async function loadBook(id: string): Promise<void> {
  if (!id) {
    error.value = 'No book ID provided'
    return
  }
  loading.value = true
  error.value = null
  booksStore.setCurrentBook(id)
  try {
    await booksStore.loadBookContent(id)
    const fileData = await loadFileData(id)
    if (!fileData) {
      error.value = 'Book file not found. It may not have been uploaded yet.'
      return
    }
    loading.value = false
    await render(id, fileData)
  } catch (err) {
    console.error('[Reader] failed to load book:', err)
    error.value = 'Failed to load book: ' + (err as Error).message
  } finally {
    loading.value = false
  }
}

async function prev(): Promise<void> {
  await renderer?.prevPage()
}

async function next(): Promise<void> {
  await renderer?.nextPage()
}

async function onTocNav(href: string): Promise<void> {
  showToc.value = false
  await renderer?.display(href)
}

function back(): void {
  router.push({ name: 'library' })
}

function destroy(): void {
  resizeObserver?.disconnect()
  resizeObserver = null
  if (renderer) {
    renderer.destroy()
    renderer = null
  }
  toc.value = []
}

function onKey(e: KeyboardEvent): void {
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    prev()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    next()
  }
}

onMounted(async () => {
  await loadBook(bookId.value)
  window.addEventListener('keydown', onKey)
})

watch(bookId, (id) => {
  if (!id) return
  destroy()
  loadBook(id)
})

onBeforeUnmount(() => {
  destroy()
  window.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.viewer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-page, #ffffff);
}

.v-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle, #eee);
  flex-shrink: 0;
}

.v-title {
  flex: 1;
  font-size: 0.85rem;
  color: var(--color-text-muted, #888);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: center;
}

.v-btn {
  padding: 0.4rem 0.7rem;
  background: transparent;
  border: 1px solid transparent;
  color: var(--color-text-base, #202020);
  cursor: pointer;
  border-radius: 4px;
  font-size: 0.9rem;
}

.v-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, rgba(0, 0, 0, 0.05));
}

.v-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.v-progress {
  height: 2px;
  background: var(--color-bg-hover, #eee);
  flex-shrink: 0;
}

.v-progress-fill {
  height: 100%;
  background: var(--color-primary, #404040);
}

.v-body {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.v-container {
  width: 100%;
  height: 100%;
}

.v-status {
  padding: 3rem 1rem;
  text-align: center;
  color: var(--color-text-muted, #888);
}

.v-error {
  color: var(--color-error-text, #c0392b);
}

.v-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.4rem 0.75rem;
  border-top: 1px solid var(--color-border-subtle, #eee);
  flex-shrink: 0;
}

.v-pct {
  font-size: 0.8rem;
  color: var(--color-text-muted, #888);
}

.v-toc-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.3);
  z-index: 50;
  display: flex;
}

.v-toc-panel {
  width: 80%;
  max-width: 360px;
  height: 100%;
  background: var(--color-bg-base, #fafafa);
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--color-border-base, #e0e0e0);
}

.v-toc-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle, #eee);
  font-size: 0.95rem;
  color: var(--color-text-base, #202020);
}

.v-toc-body {
  flex: 1;
  overflow-y: auto;
}
</style>
