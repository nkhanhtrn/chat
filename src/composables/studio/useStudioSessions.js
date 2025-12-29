import { ref, computed, watch, nextTick } from 'vue'

const STORAGE_KEY = 'studio-sessions'
const CHAT_STORAGE_KEY = 'studio-chat'
const CANVAS_STORAGE_KEY = 'studio-canvas-windows'

// Session state
const sessions = ref([])
const activeSessionId = ref(null)
const nextSessionNumber = ref(1)

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Save sessions to localStorage
 */
function saveToStorage() {
  try {
    const state = {
      sessions: sessions.value.map(s => ({
        id: s.id,
        name: s.name,
        showInTabs: s.showInTabs,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      activeSessionId: activeSessionId.value,
      nextSessionNumber: nextSessionNumber.value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save sessions:', e)
  }
}

/**
 * Save per-session data (chat and canvas state)
 */
function saveSessionData(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return

  try {
    // Save chat state for this session
    const chatKey = `${CHAT_STORAGE_KEY}-${sessionId}`
    const chatState = {
      messages: session.chatMessages || [],
      nextMessageId: session.nextMessageId || 1
    }
    localStorage.setItem(chatKey, JSON.stringify(chatState))

    // Save canvas state for this session
    const canvasKey = `${CANVAS_STORAGE_KEY}-${sessionId}`
    const canvasState = {
      windows: session.canvasWindows || [],
      nextWindowId: session.nextWindowId || 1,
      cascadeOffset: session.cascadeOffset || { x: 0, y: 0 },
      maxZIndex: session.maxZIndex || 100
    }
    localStorage.setItem(canvasKey, JSON.stringify(canvasState))
  } catch (e) {
    console.warn('Failed to save session data:', e)
  }
}

/**
 * Load per-session data
 */
function loadSessionData(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return { chat: null, canvas: null }

  try {
    // Load chat state
    const chatKey = `${CHAT_STORAGE_KEY}-${sessionId}`
    const chatStored = localStorage.getItem(chatKey)
    const chatState = chatStored ? JSON.parse(chatStored) : { messages: [], nextMessageId: 1 }

    // Load canvas state
    const canvasKey = `${CANVAS_STORAGE_KEY}-${sessionId}`
    const canvasStored = localStorage.getItem(canvasKey)
    const canvasState = canvasStored ? JSON.parse(canvasStored) : {
      windows: [],
      nextWindowId: 1,
      cascadeOffset: { x: 0, y: 0 },
      maxZIndex: 100
    }

    return { chat: chatState, canvas: canvasState }
  } catch (e) {
    console.warn('Failed to load session data:', e)
    return { chat: null, canvas: null }
  }
}

/**
 * Migrate legacy data to first session (for backwards compatibility)
 */
function migrateLegacyData() {
  try {
    // Check if we have legacy chat data
    const legacyChat = localStorage.getItem(CHAT_STORAGE_KEY)
    const legacyCanvas = localStorage.getItem(CANVAS_STORAGE_KEY)

    if (!legacyChat && !legacyCanvas) return

    // Create first session with legacy data
    const sessionId = generateSessionId()
    const session = {
      id: sessionId,
      name: 'Session',
      showInTabs: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }

    sessions.value.push(session)

    // Migrate chat data
    if (legacyChat) {
      const chatKey = `${CHAT_STORAGE_KEY}-${sessionId}`
      localStorage.setItem(chatKey, legacyChat)
      localStorage.removeItem(CHAT_STORAGE_KEY)
    }

    // Migrate canvas data
    if (legacyCanvas) {
      const canvasKey = `${CANVAS_STORAGE_KEY}-${sessionId}`
      localStorage.setItem(canvasKey, legacyCanvas)
      localStorage.removeItem(CANVAS_STORAGE_KEY)
    }

    activeSessionId.value = sessionId
    saveToStorage()
  } catch (e) {
    console.warn('Failed to migrate legacy data:', e)
  }
}

/**
 * Initialize sessions from localStorage
 */
async function initializeSessions() {
  skipWatch = true
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const state = JSON.parse(stored)
      sessions.value = state.sessions || []
      activeSessionId.value = state.activeSessionId || null
      nextSessionNumber.value = state.nextSessionNumber || 1
    }

    // If no sessions exist, migrate legacy data or create default session
    if (sessions.value.length === 0) {
      migrateLegacyData()
    }

    // If still no sessions, create a default one
    if (sessions.value.length === 0) {
      createNewSession()
    }

    // Ensure we have an active session
    if (!activeSessionId.value && sessions.value.length > 0) {
      activeSessionId.value = sessions.value[0].id
    }
  } catch (e) {
    console.warn('Failed to initialize sessions:', e)
    // Create default session on error
    createNewSession()
  } finally {
    skipWatch = false
  }
}

/**
 * Create a new session
 */
function createNewSession() {
  const sessionNumber = nextSessionNumber.value++
  const newSession = {
    id: generateSessionId(),
    name: sessionNumber === 1 ? 'Session' : `Session ${sessionNumber}`,
    showInTabs: true,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  sessions.value.push(newSession)
  activeSessionId.value = newSession.id
  if (!skipWatch) {
    saveToStorage()
  }

  return newSession
}

/**
 * Get the active session
 */
function getActiveSession() {
  return sessions.value.find(s => s.id === activeSessionId.value) || null
}

/**
 * Switch to a different session
 * Returns the session data that should be loaded into chat/canvas
 * Note: Caller is responsible for saving current state before calling this
 */
function switchToSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return null

  // Update the active session and save session metadata
  activeSessionId.value = sessionId
  session.updatedAt = Date.now()
  saveToStorage()

  // Return the new session's data to be loaded
  return loadSessionData(sessionId)
}

/**
 * Rename a session
 */
function renameSession(sessionId, newName) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session && newName.trim()) {
    session.name = newName.trim()
    session.updatedAt = Date.now()
    saveToStorage()
  }
}

/**
 * Hide a session (remove from tabs)
 */
function hideSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.showInTabs = false
    session.updatedAt = Date.now()
    saveToStorage()
  }
}

/**
 * Show a session (add to tabs)
 */
function showSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.showInTabs = true
    session.updatedAt = Date.now()
    saveToStorage()
  }
}

/**
 * Delete a session (cannot delete the only session or active session)
 * Returns the ID of the session that should become active, or null
 */
async function deleteSession(sessionId) {
  const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
  if (sessionIndex === -1) return null

  // Cannot delete if it's the only session
  if (sessions.value.length === 1) {
    return null
  }

  // Cannot delete if it's the active session
  if (sessionId === activeSessionId.value) {
    return null
  }

  const session = sessions.value[sessionIndex]

  // Clean up per-session storage
  try {
    localStorage.removeItem(`${CHAT_STORAGE_KEY}-${sessionId}`)
    localStorage.removeItem(`${CANVAS_STORAGE_KEY}-${sessionId}`)
  } catch (e) {
    console.warn('Failed to clean up session storage:', e)
  }

  sessions.value.splice(sessionIndex, 1)
  saveToStorage()

  return session
}

/**
 * Update chat state for active session (called by useStudioChat)
 */
function updateChatState(chatState) {
  const session = getActiveSession()
  if (session) {
    session.chatMessages = chatState.messages
    session.nextMessageId = chatState.nextMessageId
    session.updatedAt = Date.now()

    // Persist to localStorage
    const chatKey = `${CHAT_STORAGE_KEY}-${session.id}`
    try {
      localStorage.setItem(chatKey, JSON.stringify(chatState))
    } catch (e) {
      console.warn('Failed to save chat state:', e)
    }
  }
}

/**
 * Update canvas state for active session (called by useStudioCanvas)
 */
function updateCanvasState(canvasState) {
  const session = getActiveSession()
  if (session) {
    session.canvasWindows = canvasState.windows
    session.nextWindowId = canvasState.nextWindowId
    session.cascadeOffset = canvasState.cascadeOffset
    session.maxZIndex = canvasState.maxZIndex
    session.updatedAt = Date.now()

    // Persist to localStorage
    const canvasKey = `${CANVAS_STORAGE_KEY}-${session.id}`
    try {
      localStorage.setItem(canvasKey, JSON.stringify(canvasState))
    } catch (e) {
      console.warn('Failed to save canvas state:', e)
    }
  }
}

/**
 * Force sync to cloud - no-op for now (could be added later)
 */
async function forceSyncToCloud() {
  // No cloud sync for sessions currently
}

/**
 * Computed: active session
 */
const activeSession = computed(() => getActiveSession())

/**
 * Computed: visible sessions (showInTabs = true, in original order)
 */
const sortedSessions = computed(() => {
  return sessions.value.filter(s => s.showInTabs)
})

/**
 * Computed: all sessions (for session browser, in original order)
 */
const allSessions = computed(() => [...sessions.value])

/**
 * Computed: active session's chat state
 */
const activeChatState = computed(() => {
  const session = getActiveSession()
  if (!session) return { messages: [], nextMessageId: 1 }
  const data = loadSessionData(session.id)
  return data.chat || { messages: [], nextMessageId: 1 }
})

/**
 * Computed: active session's canvas state
 */
const activeCanvasState = computed(() => {
  const session = getActiveSession()
  if (!session) {
    return {
      windows: [],
      nextWindowId: 1,
      cascadeOffset: { x: 0, y: 0 },
      maxZIndex: 100
    }
  }
  const data = loadSessionData(session.id)
  return data.canvas || {
    windows: [],
    nextWindowId: 1,
    cascadeOffset: { x: 0, y: 0 },
    maxZIndex: 100
  }
})

// Flag to skip watch during reset and initialization
let skipWatch = false

// Watch sessions for changes and save
watch(sessions, () => {
  if (!skipWatch) {
    saveToStorage()
  }
}, { deep: true })

/**
 * Reset all state to defaults (for testing only)
 * Note: Caller is responsible for setting skipWatch flag appropriately
 */
function resetStateForTesting() {
  sessions.value = []
  activeSessionId.value = null
  nextSessionNumber.value = 1
}

/**
 * Enable watch skipping (for testing)
 */
function enableSkipWatch() {
  skipWatch = true
}

/**
 * Disable watch skipping (for testing)
 */
function disableSkipWatch() {
  skipWatch = false
}

/**
 * Session management composable for AI Studio
 */
export function useStudioSessions() {
  return {
    // State
    sessions,
    activeSessionId,
    activeSession,
    sortedSessions,
    allSessions,

    // Active session data
    activeChatState,
    activeCanvasState,

    // Initialization
    initializeSessions,

    // Session CRUD
    createNewSession,
    switchToSession,
    renameSession,
    hideSession,
    showSession,
    deleteSession,

    // State updating
    updateChatState,
    updateCanvasState,

    // Cloud sync
    forceSyncToCloud,

    // Testing
    resetStateForTesting,
    enableSkipWatch,
    disableSkipWatch
  }
}
