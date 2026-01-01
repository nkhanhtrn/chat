import { ref, computed, watch, nextTick } from 'vue'
import { debugLog } from '../../utils/debug.js'
import {
  saveStudioSessionsToFirestore,
  saveSingleSessionToFirestore,
  loadStudioSessionsFromFirestore,
  deleteStudioSessionFromFirestore,
  mergeCloudLocal
} from '../../services/firestore.js'

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
async function saveToStorage() {
  try {
    debugLog('[Session Sync] saveToStorage called - syncing ALL sessions:', sessions.value.length)
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

    // Also sync to Firestore
    await saveStudioSessionsToFirestore(sessions.value, activeSessionId.value)
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
 * Initialize sessions from Firestore with bidirectional merge (same as tools/notebooks)
 * Uses generic mergeCloudLocal utility
 */
async function initializeSessions() {
  skipWatch = true
  try {
    // Load both cloud and local sessions
    const cloudData = await loadStudioSessionsFromFirestore()
    const localStored = localStorage.getItem(STORAGE_KEY)
    const localState = localStored ? JSON.parse(localStored) : { sessions: [], activeSessionId: null, nextSessionNumber: 1 }

    const cloudSessions = cloudData?.sessions || []
    const localSessions = localState.sessions || []

    // Use generic merge utility
    const { merged: mergedSessions, toUpload: sessionsToUpload, fromCloud, toCloud } =
      mergeCloudLocal(cloudSessions, localSessions)

    // Sort by createdAt to maintain order
    mergedSessions.sort((a, b) => a.createdAt - b.createdAt)

    sessions.value = mergedSessions

    // Calculate nextSessionNumber from all sessions
    nextSessionNumber.value = Math.max(...mergedSessions.map(s => {
      const match = s.name.match(/Session (\d+)/)
      return match ? parseInt(match[1]) + 1 : 1
    }), localState.nextSessionNumber || 1)

    // Active session: prefer cloud's active, fall back to local's, then first session
    activeSessionId.value = cloudData?.activeSessionId || localState.activeSessionId || sessions.value[0]?.id || null

    // Don't sync sessions to cloud during initialization
    // Sessions will be synced when explicitly opened

    // Save merged state to localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
      nextSessionNumber: nextSessionNumber.value
    }))

    if (fromCloud > 0 || toCloud > 0) {
      console.log(`Sessions merge: ${fromCloud} from cloud, ${toCloud} to cloud`)
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

    // Clean up tool instance data for this session
    // Tool instance keys are stored as: tool-instance-${sessionId}-${toolId}
    const toolPrefix = `tool-instance-${sessionId}-`
    const keysToRemove = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(toolPrefix)) {
        keysToRemove.push(key)
      }
    }
    keysToRemove.forEach(key => localStorage.removeItem(key))

    console.log(`Deleted ${keysToRemove.length} tool instance data entries for session ${sessionId}`)
  } catch (e) {
    console.warn('Failed to clean up session storage:', e)
  }

  sessions.value.splice(sessionIndex, 1)
  saveToStorage()

  // Also delete from Firestore
  await deleteStudioSessionFromFirestore(sessionId)

  return session
}

/**
 * Update chat state for active session (called by useStudioChat)
 */
function updateChatState(chatState) {
  const session = getActiveSession()
  if (session) {
    debugLog('[Session Sync] updateChatState called for session:', session.id)

    // Set skipWatch at the START to prevent watcher from triggering during this entire operation
    skipWatch = true

    session.updatedAt = Date.now()

    // Persist to localStorage
    const chatKey = `${CHAT_STORAGE_KEY}-${session.id}`
    try {
      localStorage.setItem(chatKey, JSON.stringify(chatState))
    } catch (e) {
      console.warn('Failed to save chat state:', e)
    }

    debugLog('[Session Sync] Syncing single session to Firestore:', session.id)
    // Sync only this session to Firestore (not all sessions)
    saveSingleSessionToFirestore(session, activeSessionId.value)
      .then(() => {
        debugLog('[Session Sync] ✅ Single session sync complete')
      })
      .catch(err => {
        console.warn('Failed to sync session chat state to cloud:', err)
      })
      .finally(() => {
        // Clear skipWatch AFTER sync is complete
        skipWatch = false
        debugLog('[Session Sync] skipWatch flag cleared')
      })
  }
}

/**
 * Update canvas state for active session (called by useStudioCanvas)
 */
function updateCanvasState(canvasState) {
  const session = getActiveSession()
  if (session) {
    debugLog('[Session Sync] updateCanvasState called for session:', session.id, 'windows:', canvasState.windows.length)

    // Set skipWatch at the START to prevent watcher from triggering during this entire operation
    skipWatch = true

    session.updatedAt = Date.now()

    // Persist to localStorage
    const canvasKey = `${CANVAS_STORAGE_KEY}-${session.id}`
    try {
      localStorage.setItem(canvasKey, JSON.stringify(canvasState))
    } catch (e) {
      console.warn('Failed to save canvas state:', e)
    }

    debugLog('[Session Sync] Syncing single session to Firestore:', session.id)
    // Sync only this session to Firestore (not all sessions)
    saveSingleSessionToFirestore(session, activeSessionId.value)
      .then(() => {
        debugLog('[Session Sync] ✅ Single session sync complete')
      })
      .catch(err => {
        console.warn('Failed to sync session canvas state to cloud:', err)
      })
      .finally(() => {
        // Clear skipWatch AFTER sync is complete
        skipWatch = false
        debugLog('[Session Sync] skipWatch flag cleared')
      })
  }
}

/**
 * Force sync to cloud - immediately sync all sessions to Firestore
 */
async function forceSyncToCloud() {
  await saveStudioSessionsToFirestore(sessions.value, activeSessionId.value)
}

/**
 * Sync a session's complete state (chat, canvas windows, positions) to Firestore
 * This is called when explicitly opening a session
 * @param {string} sessionId - The session ID to sync
 */
async function syncSessionData(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) {
    console.warn('Session not found:', sessionId)
    return
  }

  try {
    debugLog('[Session Sync] Syncing session data on open:', sessionId)

    // Collect all data for this session from localStorage
    const chatKey = `${CHAT_STORAGE_KEY}-${sessionId}`
    const canvasKey = `${CANVAS_STORAGE_KEY}-${sessionId}`
    const chatState = localStorage.getItem(chatKey)
    const canvasState = localStorage.getItem(canvasKey)

    // Collect tool instance data for this session
    const toolInstanceData = {}
    const toolPrefix = `tool-instance-${sessionId}-`
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(toolPrefix)) {
        const toolId = key.slice(toolPrefix.length)
        try {
          toolInstanceData[toolId] = JSON.parse(localStorage.getItem(key))
        } catch (e) {
          console.warn(`Failed to parse tool instance data for ${key}:`, e)
        }
      }
    }

    // Save to Firestore with all current state
    await saveSingleSessionToFirestore({
      ...session,
      chatState: chatState ? JSON.parse(chatState) : null,
      canvasState: canvasState ? JSON.parse(canvasState) : null,
      toolInstanceData
    }, activeSessionId.value)

    debugLog('[Session Sync] ✅ Session data synced:', sessionId)
  } catch (error) {
    console.error('Failed to sync session data:', error)
  }
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
  debugLog('[Session Sync] Deep watcher triggered, skipWatch:', skipWatch)
  if (!skipWatch) {
    saveToStorage()
  } else {
    debugLog('[Session Sync] ⏭️ Skipping full sync - skipWatch flag is set')
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
    syncSessionData,

    // Testing
    resetStateForTesting,
    enableSkipWatch,
    disableSkipWatch
  }
}
