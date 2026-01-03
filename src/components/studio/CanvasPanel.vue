<template>
  <div ref="canvasRef" class="canvas-container">
    <!-- Browse Windows Button -->
    <button class="browse-windows-btn" @click.stop="$emit('browse-windows')" title="Browse all windows">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <line x1="9" y1="3" x2="9" y2="21"></line>
        <line x1="15" y1="3" x2="15" y2="21"></line>
      </svg>
    </button>

    <!-- Empty State -->
    <div v-if="activeWindows.length === 0" class="canvas-empty-state">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
      </div>
      <p class="empty-title">Canvas</p>
      <p class="empty-description">Chat outputs will appear here as windows</p>
    </div>

    <!-- Output Windows (render non-closed windows; minimized are hidden with CSS) -->
    <TransitionGroup name="window-pop">
      <OutputWindow
        v-for="window in activeWindows"
        :key="window.id"
        :window="window"
        :container-rect="containerRect"
        :sessionId="sessionId"
        :hasHistory="hasHistoryFn(window.id)"
        :class="{ 'window-minimized': window.displayState === 'minimized' }"
        @click.stop
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import OutputWindow from './OutputWindow.vue'
import MinimizedWindowsBar from './MinimizedWindowsBar.vue'

const props = defineProps({
  windows: { type: Array, default: () => [] },
  sessionId: { type: String, default: 'default' },
  hasHistoryFn: { type: Function, default: () => () => false }
})

// Computed: windows that are not closed (both open and minimized)
const activeWindows = computed(() =>
  props.windows.filter(w => w.displayState !== 'closed')
)

// Computed: minimized windows for the bar
const minimizedCategories = computed(() => {
  const minimized = props.windows.filter(w => w.displayState === 'minimized')
  const TYPE_CATEGORIES = {
    chart: { name: 'Charts', icon: '📊', order: 1 },
    mermaid: { name: 'Diagrams', icon: '📐', order: 2 },
    svg: { name: 'Graphics', icon: '🎨', order: 3 },
    tool: { name: 'Tools', icon: '🔧', order: 4 },
    codeResult: { name: 'Code', icon: '💻', order: 5 }
  }
  const grouped = {}
  for (const win of minimized) {
    const category = TYPE_CATEGORIES[win.type] || { name: 'Other', icon: '📋', order: 99 }
    if (!grouped[win.type]) {
      grouped[win.type] = { type: win.type, ...category, windows: [] }
    }
    grouped[win.type].windows.push(win)
  }
  return Object.values(grouped).sort((a, b) => a.order - b.order)
})

defineEmits(['close-window', 'minimize-window', 'clone-window', 'restore-window', 'update-position', 'update-size', 'update-title', 'bring-to-front', 'edit-window', 'go-back', 'refresh', 'tool-error', 'browse-windows'])

const canvasRef = ref(null)
const containerRect = ref({ width: 0, height: 0 })
let resizeObserver = null

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

/* Hide minimized windows but keep them mounted (preserves state) */
:deep(.window-minimized) {
  display: none !important;
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

.browse-windows-btn {
  position: absolute;
  top: 0.75rem;
  right: 0.75rem;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.15s;
  z-index: 100;
  opacity: 0.6;
}

.browse-windows-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
  opacity: 1;
}

.browse-windows-btn svg {
  width: 16px;
  height: 16px;
}
</style>
