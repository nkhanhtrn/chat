<template>
  <div class="pdf-controls">
    <button class="tb-btn" @click="emit('prev')" :disabled="!canGoPrev" title="Previous page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      <span class="page-turn-label">Prev</span>
    </button>
    <button class="tb-btn" @click="emit('next')" :disabled="!canGoNext" title="Next page">
      <span class="page-turn-label">Next</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <span class="tb-sep"></span>
    <button class="tb-btn zoom-btn" @click="zoomOut" :disabled="pdfScale <= 0.5" title="Zoom out">−</button>
    <div class="tb-anchor">
      <span class="zoom-info" @click="togglePopover('zoom')" title="Click to adjust zoom">{{ Math.round(pdfScale * 100) }}%</span>
      <div v-if="openPopover === 'zoom'" class="tb-popover" @pointerdown.stop>
        <div class="tb-popover-label">Zoom</div>
        <div class="tb-slider-row">
          <input type="range" class="tb-slider" min="50" max="400" step="10" :value="Math.round(pdfScale * 100)" @input="onZoomSliderInput" @change="onZoomChange" />
          <input type="number" class="zoom-num-input" min="50" max="400" :value="Math.round(pdfScale * 100)" @change="onZoomInputChange" />
          <span class="size-unit">%</span>
        </div>
        <div class="popover-presets">
          <button v-for="p in ZOOM_PRESETS" :key="p" class="preset-btn" @click="setZoom(p / 100)">{{ p }}%</button>
        </div>
      </div>
    </div>
    <button class="tb-btn zoom-btn" @click="zoomIn" :disabled="pdfScale >= 4" title="Zoom in">+</button>
    <button class="tb-btn" :class="{ active: spreadMode === 'double' }" :title="spreadMode === 'double' ? 'Double-page view' : 'Single-page view'" @click="toggleSpread">
      <svg v-if="spreadMode === 'double'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="5" width="8" height="14" rx="1"/></svg>
    </button>
    <span class="tb-sep"></span>
    <DrawToolbar
      v-model:draw-tool="drawTool"
      v-model:draw-color-index="drawColorIndex"
      v-model:pen-size="penSize"
      v-model:highlighter-size="highlighterSize"
      v-model:eraser-size="eraserSize"
      v-model:eraser-opacity="eraserOpacity"
    />
    <span class="tb-sep"></span>
    <span class="tb-page-info page-info-full">{{ pageDisplayText }}</span>
    <span class="tb-page-info page-info-short">{{ pageDisplayShort }}</span>
  </div>
  <Teleport to="body">
    <div v-if="showDebugDialog" class="debug-overlay" @click.self="showDebugDialog = false">
      <div class="debug-dialog">
        <div class="debug-header">
          <strong>PDF Toolbar Debug</strong>
          <button class="debug-close" @click="showDebugDialog = false">×</button>
        </div>
        <div class="debug-body">
          <div class="debug-section">
            <div class="debug-section-title">State <button class="debug-refresh" @click="refreshDebugDom">Refresh DOM</button></div>
            <table class="debug-table">
              <tr><td>drawTool</td><td>{{ drawTool }}</td></tr>
              <tr><td>drawColorIndex</td><td>{{ drawColorIndex }}</td></tr>
              <tr><td>penSize</td><td>{{ penSize }}</td></tr>
              <tr><td>highlighterSize</td><td>{{ highlighterSize }}</td></tr>
              <tr><td>eraserSize</td><td>{{ eraserSize }}</td></tr>
              <tr><td>pdfScale</td><td>{{ pdfScale }}</td></tr>
              <tr><td>spreadMode</td><td>{{ spreadMode }}</td></tr>
              <tr><td>pdfRenderer</td><td>{{ pdfRenderer ? 'exists' : 'null' }}</td></tr>
            </table>
          </div>

          <div class="debug-section">
            <div class="debug-section-title">Stroke layers (renderer)</div>
            <div v-if="strokeLayerDebug.length === 0" class="debug-empty">No stroke layers</div>
            <div v-for="(info, i) in strokeLayerDebug" :key="i" class="debug-layer">
              <span>layer[{{ i }}]:</span>
              tool={{ info.tool }} | pointerEvents={{ info.pointerEvents }} | cursor="{{ info.cursor }}" | strokes={{ info.strokeCount }} | hits={{ info.hitTargetCount }} | destroyed={{ info.destroyed }}
            </div>
          </div>

          <div class="debug-section">
            <div class="debug-section-title">Rendered DOM (.pdf-controls)</div>
            <pre class="debug-code">{{ debugDomSnapshot }}</pre>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onBeforeUnmount } from 'vue'
import { type DrawTool } from '@/services/strokeLayer'
import DrawToolbar from '@/components/DrawToolbar.vue'
import { useDrawSettings } from '@/composables/useDrawSettings'
import { type PdfRenderer, type SpreadMode } from '@/services/pdfRenderer'
import { Settings, type SettingsData } from '@/services/settings'

const props = defineProps<{
  pdfRenderer: PdfRenderer | null
  currentPage: number
  totalPages: number
  pageEnd?: number
  canGoPrev: boolean
  canGoNext: boolean
}>()

const emit = defineEmits<{
  prev: []
  next: []
  scaleChange: []
}>()

// Two-way bound with BookViewer — gestures/renderPdf read & write these
const pdfScale = defineModel<number>('pdfScale', { default: 1.0 })
const drawTool = defineModel<DrawTool>('drawTool', { default: 'select' })
const spreadMode = defineModel<SpreadMode>('spreadMode', { default: 'auto' })

// One-time migration from legacy localStorage keys to cloud-synced Settings
function migrateLegacyPdfSettings(): void {
  if (typeof localStorage === 'undefined') return
  const pairs: [string, string][] = [
    ['pdf-draw-tool', 'pdfDrawTool'],
    ['pdf-pen-size', 'pdfPenSize'],
    ['pdf-highlighter-size', 'pdfHighlighterSize'],
    ['pdf-spread-mode', 'pdfSpreadMode'],
  ]
  for (const [oldKey, settingsKey] of pairs) {
    const v = localStorage.getItem(oldKey)
    if (v === null) continue
    if (Settings.get(settingsKey as keyof typeof Settings) === undefined) {
      const parsed = isNaN(Number(v)) ? v : Number(v)
      Settings.set({ [settingsKey]: parsed } as Partial<SettingsData>)
    }
    try { localStorage.removeItem(oldKey) } catch {}
  }
}
migrateLegacyPdfSettings()

const { drawColorIndex, penSize, highlighterSize, eraserSize, eraserOpacity } = useDrawSettings()
const openPopover = ref<null | 'zoom'>(null)

const ZOOM_PRESETS = [75, 100, 150, 200]

const pageDisplayText = computed(() => {
  if (props.pageEnd && props.pageEnd !== props.currentPage) {
    return `Pages ${props.currentPage}\u2013${props.pageEnd} of ${props.totalPages}`
  }
  return `Page ${props.currentPage} of ${props.totalPages}`
})

const pageDisplayShort = computed(() => {
  if (props.pageEnd && props.pageEnd !== props.currentPage) {
    return `${props.currentPage}\u2013${props.pageEnd}/${props.totalPages}`
  }
  return `${props.currentPage}/${props.totalPages}`
})

// Debug dialog
const showDebugDialog = ref(false)
const debugDomSnapshot = ref('')
function refreshDebugDom(): void {
  debugDomSnapshot.value = document.querySelector('.pdf-controls')?.outerHTML ?? '(.pdf-controls not found)'
}

const strokeLayerDebug = computed<Record<string, unknown>[]>(() => {
  if (!showDebugDialog.value) return []
  return props.pdfRenderer?.getStrokeLayerDebug() ?? []
})

function toggleDebug(): void {
  showDebugDialog.value = !showDebugDialog.value
  if (showDebugDialog.value) refreshDebugDom()
}

// Propagate drawing settings to the renderer (Settings persistence handled by useDrawSettings)
watch(drawTool, (tool) => { props.pdfRenderer?.setDrawTool(tool) })
watch(drawColorIndex, (i) => { props.pdfRenderer?.setDrawColor(i) })
watch(penSize, (v) => { props.pdfRenderer?.setPenWidth(v) })
watch(highlighterSize, (v) => { props.pdfRenderer?.setHighlighterWidth(v) })
watch(eraserSize, (v) => { props.pdfRenderer?.setEraserWidth(v) })
watch(eraserOpacity, (v) => { props.pdfRenderer?.setEraserOpacity(v) })

// Zoom popover
function togglePopover(tool: 'zoom'): void {
  openPopover.value = openPopover.value === tool ? null : tool
}

function onZoomSliderInput(e: Event): void {
  const pct = Number((e.target as HTMLInputElement).value)
  pdfScale.value = pct / 100
  emit('scaleChange')
}

function onZoomChange(): void {
  props.pdfRenderer?.setScale(pdfScale.value)
}

function onZoomInputChange(e: Event): void {
  const pct = Number((e.target as HTMLInputElement).value)
  const clamped = Math.max(50, Math.min(400, Number.isNaN(pct) ? 100 : pct))
  pdfScale.value = clamped / 100
  props.pdfRenderer?.setScale(pdfScale.value)
  emit('scaleChange')
}

function setZoom(scale: number): void {
  pdfScale.value = Math.max(0.5, Math.min(4, scale))
  props.pdfRenderer?.setScale(pdfScale.value)
  emit('scaleChange')
  openPopover.value = null
}

function zoomIn(): void {
  pdfScale.value = Math.min(4, Math.floor(pdfScale.value * 10) / 10 + 0.1)
  props.pdfRenderer?.setScale(pdfScale.value)
  emit('scaleChange')
}

function zoomOut(): void {
  pdfScale.value = Math.max(0.5, Math.ceil(pdfScale.value * 10) / 10 - 0.1)
  props.pdfRenderer?.setScale(pdfScale.value)
  emit('scaleChange')
}

function toggleSpread(): void {
  spreadMode.value = spreadMode.value === 'double' ? 'single' : 'double'
  Settings.set({ pdfSpreadMode: spreadMode.value })
  props.pdfRenderer?.setSpreadMode(spreadMode.value)
}

function onPopoverOutsideClick(e: PointerEvent): void {
  if (openPopover.value === null) return
  const target = e.target as HTMLElement | null
  if (!target?.closest('.tool-popover') && !target?.closest('.tool-anchor')) {
    openPopover.value = null
  }
}

watch(openPopover, (val, oldVal) => {
  if (val && !oldVal) {
    window.addEventListener('pointerdown', onPopoverOutsideClick)
  } else if (!val && oldVal) {
    window.removeEventListener('pointerdown', onPopoverOutsideClick)
  }
})

// Push all tool sizes to the renderer when it becomes available (handles
// timing where renderPdf reads pdfToolbar before it's fully mounted)
watch(() => props.pdfRenderer, (r) => {
  if (!r) return
  r.setDrawTool(drawTool.value)
  r.setPenWidth(penSize.value)
  r.setHighlighterWidth(highlighterSize.value)
  r.setEraserWidth(eraserSize.value)
  r.setEraserOpacity(eraserOpacity.value)
  r.setDrawColor(drawColorIndex.value)
})

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPopoverOutsideClick)
})

defineExpose({
  drawColorIndex,
  penSize,
  highlighterSize,
  eraserSize,
  eraserOpacity,
  toggleDebug,
})
</script>

<style scoped>
.pdf-controls { display: flex; align-items: center; justify-content: center; flex-wrap: wrap; gap: 0.4rem; }
.zoom-btn { padding: 0.3rem 0.6rem; min-width: 2rem; }
.zoom-info { font-size: 0.8rem; color: var(--color-text-muted); min-width: 3rem; text-align: center; cursor: pointer; user-select: none; }
.zoom-info:hover { color: var(--color-text-base); }
.page-turn-label { font-size: 0.8rem; color: var(--color-text-message); white-space: nowrap; margin: 0 0.15rem; }
.size-unit { font-size: 0.8rem; color: var(--color-text-muted); }
.zoom-num-input { width: 3.5rem; padding: 0.2rem 0.35rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-base); color: var(--color-text-base); font-size: 0.8rem; text-align: center; }
.zoom-num-input:focus { outline: none; border-color: var(--color-border-accent, var(--color-primary)); }
.popover-presets { display: flex; gap: 0.3rem; margin-top: 0.6rem; }
.preset-btn { flex: 1; padding: 0.25rem 0; font-size: 0.75rem; border: 1px solid var(--color-border-base); border-radius: 4px; background: var(--color-bg-base); color: var(--color-text-base); cursor: pointer; }
.preset-btn:hover { background: var(--color-bg-hover); }
.page-info-short { display: none; }
@media (max-width: 768px) {
  .pdf-controls { flex-wrap: nowrap; overflow-x: auto; justify-content: space-between; gap: 0.15rem; scrollbar-width: none; }
  .pdf-controls::-webkit-scrollbar { display: none; }
  .pdf-controls .zoom-btn { padding: 0.2rem 0.4rem; min-width: 1.5rem; }
  .pdf-controls .zoom-info { min-width: 2.4rem; font-size: 0.75rem; }
  .pdf-controls .tb-sep { display: none; }
  .pdf-controls .tb-page-info { font-size: 0.75rem; }
  .page-info-full { display: none; }
  .page-info-short { display: inline; }
}
.debug-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); z-index: 9999; display: flex; align-items: flex-start; justify-content: center; padding-top: 3vh; }
.debug-dialog { background: var(--color-bg-base, #fff); border-radius: 8px; width: 90%; max-width: 700px; max-height: 90vh; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 8px 32px rgba(0,0,0,0.3); }
.debug-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border-base, #ddd); }
.debug-close { background: none; border: none; font-size: 1.4rem; cursor: pointer; color: var(--color-text-muted, #666); line-height: 1; padding: 0 0.25rem; }
.debug-body { padding: 1rem; overflow-y: auto; font-size: 0.82rem; }
.debug-section { margin-bottom: 1.25rem; }
.debug-section-title { font-weight: 600; margin-bottom: 0.4rem; color: var(--color-text-message, #333); display: flex; justify-content: space-between; align-items: center; }
.debug-table { border-collapse: collapse; }
.debug-table td { padding: 0.15rem 0.5rem; border-bottom: 1px solid var(--color-border-base, #eee); }
.debug-table td:first-child { color: var(--color-text-muted, #888); white-space: nowrap; }
.debug-empty { color: var(--color-text-muted, #999); font-style: italic; }
.debug-layer { font-family: monospace; font-size: 0.75rem; padding: 0.2rem 0; border-bottom: 1px solid var(--color-border-base, #f0f0f0); word-break: break-all; }
.debug-code { background: var(--color-bg-hover, #f5f5f5); border-radius: 4px; padding: 0.6rem; font-family: 'SF Mono', Menlo, monospace; font-size: 0.72rem; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; line-height: 1.4; }
.debug-refresh { font-size: 0.7rem; padding: 0.15rem 0.5rem; border: 1px solid var(--color-border-base, #ddd); border-radius: 4px; background: var(--color-bg-base, #fff); cursor: pointer; }
.debug-refresh:hover { background: var(--color-bg-hover, #f5f5f5); }
</style>
