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
        <span class="window-title-text">{{ window.title }}</span>
      </div>
      <div class="window-controls">
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

    <!-- Resize Handle -->
    <div
      class="resize-handle"
      @mousedown.stop="startResize"
    ></div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import ChartRenderer from '../ChartRenderer.vue'
import MermaidBlock from '../markdown/MermaidBlock.vue'
import ToolRenderer from '../ToolRenderer.vue'
import { parseChartOption } from '../../utils/chart.js'

const props = defineProps({
  window: { type: Object, required: true },
  containerRect: { type: Object, default: () => ({ width: 0, height: 0 }) }
})

const emit = defineEmits(['close', 'update:position', 'update:size', 'bring-to-front'])

const windowRef = ref(null)
const isDragging = ref(false)
const isResizing = ref(false)
const dragStart = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0 })

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
function startResize(event) {
  isResizing.value = true
  resizeStart.value = {
    x: event.clientX,
    y: event.clientY,
    width: props.window.size.width,
    height: props.window.size.height
  }
  emit('bring-to-front')

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.body.style.cursor = 'se-resize'
  document.body.style.userSelect = 'none'
}

function handleResize(event) {
  if (!isResizing.value) return

  const deltaX = event.clientX - resizeStart.value.x
  const deltaY = event.clientY - resizeStart.value.y

  let newWidth = resizeStart.value.width + deltaX
  let newHeight = resizeStart.value.height + deltaY

  // Constrain to container bounds
  const maxWidth = props.containerRect.width - props.window.position.x
  const maxHeight = props.containerRect.height - props.window.position.y

  newWidth = Math.min(newWidth, maxWidth)
  newHeight = Math.min(newHeight, maxHeight)

  emit('update:size', { width: newWidth, height: newHeight })
}

function stopResize() {
  isResizing.value = false
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

.window-title-text {
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

/* Resize Handle */
.resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 16px;
  height: 16px;
  cursor: se-resize;
  background: linear-gradient(
    135deg,
    transparent 50%,
    var(--color-border-base) 50%,
    var(--color-border-base) 60%,
    transparent 60%,
    transparent 70%,
    var(--color-border-base) 70%,
    var(--color-border-base) 80%,
    transparent 80%
  );
  opacity: 0.5;
  transition: opacity 0.15s;
}

.output-window:hover .resize-handle {
  opacity: 1;
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
