<template>
  <AppLayout storage-key="sidebar" side-tab-label="Pages">
    <template #side>
      <SketchPagesSidebar
        :notebook-key="notebookKey"
        :current-page="currentPage"
        :page-count="sketchbook?.pageCount ?? 1"
        @select="goToPage"
        @add="nextPage"
        @delete="deletePage"
      />
    </template>
    <div class="notebook-page-view">
      <div class="notebook-header">
        <DrawToolbar
          v-model:draw-tool="drawTool"
          v-model:draw-color-index="drawColorIndex"
          v-model:pen-size="penSize"
          v-model:highlighter-size="highlighterSize"
          v-model:eraser-size="eraserSize"
          v-model:eraser-opacity="eraserOpacity"
        />
        <span class="tb-sep"></span>
        <button class="tb-btn" @click="undo" :disabled="!canUndo" title="Undo last stroke">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
        </button>
        <button class="tb-btn danger" @click="confirmClear" :disabled="pageStrokeCount === 0" title="Clear page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
        <span class="tb-sep"></span>
        <button class="tb-btn" @click="prevPage" :disabled="currentPage <= 1" title="Previous page">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
        </button>
        <span class="tb-page-info">{{ currentPage }}</span>
        <button class="tb-btn" @click="nextPage" :title="isLastPage ? 'Add page' : 'Next page'">
          <svg v-if="isLastPage" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
          <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
        </button>
      </div>
      <div
        class="notebook-scroll"
        ref="scrollEl"
        :style="{ cursor: scrollCursor }"
        @pointerdown.capture="onScrollPointerDown"
        @pointermove="onScrollPointerMove"
        @pointerup="onScrollPointerUp"
        @pointercancel="onScrollPointerUp"
      >
        <div class="notebook-paper" ref="canvasEl"></div>
      </div>
      <Transition name="fade">
        <div v-if="showClearConfirm" class="clear-confirm" @click.self="showClearConfirm = false">
          <div class="clear-dialog">
            <p>Clear all strokes on this page?</p>
            <div class="clear-actions">
              <button class="tb-btn" @click="showClearConfirm = false">Cancel</button>
              <button class="tb-btn danger solid" @click="clearPage">Clear</button>
            </div>
          </div>
        </div>
      </Transition>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import DrawToolbar from '@/components/DrawToolbar.vue'
import SketchPagesSidebar from '@/components/SketchPagesSidebar.vue'
import { useStrokeCanvas } from '@/composables/useStrokeCanvas'
import { useStrokesStore } from '@/stores/strokes'
import { useSketchbooksStore } from '@/stores/sketchbooks'
import { Settings } from '@/services/settings'
import { sketchbookKey, PAGE_WIDTH, PAGE_HEIGHT } from '@/types/sketchbook'
import type { DrawTool } from '@/services/strokeLayer'
import type { StrokeDraft } from '@/types/stroke'

const route = useRoute()
const strokesStore = useStrokesStore()
const sketchbooksStore = useSketchbooksStore()

const sketchbookId = computed(() => route.params.id as string)
const notebookKey = computed(() => sketchbookKey(sketchbookId.value))
const sketchbook = computed(() =>
  sketchbooksStore.list.find(s => s.id === sketchbookId.value),
)

const currentPage = ref(1)
const canvasEl = ref<HTMLElement | null>(null)
const scrollEl = ref<HTMLElement | null>(null)
const showClearConfirm = ref(false)

const panning = ref(false)
const panStart = { x: 0, y: 0, left: 0, top: 0 }
let panPointerId: number | null = null

function onScrollPointerDown(e: PointerEvent): void {
  if (drawTool.value !== 'select') return
  if (e.pointerType === 'pen') return
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const el = scrollEl.value
  if (!el) return
  e.preventDefault()
  e.stopPropagation()
  panStart.x = e.clientX
  panStart.y = e.clientY
  panStart.left = el.scrollLeft
  panStart.top = el.scrollTop
  panning.value = true
  panPointerId = e.pointerId
  try { el.setPointerCapture?.(e.pointerId) } catch {}
}

function onScrollPointerMove(e: PointerEvent): void {
  if (!panning.value || panPointerId !== e.pointerId) return
  const el = scrollEl.value
  if (!el) return
  el.scrollLeft = panStart.left - (e.clientX - panStart.x)
  el.scrollTop = panStart.top - (e.clientY - panStart.y)
}

function onScrollPointerUp(e: PointerEvent): void {
  if (panPointerId !== e.pointerId) return
  panning.value = false
  const el = scrollEl.value
  if (el) { try { el.releasePointerCapture?.(e.pointerId) } catch {} }
  panPointerId = null
}

function numSetting(key: 'pdfDrawColor' | 'pdfPenSize' | 'pdfHighlighterSize' | 'pdfEraserSize' | 'pdfEraserOpacity', fallback: number): number {
  const v = Settings.get(key)
  return typeof v === 'number' ? v : fallback
}
function loadDrawTool(): DrawTool {
  const v = Settings.get('pdfDrawTool')
  return v === 'pen' || v === 'highlighter' || v === 'eraser' ? v : 'pen'
}

const drawTool = ref<DrawTool>(loadDrawTool())
const drawColorIndex = ref<number>(numSetting('pdfDrawColor', 0))
const penSize = ref<number>(numSetting('pdfPenSize', 1.8))
const highlighterSize = ref<number>(numSetting('pdfHighlighterSize', 14))
const eraserSize = ref<number>(numSetting('pdfEraserSize', 20))
const eraserOpacity = ref<number>(numSetting('pdfEraserOpacity', 0.4))

watch(drawTool, (v) => Settings.set({ pdfDrawTool: v }))
watch(drawColorIndex, (v) => Settings.set({ pdfDrawColor: v }))
watch(penSize, (v) => Settings.set({ pdfPenSize: v }))
watch(highlighterSize, (v) => Settings.set({ pdfHighlighterSize: v }))
watch(eraserSize, (v) => Settings.set({ pdfEraserSize: v }))
watch(eraserOpacity, (v) => Settings.set({ pdfEraserOpacity: v }))

const pageStrokes = computed(() => strokesStore.forPage(notebookKey.value, currentPage.value))
const pageStrokeCount = computed(() => pageStrokes.value.length)
const canUndo = computed(() => pageStrokeCount.value > 0)
const isLastPage = computed(() => currentPage.value >= (sketchbook.value?.pageCount ?? 1))
const scrollCursor = computed(() => {
  if (panning.value) return 'grabbing'
  if (drawTool.value === 'select') return 'grab'
  return 'default'
})

function handleCreate(draft: StrokeDraft): void {
  strokesStore.add(notebookKey.value, { ...draft, page: currentPage.value })
  sketchbooksStore.touch(sketchbookId.value)
  sketchbooksStore.persist(sketchbookId.value)
}
function handleErase(id: string): void {
  strokesStore.remove(notebookKey.value, id)
  sketchbooksStore.touch(sketchbookId.value)
  sketchbooksStore.persist(sketchbookId.value)
}

const {
  setTool, setColor, setPenWidth, setHighlighterWidth, setEraserWidth, setEraserOpacity,
  setPage, redraw,
} = useStrokeCanvas(canvasEl, {
  logicalWidth: PAGE_WIDTH,
  logicalHeight: PAGE_HEIGHT,
  page: currentPage.value,
  tool: drawTool.value,
  colorIndex: drawColorIndex.value,
  penWidth: penSize.value,
  highlighterWidth: highlighterSize.value,
  eraserWidth: eraserSize.value,
  eraserOpacity: eraserOpacity.value,
  getStrokes: () => pageStrokes.value,
  onCreate: handleCreate,
  onErase: handleErase,
})

watch(drawTool, (v) => setTool(v))
watch(drawColorIndex, (v) => setColor(v))
watch(penSize, (v) => setPenWidth(v))
watch(highlighterSize, (v) => setHighlighterWidth(v))
watch(eraserSize, (v) => setEraserWidth(v))
watch(eraserOpacity, (v) => setEraserOpacity(v))

function undo(): void {
  strokesStore.removeLastOnPage(notebookKey.value, currentPage.value)
  redraw()
}

function confirmClear(): void {
  showClearConfirm.value = true
}

function clearPage(): void {
  showClearConfirm.value = false
  const ids = pageStrokes.value.map(s => s.id)
  Promise.all(ids.map(id => strokesStore.remove(notebookKey.value, id))).then(() => redraw())
}

function goToPage(page: number): void {
  if (page < 1) return
  currentPage.value = page
  setPage(page)
}

function prevPage(): void {
  if (currentPage.value <= 1) return
  currentPage.value--
  setPage(currentPage.value)
}

async function nextPage(): Promise<void> {
  currentPage.value++
  setPage(currentPage.value)
  await sketchbooksStore.ensurePageCount(sketchbookId.value, currentPage.value)
}

async function deletePage(page: number): Promise<void> {
  await strokesStore.deletePage(notebookKey.value, page)
  const pageCount = (sketchbook.value?.pageCount ?? 1) - 1
  sketchbooksStore.setPageCount(sketchbookId.value, Math.max(1, pageCount))
  if (currentPage.value > pageCount) {
    currentPage.value = Math.max(1, pageCount)
    setPage(currentPage.value)
  } else {
    redraw()
  }
}

onMounted(async () => {
  await Promise.all([
    sketchbooksStore.load(),
    strokesStore.loadForBook(notebookKey.value),
  ])
  redraw()
})
</script>

<style scoped>
.notebook-page-view { height: 100%; min-height: 0; display: flex; flex-direction: column; background: var(--color-bg-page); }
.notebook-header {
  display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.4rem;
  padding: 0.5rem 1rem; border-bottom: 1px solid var(--color-border-base); flex-shrink: 0; position: relative; z-index: 10;
}
.notebook-scroll { flex: 1; min-height: 0; overflow: auto; display: flex; justify-content: center; align-items: flex-start; padding: 1.5rem; }
.notebook-paper {
  width: 100%; max-width: 820px; aspect-ratio: 794 / 1123;
  background: #fff; position: relative; box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  border-radius: 2px; touch-action: none; flex-shrink: 0; overflow: hidden;
}
.notebook-paper :deep(svg.pdf-draw-layer) { border-radius: 2px; }
.clear-confirm { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999; display: flex; align-items: center; justify-content: center; }
.clear-dialog { background: var(--color-bg-base, #fff); border-radius: 8px; padding: 1.5rem; box-shadow: 0 8px 32px rgba(0,0,0,0.3); min-width: 280px; }
.clear-dialog p { margin: 0 0 1rem; color: var(--color-text-message, #333); }
.clear-actions { display: flex; justify-content: flex-end; gap: 0.5rem; }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
@media (max-width: 768px) {
  .notebook-header { padding: 0.3rem 0.4rem; gap: 0.15rem; flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; }
  .notebook-header::-webkit-scrollbar { display: none; }
  .notebook-scroll { padding: 0.5rem; }
}
</style>
