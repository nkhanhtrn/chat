<template>
  <div class="side-sketch">
    <div class="side-sketch-toolbar">
      <DrawToolbar
        v-model:draw-tool="drawTool"
        v-model:draw-color-index="drawColorIndex"
        v-model:pen-size="penSize"
        v-model:highlighter-size="highlighterSize"
        v-model:eraser-size="eraserSize"
        v-model:eraser-opacity="eraserOpacity"
        :show-select-tool="false"
      />
      <span class="tb-sep"></span>
      <button class="tb-btn" @click="undo" :disabled="!canUndo" title="Undo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/></svg>
      </button>
      <button class="tb-btn danger" @click="showClearConfirm = true" :disabled="strokeCount === 0" title="Clear all">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
      </button>
    </div>
    <div class="side-sketch-canvas-wrap">
      <div ref="canvasEl" class="side-sketch-canvas"></div>
    </div>
    <Transition name="fade">
      <div v-if="showClearConfirm" class="clear-overlay" @click.self="showClearConfirm = false">
        <div class="clear-dialog">
          <p>Clear all sketches on this page?</p>
          <div class="clear-actions">
            <button class="tb-btn" @click="showClearConfirm = false">Cancel</button>
            <button class="tb-btn danger solid" @click="clearAll">Clear</button>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import DrawToolbar from '@/components/DrawToolbar.vue'
import { useStrokeCanvas } from '@/composables/useStrokeCanvas'
import { useDrawSettings } from '@/composables/useDrawSettings'
import { useStrokesStore } from '@/stores/strokes'
import { GLOBAL_SCOPE } from '@/stores/sideChat'

const SKETCH_W = 800
const SKETCH_H = 1100

const route = useRoute()
const strokesStore = useStrokesStore()
const { drawTool, drawColorIndex, penSize, highlighterSize, eraserSize, eraserOpacity } = useDrawSettings()

const canvasEl = ref<HTMLElement | null>(null)
const showClearConfirm = ref(false)

const sketchKey = ref<string>(`side-sketch:${GLOBAL_SCOPE}`)

const desiredKey = computed(() => {
  const name = route.name as string
  if (name === 'book-viewer' && route.params.bookId) {
    return `side-sketch:book-${route.params.bookId}`
  }
  if (name === 'notebook' && route.params.id) {
    return `side-sketch:notebook-${route.params.id}`
  }
  if (name === 'sketchbook' && route.params.id) {
    return `side-sketch:sketchbook-${route.params.id}`
  }
  if ((name === 'project-detail' || name === 'project-subproject') && route.params.id) {
    const sub = route.params.subId ? `-${route.params.subId}` : ''
    return `side-sketch:project-${route.params.id}${sub}`
  }
  return `side-sketch:${GLOBAL_SCOPE}`
})

const strokeCount = computed(() => strokesStore.byBook[sketchKey.value]?.length ?? 0)
const canUndo = computed(() => strokeCount.value > 0)

function getStrokes() {
  return strokesStore.byBook[sketchKey.value] ?? []
}

const canvas = useStrokeCanvas(canvasEl, {
  logicalWidth: SKETCH_W,
  logicalHeight: SKETCH_H,
  page: 0,
  tool: drawTool.value === 'select' ? 'pen' : drawTool.value,
  colorIndex: drawColorIndex.value,
  penSize: penSize.value,
  highlighterSize: highlighterSize.value,
  eraserSize: eraserSize.value,
  eraserOpacity: eraserOpacity.value,
  getStrokes,
  onCreate: (draft) => { strokesStore.add(sketchKey.value, draft) },
  onErase: (id) => { strokesStore.remove(sketchKey.value, id) },
})

watch(drawTool, (t) => canvas.setTool(t === 'select' ? 'pen' : t))
watch(drawColorIndex, (c) => canvas.setColor(c))
watch(penSize, (v) => canvas.setPenWidth(v))
watch(highlighterSize, (v) => canvas.setHighlighterWidth(v))
watch(eraserSize, (v) => canvas.setEraserWidth(v))
watch(eraserOpacity, (v) => canvas.setEraserOpacity(v))

onMounted(async () => {
  if (drawTool.value === 'select') drawTool.value = 'pen'
  sketchKey.value = desiredKey.value
  await strokesStore.loadForBook(desiredKey.value)
  canvas.redraw()
})

watch(desiredKey, async (key) => {
  sketchKey.value = key
  await strokesStore.loadForBook(key)
  canvas.redraw()
})

function undo(): void {
  strokesStore.removeLastOnPage(sketchKey.value, 0)
  canvas.redraw()
}

async function clearAll(): Promise<void> {
  showClearConfirm.value = false
  const strokes = strokesStore.byBook[sketchKey.value] ?? []
  await Promise.all(strokes.map(s => strokesStore.remove(sketchKey.value, s.id)))
  canvas.redraw()
}
</script>

<style scoped>
.side-sketch {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

.side-sketch-toolbar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.4rem 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
  flex-wrap: wrap;
}

.side-sketch-canvas-wrap {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.side-sketch-canvas {
  width: 100%;
  height: 100%;
  position: relative;
  background: var(--color-bg-page);
}

.clear-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
}

.clear-dialog {
  background: var(--color-bg-base, #fff);
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
  min-width: 240px;
}

.clear-dialog p {
  margin: 0 0 1rem;
  color: var(--color-text-message, #333);
}

.clear-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.fade-enter-active, .fade-leave-active { transition: opacity 0.2s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
