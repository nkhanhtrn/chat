import { ref, computed, watch } from 'vue'
import { debugLog } from '../../utils/debug.js'
import StudioStorage from '../../services/StudioStorage.js'

// Session state
const sessions = ref([])
const activeSessionId = ref(null)
const nextSessionNumber = ref(1)

// Reactive ref for active session tools (loaded async from IndexedDB)
const activeTools = ref({})

// Watch flag to prevent save loops
let skipWatch = false

/**
 * Generate a unique session ID
 */
function generateSessionId() {
  return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

/**
 * Generate a unique tool instance ID
 */
function generateToolInstanceId() {
  return `tool-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

// ============================================================
// Session Metadata Storage (delegates to StudioStorage)
// ============================================================

/**
 * Save session metadata to localStorage
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
    StudioStorage.saveSessions(state)
  } catch (e) {
    console.warn('Failed to save sessions:', e)
  }
}

// ============================================================
// Tools Storage (delegates to StudioStorage)
// ============================================================

/**
 * Save all tools for a specific session
 */
async function saveTools(sessionId, tools) {
  return StudioStorage.saveTools(sessionId, tools)
}

/**
 * Load all tools for a specific session
 */
async function loadTools(sessionId) {
  return StudioStorage.loadTools(sessionId)
}

/**
 * Get a specific tool instance from a session
 */
async function getTool(sessionId, instanceId) {
  const tools = await loadTools(sessionId)
  return tools[instanceId] || null
}

/**
 * Save a specific tool instance to a session
 */
async function saveTool(sessionId, instanceId, tool) {
  const tools = await loadTools(sessionId)
  tools[instanceId] = tool
  await saveTools(sessionId, tools)

  // Update reactive ref if this is the active session
  if (sessionId === activeSessionId.value) {
    activeTools.value = tools
  }
}

/**
 * Delete a specific tool instance from a session
 */
async function deleteTool(sessionId, instanceId) {
  const tools = await loadTools(sessionId)
  delete tools[instanceId]
  await saveTools(sessionId, tools)

  // Update reactive ref if this is the active session
  if (sessionId === activeSessionId.value) {
    activeTools.value = tools
  }
}

// ============================================================
// Session Initialization
// ============================================================

/**
 * Initialize sessions from localStorage
 */
async function initializeSessions() {
  skipWatch = true
  try {
    // Load from localStorage via StudioStorage
    const localState = StudioStorage.loadSessions()
    const state = localState || { sessions: [], activeSessionId: null, nextSessionNumber: 1 }

    const localSessions = state.sessions || []

    // Sort by createdAt to maintain order
    localSessions.sort((a, b) => a.createdAt - b.createdAt)

    sessions.value = localSessions

    // Calculate nextSessionNumber from all sessions
    nextSessionNumber.value = Math.max(...localSessions.map(s => {
      const match = s.name.match(/Session (\d+)/)
      return match ? parseInt(match[1]) + 1 : 1
    }), state.nextSessionNumber || 1)

    // Active session: use local's active, or first session
    activeSessionId.value = state.activeSessionId || sessions.value[0]?.id || null

    // If no sessions exist, create a default one
    if (sessions.value.length === 0) {
      const newSession = createNewSession()

      // Migrate legacy data to the new session if exists
      StudioStorage.migrateLegacyData(newSession.id)
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

// ============================================================
// Session Metadata Operations
// ============================================================

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
 * Rename a session
 */
async function renameSession(sessionId, newName) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session && newName.trim()) {
    session.name = newName.trim()
    session.updatedAt = Date.now()
    await saveToStorage()
  }
}

/**
 * Hide a session (remove from tabs)
 */
async function hideSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.showInTabs = false
    session.updatedAt = Date.now()
    await saveToStorage()
  }
}

/**
 * Show a session (add to tabs)
 */
async function showSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.showInTabs = true
    session.updatedAt = Date.now()
    await saveToStorage()
  }
}

/**
 * Delete a session (cannot delete the only session or active session)
 */
async function deleteSession(sessionId) {
  const sessionIndex = sessions.value.findIndex(s => s.id === sessionId)
  if (sessionIndex === -1) return null

  if (sessions.value.length === 1) {
    return null
  }

  if (sessionId === activeSessionId.value) {
    return null
  }

  const session = sessions.value[sessionIndex]

  // Clean up per-session storage via StudioStorage
  await StudioStorage.deleteSession(sessionId)

  sessions.value.splice(sessionIndex, 1)
  await saveToStorage()

  return session
}

// ============================================================
// Tool Operations (Session owns tools with code+data)
// ============================================================

/**
 * Create a new tool instance in a session
 */
async function createTool(sessionId, tool) {
  const instanceId = generateToolInstanceId()
  const toolWithId = {
    id: instanceId,
    createdAt: Date.now(),
    ...tool
  }
  await saveTool(sessionId, instanceId, toolWithId)
  return instanceId
}

/**
 * Get a tool from a session
 */
async function getToolInstance(sessionId, instanceId) {
  return await getTool(sessionId, instanceId)
}

/**
 * Update a tool in a session
 */
async function updateTool(sessionId, instanceId, updates) {
  const tool = await getTool(sessionId, instanceId)
  if (tool) {
    const updatedTool = { ...tool, ...updates, updatedAt: Date.now() }
    await saveTool(sessionId, instanceId, updatedTool)
  }
}

/**
 * Delete a tool from a session
 */
async function deleteToolFromSession(sessionId, instanceId) {
  await deleteTool(sessionId, instanceId)
}

/**
 * Get all tools for a session (synchronous - uses activeTools if matches)
 */
function getAllTools(sessionId) {
  if (sessionId === activeSessionId.value) {
    return activeTools.value
  }
  // For non-active sessions, return empty object
  return {}
}

// ============================================================
// Chat State (delegates to StudioStorage)
// ============================================================

/**
 * Save chat state for a specific session
 */
async function saveChatState(sessionId, chatState) {
  return StudioStorage.saveChatState(sessionId, chatState)
}

/**
 * Load chat state for a specific session
 */
async function loadChatState(sessionId) {
  return StudioStorage.loadChatState(sessionId)
}

// ============================================================
// Watch for changes and auto-save
// ============================================================

watch(sessions, async () => {
  if (!skipWatch) {
    await saveToStorage()
  }
}, { deep: true })

watch(activeSessionId, () => {
  if (!skipWatch) {
    saveToStorage()
  }
})

// ============================================================
// Export the composable
// ============================================================

export function useStudioSessions() {
  // Get the active session
  const activeSession = computed(() => getActiveSession())

  // Computed: active session's chat state
  const activeChatState = computed(() => {
    if (!activeSession.value) return null
    return loadChatState(activeSession.value.id)
  })

  return {
    // State
    sessions,
    activeSessionId,
    nextSessionNumber,

    // Computed
    activeSession,
    activeChatState,
    // activeTools is a module-level ref (updated by watch below)
    activeTools,
    sortedSessions: computed(() => sessions.value.filter(s => s.showInTabs)),
    allSessions: computed(() => sessions.value),

    // Session metadata methods
    initializeSessions,
    createNewSession,
    renameSession,
    hideSession,
    showSession,
    deleteSession,

    // Chat state methods
    saveChatState,
    loadChatState,

    // Tool methods
    createTool,
    getToolInstance,
    updateTool,
    deleteTool: deleteToolFromSession,
    getAllTools,
    saveTools,
    loadTools,

    // Utility
    saveToStorage,
    resetStateForTesting: () => {
      sessions.value = []
      activeSessionId.value = null
      nextSessionNumber.value = 1
    }
  }
}
