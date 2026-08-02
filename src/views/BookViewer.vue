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
          <PdfToolbar
            v-if="bookFileType === 'pdf'"
            ref="pdfToolbar"
            v-model:pdf-scale="pdfScale"
            v-model:draw-tool="drawTool"
            v-model:spread-mode="spreadMode"
            :pdf-renderer="pdfRenderer"
            :current-page="currentPage"
            :total-pages="totalPages"
            :page-end="pageEnd"
            :can-go-prev="canGoPrev"
            :can-go-next="canGoNext"
            @prev="handlePrevPage"
            @next="handleNextPage"
            @scale-change="savePdfScale"
          />
          <template v-else>
            <h2>{{ currentBook.title }}<span v-if="currentBook.author" class="book-author"> by {{ currentBook.author }}</span></h2>
          </template>
        </div>
        <div v-if="progress > 0 && bookFileType !== 'pdf'" class="progress-bar">
          <ProgressBar :progress="Math.round(progress * 100)" />
        </div>
        <div
          class="viewer-container"
          :class="{ 'is-pdf-viewer': bookFileType === 'pdf' }"
          ref="viewerContainer"
          :style="{ cursor: viewerCursor }"
          @pointerdown.capture="onViewerPointerDown"
          @pointermove="onViewerPointerMove"
          @pointerup="onViewerPointerUp"
          @pointercancel="onViewerPointerUp"
          @contextmenu.prevent
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
import { ref, reactive, computed, shallowRef, onMounted, onUnmounted, watch, nextTick, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import BookTocSidebar from '@/components/BookTocSidebar.vue'
import ProgressBar from '@/components/ProgressBar.vue'
import ContextMenu from '@/components/ContextMenu.vue'
import DictionaryModal from '@/components/modal/DictionaryModal.vue'
import ResponseModal from '@/components/modal/ResponseModal.vue'
import PdfToolbar from '@/components/PdfToolbar.vue'
import { useBooksStore } from '@/stores/books'
import { useStrokesStore } from '@/stores/strokes'
import { EpubRenderer } from '@/services/epubRenderer'
import { PdfRenderer, type SpreadMode } from '@/services/pdfRenderer'
import { Settings } from '@/services/settings'
import lmService from '@/services/llm/LMService'
import { getQuickExplainPrompts, getMainPrompts, getSummaryPrompts } from '@/services/extraPrompt'
import { useVocabulary } from '@/composables/useVocabulary'
import { type DrawTool } from '@/services/strokeLayer'
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

// PDF-specific state (shallowRef — avoids Vue reactive proxy wrapping pdfjs internals)
const pdfRenderer = shallowRef<PdfRenderer | null>(null)
const pdfToolbar = ref<InstanceType<typeof PdfToolbar> | null>(null)

// Zoom is per-book and stays local (not cloud-synced)
let currentPdfBookId: string | null = null
function loadPdfScaleForBook(bookId: string): number {
  const v = typeof localStorage !== 'undefined' ? localStorage.getItem(`pdf-scale-${bookId}`) : null
  const n = v ? parseFloat(v) : NaN
  return Number.isFinite(n) && n >= 0.5 && n <= 4 ? n : 1.0
}
function savePdfScale(): void {
  if (!currentPdfBookId) return
  try { localStorage.setItem(`pdf-scale-${currentPdfBookId}`, String(pdfScale.value)) } catch {}
}
const pdfScale = ref<number>(1.0)
const currentPage = ref(1)
const pageEnd = ref<number | undefined>()
const totalPages = ref(0)

// Drawing annotations (PDF only) — these stay here because BookViewer's gesture
// handlers and renderPdf read/write them directly. PdfToolbar binds via v-model.
function loadDrawTool(): DrawTool {
  const v = Settings.get('pdfDrawTool')
  return v === 'select' || v === 'pen' || v === 'highlighter' || v === 'eraser' ? v : 'select'
}
const drawTool = ref<DrawTool>(loadDrawTool())

function loadSpreadMode(): SpreadMode {
  const v = Settings.get('pdfSpreadMode')
  return v === 'single' || v === 'double' ? v : 'auto'
}
const spreadMode = ref<SpreadMode>(loadSpreadMode())

function handleStrokeAdd(draft: StrokeDraft): void {
  if (!currentBook.value) return
  strokesStore.add(currentBook.value.id, draft)
}

function handleStrokeRemove(strokeId: string): void {
  if (!currentBook.value) return
  strokesStore.remove(currentBook.value.id, strokeId)
}

// Grab-to-pan (Select mode) + multi-touch gestures (pinch-zoom, two-finger pan).
// Works in every tool: one finger draws/pans, two fingers always zoom + pan.
const panning = ref(false)
const gestureActive = ref(false)
const panStart = { x: 0, y: 0, left: 0, top: 0 }
let panPointerId: number | null = null

const activePointers = new Map<number, { x: number; y: number }>()
let gestureScaleRatio = 1
let gestureMode: 'pan' | 'zoom' = 'pan'
let pinch: {
  startDist: number
  startScale: number
  startMidX: number
  startMidY: number
  startScrollLeft: number
  startScrollTop: number
} | null = null

const viewerCursor = computed(() => {
  if (bookFileType.value !== 'pdf') return 'default'
  if (gestureActive.value || panning.value) return 'grabbing'
  if (drawTool.value === 'select') return 'grab'
  if (drawTool.value === 'eraser') return 'cell'
  return 'default'
})

function startPan(e: PointerEvent): void {
  const el = viewerContainer.value
  if (!el) return
  e.preventDefault()
  panStart.x = e.clientX
  panStart.y = e.clientY
  panStart.left = el.scrollLeft
  panStart.top = el.scrollTop
  panning.value = true
  panPointerId = e.pointerId
  try { el.setPointerCapture?.(e.pointerId) } catch {}
}

function updatePan(e: PointerEvent): void {
  const el = viewerContainer.value
  if (!el) return
  el.scrollLeft = panStart.left - (e.clientX - panStart.x)
  el.scrollTop = panStart.top - (e.clientY - panStart.y)
}

function endPan(): void {
  panning.value = false
  const el = viewerContainer.value
  if (el && panPointerId !== null) { try { el.releasePointerCapture?.(panPointerId) } catch {} }
  panPointerId = null
}

function applyGestureTransform(scaleFactor: number): void {
  const el = viewerContainer.value
  if (!el) return
  for (const child of Array.from(el.children)) {
    if (child instanceof HTMLElement) {
      child.style.transform = `scale(${scaleFactor})`
      child.style.transformOrigin = 'center center'
    }
  }
}

function clearGestureTransform(): void {
  const el = viewerContainer.value
  if (!el) return
  for (const child of Array.from(el.children)) {
    if (child instanceof HTMLElement) {
      child.style.transform = ''
      child.style.transformOrigin = ''
    }
  }
}

function startGesture(): void {
  const pts = Array.from(activePointers.values())
  if (pts.length < 2) return
  if (panning.value) endPan()
  pdfRenderer.value?.setGestureActive(true)
  gestureActive.value = true
  gestureScaleRatio = 1
  gestureMode = 'pan'
  const el = viewerContainer.value!
  pinch = {
    startDist: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y),
    startScale: pdfScale.value,
    startMidX: (pts[0].x + pts[1].x) / 2,
    startMidY: (pts[0].y + pts[1].y) / 2,
    startScrollLeft: el.scrollLeft,
    startScrollTop: el.scrollTop,
  }
}

function updateGesture(): void {
  if (!pinch) return
  const pts = Array.from(activePointers.values())
  if (pts.length < 2) return
  const el = viewerContainer.value
  if (!el) return
  const midX = (pts[0].x + pts[1].x) / 2
  const midY = (pts[0].y + pts[1].y) / 2
  el.scrollLeft = pinch.startScrollLeft - (midX - pinch.startMidX)
  el.scrollTop = pinch.startScrollTop - (midY - pinch.startMidY)
  const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
  // Lock into zoom mode only when distance changes by at least 30px
  // (absolute, not percentage — prevents accidental zoom during pan)
  if (gestureMode === 'pan' && Math.abs(dist - pinch.startDist) > 30) {
    gestureMode = 'zoom'
  }
  if (gestureMode === 'zoom') {
    const ratio = pinch.startDist > 0 ? dist / pinch.startDist : 1
    gestureScaleRatio = Math.max(0.5 / pinch.startScale, Math.min(4 / pinch.startScale, ratio))
    pdfScale.value = pinch.startScale * gestureScaleRatio
    applyGestureTransform(gestureScaleRatio)
  }
}

async function endGesture(): Promise<void> {
  if (!pinch) return
  const startScale = pinch.startScale
  const wasZoom = gestureMode === 'zoom'
  const finalScale = pdfScale.value
  pinch = null
  gestureActive.value = false
  gestureMode = 'pan'
  pdfRenderer.value?.setGestureActive(false)
  if (wasZoom && Math.abs(finalScale - startScale) > 0.01) {
    savePdfScale()
    await pdfRenderer.value?.setScale(finalScale)
  }
  gestureScaleRatio = 1
  clearGestureTransform()
}

function onViewerPointerDown(e: PointerEvent) {
  if (bookFileType.value !== 'pdf') return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  // Pen input is handled entirely by the stroke layer — never pan or gesture.
  if (e.pointerType === 'pen') return

  if (e.pointerType === 'touch') {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }

  if (activePointers.size >= 2) {
    // Second finger — cancel any active touch stroke and start gesture
    // BEFORE the SVG can process this event.
    if (!pinch) startGesture()
    e.stopPropagation()
    return
  }

  if (drawTool.value === 'select') {
    startPan(e)
    e.stopPropagation()
  }
  // In pen/highlighter mode: let the event continue to the SVG (drawing)
}

function onViewerPointerMove(e: PointerEvent) {
  if (bookFileType.value !== 'pdf') return
  if (e.pointerType === 'touch' && activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
  }
  if (pinch) { updateGesture(); return }
  if (panning.value) updatePan(e)
}

function onViewerPointerUp(e: PointerEvent) {
  if (bookFileType.value !== 'pdf') return
  if (e.pointerType === 'touch') activePointers.delete(e.pointerId)
  if (pinch) {
    if (activePointers.size < 2) endGesture()
    return
  }
  if (panning.value) endPan()
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

  currentPdfBookId = bookId
  pdfScale.value = loadPdfScaleForBook(bookId)

  await strokesStore.loadForBook(bookId)

  const pr = new PdfRenderer(viewerContainer.value!, fileData, {
    scale: pdfScale.value,
    spreadMode: spreadMode.value,
    drawTool: drawTool.value,
    drawColorIndex: pdfToolbar.value?.drawColorIndex.value ?? 0,
    penWidth: pdfToolbar.value?.penSize.value ?? 1.8,
    highlighterWidth: pdfToolbar.value?.highlighterSize.value ?? 14,
    eraserWidth: pdfToolbar.value?.eraserSize.value ?? 20,
    eraserOpacity: pdfToolbar.value?.eraserOpacity.value ?? 0.4,
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
  pdfRenderer.value = pr

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
        pdfRenderer.value?.resize(width, height)
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
      await pdfRenderer.value?.display(pageNum)
    }
  } else {
    await renderer?.display(href)
  }
}

async function handlePrevPage() {
  if (bookFileType.value === 'pdf') {
    await pdfRenderer.value?.prevPage()
  } else {
    await renderer?.prevPage()
  }
}

async function handleNextPage() {
  if (bookFileType.value === 'pdf') {
    await pdfRenderer.value?.nextPage()
  } else {
    await renderer?.nextPage()
  }
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
  if (pdfRenderer.value) {
    pdfRenderer.value.destroy()
    pdfRenderer.value = null
  }
  toc.value = []
  activeHref.value = null
  activePointers.clear()
  pinch = null
  gestureActive.value = false
  currentPdfBookId = null
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
  if (e.altKey && e.shiftKey && (e.key === 'D' || e.key === 'd')) {
    e.preventDefault()
    pdfToolbar.value?.toggleDebug()
    return
  }
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    handlePrevPage()
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    handleNextPage()
  }
}

// Debug: pen event logging controlled by Settings > Debug > Pen event log
const debugPenDown = (e: PointerEvent) => {
  if (e.pointerType === 'pen') {
    window.alert('[pen pointerdown] pointerType=' + e.pointerType + ' button=' + e.button + ' buttons=' + e.buttons + ' (0b' + e.buttons.toString(2) + ') pressure=' + e.pressure + ' tiltX=' + e.tiltX + ' tiltY=' + e.tiltY)
  }
}
function updatePenDebug(on: boolean) {
  if (on) {
    window.addEventListener('pointerdown', debugPenDown, true)
  } else {
    window.removeEventListener('pointerdown', debugPenDown, true)
  }
}
watch(() => Settings.get('penDebugLog') === true, (on) => updatePenDebug(on), { immediate: true })

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  destroyRenderer()
  window.removeEventListener('keydown', handleKeydown)
  updatePenDebug(false)
})
</script>

<style scoped>
.book-viewer-page { height: 100%; min-height: 0; overflow-y: hidden; background: var(--color-bg-page); display: flex; flex-direction: column; }
.loading-state, .error-state, .empty-state { text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-state h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.empty-state a { color: var(--color-primary); }
.book-header { padding: 0.5rem 2rem; border-bottom: 1px solid var(--color-border-base); flex-shrink: 0; position: relative; z-index: 10; }
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
.viewer-container :deep(.pdf-page-wrapper) { position: relative; margin: 0 auto; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
.viewer-container :deep(.pdf-spread) { display: flex; justify-content: center; gap: 1rem; margin: 0 auto; }
.viewer-container :deep(.pdf-spread .pdf-page-wrapper) { margin: 0; }
.viewer-container :deep(.pdf-text-layer) { position: absolute; left: 0; top: 0; right: 0; bottom: 0; overflow: hidden; opacity: 0.25; line-height: 1.0; }
.viewer-container :deep(.pdf-text-layer > span) { color: transparent; position: absolute; white-space: pre; cursor: text; }
.page-nav { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 2rem; border-top: 1px solid var(--color-border-base); flex-shrink: 0; }
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }
@media (max-width: 768px) {
  .book-header { padding: 0.3rem 0.4rem; }
}
</style>
