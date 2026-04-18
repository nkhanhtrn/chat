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
        </div>
        <div v-if="progress > 0" class="progress-bar">
          <ProgressBar :progress="Math.round(progress * 100)" />
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
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :highlighted-text="contextMenu.text"
      :read-only="true"
      @close="contextMenu.visible = false"
      @dictionary="handleDictionary"
      @ask-question="handleExplain"
      @custom-prompt="handleCustomPrompt"
      @custom-prompt-deep-dive="handleCustomPromptDeepDive"
    />
    <DictionaryModal
      :visible="dictionary.show"
      :word="dictionary.word"
      :definition="dictionary.definition"
      :is-streaming="dictionary.streaming"
      @close="dictionary.show = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import BookTocSidebar from '@/components/BookTocSidebar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import DictionaryModal from '@/components/modal/DictionaryModal.vue'
import { useBooksStore } from '@/stores/books'
import { EpubRenderer } from '@/services/epubRenderer'
import { Settings } from '@/services/settings'
import lmService, { Category } from '@/services/llm/LMService'
import { getDictionaryPrompts, getQuickExplainPrompts, getMainPrompts } from '@/services/extraPrompt'
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
const contextMenu = reactive({ visible: false, x: 0, y: 0, text: '' })
const dictionary = reactive({ show: false, word: '', definition: '', streaming: false })

async function handleDictionary() {
  contextMenu.visible = false
  const word = contextMenu.text
  if (!word) return

  dictionary.word = word
  dictionary.definition = ''
  dictionary.streaming = true
  dictionary.show = true

  try {
    const messages = getDictionaryPrompts(word)
    await lmService.sendByCategory(Category.QUICK, messages, (chunk: string) => {
      dictionary.definition += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Dictionary lookup failed:', err)
    if (!dictionary.definition) dictionary.definition = 'Failed to look up definition.'
  } finally {
    dictionary.streaming = false
  }
}

async function handleExplain(text: string) {
  contextMenu.visible = false
  if (!text) return

  dictionary.word = text
  dictionary.definition = ''
  dictionary.streaming = true
  dictionary.show = true

  try {
    const messages = getQuickExplainPrompts(`Explain this text: "${text}"`)
    await lmService.sendByCategory(Category.QUICK, messages, (chunk: string) => {
      dictionary.definition += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Explain failed:', err)
    if (!dictionary.definition) dictionary.definition = 'Failed to get explanation.'
  } finally {
    dictionary.streaming = false
  }
}

async function handleCustomPrompt(prompt: string) {
  contextMenu.visible = false
  const text = contextMenu.text
  if (!text) return

  dictionary.word = text
  dictionary.definition = ''
  dictionary.streaming = true
  dictionary.show = true

  try {
    const messages = getQuickExplainPrompts(`Regarding this text: "${text}"\n\n${prompt}`)
    await lmService.sendByCategory(Category.QUICK, messages, (chunk: string) => {
      dictionary.definition += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Custom prompt failed:', err)
    if (!dictionary.definition) dictionary.definition = 'Failed to get response.'
  } finally {
    dictionary.streaming = false
  }
}

async function handleCustomPromptDeepDive(prompt: string) {
  contextMenu.visible = false
  const text = contextMenu.text
  if (!text) return

  dictionary.word = text
  dictionary.definition = ''
  dictionary.streaming = true
  dictionary.show = true

  try {
    const question = `${prompt} (context: "${text}")`
    const messages = getMainPrompts(question)
    await lmService.sendByCategory(Category.DETAILS, messages, (chunk: string) => {
      dictionary.definition += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Deep dive failed:', err)
    if (!dictionary.definition) dictionary.definition = 'Failed to get response.'
  } finally {
    dictionary.streaming = false
  }
}

let renderer: EpubRenderer | null = null
let resizeObserver: ResizeObserver | null = null
let styleObserver: MutationObserver | null = null

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

function getEpubTheme(): { bg: string; color: string; accent: string; fontFamily?: string; fontSize?: number; lineHeight?: number } {
  const style = getComputedStyle(document.documentElement)
  const settings = Settings.getAll()
  return {
    bg: style.getPropertyValue('--color-bg-page').trim() || '#ffffff',
    color: style.getPropertyValue('--color-text-base').trim() || '#000000',
    accent: style.getPropertyValue('--color-primary').trim() || '#404040',
    fontFamily: settings.fontFamily,
    fontSize: settings.fontSize,
    lineHeight: settings.lineHeight,
  }
}

function applyBookContentWidth() {
  const settings = Settings.getAll()
  const widthMap: Record<string, string> = { narrow: '600px', medium: '900px', wide: '100%' }
  document.documentElement.style.setProperty('--book-max-width', widthMap[settings.contentWidth ?? 'medium'] ?? '900px')
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
    onTextSelect(data) {
      contextMenu.x = data.x
      contextMenu.y = data.y
      contextMenu.text = data.text
      contextMenu.visible = true
    },
    onLocationChange(location) {
      progress.value = location.percentage
      canGoPrev.value = !location.atStart
      canGoNext.value = !location.atEnd
      contextMenu.visible = false

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

  // Watch for style attribute changes on <html> (theme/font/line-height updates from settings)
  styleObserver = new MutationObserver(() => {
    renderer?.updateTheme(getEpubTheme())
    applyBookContentWidth()
  })
  styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
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
  resizeObserver?.disconnect()
  resizeObserver = null
  styleObserver?.disconnect()
  styleObserver = null
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
  applyBookContentWidth()

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
.book-header h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.25rem; font-size: 1.1rem; }
.book-author { color: var(--color-text-muted); font-size: 0.9rem; margin: 0 0 0.5rem; }
.progress-bar { flex-shrink: 0; }
.viewer-container { flex: 1; overflow: hidden; max-width: var(--book-max-width, 100%); margin: 0 auto; width: 100%; display: flex; justify-content: center; }
.viewer-container :deep(.epub-container) { margin: 0 auto; }
.page-nav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 2rem; border-top: 1px solid var(--color-border-base); flex-shrink: 0; }
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }
@media (max-width: 768px) { .book-header { padding: 0.75rem 1rem; } }
</style>
