<template>
  <div class="pdf-controls">
    <button class="nav-btn tool-btn page-turn-btn" @click="emit('prev')" :disabled="!canGoPrev" title="Previous page">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>
      <span class="page-turn-label">Prev</span>
    </button>
    <button class="nav-btn tool-btn page-turn-btn" @click="emit('next')" :disabled="!canGoNext" title="Next page">
      <span class="page-turn-label">Next</span>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18l6-6-6-6"/></svg>
    </button>
    <span class="ctrl-sep"></span>
    <button class="nav-btn zoom-btn" @click="zoomOut" :disabled="pdfScale <= 0.5" title="Zoom out">−</button>
    <div class="tool-anchor">
      <span class="zoom-info" @click="togglePopover('zoom')" title="Click to adjust zoom">{{ Math.round(pdfScale * 100) }}%</span>
      <div v-if="openPopover === 'zoom'" class="tool-popover" @pointerdown.stop>
        <div class="popover-label">Zoom</div>
        <div class="popover-slider-row">
          <input type="range" class="size-slider" min="50" max="400" step="10" :value="Math.round(pdfScale * 100)" @input="onZoomSliderInput" @change="onZoomChange" />
          <input type="number" class="zoom-num-input" min="50" max="400" :value="Math.round(pdfScale * 100)" @change="onZoomInputChange" />
          <span class="size-unit">%</span>
        </div>
        <div class="popover-presets">
          <button v-for="p in ZOOM_PRESETS" :key="p" class="preset-btn" @click="setZoom(p / 100)">{{ p }}%</button>
        </div>
      </div>
    </div>
    <button class="nav-btn zoom-btn" @click="zoomIn" :disabled="pdfScale >= 4" title="Zoom in">+</button>
    <button class="nav-btn tool-btn" :class="{ active: spreadMode === 'double' }" :title="spreadMode === 'double' ? 'Double-page view' : 'Single-page view'" @click="toggleSpread">
      <svg v-if="spreadMode === 'double'" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="7" height="14" rx="1"/><rect x="14" y="5" width="7" height="14" rx="1"/></svg>
      <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="8" y="5" width="8" height="14" rx="1"/></svg>
    </button>
    <span class="ctrl-sep"></span>
    <div
      v-for="t in DRAW_TOOLS"
      :key="t.tool"
      class="tool-anchor"
    >
      <button
        class="nav-btn tool-btn"
        :class="{ active: drawTool === t.tool }"
        :title="t.hasSettings ? `${t.label} (click again when active for size)` : t.label"
        :aria-label="t.label"
        @click="onToolClick(t.tool)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="t.icon" /></svg>
      </button>
      <div v-if="openPopover === 'pen' && t.tool === 'pen'" class="tool-popover" @pointerdown.stop>
        <div class="popover-label">Pen size</div>
        <div class="popover-slider-row">
          <input type="range" class="size-slider" min="0.5" max="8" step="0.1" :value="penSize" @input="onPenSizeInput" />
          <span class="size-value">{{ penSize.toFixed(1) }}</span>
        </div>
      </div>
      <div v-if="openPopover === 'highlighter' && t.tool === 'highlighter'" class="tool-popover" @pointerdown.stop>
        <div class="popover-label">Highlighter size</div>
        <div class="popover-slider-row">
          <input type="range" class="size-slider" min="4" max="40" step="0.5" :value="highlighterSize" @input="onHighlighterSizeInput" />
          <span class="size-value">{{ highlighterSize.toFixed(1) }}</span>
        </div>
      </div>
      <div v-if="openPopover === 'eraser' && t.tool === 'eraser'" class="tool-popover" @pointerdown.stop>
        <div class="popover-label">Eraser size</div>
        <div class="popover-slider-row">
          <input type="range" class="size-slider" min="5" max="30" step="1" :value="eraserSize" @input="onEraserSizeInput" />
          <span class="size-value">{{ eraserSize.toFixed(0) }}</span>
        </div>
        <div class="popover-label popover-label-secondary">Transparency</div>
        <div class="popover-slider-row">
          <input type="range" class="size-slider" min="0.1" max="1" step="0.05" :value="eraserOpacity" @input="onEraserOpacityInput" />
          <span class="size-value">{{ Math.round(eraserOpacity * 100) }}%</span>
        </div>
      </div>
    </div>
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
              <tr><td>openPopover</td><td>{{ openPopover }}</td></tr>
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
            <div class="debug-section-title">DRAW_TOOLS config</div>
            <table class="debug-table">
              <tr v-for="t in DRAW_TOOLS" :key="t.tool">
                <td>{{ t.tool }}</td>
                <td :class="{ 'debug-active': drawTool === t.tool }">{{ drawTool === t.tool ? '← ACTIVE' : '' }} hasSettings={{ !!t.hasSettings }}</td>
              </tr>
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
            <div class="debug-section-title">Handler code</div>
            <pre class="debug-code">onToolClick(tool) {
  if (drawTool === tool && (tool === 'pen' || tool === 'highlighter')) {
    togglePopover(tool)       // open/close size settings
  } else {
    openPopover = null
    setTool(tool)             // select the tool
  }
}

setTool(tool) {
  drawTool = tool
  Settings.set({ pdfDrawTool: tool })   // cloud sync
  pdfRenderer?.setDrawTool(tool)        // propagate to stroke layers
}</pre>
          </div>

          <div class="debug-section">
            <div class="debug-section-title">Event log (most recent first)</div>
            <div v-if="debugLog.length === 0" class="debug-empty">No events yet — click toolbar buttons</div>
            <div v-for="(line, i) in debugLog" :key="i" class="debug-log-line">{{ line }}</div>
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
import { STROKE_COLORS, type DrawTool } from '@/services/strokeLayer'
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

function loadDrawColor(): number {
  const v = Settings.get('pdfDrawColor')
  return typeof v === 'number' && v >= 0 && v <= 4 ? v : 0
}
const drawColorIndex = ref<number>(loadDrawColor())
const openPopover = ref<null | 'pen' | 'highlighter' | 'eraser' | 'zoom'>(null)

function loadPenSize(): number {
  const v = Settings.get('pdfPenSize')
  return typeof v === 'number' && v >= 0.5 && v <= 8 ? v : 1.8
}
const penSize = ref<number>(loadPenSize())

function loadHighlighterSize(): number {
  const v = Settings.get('pdfHighlighterSize')
  return typeof v === 'number' && v >= 4 && v <= 40 ? v : 14
}
const highlighterSize = ref<number>(loadHighlighterSize())

function loadEraserSize(): number {
  const v = Settings.get('pdfEraserSize')
  return typeof v === 'number' && v >= 5 && v <= 30 ? v : 20
}
const eraserSize = ref<number>(loadEraserSize())

function loadEraserOpacity(): number {
  const v = Settings.get('pdfEraserOpacity')
  return typeof v === 'number' && v >= 0.1 && v <= 1 ? v : 0.4
}
const eraserOpacity = ref<number>(loadEraserOpacity())

const ZOOM_PRESETS = [75, 100, 150, 200]

const DRAW_TOOLS: { tool: DrawTool; label: string; icon: string; hasSettings?: boolean }[] = [
  { tool: 'select', label: 'Select', icon: 'M5 3l5.5 15.5L13 12l6.5-2.5z' },
  { tool: 'pen', label: 'Pen', icon: 'M16 3l5 5L8 21H3v-5z', hasSettings: true },
  { tool: 'highlighter', label: 'Highlighter', icon: 'M9 11l3-3 5 5-3 3zM6 14l3 3-2.5 2.5H3.5V17z', hasSettings: true },
  { tool: 'eraser', label: 'Eraser', icon: 'M5 19h14M9 15l5-5 5 5-5 5z', hasSettings: true },
]

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
const debugLog = ref<string[]>([])
function debugPush(msg: string): void {
  const ts = new Date().toLocaleTimeString()
  debugLog.value.unshift(`[${ts}] ${msg}`)
  if (debugLog.value.length > 30) debugLog.value.pop()
}
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

// Tool handlers
function setTool(tool: DrawTool): void {
  debugPush(`setTool('${tool}') → renderer=${props.pdfRenderer ? 'exists' : 'null'}`)
  drawTool.value = tool
  Settings.set({ pdfDrawTool: tool })
  props.pdfRenderer?.setDrawTool(tool)
}

function onToolClick(tool: DrawTool): void {
  debugPush(`onToolClick('${tool}') — drawTool was '${drawTool.value}'`)
  if (drawTool.value === tool && (tool === 'pen' || tool === 'highlighter' || tool === 'eraser')) {
    togglePopover(tool)
    debugPush(`  → togglePopover('${tool}') → openPopover='${openPopover.value}'`)
  } else {
    openPopover.value = null
    setTool(tool)
  }
}

function setStrokeColor(i: number): void {
  drawColorIndex.value = i
  Settings.set({ pdfDrawColor: i })
  props.pdfRenderer?.setDrawColor(i)
}

function togglePopover(tool: 'pen' | 'highlighter' | 'eraser' | 'zoom'): void {
  openPopover.value = openPopover.value === tool ? null : tool
}

function onPenSizeInput(e: Event): void {
  penSize.value = Number((e.target as HTMLInputElement).value)
  Settings.set({ pdfPenSize: penSize.value })
  props.pdfRenderer?.setPenWidth(penSize.value)
}

function onHighlighterSizeInput(e: Event): void {
  highlighterSize.value = Number((e.target as HTMLInputElement).value)
  Settings.set({ pdfHighlighterSize: highlighterSize.value })
  props.pdfRenderer?.setHighlighterWidth(highlighterSize.value)
}

function onEraserSizeInput(e: Event): void {
  eraserSize.value = Number((e.target as HTMLInputElement).value)
  Settings.set({ pdfEraserSize: eraserSize.value })
  props.pdfRenderer?.setEraserWidth(eraserSize.value)
}

function onEraserOpacityInput(e: Event): void {
  eraserOpacity.value = Number((e.target as HTMLInputElement).value)
  Settings.set({ pdfEraserOpacity: eraserOpacity.value })
  props.pdfRenderer?.setEraserOpacity(eraserOpacity.value)
}

// Zoom handlers — notify BookViewer to persist after a toolbar-initiated change
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

// Close popovers on outside click
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
.nav-btn { padding: 0.4rem 1rem; background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 4px; color: var(--color-text-message); cursor: pointer; }
.nav-btn:hover:not(:disabled) { background: var(--color-bg-hover); }
.nav-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.page-info { font-size: 0.85rem; color: var(--color-text-muted); }
.zoom-btn { padding: 0.3rem 0.6rem; min-width: 2rem; }
.zoom-info { font-size: 0.8rem; color: var(--color-text-muted); min-width: 3rem; text-align: center; cursor: pointer; user-select: none; }
.zoom-info:hover { color: var(--color-text-base); }
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
.tool-anchor { position: relative; display: inline-flex; align-items: center; }
.tool-popover {
  position: absolute; top: calc(100% + 8px); left: 50%; transform: translateX(-50%);
  background: var(--color-bg-base); border: 1px solid var(--color-border-base); border-radius: 8px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.18); padding: 0.7rem 0.85rem; z-index: 200; min-width: 230px;
}
.popover-label { font-size: 0.72rem; color: var(--color-text-muted); margin-bottom: 0.45rem; text-transform: uppercase; letter-spacing: 0.04em; }
.popover-label-secondary { margin-top: 0.7rem; }
.popover-slider-row { display: flex; align-items: center; gap: 0.5rem; }
.size-slider { flex: 1; cursor: pointer; accent-color: var(--color-primary, var(--color-text-message)); }
.size-value { font-size: 0.8rem; color: var(--color-text-base); min-width: 2rem; text-align: right; font-variant-numeric: tabular-nums; }
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
  .pdf-controls .tool-btn { padding: 0.2rem; }
  .pdf-controls .tool-btn svg { width: 14px; height: 14px; }
  .pdf-controls .zoom-btn { padding: 0.2rem 0.4rem; min-width: 1.5rem; }
  .pdf-controls .zoom-info { min-width: 2.4rem; font-size: 0.75rem; }
  .pdf-controls .color-circle { width: 14px; height: 14px; }
  .pdf-controls .ctrl-sep { display: none; }
  .pdf-controls .page-info { font-size: 0.75rem; }
  .pdf-controls .tool-popover { min-width: 200px; }
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
.debug-active { font-weight: bold; color: var(--color-primary, #2f80d6); }
.debug-empty { color: var(--color-text-muted, #999); font-style: italic; }
.debug-layer { font-family: monospace; font-size: 0.75rem; padding: 0.2rem 0; border-bottom: 1px solid var(--color-border-base, #f0f0f0); word-break: break-all; }
.debug-code { background: var(--color-bg-hover, #f5f5f5); border-radius: 4px; padding: 0.6rem; font-family: 'SF Mono', Menlo, monospace; font-size: 0.72rem; white-space: pre-wrap; word-break: break-all; max-height: 200px; overflow-y: auto; line-height: 1.4; }
.debug-log-line { font-family: monospace; font-size: 0.72rem; padding: 0.1rem 0; color: var(--color-text-base, #333); }
.debug-refresh { font-size: 0.7rem; padding: 0.15rem 0.5rem; border: 1px solid var(--color-border-base, #ddd); border-radius: 4px; background: var(--color-bg-base, #fff); cursor: pointer; }
.debug-refresh:hover { background: var(--color-bg-hover, #f5f5f5); }
</style>
