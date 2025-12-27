<template>
  <div
    ref="windowRef"
    class="output-window"
    :class="{ 'is-dragging': isDragging, 'is-resizing': isResizing }"
    :style="windowStyle"
    @mousedown="handleWindowClick"
  >
    <!-- Window Header -->
    <div
      class="window-header"
      @mousedown.stop="startDrag"
    >
      <div class="window-title">
        <span class="window-type-icon">{{ typeIcon }}</span>
        <InlineEdit
          :modelValue="window.title"
          textClass="window-title-text"
          inputClass="window-title-input"
          @save="(title) => emit('update:title', title)"
        />
      </div>
      <div class="window-controls">
        <button
          class="window-control-btn minimize-btn"
          @click.stop="$emit('minimize')"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button
          class="window-control-btn close-btn"
          @click.stop="$emit('close')"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Window Content -->
    <div class="window-content">
      <!-- Chart -->
      <ChartRenderer
        v-if="window.type === 'chart'"
        :option="parseChartOption(window.content)"
        height="100%"
      />

      <!-- Mermaid -->
      <MermaidBlock
        v-else-if="window.type === 'mermaid'"
        :code="window.content"
      />

      <!-- SVG -->
      <div
        v-else-if="window.type === 'svg'"
        class="svg-wrapper"
        v-html="window.content"
      ></div>

      <!-- Tool -->
      <ToolRenderer
        v-else-if="window.type === 'tool'"
        :tool="window.content"
      />

      <!-- Code Result -->
      <div v-else-if="window.type === 'codeResult'" class="code-result">
        <div class="result-output">
          <pre class="result-value">{{ formatResult(window.content.result) }}</pre>
        </div>
        <details v-if="window.content.code" class="code-details">
          <summary>View code</summary>
          <pre class="code-source"><code>{{ window.content.code }}</code></pre>
        </details>
      </div>
    </div>

    <!-- Resize Handles -->
    <div class="resize-handle resize-n" @mousedown.stop="(e) => startResize(e, 'n')"></div>
    <div class="resize-handle resize-s" @mousedown.stop="(e) => startResize(e, 's')"></div>
    <div class="resize-handle resize-e" @mousedown.stop="(e) => startResize(e, 'e')"></div>
    <div class="resize-handle resize-w" @mousedown.stop="(e) => startResize(e, 'w')"></div>
    <div class="resize-handle resize-ne" @mousedown.stop="(e) => startResize(e, 'ne')"></div>
    <div class="resize-handle resize-nw" @mousedown.stop="(e) => startResize(e, 'nw')"></div>
    <div class="resize-handle resize-se" @mousedown.stop="(e) => startResize(e, 'se')"></div>
    <div class="resize-handle resize-sw" @mousedown.stop="(e) => startResize(e, 'sw')"></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ChartRenderer from '../ChartRenderer.vue'
import MermaidBlock from '../markdown/MermaidBlock.vue'
import ToolRenderer from '../ToolRenderer.vue'
import InlineEdit from '../InlineEdit.vue'
import { parseChartOption } from '../../utils/chart.js'

const props = defineProps({
  window: { type: Object, required: true },
  containerRect: { type: Object, default: () => ({ width: 0, height: 0 }) }
})

const emit = defineEmits(['close', 'minimize', 'update:position', 'update:size', 'update:title', 'bring-to-front'])

const windowRef = ref(null)
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref('')
const dragStart = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

// Computed styles
const windowStyle = computed(() => ({
  left: `${props.window.position.x}px`,
  top: `${props.window.position.y}px`,
  width: `${props.window.size.width}px`,
  height: `${props.window.size.height}px`,
  zIndex: props.window.zIndex
}))

// Type icons
const typeIcon = computed(() => {
  switch (props.window.type) {
    case 'chart': return '📊'
    case 'mermaid': return '📐'
    case 'svg': return '🎨'
    case 'tool': return '🔧'
    case 'codeResult': return '💻'
    default: return '📋'
  }
})

// Format result to ensure it's a string
function formatResult(result) {
  if (typeof result === 'string') return result
  if (result === null || result === undefined) return ''
  try {
    return JSON.stringify(result, null, 2)
  } catch {
    return String(result)
  }
}

// Bring to front on click
function handleWindowClick() {
  emit('bring-to-front')
}

// Drag functionality
function startDrag(event) {
  isDragging.value = true
  dragStart.value = {
    x: event.clientX - props.window.position.x,
    y: event.clientY - props.window.position.y
  }
  emit('bring-to-front')

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'
}

function handleDrag(event) {
  if (!isDragging.value) return

  let newX = event.clientX - dragStart.value.x
  let newY = event.clientY - dragStart.value.y

  // Constrain to container bounds
  const maxX = props.containerRect.width - props.window.size.width
  const maxY = props.containerRect.height - props.window.size.height

  newX = Math.max(0, Math.min(newX, maxX))
  newY = Math.max(0, Math.min(newY, maxY))

  emit('update:position', { x: newX, y: newY })
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Resize functionality
const cursorMap = {
  n: 'ns-resize',
  s: 'ns-resize',
  e: 'ew-resize',
  w: 'ew-resize',
  ne: 'nesw-resize',
  sw: 'nesw-resize',
  nw: 'nwse-resize',
  se: 'nwse-resize'
}

function startResize(event, direction) {
  isResizing.value = true
  resizeDirection.value = direction
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: props.window.size.width,
    height: props.window.size.height,
    posX: props.window.position.x,
    posY: props.window.position.y
  }
  emit('bring-to-front')

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = cursorMap[direction]
  document.body.style.userSelect = 'none'
}

function handleResize(event) {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStart.value.x
  const deltaY = event.clientY - resizeStart.value.y
  const dir = resizeDirection.value

  let newWidth = resizeStart.value.width
  let newHeight = resizeStart.value.height
  let newX = resizeStart.value.posX
  let newY = resizeStart.value.posY

  // Handle horizontal resizing
  if (dir.includes('e')) {
    newWidth = resizeStart.value.width + deltaX
  } else if (dir.includes('w')) {
    newWidth = resizeStart.value.width - deltaX
    newX = resizeStart.value.posX + deltaX
  }

  // Handle vertical resizing
  if (dir.includes('s')) {
    newHeight = resizeStart.value.height + deltaY
  } else if (dir.includes('n')) {
    newHeight = resizeStart.value.height - deltaY
    newY = resizeStart.value.posY + deltaY
  }

  // Constrain position to not go negative
  if (newX < 0) {
    newWidth += newX
    newX = 0
  }
  if (newY < 0) {
    newHeight += newY
    newY = 0
  }

  // Constrain to container bounds
  const maxWidth = props.containerRect.width - newX
  const maxHeight = props.containerRect.height - newY
  newWidth = Math.min(newWidth, maxWidth)
  newHeight = Math.min(newHeight, maxHeight)

  // Update position if resizing from top or left
  if (dir.includes('w') || dir.includes('n')) {
    emit('update:position', { x: newX, y: newY })
  }

  emit('update:size', { width: newWidth, height: newHeight })
}

function stopResize() {
  isResizing.value = false
  resizeDirection.value = ''
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
})
</script>

<style scoped>
.output-window {
  position: absolute;
  display: flex;
  flex-direction: column;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  overflow: hidden;
  transition: box-shadow 0.15s;
}

.output-window:hover {
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.2);
}

.output-window.is-dragging,
.output-window.is-resizing {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.25);
  opacity: 0.95;
}

/* Header */
.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-surface);
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: grab;
  flex-shrink: 0;
}

.window-header:active {
  cursor: grabbing;
}

.window-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-base);
  user-select: none;
}

.window-type-icon {
  font-size: 0.9rem;
}

.window-title :deep(.window-title-text) {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.window-title :deep(.window-title-input) {
  font-family: inherit;
  font-size: 0.8rem;
  font-weight: 500;
  padding: 2px 4px;
  width: 150px;
}

.window-controls {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.window-control-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.15s;
}

.window-control-btn:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

.close-btn:hover {
  background-color: var(--color-error-subtle, #fee2e2);
  color: var(--color-error, #ef4444);
}

/* Content */
.window-content {
  flex: 1;
  overflow: auto;
  padding: 0.5rem;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.window-content > * {
  flex: 1;
  min-height: 0;
}

.svg-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.svg-wrapper :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}

/* Resize Handles */
.resize-handle {
  position: absolute;
  z-index: 10;
}

/* Edge handles */
.resize-n {
  top: 0;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: ns-resize;
}

.resize-s {
  bottom: 0;
  left: 8px;
  right: 8px;
  height: 6px;
  cursor: ns-resize;
}

.resize-e {
  right: 0;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: ew-resize;
}

.resize-w {
  left: 0;
  top: 8px;
  bottom: 8px;
  width: 6px;
  cursor: ew-resize;
}

/* Corner handles */
.resize-ne {
  top: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

.resize-nw {
  top: 0;
  left: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.resize-se {
  bottom: 0;
  right: 0;
  width: 12px;
  height: 12px;
  cursor: nwse-resize;
}

.resize-sw {
  bottom: 0;
  left: 0;
  width: 12px;
  height: 12px;
  cursor: nesw-resize;
}

/* Code Result */
.code-result {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.5rem;
}

.result-output {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.result-value {
  margin: 0;
  padding: 0.75rem;
  background-color: var(--color-bg-surface);
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-base);
  white-space: pre-wrap;
  word-break: break-word;
}

.code-details {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-subtle);
}

.code-details summary {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.code-details summary:hover {
  color: var(--color-text-base);
}

.code-source {
  margin: 0;
  padding: 0.75rem;
  background-color: var(--color-code-block-bg, #1e1e1e);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-code-block-text, #d4d4d4);
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.code-source code {
  font-family: inherit;
}
</style>
