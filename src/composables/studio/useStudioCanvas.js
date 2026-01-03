import { ref, computed, watch } from 'vue'
import StudioStorage from '../../services/StudioStorage.js'

// UI-only state (not persisted, for smooth UX)
const maxZIndex = ref(100)

// History stack for tool windows (Map of windowId -> Array of previous content states)
// This is runtime-only, not persisted
const toolHistory = new Map()

// Reactive canvas state for the active session (loaded async from IndexedDB)
const activeCanvasState = ref(null)

// Window display states
export const DISPLAY_STATES = {
  OPEN: 'open',
  MINIMIZED: 'minimized',
  CLOSED: 'closed'
}

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

// ============================================================
// UI Helpers
// ============================================================

/**
 * Clean an object by removing undefined values (for Firestore compatibility)
 */
function cleanObject(obj) {
  if (!obj || typeof obj !== 'object') return obj
  if (Array.isArray(obj)) return obj.map(cleanObject)

  const cleaned = {}
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      cleaned[key] = typeof value === 'object' ? cleanObject(value) : value
    }
  }
  return cleaned
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
 * Get next z-index (UI-only state)
 */
function getNextZIndex() {
  return ++maxZIndex.value
}

/**
 * Get default size for window type
 */
function getDefaultSize(type) {
  return DEFAULT_SIZES[type] || { width: 400, height: 300 }
}

/**
 * Get minimum size for window type
 */
function getMinSize(type) {
  return MIN_SIZES[type] || { width: 200, height: 150 }
}

// ============================================================
// Canvas State Storage (delegates to StudioStorage)
// ============================================================

/**
 * Save canvas state (windows) for a specific session
 */
async function saveCanvasState(sessionId, canvasState) {
  return StudioStorage.saveCanvasState(sessionId, canvasState)
}

/**
 * Load canvas state (windows) for a specific session
 */
async function loadCanvasState(sessionId) {
  return StudioStorage.loadCanvasState(sessionId)
}

// ============================================================
// History Management (Runtime-only, not persisted)
// ============================================================

/**
 * Push current content to history before updating
 */
export function pushToHistory(windowId, content) {
  if (!toolHistory.has(windowId)) {
    toolHistory.set(windowId, [])
  }
  // Deep clone content to store in history
  toolHistory.get(windowId).push(JSON.parse(JSON.stringify(content)))
}

/**
 * Check if window has history
 */
export function hasHistory(windowId) {
  const history = toolHistory.get(windowId)
  return !!(history && history.length > 0)
}

/**
 * Pop and restore previous content from history
 */
export function popFromHistory(windowId) {
  const history = toolHistory.get(windowId)
  if (!history || history.length === 0) return null
  return history.pop()
}

/**
 * Clear history for a window
 */
export function clearHistory(windowId) {
  toolHistory.delete(windowId)
}

// ============================================================
// Export the composable
// ============================================================

export function useStudioCanvas(activeSessionId) {
  // Watch activeSessionId to load canvas data
  watch(activeSessionId, async (newSessionId) => {
    if (newSessionId) {
      activeCanvasState.value = await loadCanvasState(newSessionId)
    } else {
      activeCanvasState.value = null
    }
  }, { immediate: true })

  // Computed: all windows for active session
  const windows = computed(() => {
    if (!activeSessionId?.value) return []
    return activeCanvasState.value?.windows || []
  })

  // Computed: visible windows (not closed)
  const visibleWindows = computed(() =>
    windows.value.filter(w => w.displayState !== 'closed')
  )

  // Window type categories for grouping minimized windows
  const TYPE_CATEGORIES = {
    chart: { name: 'Charts', icon: '📊', order: 1 },
    mermaid: { name: 'Diagrams', icon: '📐', order: 2 },
    svg: { name: 'Graphics', icon: '🎨', order: 3 },
    tool: { name: 'Tools', icon: '🔧', order: 4 },
    codeResult: { name: 'Code', icon: '💻', order: 5 }
  }

  // Computed: minimized windows grouped by category
  const minimizedWindowsByCategory = computed(() => {
    const minimized = windows.value.filter(w => w.displayState === 'minimized')
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

  // ============================================================
  // Window CRUD Operations (inside composable to access activeSessionId)
  // ============================================================

  /**
   * Add a window to a session
   */
  async function addWindow(sessionId, window) {
    const canvasState = await loadCanvasState(sessionId)

    // Ensure window has required properties
    const completeWindow = {
      id: window.id || crypto.randomUUID(),
      type: window.type || 'text',
      content: window.content || null,
      title: window.title || '',
      position: window.position || { x: 100, y: 100 },
      size: window.size || { width: 400, height: 300 },
      zIndex: window.zIndex || (canvasState.maxZIndex || 100) + 1,
      displayState: window.displayState || 'open'
    }

    canvasState.windows.push(completeWindow)
    canvasState.nextWindowId = (canvasState.nextWindowId || 1) + 1
    canvasState.maxZIndex = Math.max(canvasState.maxZIndex || 100, completeWindow.zIndex)
    await saveCanvasState(sessionId, canvasState)

    // Update reactive ref if this is the active session
    if (sessionId === activeSessionId.value) {
      activeCanvasState.value = canvasState
    }
  }

  /**
   * Remove a window from a session
   */
  async function removeWindow(sessionId, windowId) {
    const canvasState = await loadCanvasState(sessionId)
    canvasState.windows = canvasState.windows.filter(w => w.id !== windowId)
    await saveCanvasState(sessionId, canvasState)

    // Update reactive ref if this is the active session
    if (sessionId === activeSessionId.value) {
      activeCanvasState.value = canvasState
    }
  }

  /**
   * Update a window in a session
   */
  async function updateWindow(sessionId, windowId, updates) {
    const canvasState = await loadCanvasState(sessionId)
    const window = canvasState.windows.find(w => w.id === windowId)
    if (window) {
      Object.assign(window, updates)
      // Update maxZIndex if provided
      if (updates.zIndex !== undefined) {
        canvasState.maxZIndex = Math.max(canvasState.maxZIndex || 100, updates.zIndex)
      }
      await saveCanvasState(sessionId, canvasState)

      // Update reactive ref if this is the active session
      if (sessionId === activeSessionId.value) {
        activeCanvasState.value = canvasState
      }
    }
  }

  /**
   * Get all windows for a session (synchronous - uses activeCanvasState if matches)
   */
  function getWindows(sessionId) {
    if (sessionId === activeSessionId.value && activeCanvasState.value) {
      return activeCanvasState.value.windows || []
    }
    // For non-active sessions, we'd need to load from IndexedDB
    // For now, return empty and let the caller load the session first
    return []
  }

  return {
    // === State ===
    activeCanvasState,

    // === Computed ===
    windows,
    visibleWindows,
    minimizedWindowsByCategory,

    // === UI Helpers ===
    getNextZIndex,
    getDefaultSize,
    getMinSize,
    generateTitle,
    cleanObject,

    // === Canvas Storage ===
    saveCanvasState,
    loadCanvasState,

    // === Window CRUD ===
    getWindows,
    addWindow,
    removeWindow,
    updateWindow,

    // === History (Runtime-only) ===
    pushToHistory,
    hasHistory,
    popFromHistory,
    clearHistory,

    // === Constants ===
    DISPLAY_STATES
  }
}
