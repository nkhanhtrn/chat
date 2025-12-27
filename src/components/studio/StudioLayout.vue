<template>
  <div class="studio-layout">
    <!-- Chat Panel (Left) -->
    <div class="chat-panel" :style="{ width: chatPanelWidth + 'px' }">
      <slot name="chat"></slot>
    </div>

    <!-- Resizable Divider -->
    <div
      class="divider"
      :class="{ 'is-dragging': isDraggingDivider }"
      @mousedown="startDividerDrag"
    >
      <div class="divider-handle"></div>
    </div>

    <!-- Canvas Panel (Right) -->
    <div class="canvas-panel">
      <slot name="canvas"></slot>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

// Divider drag state
const chatPanelWidth = ref(500)
const isDraggingDivider = ref(false)
const startX = ref(0)
const startWidth = ref(0)

// Min/max widths
const MIN_CHAT_WIDTH = 400
const MAX_CHAT_WIDTH = 800

function startDividerDrag(event) {
  isDraggingDivider.value = true
  startX.value = event.clientX
  startWidth.value = chatPanelWidth.value

  document.addEventListener('mousemove', handleDividerDrag)
  document.addEventListener('mouseup', stopDividerDrag)
  document.body.style.cursor = 'col-resize'
  document.body.style.userSelect = 'none'
}

function handleDividerDrag(event) {
  if (!isDraggingDivider.value) return

  const delta = event.clientX - startX.value
  const newWidth = startWidth.value + delta

  chatPanelWidth.value = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, newWidth))
}

function stopDividerDrag() {
  isDraggingDivider.value = false
  document.removeEventListener('mousemove', handleDividerDrag)
  document.removeEventListener('mouseup', stopDividerDrag)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleDividerDrag)
  document.removeEventListener('mouseup', stopDividerDrag)
})
</script>

<style scoped>
.studio-layout {
  display: flex;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.chat-panel {
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  min-width: 400px;
  max-width: 800px;
  border-right: 1px solid var(--color-border-subtle);
}

.divider {
  width: 6px;
  background-color: transparent;
  cursor: col-resize;
  flex-shrink: 0;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s;
}

.divider:hover,
.divider.is-dragging {
  background-color: var(--color-bg-hover);
}

.divider-handle {
  width: 3px;
  height: 40px;
  background-color: var(--color-border-subtle);
  border-radius: 2px;
  transition: background-color 0.15s;
}

.divider:hover .divider-handle,
.divider.is-dragging .divider-handle {
  background-color: var(--color-border-strong);
}

.canvas-panel {
  flex: 1;
  min-width: 300px;
  position: relative;
  background-color: var(--color-bg-page);
  overflow: hidden;
}

/* Mobile: Stack vertically */
@media (max-width: 1024px) {
  .studio-layout {
    flex-direction: column;
  }

  .chat-panel {
    width: 100% !important;
    max-width: none;
    min-width: 0;
    height: 50%;
    border-right: none;
    border-bottom: 1px solid var(--color-border-subtle);
  }

  .divider {
    width: 100%;
    height: 6px;
    cursor: row-resize;
  }

  .divider-handle {
    width: 40px;
    height: 3px;
  }

  .canvas-panel {
    min-width: 0;
    min-height: 200px;
  }
}

/* Hide canvas on very small screens */
@media (max-width: 768px) {
  .divider,
  .canvas-panel {
    display: none;
  }

  .chat-panel {
    width: 100% !important;
    height: 100%;
    border: none;
  }
}
</style>
