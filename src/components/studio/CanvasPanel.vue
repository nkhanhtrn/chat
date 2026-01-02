<template>
  <div ref="canvasRef" class="canvas-container">
    <!-- Tool Library -->
    <ToolLibrary ref="toolLibraryRef" @open-tool="$emit('open-tool', $event)" />

    <!-- Empty State -->
    <div v-if="visibleWindows.length === 0 && minimizedCategories.length === 0" class="canvas-empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </div>
      <p class="empty-title">Canvas</p>
      <p class="empty-description">Chat outputs will appear here as windows</p>
    </div>

    <!-- Output Windows -->
    <TransitionGroup name="window-pop">
      <OutputWindow
        v-for="window in visibleWindows"
        :key="window.id"
        :window="window"
        :container-rect="containerRect"
        :sessionId="sessionId"
        :hasHistory="hasHistoryFn(window.id)"
        @close="$emit('close-window', window.id)"
        @minimize="$emit('minimize-window', window.id)"
        @clone="$emit('clone-window', window)"
        @update:position="(pos) => $emit('update-position', window.id, pos)"
        @update:size="(size) => $emit('update-size', window.id, size)"
        @update:title="(title) => $emit('update-title', window.id, title)"
        @bring-to-front="$emit('bring-to-front', window.id)"
        @edit-window="(data) => $emit('edit-window', data)"
        @go-back="$emit('go-back', window.id)"
        @refresh="$emit('refresh', window.id)"
        @tool-error="(error) => $emit('tool-error', error)"
      />
    </TransitionGroup>

    <!-- Minimized Windows Bar -->
    <MinimizedWindowsBar
      :categories="minimizedCategories"
      @restore="$emit('restore-window', $event)"
      @close="$emit('close-window', $event)"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import OutputWindow from './OutputWindow.vue'
import MinimizedWindowsBar from './MinimizedWindowsBar.vue'
import ToolLibrary from './ToolLibrary.vue'

defineProps({
  visibleWindows: { type: Array, default: () => [] },
  minimizedCategories: { type: Array, default: () => [] },
  sessionId: { type: String, default: 'default' },
  hasHistoryFn: { type: Function, default: () => () => false }
})

defineEmits(['close-window', 'minimize-window', 'clone-window', 'restore-window', 'update-position', 'update-size', 'update-title', 'bring-to-front', 'edit-window', 'open-tool', 'go-back', 'refresh', 'tool-error'])

const canvasRef = ref(null)
const toolLibraryRef = ref(null)
const containerRect = ref({ width: 0, height: 0 })
let resizeObserver = null

// Expose methods for parent components
defineExpose({
  reloadToolLibrary: () => toolLibraryRef.value?.loadTools()
})

function updateContainerRect() {
  if (canvasRef.value) {
    const rect = canvasRef.value.getBoundingClientRect()
    containerRect.value = { width: rect.width, height: rect.height }
  }
}

onMounted(() => {
  updateContainerRect()

  // Use ResizeObserver to detect container size changes (e.g., when divider is dragged)
  if (canvasRef.value) {
    resizeObserver = new ResizeObserver(() => {
      updateContainerRect()
    })
    resizeObserver.observe(canvasRef.value)
  }
})

onUnmounted(() => {
  if (resizeObserver) {
    resizeObserver.disconnect()
    resizeObserver = null
  }
})
</script>

<style scoped>
.canvas-container {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  background-color: var(--color-bg-page);
  background-image: radial-gradient(var(--color-border-subtle) 1px, transparent 1px);
  background-size: 20px 20px;
}

.canvas-empty-state {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  color: var(--color-text-muted);
  pointer-events: none;
  user-select: none;
}

.empty-icon {
  opacity: 0.3;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.25rem;
  font-weight: 500;
  margin: 0 0 0.5rem 0;
  color: var(--color-text-muted);
}

.empty-description {
  font-size: 0.875rem;
  margin: 0;
  opacity: 0.7;
}

/* Window pop animation */
.window-pop-enter-active {
  animation: window-pop-in 0.25s ease-out;
}

.window-pop-leave-active {
  animation: window-pop-out 0.2s ease-in;
}

@keyframes window-pop-in {
  0% {
    opacity: 0;
    transform: scale(0.8);
  }
  50% {
    transform: scale(1.02);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

@keyframes window-pop-out {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  100% {
    opacity: 0;
    transform: scale(0.8);
  }
}
</style>
