import { ref, watch, computed } from 'vue'

const STORAGE_KEY = 'studio-canvas-windows'

// Shared state (singleton pattern)
const windows = ref([])
const nextWindowId = ref(1)
const cascadeOffset = ref({ x: 0, y: 0 })
const maxZIndex = ref(100)
let watcherSetup = false

// Window type categories for grouping minimized windows
const TYPE_CATEGORIES = {
  chart: { name: 'Charts', icon: '📊', order: 1 },
  mermaid: { name: 'Diagrams', icon: '📐', order: 2 },
  svg: { name: 'Graphics', icon: '🎨', order: 3 },
  tool: { name: 'Tools', icon: '🔧', order: 4 },
  codeResult: { name: 'Code', icon: '💻', order: 5 }
}

// Constants
const CASCADE_STEP = 30
const CASCADE_RESET_THRESHOLD = 300

// Default sizes by type
const DEFAULT_SIZES = {
  chart: { width: 450, height: 350 },
  mermaid: { width: 500, height: 400 },
  svg: { width: 400, height: 400 },
  tool: { width: 350, height: 400 },
  codeResult: { width: 400, height: 250 }
}

// Minimum sizes
const MIN_SIZES = {
  chart: { width: 300, height: 250 },
  mermaid: { width: 300, height: 200 },
  svg: { width: 200, height: 200 },
  tool: { width: 250, height: 200 },
  codeResult: { width: 300, height: 150 }
}

/**
 * Save state to localStorage
 */
function saveToStorage() {
  try {
    const state = {
      windows: windows.value,
      nextWindowId: nextWindowId.value,
      cascadeOffset: cascadeOffset.value,
      maxZIndex: maxZIndex.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save canvas state:', e)
  }
}

/**
 * Load state from localStorage
 */
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const state = JSON.parse(stored)
      windows.value = state.windows || []
      nextWindowId.value = state.nextWindowId || 1
      cascadeOffset.value = state.cascadeOffset || { x: 0, y: 0 }
      maxZIndex.value = state.maxZIndex || 100
      return true
    }
  } catch (e) {
    console.warn('Failed to load canvas state:', e)
  }
  return false
}

/**
 * Get next cascade position
 */
function getNextCascadePosition() {
  const pos = { ...cascadeOffset.value }

  // Advance cascade
  cascadeOffset.value.x += CASCADE_STEP
  cascadeOffset.value.y += CASCADE_STEP

  // Reset if too far
  if (cascadeOffset.value.x > CASCADE_RESET_THRESHOLD) {
    cascadeOffset.value = { x: 0, y: 0 }
  }

  return pos
}

/**
 * Generate window title based on type and content
 */
function generateTitle(type, content) {
  switch (type) {
    case 'chart':
      return content?.title || 'Chart'
    case 'mermaid':
      return 'Diagram'
    case 'svg':
      return 'SVG'
    case 'tool':
      return content?.name || 'Tool'
    case 'codeResult':
      return 'Code Result'
    default:
      return 'Output'
  }
}

/**
 * Add a new window to the canvas
 */
function addWindow({ messageId, type, content }) {
  const id = `window-${nextWindowId.value++}`
  const position = getNextCascadePosition()
  const size = DEFAULT_SIZES[type] || { width: 400, height: 300 }

  maxZIndex.value++

  const window = {
    id,
    messageId,
    type,
    content,
    position,
    size: { ...size },
    zIndex: maxZIndex.value,
    title: generateTitle(type, content),
    minimized: false
  }

  windows.value.push(window)
  saveToStorage()
  return window
}

/**
 * Remove a window from the canvas
 */
function removeWindow(windowId) {
  const index = windows.value.findIndex(w => w.id === windowId)
  if (index !== -1) {
    windows.value.splice(index, 1)
    saveToStorage()
  }
}

/**
 * Update window position
 */
function updateWindowPosition(windowId, position) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    window.position = { ...position }
    saveToStorage()
  }
}

/**
 * Update window size
 */
function updateWindowSize(windowId, size) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    const minSize = MIN_SIZES[window.type] || { width: 200, height: 150 }
    window.size = {
      width: Math.max(size.width, minSize.width),
      height: Math.max(size.height, minSize.height)
    }
    saveToStorage()
  }
}

/**
 * Bring window to front
 */
function bringToFront(windowId) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    maxZIndex.value++
    window.zIndex = maxZIndex.value
    saveToStorage()
  }
}

/**
 * Update window title
 */
function updateWindowTitle(windowId, title) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    window.title = title
    saveToStorage()
  }
}

/**
 * Update window content
 */
function updateWindowContent(windowId, content) {
  const index = windows.value.findIndex(w => w.id === windowId)
  if (index !== -1) {
    // Replace the window object to ensure reactivity
    windows.value[index] = { ...windows.value[index], content }
    saveToStorage()
  }
}

/**
 * Minimize a window
 */
function minimizeWindow(windowId) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    window.minimized = true
    saveToStorage()
  }
}

/**
 * Restore a minimized window
 */
function restoreWindow(windowId) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    window.minimized = false
    bringToFront(windowId)
  }
}

/**
 * Computed: visible windows (not minimized)
 */
const visibleWindows = computed(() =>
  windows.value.filter(w => !w.minimized)
)

/**
 * Computed: minimized windows grouped by category
 */
const minimizedWindowsByCategory = computed(() => {
  const minimized = windows.value.filter(w => w.minimized)
  const grouped = {}

  for (const win of minimized) {
    const category = TYPE_CATEGORIES[win.type] || { name: 'Other', icon: '📋', order: 99 }
    if (!grouped[win.type]) {
      grouped[win.type] = {
        type: win.type,
        ...category,
        windows: []
      }
    }
    grouped[win.type].windows.push(win)
  }

  // Sort by category order
  return Object.values(grouped).sort((a, b) => a.order - b.order)
})

/**
 * Get window by message ID
 */
function getWindowByMessageId(messageId) {
  return windows.value.find(w => w.messageId === messageId)
}

/**
 * Clear all windows
 */
function clearWindows() {
  windows.value = []
  cascadeOffset.value = { x: 0, y: 0 }
  saveToStorage()
}

/**
 * Get minimum size for a window type
 */
function getMinSize(type) {
  return MIN_SIZES[type] || { width: 200, height: 150 }
}

/**
 * Reset all state to defaults (for testing)
 */
function resetState() {
  windows.value = []
  nextWindowId.value = 1
  cascadeOffset.value = { x: 0, y: 0 }
  maxZIndex.value = 100
}

// Initialize from storage on module load
loadFromStorage()

/**
 * Composable for managing output windows in the Studio canvas
 */
export function useStudioCanvas() {
  // Set up watcher only once
  if (!watcherSetup) {
    watch(windows, saveToStorage, { deep: true })
    watcherSetup = true
  }

  return {
    // State
    windows,
    visibleWindows,
    minimizedWindowsByCategory,

    // Actions
    addWindow,
    removeWindow,
    updateWindowPosition,
    updateWindowSize,
    updateWindowTitle,
    updateWindowContent,
    bringToFront,
    minimizeWindow,
    restoreWindow,
    getWindowByMessageId,
    clearWindows,
    getMinSize,

    // Storage
    saveToStorage,
    loadFromStorage,

    // Testing
    resetState
  }
}
