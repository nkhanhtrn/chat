<template>
  <AppLayout storage-key="sidebar" side-tab-label="Contents">
    <template #side>
      <BookTocSidebar
        :toc="toc"
        :book-title="currentBook?.title ?? ''"
        :active-href="activeHref"
        @navigate="handleTocNavigate"
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
          <template v-if="bookFileType === 'pdf'">
            <div class="pdf-controls">
              <button class="nav-btn tool-btn page-turn-btn" @click="handlePrevPage" :disabled="!canGoPrev" title="Previous page">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
                <span class="page-turn-label">Prev</span>
              </button>
              <button class="nav-btn tool-btn page-turn-btn" @click="handleNextPage" :disabled="!canGoNext" title="Next page">
                <span class="page-turn-label">Next</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
              </button>
              <span class="ctrl-sep"></span>
              <button class="nav-btn zoom-btn" @click="zoomOut" :disabled="pdfScale <= 0.5" title="Zoom out">−</button>
              <span class="zoom-info">{{ Math.round(pdfScale * 100) }}%</span>
              <button class="nav-btn zoom-btn" @click="zoomIn" :disabled="pdfScale >= 4" title="Zoom in">+</button>
              <button class="nav-btn tool-btn" :class="{ active: spreadMode === 'double' }" :title="spreadMode === 'double' ? 'Double-page view' : 'Single-page view'" @click="toggleSpread">
                <svg v-if="spreadMode === 'double'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/></svg>
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="5" width="8" height="14" rx="1"/></svg>
              </button>
              <span class="ctrl-sep"></span>
              <button
                v-for="t in DRAW_TOOLS"
                :key="t.tool"
                class="nav-btn tool-btn"
                :class="{ active: drawTool === t.tool }"
                :title="t.label"
                :aria-label="t.label"
                @click="setTool(t.tool)"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="t.icon" /></svg>
              </button>
              <div class="stroke-color-picker">
                <button
                  v-for="(_, i) in STROKE_COLORS"
                  :key="i"
                  class="color-circle"
                  :class="{ selected: drawColorIndex === i }"
                  :style="{ backgroundColor: `var(--color-highlight-${i}, var(--color-highlight-0))` }"
                  :aria-label="`Color ${i + 1}`"
                  @click="setStrokeColor(i)"
                ></button>
              </div>
              <span class="ctrl-sep"></span>
              <span class="page-info page-info-full">{{ pageDisplayText }}</span>
              <span class="page-info page-info-short">{{ pageDisplayShort }}</span>
            </div>
          </template>
          <template v-else>
            <h2>{{ currentBook.title }}<span v-if="currentBook.author" class="book-author"> by {{ currentBook.author }}</span></h2>
          </template>
        </div>
        <div v-if="progress > 0" class="progress-bar">
          <ProgressBar :progress="Math.round(progress * 100)" />
        </div>
        <div
          class="viewer-container"
          :class="{ 'is-pdf-viewer': bookFileType === 'pdf' }"
          ref="viewerContainer"
          :style="{ cursor: viewerCursor }"
          @pointerdown="onViewerPointerDown"
          @pointermove="onViewerPointerMove"
          @pointerup="onViewerPointerUp"
          @pointercancel="onViewerPointerUp"
        >
          <!-- book renders here -->
        </div>
        <div v-if="bookFileType !== 'pdf'" class="page-nav">
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
      @ask-question="handleDeepdive"
      @summary="handleSummary"
      @custom-prompt="handleCustomPrompt"
      @custom-prompt-deep-dive="handleCustomPromptDeepDive"
    />
    <DictionaryModal
      :visible="dictionary.show"
      :word="dictionary.word"
      :definition="dictionary.definition"
      :pronunciation="dictionary.pronunciation"
      :context="dictionary.context"
      @close="dictionary.show = false"
      @lookup="handleDictionaryLookup"
    />
    <ResponseModal
      :visible="response.show"
      :title="response.title"
      :content="response.content"
      :is-streaming="response.streaming"
      @close="response.show = false"
    />
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import BookTocSidebar from '@/components/BookTocSidebar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import DictionaryModal from '@/components/modal/DictionaryModal.vue'
import ResponseModal from '@/components/modal/ResponseModal.vue'
import { useBooksStore } from '@/stores/books'
import { useStrokesStore } from '@/stores/strokes'
import { EpubRenderer } from '@/services/epubRenderer'
import { PdfRenderer, type SpreadMode } from '@/services/pdfRenderer'
import { Settings } from '@/services/settings'
import lmService from '@/services/llm/LMService'
import { getQuickExplainPrompts, getMainPrompts, getSummaryPrompts } from '@/services/extraPrompt'
import { useVocabulary } from '@/composables/useVocabulary'
import { STROKE_COLORS, type DrawTool } from '@/services/strokeLayer'
import type { StrokeDraft } from '@/types/stroke'

import type { BookData, TocItem } from '@/types/book'

const route = useRoute()
const router = useRouter()
const booksStore = useBooksStore()
const strokesStore = useStrokesStore()
const { addVocabCard, findByWord } = useVocabulary()

const loading = ref(false)
const error = ref<string | null>(null)
const viewerContainer = ref<HTMLElement | null>(null)
const progress = ref(0)
const canGoPrev = ref(false)
const canGoNext = ref(true)
const toc = ref<TocItem[]>([])
const activeHref = ref<string | null>(null)
const contextMenu = reactive({ visible: false, x: 0, y: 0, text: '', context: '' })
const dictionary = reactive({ show: false, word: '', definition: '', pronunciation: '', context: '' })
const response = reactive({ show: false, title: '', content: '', streaming: false })

// PDF-specific state (plain variable — same pattern as epub renderer, avoids Vue reactive proxy wrapping pdfjs internals)
let pdfRenderer: PdfRenderer | null = null
const PDF_SCALE_KEY = 'pdf-scale'
function loadPdfScale(): number {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PDF_SCALE_KEY) : null
  const n = v ? parseFloat(v) : NaN
  return Number.isFinite(n) && n >= 0.5 && n <= 4 ? n : 1.0
}
const pdfScale = ref<number>(loadPdfScale())
const currentPage = ref(1)
const pageEnd = ref<number | undefined>()
const totalPages = ref(0)

// Drawing annotations (PDF only)
const PDF_DRAW_TOOL_KEY = 'pdf-draw-tool'
function loadDrawTool(): DrawTool {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PDF_DRAW_TOOL_KEY) : null
  return v === 'select' || v === 'pen' || v === 'highlighter' || v === 'eraser' ? v : 'select'
}
const drawTool = ref<DrawTool>(loadDrawTool())
const drawColorIndex = ref(0)
const PDF_SPREAD_KEY = 'pdf-spread-mode'
function loadSpreadMode(): SpreadMode {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(PDF_SPREAD_KEY) : null
  return v === 'single' || v === 'double' ? v : 'auto'
}
const spreadMode = ref<SpreadMode>(loadSpreadMode())
const DRAW_TOOLS: { tool: DrawTool; label: string; icon: string }[] = [
  { tool: 'select', label: 'Select', icon: 'M5 3l5.5 15.5L13 12l6.5-2.5z' },
  { tool: 'pen', label: 'Pen', icon: 'M16 3l5 5L8 21H3v-5z' },
  { tool: 'highlighter', label: 'Highlighter', icon: 'M9 11l3-3 5 5-3 3zM6 14l3 3-2.5 2.5H3.5V17z' },
  { tool: 'eraser', label: 'Eraser', icon: 'M5 19h14M9 15l5-5 5 5-5 5z' },
]

function setTool(tool: DrawTool): void {
  drawTool.value = tool
  try { localStorage.setItem(PDF_DRAW_TOOL_KEY, tool) } catch {}
  pdfRenderer?.setDrawTool(tool)
}

function setStrokeColor(i: number): void {
  drawColorIndex.value = i
  pdfRenderer?.setDrawColor(i)
}

function toggleSpread(): void {
  spreadMode.value = spreadMode.value === 'double' ? 'single' : 'double'
  try { localStorage.setItem(PDF_SPREAD_KEY, spreadMode.value) } catch {}
  pdfRenderer?.setSpreadMode(spreadMode.value)
}

function handleStrokeAdd(draft: StrokeDraft): void {
  if (!currentBook.value) return
  strokesStore.add(currentBook.value.id, draft)
}

function handleStrokeRemove(strokeId: string): void {
  if (!currentBook.value) return
  strokesStore.remove(currentBook.value.id, strokeId)
}

// Grab-to-pan: in Select mode, click-and-drag moves the document.
const panning = ref(false)
const panStart = { x: 0, y: 0, left: 0, top: 0 }
const viewerCursor = computed(() => {
  if (bookFileType.value !== 'pdf') return 'default'
  if (panning.value) return 'grabbing'
  return drawTool.value === 'select' ? 'grab' : 'default'
})

function onViewerPointerDown(e: PointerEvent) {
  if (bookFileType.value !== 'pdf' || drawTool.value !== 'select') return
  const el = viewerContainer.value
  if (!el) return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  e.preventDefault()
  panStart.x = e.clientX
  panStart.y = e.clientY
  panStart.left = el.scrollLeft
  panStart.top = el.scrollTop
  panning.value = true
  try { el.setPointerCapture?.(e.pointerId) } catch {}
}

function onViewerPointerMove(e: PointerEvent) {
  if (!panning.value) return
  const el = viewerContainer.value
  if (!el) return
  el.scrollLeft = panStart.left - (e.clientX - panStart.x)
  el.scrollTop = panStart.top - (e.clientY - panStart.y)
}

function onViewerPointerUp(e: PointerEvent) {
  if (!panning.value) return
  panning.value = false
  const el = viewerContainer.value
  if (el) { try { el.releasePointerCapture?.(e.pointerId) } catch {} }
}

async function handleDictionary() {
  contextMenu.visible = false
  const word = contextMenu.text
  if (!word) return

  const existingVocabCard = findByWord(word)

  dictionary.word = word
  dictionary.definition = existingVocabCard?.definition || ''
  dictionary.pronunciation = existingVocabCard?.pronunciation || ''
  dictionary.context = contextMenu.context
  dictionary.streaming = false
  dictionary.show = true

  if (existingVocabCard?.definition) return
}

function handleDictionaryLookup(result: { definition: string; pronunciation: string }) {
  const word = contextMenu.text
  if (!word) return
  dictionary.pronunciation = result.pronunciation
  addVocabCard({ word, definition: result.definition, context: contextMenu.context, pronunciation: result.pronunciation })
}

async function handleDeepdive(text: string) {
  contextMenu.visible = false
  if (!text) return

  response.title = text
  response.content = ''
  response.streaming = true
  response.show = true

  try {
    const messages = getQuickExplainPrompts(`Explain this text: "${text}"`)
    await lmService.ephemeralChat(messages, (chunk: string) => {
      response.content += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Deepdive failed:', err)
    if (!response.content) response.content = 'Failed to get explanation.'
  } finally {
    response.streaming = false
  }
}

async function handleSummary() {
  contextMenu.visible = false
  const text = contextMenu.text
  if (!text) return

  response.title = text
  response.content = ''
  response.streaming = true
  response.show = true

  try {
    const messages = getSummaryPrompts(text)
    await lmService.ephemeralChat(messages, (chunk: string) => {
      response.content += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Summary failed:', err)
    if (!response.content) response.content = 'Failed to generate summary.'
  } finally {
    response.streaming = false
  }
}

async function handleCustomPrompt(prompt: string) {
  contextMenu.visible = false
  const text = contextMenu.text
  if (!text) return

  response.title = prompt
  response.content = ''
  response.streaming = true
  response.show = true

  try {
    const messages = getQuickExplainPrompts(`Regarding this text: "${text}"\n\n${prompt}`)
    await lmService.ephemeralChat(messages, (chunk: string) => {
      response.content += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Custom prompt failed:', err)
    if (!response.content) response.content = 'Failed to get response.'
  } finally {
    response.streaming = false
  }
}

async function handleCustomPromptDeepDive(prompt: string) {
  contextMenu.visible = false
  const text = contextMenu.text
  if (!text) return

  response.title = prompt
  response.content = ''
  response.streaming = true
  response.show = true

  try {
    const question = `${prompt} (context: "${text}")`
    const messages = getMainPrompts(question)
    await lmService.ephemeralChat(messages, (chunk: string) => {
      response.content += chunk
    })
  } catch (err) {
    console.error('[BookViewer] Deep dive failed:', err)
    if (!response.content) response.content = 'Failed to get response.'
  } finally {
    response.streaming = false
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

const bookFileType = computed<'epub' | 'pdf'>(() => currentBook.value?.fileType ?? 'epub')

const pageDisplayText = computed(() => {
  if (pageEnd.value && pageEnd.value !== currentPage.value) {
    return `Pages ${currentPage.value}\u2013${pageEnd.value} of ${totalPages.value}`
  }
  return `Page ${currentPage.value} of ${totalPages.value}`
})

const pageDisplayShort = computed(() => {
  if (pageEnd.value && pageEnd.value !== currentPage.value) {
    return `${currentPage.value}\u2013${pageEnd.value}/${totalPages.value}`
  }
  return `${currentPage.value}/${totalPages.value}`
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
    const book = booksStore.getBookById(bookId)
    const fileType = (book?.fileType as 'epub' | 'pdf') ?? undefined
    const fileData = await downloadBookFileFromStorage(bookId, (p) => {
      booksStore.$patch({ downloadProgress: { [bookId]: p } })
    }, fileType)
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
  if (currentBook.value && currentBook.value.fileType === 'pdf') {
    document.documentElement.style.setProperty('--book-max-width', '100%')
    return
  }
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

  if (bookFileType.value === 'pdf') {
    await renderPdf(bookId, fileData)
  } else {
    await renderEpub(bookId, fileData)
  }
}

async function renderPdf(bookId: string, fileData: ArrayBuffer) {
  // Don't save position during init/restoration — only after setup is complete
  let positionSaveEnabled = false

  await strokesStore.loadForBook(bookId)

  const pr = new PdfRenderer(viewerContainer.value!, fileData, {
    scale: pdfScale.value,
    spreadMode: spreadMode.value,
    drawTool: drawTool.value,
    drawColorIndex: drawColorIndex.value,
    getStrokesForPage: (page) => strokesStore.forPage(bookId, page),
    onStrokeAdd: handleStrokeAdd,
    onStrokeRemove: handleStrokeRemove,
    onLocationChange(location) {
      currentPage.value = location.page
      pageEnd.value = location.pageEnd
      totalPages.value = location.totalPages
      progress.value = location.percentage
      canGoPrev.value = location.page > 1
      canGoNext.value = (location.pageEnd ?? location.page) < location.totalPages
      contextMenu.visible = false

      if (positionSaveEnabled) {
        booksStore.updatePdfReadingPosition(bookId, location.page, location.percentage).catch(err => {
          console.warn('Failed to save PDF reading position:', err)
        })
      }
    },
  })

  await pr.initialize()
  pdfRenderer = pr

  // Populate TOC
  toc.value = pr.getTableOfContents()
  totalPages.value = pr.totalPages

  // Restore saved position
  const book = booksStore.getBookById(bookId)
  if (book?.lastPage && book.lastPage > 1) {
    try {
      await pr.display(book.lastPage)
    } catch {
      // Invalid page — stay on first page
    }
  }

  if (book?.readingProgress) {
    progress.value = book.readingProgress / 100
  }

  // Now enable position saving for subsequent navigation
  positionSaveEnabled = true

  // Observe container resizes for spread mode changes
  let resizeSkipped = false
  resizeObserver = new ResizeObserver((entries) => {
    if (!resizeSkipped) {
      resizeSkipped = true
      return
    }
    for (const entry of entries) {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) {
        pdfRenderer?.resize(width, height)
      }
    }
  })
  resizeObserver.observe(viewerContainer.value!)
}

async function renderEpub(bookId: string, fileData: ArrayBuffer) {
  renderer = new EpubRenderer(viewerContainer.value!, fileData, {
    theme: getEpubTheme(),
    onTextSelect(data) {
      contextMenu.x = data.x
      contextMenu.y = data.y
      contextMenu.text = data.text
      contextMenu.context = data.context || ''
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

  await renderer.initialize()

  // Populate TOC in sidebar
  toc.value = renderer.getTableOfContents()

  // Navigate to saved reading position
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
  resizeObserver.observe(viewerContainer.value!)

  // Watch for style attribute changes on <html> (theme/font/line-height updates from settings)
  styleObserver = new MutationObserver(() => {
    renderer?.updateTheme(getEpubTheme())
    applyBookContentWidth()
  })
  styleObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] })
}

async function handleTocNavigate(href: string) {
  activeHref.value = href
  if (bookFileType.value === 'pdf') {
    const pageNum = parseInt(href.replace('page:', ''), 10)
    if (!isNaN(pageNum)) {
      await pdfRenderer?.display(pageNum)
    }
  } else {
    await renderer?.display(href)
  }
}

async function handlePrevPage() {
  if (bookFileType.value === 'pdf') {
    await pdfRenderer?.prevPage()
  } else {
    await renderer?.prevPage()
  }
}

async function handleNextPage() {
  if (bookFileType.value === 'pdf') {
    await pdfRenderer?.nextPage()
  } else {
    await renderer?.nextPage()
  }
}

function zoomIn() {
  pdfScale.value = Math.min(4, pdfScale.value + 0.1)
  try { localStorage.setItem(PDF_SCALE_KEY, String(pdfScale.value)) } catch {}
  pdfRenderer?.setScale(pdfScale.value)
}

function zoomOut() {
  pdfScale.value = Math.max(0.5, pdfScale.value - 0.1)
  try { localStorage.setItem(PDF_SCALE_KEY, String(pdfScale.value)) } catch {}
  pdfRenderer?.setScale(pdfScale.value)
}

function destroyRenderer() {
  resizeObserver?.disconnect()
  resizeObserver = null
  styleObserver?.disconnect()
  styleObserver = null
  if (renderer) {
    renderer.destroy()
    renderer = null
  }
  if (pdfRenderer) {
    pdfRenderer.destroy()
    pdfRenderer = null
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
})

// Keyboard navigation
function handleKeydown(e: KeyboardEvent) {
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    handlePrevPage()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    handleNextPage()
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  destroyRenderer()
  window.removeEventListener('keydown', handleKeydown)
})
</script>

<style scoped>
.book-viewer-page { height: 100%; min-height: 0; overflow-y: hidden; background: var(--color-bg-page); display: flex; flex-direction: column; }
.loading-state, .error-state, .empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-state h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.empty-state a { color: var(--color-primary); }
.book-header { padding: 0.5rem 2rem; border-bottom: 1px solid var(--color-border-base); flex-shrink: 0; }
.book-header h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0; font-size: 0.95rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.book-author { color: var(--color-text-muted); font-size: 0.85rem; font-weight: 400; }
.progress-bar { flex-shrink: 0; }
.viewer-container { flex: 1; min-height: 0; overflow: auto; max-width: var(--book-max-width, 100%); margin: 0 auto; width: 100%; display: flex; justify-content: center; }
/* PDF only: let pointer events drive pan/draw and stop the browser from
   pinch-zooming the whole page (zoom is handled by the +/− buttons). */
.viewer-container.is-pdf-viewer, .viewer-container.is-pdf-viewer :deep(*) { touch-action: none; }
/* When zoomed past the viewport, the page must overflow and scroll in BOTH
   directions. `justify-content: center` clips the left overflow and makes the
   page look like it only grows vertically; the wrapper's `margin: auto` still
   centers it when it fits. */
.viewer-container.is-pdf-viewer { justify-content: flex-start; }
.viewer-container :deep(.epub-container) { margin: 0 auto; }
.viewer-container :deep(.pdf-page-wrapper) { position: relative; margin: 1rem auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.viewer-container :deep(.pdf-spread) { display: flex; justify-content: center; gap: 1rem; margin: 1rem auto; }
.viewer-container :deep(.pdf-spread .pdf-page-wrapper) { margin: 0; }
.viewer-container :deep(.pdf-text-layer) { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; opacity: 0.25; line-height: 1.0; }
.viewer-container :deep(.pdf-text-layer > span) { color: transparent; position: absolute; white-space: pre; cursor: text; }
.page-nav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 2rem; border-top: 1px solid var(--color-border-base); flex-shrink: 0; }
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }
.pdf-controls { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.4rem; }
.zoom-btn { padding: 0.3rem 0.6rem; min-width: 2rem; }
.zoom-info { font-size: 0.8rem; color: var(--color-text-muted); min-width: 3rem; text-align: center; }
.ctrl-sep { width: 1px; height: 22px; background: var(--color-border-base); flex-shrink: 0; }
.tool-btn { padding: 0.3rem; color: var(--color-text-muted); display: flex; align-items: center; justify-content: center; }
.tool-btn:hover:not(:disabled) { color: var(--color-text-base); }
.tool-btn svg { width: 16px; height: 16px; display: block; }
.tool-btn.active { color: var(--color-primary, var(--color-text-message)); border-color: var(--color-border-accent); background: var(--color-bg-hover); }
.page-turn-btn { gap: 0.2rem; padding: 0.3rem 0.45rem; }
.page-turn-label { font-size: 0.8rem; color: var(--color-text-message); white-space: nowrap; }
.stroke-color-picker { display: flex; gap: 0.2rem; margin-left: 0.15rem; }
.color-circle { width: 16px; height: 16px; border-radius: 50%; border: 2px solid transparent; cursor: pointer; padding: 0; }
.color-circle:hover { transform: scale(1.12); }
.color-circle.selected { border-color: var(--color-text-strong); }
.page-info-short { display: none; }
@media (max-width: 768px) {
  .book-header { padding: 0.3rem 0.4rem; }
  .pdf-controls { flex-wrap: nowrap; overflow-x: auto; justify-content: space-between; gap: 0.15rem; scrollbar-width: none; }
  .pdf-controls::-webkit-scrollbar { display: none; }
  .pdf-controls .tool-btn { padding: 0.2rem; }
  .pdf-controls .tool-btn svg { width: 14px; height: 14px; }
  .pdf-controls .zoom-btn { padding: 0.2rem 0.4rem; min-width: 1.5rem; }
  .pdf-controls .zoom-info { min-width: 2.4rem; font-size: 0.75rem; }
  .pdf-controls .color-circle { width: 14px; height: 14px; }
  .pdf-controls .ctrl-sep { display: none; }
  .pdf-controls .page-info { font-size: 0.75rem; }
  .page-info-full { display: none; }
  .page-info-short { display: inline; }
}
</style>
