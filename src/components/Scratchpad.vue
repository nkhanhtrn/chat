<template>
  <div class="scratchpad-container">
    <!-- Streaming Indicator Button (above scratchpad toggle) -->
    <Transition name="streaming-fade">
      <button
        v-if="isStreaming"
        class="streaming-toggle"
        @click="$emit('stop-streaming')"
        title="Stop generating"
      >
        <svg class="streaming-spinner" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="10"></circle>
          <rect x="9" y="9" width="6" height="6" fill="currentColor" stroke="none"></rect>
        </svg>
      </button>
    </Transition>

    <!-- Toggle Button -->
    <Transition name="button-fade" @after-leave="showPanel = true">
      <button
        v-if="showButton"
        class="scratchpad-toggle"
        @click="isOpen = true"
        title="Open scratchpad"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
          <polyline points="10 9 9 9 8 9"></polyline>
        </svg>
      </button>
    </Transition>

    <!-- Scratchpad Panel -->
    <Transition name="scratchpad-slide" @after-leave="showButton = true" @after-enter="panelVisible = true">
      <div
        v-if="showPanel"
        class="scratchpad-panel"
        :style="{ width: panelWidth + 'px', height: panelHeight + 'px' }"
      >
        <!-- Resize handle (top-left corner) -->
        <div
          class="resize-handle"
          @mousedown="startResize"
        ></div>
        <div class="scratchpad-header">
          <span class="scratchpad-title">Scratchpad</span>
          <button class="scratchpad-close" @click="isOpen = false" title="Close scratchpad">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
        <textarea
          ref="textareaRef"
          class="scratchpad-textarea"
          v-model="localContent"
          @input="handleInput"
          placeholder="Write your thoughts here..."
        ></textarea>
      </div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue'

const STORAGE_KEY = 'scratchpad-size'
const DEFAULT_WIDTH = 320
const DEFAULT_HEIGHT = 280
const MIN_WIDTH = 200
const MIN_HEIGHT = 150

const props = defineProps({
  content: {
    type: String,
    default: ''
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['update:content', 'stop-streaming'])

const isOpen = ref(false)
const showButton = ref(true)
const showPanel = ref(false)
const localContent = ref(props.content)
const textareaRef = ref(null)

// Panel size (loaded from localStorage)
const panelWidth = ref(DEFAULT_WIDTH)
const panelHeight = ref(DEFAULT_HEIGHT)

// Resize state
const isResizing = ref(false)
let startX = 0
let startY = 0
let startWidth = 0
let startHeight = 0

// Load saved size from localStorage
onMounted(() => {
  const savedSize = localStorage.getItem(STORAGE_KEY)
  if (savedSize) {
    try {
      const { width, height } = JSON.parse(savedSize)
      panelWidth.value = width || DEFAULT_WIDTH
      panelHeight.value = height || DEFAULT_HEIGHT
    } catch (e) {
      // Ignore parse errors
    }
  }
})

// Save size to localStorage
const saveSize = () => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    width: panelWidth.value,
    height: panelHeight.value
  }))
}

// Resize handlers
const startResize = (e) => {
  e.preventDefault()
  isResizing.value = true
  startX = e.clientX
  startY = e.clientY
  startWidth = panelWidth.value
  startHeight = panelHeight.value

  document.addEventListener('mousemove', onResize)
  document.addEventListener('mouseup', stopResize)
}

const onResize = (e) => {
  if (!isResizing.value) return

  // Since panel is anchored at bottom-right, dragging top-left means:
  // - moving left (negative deltaX) increases width
  // - moving up (negative deltaY) increases height
  const deltaX = startX - e.clientX
  const deltaY = startY - e.clientY

  panelWidth.value = Math.max(MIN_WIDTH, startWidth + deltaX)
  panelHeight.value = Math.max(MIN_HEIGHT, startHeight + deltaY)
}

const stopResize = () => {
  if (isResizing.value) {
    isResizing.value = false
    saveSize()
  }
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
}

onUnmounted(() => {
  document.removeEventListener('mousemove', onResize)
  document.removeEventListener('mouseup', stopResize)
})

// Debounce timer for auto-save
let saveTimer = null

// Sync local content when prop changes (e.g., when switching messages)
watch(() => props.content, (newContent) => {
  localContent.value = newContent
})

// Handle open/close transitions
watch(isOpen, (newValue) => {
  if (newValue) {
    // Opening: hide button first, panel shows after button fades out
    showButton.value = false
  } else {
    // Closing: hide panel first, button shows after panel slides out
    showPanel.value = false
  }
})

// Focus textarea when panel becomes visible
watch(showPanel, (newValue) => {
  if (newValue) {
    nextTick(() => {
      textareaRef.value?.focus()
    })
  }
})

const handleInput = () => {
  // Debounce the save to avoid excessive updates
  if (saveTimer) {
    clearTimeout(saveTimer)
  }
  saveTimer = setTimeout(() => {
    emit('update:content', localContent.value)
  }, 300)
}
</script>

<style scoped>
.scratchpad-container {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 1000;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
}

.scratchpad-toggle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-text-base, #000000);
  color: var(--color-bg-page, #ffffff);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--shadow-md, rgba(0, 0, 0, 0.12));
  transition: transform 0.2s, opacity 0.2s;
}

.scratchpad-toggle:hover {
  transform: scale(1.05);
  opacity: 0.85;
}

.streaming-toggle {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: var(--color-primary, #4a90a4);
  color: var(--color-bg-page, #ffffff);
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px var(--shadow-md, rgba(0, 0, 0, 0.12));
  transition: transform 0.2s, background-color 0.2s;
  margin-bottom: 12px;
}

.streaming-toggle:hover {
  transform: scale(1.05);
  background-color: var(--color-error-border, #c0392b);
}

.streaming-spinner {
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Streaming button fade transition */
.streaming-fade-enter-active,
.streaming-fade-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.streaming-fade-enter-from,
.streaming-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

.scratchpad-panel {
  position: relative;
  background-color: var(--color-bg-page, #fff);
  border: 1px solid var(--color-border-base, #ddd);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.15);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 16px;
  height: 16px;
  cursor: nwse-resize;
  z-index: 10;
}

.resize-handle::before {
  content: '';
  position: absolute;
  top: 4px;
  left: 4px;
  width: 8px;
  height: 8px;
  border-top: 2px solid var(--color-text-muted, #999);
  border-left: 2px solid var(--color-text-muted, #999);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.resize-handle:hover::before {
  opacity: 1;
}

.scratchpad-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  background-color: var(--color-bg-primary-subtle, #f5f5f5);
  border-bottom: 1px solid var(--color-border-base, #ddd);
}

.scratchpad-title {
  font-family: var(--message-font-family, Georgia, serif);
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--color-text-message, #333);
}

.scratchpad-close {
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #666);
  transition: background-color 0.2s, color 0.2s;
}

.scratchpad-close:hover {
  background-color: var(--color-bg-hover, #e0e0e0);
  color: var(--color-text-message, #333);
}

.scratchpad-textarea {
  flex: 1;
  padding: 12px 16px;
  border: none;
  resize: none;
  font-family: var(--message-font-family, Georgia, serif);
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-message, #333);
  background-color: var(--color-bg-page, #fff);
}

.scratchpad-textarea:focus {
  outline: none;
}

.scratchpad-textarea::placeholder {
  color: var(--color-text-muted, #999);
  font-style: italic;
}

/* Slide transition for panel */
.scratchpad-slide-enter-active,
.scratchpad-slide-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.scratchpad-slide-enter-from,
.scratchpad-slide-leave-to {
  opacity: 0;
  transform: translateY(16px) scale(0.95);
}

/* Fade transition for button */
.button-fade-enter-active {
  transition: opacity 0.15s ease 0.05s, transform 0.15s ease 0.05s;
}

.button-fade-leave-active {
  transition: opacity 0.1s ease, transform 0.1s ease;
}

.button-fade-enter-from,
.button-fade-leave-to {
  opacity: 0;
  transform: scale(0.8);
}

/* Mobile: move to top-right */
@media (max-width: 768px) {
  .scratchpad-container {
    top: 12px;
    bottom: auto;
    right: 12px;
  }

  .scratchpad-toggle,
  .streaming-toggle {
    width: 40px;
    height: 40px;
  }

  .streaming-toggle {
    margin-bottom: 8px;
  }

  .scratchpad-panel {
    position: fixed;
    top: 60px;
    right: 12px;
    bottom: auto;
    max-height: calc(100vh - 180px);
  }
}
</style>
