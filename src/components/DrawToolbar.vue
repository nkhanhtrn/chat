<template>
  <div class="draw-toolbar">
    <div
      v-for="t in tools"
      :key="t.tool"
      class="tb-anchor"
    >
      <button
        class="tb-btn"
        :class="{ active: drawTool === t.tool }"
        :title="t.hasSettings ? `${t.label} (click again when active for size)` : t.label"
        :aria-label="t.label"
        @click="onToolClick(t.tool)"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path :d="t.icon" /></svg>
      </button>
      <div v-if="openPopover === 'pen' && t.tool === 'pen'" class="tb-popover" @pointerdown.stop>
        <div class="tb-popover-label">Pen size</div>
        <div class="tb-slider-row">
          <input type="range" class="tb-slider" min="0.5" max="8" step="0.1" :value="penSize" @input="onPenSizeInput" />
          <span class="tb-slider-value">{{ penSize.toFixed(1) }}</span>
        </div>
      </div>
      <div v-if="openPopover === 'highlighter' && t.tool === 'highlighter'" class="tb-popover" @pointerdown.stop>
        <div class="tb-popover-label">Highlighter size</div>
        <div class="tb-slider-row">
          <input type="range" class="tb-slider" min="4" max="40" step="0.5" :value="highlighterSize" @input="onHighlighterSizeInput" />
          <span class="tb-slider-value">{{ highlighterSize.toFixed(1) }}</span>
        </div>
      </div>
      <div v-if="openPopover === 'eraser' && t.tool === 'eraser'" class="tb-popover" @pointerdown.stop>
        <div class="tb-popover-label">Eraser size</div>
        <div class="tb-slider-row">
          <input type="range" class="tb-slider" min="5" max="30" step="1" :value="eraserSize" @input="onEraserSizeInput" />
          <span class="tb-slider-value">{{ eraserSize.toFixed(0) }}</span>
        </div>
        <div class="tb-popover-label tb-popover-label-secondary">Transparency</div>
        <div class="tb-slider-row">
          <input type="range" class="tb-slider" min="0.1" max="1" step="0.05" :value="eraserOpacity" @input="onEraserOpacityInput" />
          <span class="tb-slider-value">{{ Math.round(eraserOpacity * 100) }}%</span>
        </div>
      </div>
    </div>
    <div v-if="showColorPicker" class="tb-color-picker">
      <button
        v-for="i in colorCount"
        :key="i - 1"
        class="tb-color-circle"
        :class="{ selected: drawColorIndex === i - 1 }"
        :style="{ backgroundColor: `var(--color-highlight-${i - 1}, var(--color-highlight-0))` }"
        :aria-label="`Color ${i}`"
        @click="setStrokeColor(i - 1)"
      ></button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onBeforeUnmount } from 'vue'
import { STROKE_COLORS, type DrawTool } from '@/services/strokeLayer'

const props = withDefaults(defineProps<{
  showSelectTool?: boolean
  colorCount?: number
}>(), {
  showSelectTool: true,
  colorCount: STROKE_COLORS.length,
})

const drawTool = defineModel<DrawTool>('drawTool', { default: 'select' })
const drawColorIndex = defineModel<number>('drawColorIndex', { default: 0 })
const penSize = defineModel<number>('penSize', { default: 1.8 })
const highlighterSize = defineModel<number>('highlighterSize', { default: 14 })
const eraserSize = defineModel<number>('eraserSize', { default: 20 })
const eraserOpacity = defineModel<number>('eraserOpacity', { default: 0.4 })

const ALL_TOOLS: { tool: DrawTool; label: string; icon: string; hasSettings?: boolean }[] = [
  { tool: 'select', label: 'Select', icon: 'M5 3l5.5 15.5L13 12l6.5-2.5z' },
  { tool: 'pen', label: 'Pen', icon: 'M16 3l5 5L8 21H3v-5z', hasSettings: true },
  { tool: 'highlighter', label: 'Highlighter', icon: 'M9 11l3-3 5 5-3 3zM6 14l3 3-2.5 2.5H3.5V17z', hasSettings: true },
  { tool: 'eraser', label: 'Eraser', icon: 'M5 19h14M9 15l5-5 5 5-5 5z', hasSettings: true },
]

const tools = ALL_TOOLS.filter(t => props.showSelectTool || t.tool !== 'select')
const showColorPicker = props.colorCount > 0

const openPopover = ref<null | 'pen' | 'highlighter' | 'eraser'>(null)

function onToolClick(tool: DrawTool): void {
  if (drawTool.value === tool && (tool === 'pen' || tool === 'highlighter' || tool === 'eraser')) {
    togglePopover(tool)
  } else {
    openPopover.value = null
    setTool(tool)
  }
}

function setTool(tool: DrawTool): void {
  drawTool.value = tool
}

function setStrokeColor(i: number): void {
  drawColorIndex.value = i
}

function togglePopover(tool: 'pen' | 'highlighter' | 'eraser'): void {
  openPopover.value = openPopover.value === tool ? null : tool
}

function onPenSizeInput(e: Event): void {
  penSize.value = Number((e.target as HTMLInputElement).value)
}

function onHighlighterSizeInput(e: Event): void {
  highlighterSize.value = Number((e.target as HTMLInputElement).value)
}

function onEraserSizeInput(e: Event): void {
  eraserSize.value = Number((e.target as HTMLInputElement).value)
}

function onEraserOpacityInput(e: Event): void {
  eraserOpacity.value = Number((e.target as HTMLInputElement).value)
}

function onPopoverOutsideClick(e: PointerEvent): void {
  if (openPopover.value === null) return
  const target = e.target as HTMLElement | null
  if (!target?.closest('.tb-popover') && !target?.closest('.tb-anchor')) {
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

onBeforeUnmount(() => {
  window.removeEventListener('pointerdown', onPopoverOutsideClick)
})

defineExpose({ openPopover })
</script>

<style scoped>
.draw-toolbar { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; }
@media (max-width: 768px) {
  .draw-toolbar { flex-wrap: nowrap; overflow-x: auto; gap: 0.15rem; scrollbar-width: none; }
  .draw-toolbar::-webkit-scrollbar { display: none; }
}
</style>
