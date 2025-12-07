<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="visible" class="mermaid-modal-overlay" @mousedown.self="$emit('close')">
        <div
          ref="modalRef"
          class="mermaid-modal"
          :style="modalStyle"
        >
          <div class="mermaid-modal-header" @mousedown="startDrag">
            <span class="mermaid-modal-title">Mermaid Diagram</span>
            <div class="mermaid-modal-actions">
              <button @click="zoomOut" class="modal-action-btn" title="Zoom out" :disabled="zoomLevel <= 0.25">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <span class="zoom-level">{{ zoomPercent }}%</span>
              <button @click="zoomIn" class="modal-action-btn" title="Zoom in" :disabled="zoomLevel >= 5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="11" cy="11" r="8"></circle>
                  <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  <line x1="11" y1="8" x2="11" y2="14"></line>
                  <line x1="8" y1="11" x2="14" y2="11"></line>
                </svg>
              </button>
              <button @click="resetZoom" class="modal-action-btn" title="Reset zoom" :disabled="zoomLevel === DEFAULT_ZOOM">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"></path>
                  <path d="M3 3v5h5"></path>
                </svg>
              </button>
              <button @click="copySvg" class="modal-action-btn" :class="{ 'copy-success': copySuccess }" title="Copy SVG">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                </svg>
              </button>
              <button @click="$emit('close')" class="modal-close-btn" title="Close">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
          <div
            class="mermaid-modal-body"
            ref="bodyRef"
            :class="{ 'is-panning': isPanning, 'flashing': isFlashing }"
            @mousedown="startPan"
          >
            <div class="mermaid-modal-content" :style="contentStyle" v-html="svg"></div>
          </div>
          <!-- Resize handles -->
          <div class="resize-handle resize-handle-e" @mousedown="startResize('e', $event)"></div>
          <div class="resize-handle resize-handle-s" @mousedown="startResize('s', $event)"></div>
          <div class="resize-handle resize-handle-w" @mousedown="startResize('w', $event)"></div>
          <div class="resize-handle resize-handle-n" @mousedown="startResize('n', $event)"></div>
          <div class="resize-handle resize-handle-se" @mousedown="startResize('se', $event)"></div>
          <div class="resize-handle resize-handle-sw" @mousedown="startResize('sw', $event)"></div>
          <div class="resize-handle resize-handle-ne" @mousedown="startResize('ne', $event)"></div>
          <div class="resize-handle resize-handle-nw" @mousedown="startResize('nw', $event)"></div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from 'vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  svg: {
    type: String,
    default: ''
  }
})

const emit = defineEmits(['close'])

const modalRef = ref(null)
const bodyRef = ref(null)

// Modal position and size
const modalWidth = ref(800)
const modalHeight = ref(600)
const modalX = ref(null)
const modalY = ref(null)

// Zoom - restore from localStorage (default to 200% for better readability)
const ZOOM_STORAGE_KEY = 'mermaid-modal-zoom'
const DEFAULT_ZOOM = 2
const savedZoom = localStorage.getItem(ZOOM_STORAGE_KEY)
const zoomLevel = ref(savedZoom ? parseFloat(savedZoom) : DEFAULT_ZOOM)
const zoomPercent = computed(() => Math.round(zoomLevel.value * 100))

// Save zoom level to localStorage when it changes
watch(zoomLevel, (newZoom) => {
  localStorage.setItem(ZOOM_STORAGE_KEY, newZoom.toString())
})

// Copy state
const copySuccess = ref(false)
const isFlashing = ref(false)

// Drag state
const isDragging = ref(false)
const dragStartX = ref(0)
const dragStartY = ref(0)
const dragStartModalX = ref(0)
const dragStartModalY = ref(0)

// Resize state
const isResizing = ref(false)
const resizeDirection = ref('')
const resizeStartX = ref(0)
const resizeStartY = ref(0)
const resizeStartWidth = ref(0)
const resizeStartHeight = ref(0)
const resizeStartModalX = ref(0)
const resizeStartModalY = ref(0)

// Pan state (for scrolling content by dragging)
const isPanning = ref(false)
const panStartX = ref(0)
const panStartY = ref(0)
const panStartScrollLeft = ref(0)
const panStartScrollTop = ref(0)

const modalStyle = computed(() => {
  const style = {
    width: `${modalWidth.value}px`,
    height: `${modalHeight.value}px`
  }
  if (modalX.value !== null && modalY.value !== null) {
    style.left = `${modalX.value}px`
    style.top = `${modalY.value}px`
    style.transform = 'none'
  }
  return style
})

const contentStyle = computed(() => {
  return {
    transform: `scale(${zoomLevel.value})`,
    transformOrigin: 'top left'
  }
})

function zoomIn() {
  if (zoomLevel.value < 5) {
    zoomLevel.value = Math.min(5, zoomLevel.value + 0.25)
  }
}

function zoomOut() {
  if (zoomLevel.value > 0.25) {
    zoomLevel.value = Math.max(0.25, zoomLevel.value - 0.25)
  }
}

function resetZoom() {
  zoomLevel.value = DEFAULT_ZOOM
}

async function copySvg() {
  try {
    await navigator.clipboard.writeText(props.svg)
    copySuccess.value = true
    isFlashing.value = true
    setTimeout(() => {
      copySuccess.value = false
    }, 1500)
    setTimeout(() => {
      isFlashing.value = false
    }, 200)
  } catch (e) {
    console.error('Failed to copy SVG:', e)
  }
}

function startDrag(e) {
  if (e.target.closest('.modal-action-btn') || e.target.closest('.modal-close-btn')) return

  isDragging.value = true
  dragStartX.value = e.clientX
  dragStartY.value = e.clientY

  if (modalX.value === null) {
    const rect = modalRef.value.getBoundingClientRect()
    modalX.value = rect.left
    modalY.value = rect.top
  }

  dragStartModalX.value = modalX.value
  dragStartModalY.value = modalY.value

  document.addEventListener('mousemove', onDrag)
  document.addEventListener('mouseup', stopDrag)
}

function onDrag(e) {
  if (!isDragging.value) return

  const deltaX = e.clientX - dragStartX.value
  const deltaY = e.clientY - dragStartY.value

  modalX.value = dragStartModalX.value + deltaX
  modalY.value = dragStartModalY.value + deltaY
}

function stopDrag() {
  isDragging.value = false
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
}

function startResize(direction, e) {
  e.preventDefault()
  e.stopPropagation()

  isResizing.value = true
  resizeDirection.value = direction
  resizeStartX.value = e.clientX
  resizeStartY.value = e.clientY
  resizeStartWidth.value = modalWidth.value
  resizeStartHeight.value = modalHeight.value

  if (modalX.value === null) {
    const rect = modalRef.value.getBoundingClientRect()
    modalX.value = rect.left
    modalY.value = rect.top
  }

  resizeStartModalX.value = modalX.value
  resizeStartModalY.value = modalY.value

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

function onResize(e) {
  if (!isResizing.value) return

  const deltaX = e.clientX - resizeStartX.value
  const deltaY = e.clientY - resizeStartY.value
  const dir = resizeDirection.value

  let newWidth = resizeStartWidth.value
  let newHeight = resizeStartHeight.value

  if (dir.includes('e')) {
    newWidth = Math.max(400, resizeStartWidth.value + deltaX)
  }
  if (dir.includes('w')) {
    newWidth = Math.max(400, resizeStartWidth.value - deltaX)
  }
  if (dir.includes('s')) {
    newHeight = Math.max(300, resizeStartHeight.value + deltaY)
  }
  if (dir.includes('n')) {
    newHeight = Math.max(300, resizeStartHeight.value - deltaY)
  }

  modalWidth.value = newWidth
  modalHeight.value = newHeight
  // Always center the modal when resizing
  modalX.value = null
  modalY.value = null
}

function stopResize() {
  isResizing.value = false
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

function startPan(e) {
  // Don't start panning if clicking on buttons or other interactive elements
  if (e.target.closest('button')) return

  isPanning.value = true
  panStartX.value = e.clientX
  panStartY.value = e.clientY
  panStartScrollLeft.value = bodyRef.value.scrollLeft
  panStartScrollTop.value = bodyRef.value.scrollTop

  document.addEventListener('mousemove', onPan)
  document.addEventListener('mouseup', stopPan)
}

function onPan(e) {
  if (!isPanning.value) return

  const deltaX = e.clientX - panStartX.value
  const deltaY = e.clientY - panStartY.value

  bodyRef.value.scrollLeft = panStartScrollLeft.value - deltaX
  bodyRef.value.scrollTop = panStartScrollTop.value - deltaY
}

function stopPan() {
  isPanning.value = false
  document.removeEventListener('mousemove', onPan)
  document.removeEventListener('mouseup', stopPan)
}

function handleKeydown(e) {
  if (e.key === 'Escape') {
    emit('close')
  }
}

// Reset position when modal opens (but keep zoom level)
watch(() => props.visible, (isOpen) => {
  if (isOpen) {
    modalX.value = null
    modalY.value = null
    document.addEventListener('keydown', handleKeydown)
  } else {
    document.removeEventListener('keydown', handleKeydown)
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeydown)
  document.removeEventListener('mousemove', onDrag)
  document.removeEventListener('mouseup', stopDrag)
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
  document.removeEventListener('mousemove', onPan)
  document.removeEventListener('mouseup', stopPan)
})
</script>

<style scoped>
.mermaid-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--color-backdrop, rgba(0, 0, 0, 0.3));
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9998;
}

.mermaid-modal {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  background-color: var(--color-mermaid-bg);
  border: 1px solid var(--color-mermaid-border);
  box-shadow: 0 8px 32px var(--shadow-lg, rgba(0, 0, 0, 0.2));
  border-radius: 8px;
  min-width: 400px;
  min-height: 300px;
  max-width: 95vw;
  max-height: 95vh;
  user-select: none;
}

.mermaid-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background-color: var(--color-mermaid-header-bg);
  border-bottom: 1px solid var(--color-mermaid-border);
  border-radius: 8px 8px 0 0;
  cursor: move;
  user-select: none;
}

.mermaid-modal-title {
  font-weight: 600;
  font-size: 14px;
  color: var(--color-text-strong);
}

.mermaid-modal-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.modal-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.15s ease;
}

.modal-action-btn:hover:not(:disabled) {
  background: var(--color-bg-hover);
  color: var(--color-text-strong);
}

.modal-action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}

.modal-action-btn.copy-success {
  color: var(--color-success, #4caf50);
}

.modal-close-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  transition: all 0.15s ease;
  margin-left: 8px;
}

.modal-close-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-strong);
}

.zoom-level {
  font-size: 11px;
  min-width: 36px;
  text-align: center;
  color: var(--color-text-muted);
}

.mermaid-modal-body {
  flex: 1;
  overflow: auto;
  padding: 16px;
  cursor: grab;
}

.mermaid-modal-body.is-panning {
  cursor: grabbing;
  user-select: none;
}

.mermaid-modal-body.flashing {
  animation: flash 0.2s ease-out;
}

@keyframes flash {
  0% {
    background-color: rgba(212, 212, 212, 0.2);
  }
  100% {
    background-color: transparent;
  }
}

.mermaid-modal-content {
  display: inline-block;
}

.mermaid-modal-content :deep(svg) {
  display: block;
}

/* Resize handles */
.resize-handle {
  position: absolute;
  z-index: 10;
}

.resize-handle-e {
  top: 0;
  right: -4px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
}

.resize-handle-w {
  top: 0;
  left: -4px;
  width: 8px;
  height: 100%;
  cursor: ew-resize;
}

.resize-handle-s {
  bottom: -4px;
  left: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
}

.resize-handle-n {
  top: -4px;
  left: 0;
  width: 100%;
  height: 8px;
  cursor: ns-resize;
}

.resize-handle-se {
  bottom: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

.resize-handle-sw {
  bottom: -4px;
  left: -4px;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
}

.resize-handle-ne {
  top: -4px;
  right: -4px;
  width: 16px;
  height: 16px;
  cursor: nesw-resize;
}

.resize-handle-nw {
  top: -4px;
  left: -4px;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
}

/* Modal transitions */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.15s ease;
}

.modal-enter-active .mermaid-modal,
.modal-leave-active .mermaid-modal {
  transition: transform 0.15s ease, opacity 0.15s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.modal-enter-from .mermaid-modal,
.modal-leave-to .mermaid-modal {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.95);
}
</style>
