import { ref, watch, computed } from 'vue'
import { saveTool } from '../../services/indexedDB.js'

const STORAGE_KEY = 'studio-canvas-windows'
let sessionManager = null

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
 * Set the session manager (called by parent component)
 */
function setSessionManager(manager) {
  sessionManager = manager
}

/**
 * Load state from session data (for session switching)
 */
function loadState(canvasState) {
  if (canvasState) {
    windows.value = canvasState.windows || []
    nextWindowId.value = canvasState.nextWindowId || 1
    cascadeOffset.value = canvasState.cascadeOffset || { x: 0, y: 0 }
    maxZIndex.value = canvasState.maxZIndex || 100
  } else {
    windows.value = []
    nextWindowId.value = 1
    cascadeOffset.value = { x: 0, y: 0 }
    maxZIndex.value = 100
  }
}

/**
 * Get current state (for session switching)
 */
function getState() {
  return {
    windows: windows.value,
    nextWindowId: nextWindowId.value,
    cascadeOffset: cascadeOffset.value,
    maxZIndex: maxZIndex.value
  }
}

/**
 * Save state to session (via session manager or localStorage)
 */
function saveToStorage() {
  const state = {
    windows: windows.value,
    nextWindowId: nextWindowId.value,
    cascadeOffset: cascadeOffset.value,
    maxZIndex: maxZIndex.value
  }

  // If session manager is available, use it
  if (sessionManager) {
    sessionManager.updateCanvasState(state)
    return
  }

  // Fall back to localStorage for backwards compatibility
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save canvas state:', e)
  }
}

/**
 * Load state from storage (no longer used, kept for compatibility)
 */
function loadFromStorage() {
  // State is now loaded via loadState() when sessions are initialized
  return false
}

// Don't auto-load from storage on module load - sessions will handle this

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
 * For tool type: closes any existing tool windows first (one tool at a time)
 * @param {Object} options - Window options
 * @param {string} options.messageId - Message ID
 * @param {string} options.type - Window type
 * @param {Object} options.content - Window content
 * @param {boolean} options.preserveExisting - If true, don't close existing tool windows (for cloning)
 */
function addWindow({ messageId, type, content, preserveExisting }) {
  // If adding a tool window (and not preserving existing), close any existing tool windows first
  if (type === 'tool' && !preserveExisting) {
    const existingToolWindows = windows.value.filter(w => w.type === 'tool')
    for (const existingWindow of existingToolWindows) {
      removeWindow(existingWindow.id)
    }
  }

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
 * Update window title (also updates tool name and saves to IndexedDB)
 */
function updateWindowTitle(windowId, title) {
  const window = windows.value.find(w => w.id === windowId)
  if (window) {
    window.title = title
    // Also update content.name for tools and save to IndexedDB
    if (window.type === 'tool' && window.content) {
      window.content = { ...window.content, name: title }
      if (window.content.code) {
        saveTool({
          id: window.content.id, // Use id to support renaming
          name: title,
          emoji: window.content.emoji,
          type: window.content.type,
          code: window.content.code
        }).catch(console.error)
      }
    }
    saveToStorage()
  }
}

/**
 * Update window content (preserves existing name/emoji/id on edit, saves tools to IndexedDB)
 */
function updateWindowContent(windowId, content) {
  const index = windows.value.findIndex(w => w.id === windowId)
  if (index !== -1) {
    const window = windows.value[index]
    const existingContent = window.content
    // Preserve existing id, name and emoji when editing (don't regenerate)
    const mergedContent = {
      ...content,
      id: existingContent?.id || content?.id,
      name: existingContent?.name || content?.name,
      emoji: existingContent?.emoji || content?.emoji
    }
    // Replace the window object to ensure reactivity
    windows.value[index] = { ...window, content: mergedContent }
    saveToStorage()

    // Save tool to IndexedDB
    if (window.type === 'tool' && mergedContent.name && mergedContent.code) {
      saveTool({
        id: mergedContent.id,
        name: mergedContent.name,
        emoji: mergedContent.emoji,
        type: mergedContent.type,
        code: mergedContent.code
      }).catch(console.error)
    }
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
 * Clone a window (creates a new window with same content, cascade position)
 */
function cloneWindow(window) {
  const clonedContent = JSON.parse(JSON.stringify(window.content))

  // Generate unique name for cloned tool
  if (clonedContent.name) {
    const baseName = clonedContent.name.replace(/ \(Copy( \d+)?\)$/, '')
    const existingNames = windows.value
      .filter(w => w.type === 'tool' && w.content?.name)
      .map(w => w.content.name)

    let copyNum = 1
    let newName = `${baseName} (Copy)`
    while (existingNames.includes(newName)) {
      copyNum++
      newName = `${baseName} (Copy ${copyNum})`
    }
    clonedContent.name = newName
  }

  const newWindow = addWindow({
    type: window.type,
    content: clonedContent,
    preserveExisting: true  // Keep the original window when cloning
  })

  // Save cloned tool to IndexedDB
  if (window.type === 'tool' && clonedContent.name) {
    saveTool({
      name: clonedContent.name,
      emoji: clonedContent.emoji,
      type: clonedContent.type,
      code: clonedContent.code
    }).catch(console.error)
  }

  return newWindow
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
 * Remove the last window added
 * @returns {Object|null} The removed window or null if no windows
 */
function removeLastWindow() {
  if (windows.value.length === 0) return null
  const removed = windows.value.pop()
  saveToStorage()
  return removed
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
    removeLastWindow,
    cloneWindow,
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

    // Session support
    setSessionManager,
    loadState,
    getState,

    // Testing
    resetState
  }
}
