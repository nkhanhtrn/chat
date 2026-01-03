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
      @touchstart.stop="startDrag"
    >
      <div class="window-title">
        <span class="window-type-icon">{{ typeIcon }}</span>
        <InlineEdit
          :modelValue="window.title || ''"
          textClass="window-title-text"
          inputClass="window-title-input"
          @save="(title) => emit('update:title', title)"
        />
        <span v-if="tokenCount > 0" class="token-count" :title="`~${tokenCount.toLocaleString()} tokens`">
          {{ formatTokenCount(tokenCount) }}
        </span>
      </div>
      <div class="window-controls">
        <button
          v-if="window.type === 'tool'"
          class="window-control-btn back-btn"
          :class="{ 'is-disabled': !hasHistory }"
          :disabled="!hasHistory"
          @click.stop="emit('go-back')"
          title="Back to previous version"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"></polyline>
          </svg>
        </button>
        <button
          class="window-control-btn edit-btn"
          @click.stop="showEditPanel = !showEditPanel"
          title="Edit"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button
          v-if="window.type === 'tool'"
          class="window-control-btn clone-btn"
          @click.stop="emit('clone')"
          title="Clone"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button
          class="window-control-btn minimize-btn"
          @click.stop="emit('minimize')"
          title="Minimize"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button
          class="window-control-btn close-btn"
          @click.stop="emit('close')"
          title="Close"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>

    <!-- Window Content - Dynamic Renderer -->
    <div class="window-content">
      <component
        :is="rendererComponent"
        v-if="rendererComponent"
        :content="window.content"
        :windowId="window.id"
        :sessionId="sessionId"
        :showEditPanel="showEditPanel"
        @error="handleRendererError"
      />
      <div v-else class="no-renderer">
        <p>Unknown window type: {{ window.type }}</p>
      </div>
    </div>

    <!-- Edit Panel -->
    <div v-if="showEditPanel" class="edit-panel">
      <div class="edit-options-row">
        <ThinkingModeToggle
          :model-value="useThinkingMode"
          @update:model-value="toggleThinkingMode"
        />
      </div>
      <div class="edit-input-row">
        <input
          v-model="editPrompt"
          class="edit-input"
          placeholder="Describe changes..."
          @keydown.enter="submitEdit"
        />
        <button
          class="edit-submit-btn"
          @click="submitEdit"
          :disabled="!editPrompt.trim() || isEditing"
          title="Send (Enter)"
        >
          <svg v-if="!isEditing" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
            <circle cx="12" cy="12" r="10" stroke-dasharray="32" stroke-dashoffset="12"></circle>
          </svg>
        </button>
      </div>
      <details class="spec-details">
        <summary>Current {{ contentLabel }}</summary>
        <CodeDisplay
          :language="contentLanguage"
          :code="contentForDisplay"
        />
      </details>
    </div>

    <!-- Resize Handles -->
    <div class="resize-handle resize-n" @mousedown.stop="(e) => startResize(e, 'n')" @touchstart.stop.prevent="(e) => startResize(e, 'n')"></div>
    <div class="resize-handle resize-s" @mousedown.stop="(e) => startResize(e, 's')" @touchstart.stop.prevent="(e) => startResize(e, 's')"></div>
    <div class="resize-handle resize-e" @mousedown.stop="(e) => startResize(e, 'e')" @touchstart.stop.prevent="(e) => startResize(e, 'e')"></div>
    <div class="resize-handle resize-w" @mousedown.stop="(e) => startResize(e, 'w')" @touchstart.stop.prevent="(e) => startResize(e, 'w')"></div>
    <div class="resize-handle resize-ne" @mousedown.stop="(e) => startResize(e, 'ne')" @touchstart.stop.prevent="(e) => startResize(e, 'ne')"></div>
    <div class="resize-handle resize-nw" @mousedown.stop="(e) => startResize(e, 'nw')" @touchstart.stop.prevent="(e) => startResize(e, 'nw')"></div>
    <div class="resize-handle resize-se" @mousedown.stop="(e) => startResize(e, 'se')" @touchstart.stop.prevent="(e) => startResize(e, 'se')"></div>
    <div class="resize-handle resize-sw" @mousedown.stop="(e) => startResize(e, 'sw')" @touchstart.stop.prevent="(e) => startResize(e, 'sw')"></div>
  </div>
</template>

<script setup>
import { ref, computed, onUnmounted } from 'vue'
import InlineEdit from '../InlineEdit.vue'
import CodeDisplay from './CodeDisplay.vue'
import ThinkingModeToggle from './ThinkingModeToggle.vue'
import { getRenderer } from './renderers/WindowRendererRegistry.js'

const props = defineProps({
  window: { type: Object, required: true },
  containerRect: { type: Object, default: () => ({ width: 0, height: 0 }) },
  sessionId: { type: String, default: 'default' },
  hasHistory: { type: Boolean, default: false }
})

const emit = defineEmits(['close', 'minimize', 'clone', 'update:position', 'update:size', 'update:title', 'bring-to-front', 'edit-window', 'go-back', 'tool-error'])

const windowRef = ref(null)
const isDragging = ref(false)
const isResizing = ref(false)
const resizeDirection = ref('')
const dragStart = ref({ x: 0, y: 0 })
const resizeStart = ref({ x: 0, y: 0, width: 0, height: 0, posX: 0, posY: 0 })

// Edit panel state
const showEditPanel = ref(false)
const editPrompt = ref('')
const isEditing = ref(false)
const useThinkingMode = ref(false)

const EDIT_THINKING_STORAGE_KEY = 'edit-thinking-mode'

// Load thinking mode state from localStorage when edit panel opens
function loadThinkingMode() {
  const stored = localStorage.getItem(EDIT_THINKING_STORAGE_KEY)
  if (stored !== null) {
    useThinkingMode.value = stored === 'true'
  }
}

// Watch edit panel opening to load thinking mode
function toggleEditPanel() {
  showEditPanel.value = !showEditPanel.value
  if (showEditPanel.value) {
    loadThinkingMode()
  }
}

// Expose method to parent to toggle edit panel
defineExpose({ toggleEditPanel })

function toggleThinkingMode(value) {
  useThinkingMode.value = value
  localStorage.setItem(EDIT_THINKING_STORAGE_KEY, value.toString())
}

function submitEdit() {
  if (!editPrompt.value.trim() || isEditing.value) return

  isEditing.value = true
  const currentPrompt = editPrompt.value.trim()
  editPrompt.value = '' // Clear prompt immediately

  emit('edit-window', {
    windowId: props.window.id,
    windowType: props.window.type,
    currentContent: props.window.content,
    prompt: currentPrompt,
    useThinkingMode: useThinkingMode.value,
    onDone: () => {
      isEditing.value = false
      // Keep edit panel open - user must click edit button again to close
      // Don't reset useThinkingMode - keep it for next edit
    }
  })
}

// Get renderer component for this window type
const rendererComponent = computed(() => getRenderer(props.window.type))

// Computed properties for edit panel content display
const contentLabel = computed(() => {
  switch (props.window.type) {
    case 'tool': return isVueSfcTool.value ? 'Component' : 'Specification'
    case 'chart': return 'Chart Config'
    case 'mermaid': return 'Diagram'
    case 'svg': return 'SVG'
    case 'codeResult': return 'Code'
    default: return 'Content'
  }
})

const contentLanguage = computed(() => {
  switch (props.window.type) {
    case 'tool': return isVueSfcTool.value ? 'vue' : 'json'
    case 'chart': return 'json'
    case 'mermaid': return 'mermaid'
    case 'svg': return 'xml'
    case 'codeResult': return 'javascript'
    default: return 'text'
  }
})

const isVueSfcTool = computed(() => {
  return props.window.type === 'tool' &&
         props.window.content?.type === 'vue-sfc' &&
         props.window.content?.code
})

const contentForDisplay = computed(() => {
  const content = props.window.content
  switch (props.window.type) {
    case 'tool':
      return isVueSfcTool.value ? content.code : JSON.stringify(content, null, 2)
    case 'chart':
      return typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    case 'mermaid':
    case 'svg':
      return content
    case 'codeResult':
      return content.code || ''
    default:
      return typeof content === 'string' ? content : JSON.stringify(content, null, 2)
  }
})

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
  // Use custom emoji from tool content if available
  if (props.window.type === 'tool' && props.window.content?.emoji) {
    return props.window.content.emoji
  }
  switch (props.window.type) {
    case 'chart': return '📊'
    case 'mermaid': return '📐'
    case 'svg': return '🎨'
    case 'tool': return '🔧'
    case 'codeResult': return '💻'
    default: return '📋'
  }
})

// Estimate token count from window content
const tokenCount = computed(() => {
  const content = props.window.content
  if (!content) return 0

  let text = ''
  if (typeof content === 'string') {
    text = content
  } else if (content.code) {
    // Tool or code result with code
    text = content.code
  } else {
    // Serialize object content (chart options, etc.)
    try {
      text = JSON.stringify(content)
    } catch {
      return 0
    }
  }

  // Rough token estimation: ~4 characters per token
  return Math.ceil(text.length / 4)
})

// Format token count for display
function formatTokenCount(count) {
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`
  }
  return count.toString()
}

// Bring to front on click
function handleWindowClick() {
  emit('bring-to-front')
}

// Handle error from renderer
function handleRendererError(errorDetails) {
  emit('tool-error', errorDetails)
}

// Helper to get clientX/clientY from mouse or touch event
function getEventCoords(event) {
  if (event.touches && event.touches.length > 0) {
    return { x: event.touches[0].clientX, y: event.touches[0].clientY }
  }
  return { x: event.clientX, y: event.clientY }
}

// Drag functionality
function startDrag(event) {
  // Don't start drag if clicking on buttons or controls
  const target = event.target
  if (
    target.closest('button') ||
    target.closest('.window-controls') ||
    target.closest('.inline-edit-input')
  ) {
    return
  }

  // Prevent default for touch to avoid scrolling while dragging
  if (event.cancelable) event.preventDefault()

  isDragging.value = true
  const coords = getEventCoords(event)
  dragStart.value = {
    x: coords.x - props.window.position.x,
    y: coords.y - props.window.position.y
  }
  emit('bring-to-front')

  document.addEventListener('mousemove', handleDrag)
  document.addEventListener('mouseup', stopDrag)
  document.addEventListener('touchmove', handleDrag, { passive: false })
  document.addEventListener('touchend', stopDrag)
  document.body.style.cursor = 'grabbing'
  document.body.style.userSelect = 'none'
}

function handleDrag(event) {
  if (!isDragging.value) return

  if (event.cancelable) event.preventDefault()
  const coords = getEventCoords(event)
  let newX = coords.x - dragStart.value.x
  let newY = coords.y - dragStart.value.y

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
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
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
  const coords = getEventCoords(event)
  resizeStart.value = {
    x: coords.x,
    y: coords.y,
    width: props.window.size.width,
    height: props.window.size.height,
    posX: props.window.position.x,
    posY: props.window.position.y
  }
  emit('bring-to-front')

  document.addEventListener('mousemove', handleResize)
  document.addEventListener('mouseup', stopResize)
  document.addEventListener('touchmove', handleResize, { passive: false })
  document.addEventListener('touchend', stopResize)
  document.body.style.cursor = cursorMap[direction]
  document.body.style.userSelect = 'none'
}

function handleResize(event) {
  if (!isResizing.value) return

  if (event.cancelable) event.preventDefault()
  const coords = getEventCoords(event)
  const deltaX = coords.x - resizeStart.value.x
  const deltaY = coords.y - resizeStart.value.y
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
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

// Cleanup
onUnmounted(() => {
  document.removeEventListener('mousemove', handleDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('touchmove', handleDrag)
  document.removeEventListener('touchend', stopDrag)
  document.removeEventListener('mousemove', handleResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('touchmove', handleResize)
  document.removeEventListener('touchend', stopResize)
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

.no-renderer {
  padding: 1rem;
  color: var(--color-text-muted);
  text-align: center;
}

/* Header */
.window-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border-subtle);
  cursor: grab;
  flex-shrink: 0;
  touch-action: none;
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

.token-count {
  font-size: 0.65rem;
  font-weight: 400;
  color: var(--color-text-muted);
  background-color: var(--color-bg-hover);
  padding: 1px 5px;
  border-radius: 4px;
  margin-left: 4px;
  flex-shrink: 0;
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

.window-control-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.window-control-btn:not(:disabled):hover {
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

/* Resize Handles */
.resize-handle {
  position: absolute;
  z-index: 10;
  touch-action: none;
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

/* Edit Panel */
.edit-panel {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.75rem;
  background: linear-gradient(to bottom, var(--color-bg-base, #2a2a2a), var(--color-bg-base, #1a1a1a));
  border-top: 1px solid var(--color-primary, #3b82f6);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.2);
  z-index: 5;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 50%;
  overflow: hidden;
}

.spec-details {
  font-size: 0.75rem;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.spec-details summary {
  cursor: pointer;
  color: var(--color-text-muted);
  user-select: none;
  padding: 0.25rem 0;
  flex-shrink: 0;
}

.spec-details summary:hover {
  color: var(--color-text-base);
}

.spec-details[open] {
  flex: 1;
}

.spec-preview {
  margin: 0;
  padding: 0.5rem;
  background-color: var(--color-code-block-bg);
  color: var(--color-code-block-text);
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', monospace;
  font-size: 0.7rem;
  overflow: auto;
  white-space: pre-wrap;
  word-break: break-all;
  flex: 1;
  min-height: 0;
}

.edit-input-row {
  display: flex;
  gap: 0.5rem;
  align-items: flex-end;
}

.edit-input {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  font-family: inherit;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  height: 36px;
}

.edit-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.edit-input::placeholder {
  color: var(--color-text-muted);
}

.edit-options-row {
  display: flex;
  align-items: center;
  padding: 0.25rem 0;
  margin-bottom: 0.25rem;
  gap: 0.5rem;
}

.thinking-warning {
  font-size: 0.7rem;
  color: #d97706;
  font-family: system-ui, -apple-system, sans-serif;
}

.edit-submit-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  padding: 0;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.15s;
  flex-shrink: 0;
}

.edit-submit-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.edit-submit-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.edit-submit-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.edit-btn:hover {
  background-color: var(--color-primary-subtle, #dbeafe);
  color: var(--color-primary);
}

.clone-btn:hover {
  background-color: var(--color-success-subtle, #dcfce7);
  color: var(--color-success, #22c55e);
}

.back-btn:hover {
  background-color: var(--color-warning-subtle, #fef3c7);
  color: var(--color-warning, #f59e0b);
}
</style>
