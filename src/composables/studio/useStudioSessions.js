import { ref, computed } from 'vue'
import { onAuthStateChanged } from 'firebase/auth'
import {
  saveStudioSessionsToFirestore,
  loadStudioSessionsFromFirestore,
  deleteStudioSessionFromFirestore
} from '../../services/firestore.js'
import { getFirebaseAuth } from '../../services/firebase.js'

const STORAGE_KEY = 'studio-sessions'

// Session state
const sessions = ref([])
const activeSessionId = ref(null)
let nextSessionNumber = 1

// Firestore sync configuration
const FIRESTORE_SYNC_THROTTLE_MS = 1000
let lastFirestoreSyncTime = 0
let pendingFirestoreSync = null

// Auth state unsubscribe
let authUnsubscribe = null

/**
 * Save sessions to localStorage
 */
function saveToStorage() {
  try {
    const state = {
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
      nextSessionNumber
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch (e) {
    console.warn('Failed to save sessions:', e)
  }
}

/**
 * Load sessions from localStorage
 */
function loadFromStorage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      const state = JSON.parse(stored)
      sessions.value = state.sessions || []
      activeSessionId.value = state.activeSessionId || null
      nextSessionNumber = state.nextSessionNumber || 1
      return true
    }
  } catch (e) {
    console.warn('Failed to load sessions:', e)
  }
  return false
}

/**
 * Throttled Firestore sync
 */
function scheduleFirestoreSync() {
  const now = Date.now()
  const timeSinceLastSync = now - lastFirestoreSyncTime

  if (timeSinceLastSync >= FIRESTORE_SYNC_THROTTLE_MS) {
    performFirestoreSync()
    return
  }

  if (pendingFirestoreSync) {
    clearTimeout(pendingFirestoreSync)
  }

  const delay = FIRESTORE_SYNC_THROTTLE_MS - timeSinceLastSync
  pendingFirestoreSync = setTimeout(() => {
    performFirestoreSync()
    pendingFirestoreSync = null
  }, delay)
}

/**
 * Perform the actual Firestore sync
 */
async function performFirestoreSync() {
  lastFirestoreSyncTime = Date.now()

  try {
    await saveStudioSessionsToFirestore(sessions.value, activeSessionId.value)
  } catch (error) {
    console.warn('Firestore sync failed (will retry):', error)
  }
}

/**
 * Simple hash to compare session data
 */
function hashSessions() {
  return JSON.stringify({
    sessions: sessions.value,
    activeSessionId: activeSessionId.value
  })
}

let lastSyncedHash = null

/**
 * Save to both localStorage and schedule Firestore sync
 */
function saveToStorageWithSync() {
  saveToStorage()

  const currentHash = hashSessions()
  if (currentHash !== lastSyncedHash) {
    scheduleFirestoreSync()
    lastSyncedHash = currentHash
  }
}

/**
 * Check if cloud has more data than local (for auto-resolve)
 */
function cloudIsSuperset(local, cloud) {
  if (!local || !cloud) return false

  const localIds = new Set(local.sessions.map(s => s.id))
  const cloudIds = new Set(cloud.sessions.map(s => s.id))

  // Check all local sessions exist in cloud
  for (const id of localIds) {
    if (!cloudIds.has(id)) return false
  }

  // Cloud has more sessions
  return cloudIds.size > localIds.size
}

/**
 * Merge local and cloud sessions (cloud wins on conflicts)
 */
function mergeSessions(local, cloud) {
  const localMap = new Map(local.sessions.map(s => [s.id, s]))
  const cloudMap = new Map(cloud.sessions.map(s => [s.id, s]))

  // Use cloud sessions, but keep any local-only sessions
  const merged = []

  // Add all cloud sessions
  for (const [id, session] of cloudMap) {
    merged.push(session)
  }

  // Add local-only sessions
  for (const [id, session] of localMap) {
    if (!cloudMap.has(id)) {
      merged.push(session)
    }
  }

  // Use cloud's active session if it exists, otherwise local's
  const activeId = cloud.activeSessionId || local.activeSessionId

  // Calculate nextSessionNumber from existing sessions
  const maxNum = merged.reduce((max, s) => {
    const match = s.name.match(/Session (\d+)$/)
    return match ? Math.max(max, parseInt(match[1])) : max
  }, 0)

  return {
    sessions: merged,
    activeSessionId: activeId,
    nextSessionNumber: maxNum + 1
  }
}

/**
 * Load from both localStorage and Firestore, merge if needed
 */
async function loadFromAllSources() {
  let localData = null
  let cloudData = null

  // Load from localStorage
  loadFromStorage()
  if (sessions.value.length > 0) {
    localData = {
      sessions: sessions.value,
      activeSessionId: activeSessionId.value,
      nextSessionNumber
    }
  }

  // Try to load from Firestore
  try {
    cloudData = await loadStudioSessionsFromFirestore()
  } catch (e) {
    console.warn('Failed to load from Firestore:', e)
  }

  // Merge logic
  if (cloudData && cloudData.sessions.length > 0) {
    if (!localData || localData.sessions.length === 0) {
      // Only cloud data exists
      sessions.value = cloudData.sessions
      activeSessionId.value = cloudData.activeSessionId
      nextSessionNumber = extractNextSessionNumber(cloudData.sessions) + 1
    } else if (cloudIsSuperset(localData, cloudData)) {
      // Cloud has all local data plus more - use cloud
      console.log('Cloud has all local data plus more - using cloud')
      sessions.value = cloudData.sessions
      activeSessionId.value = cloudData.activeSessionId
      nextSessionNumber = extractNextSessionNumber(cloudData.sessions) + 1
      saveToStorage()
    } else if (JSON.stringify(localData.sessions) !== JSON.stringify(cloudData.sessions)) {
      // Both have data but different - need to merge
      console.log('Local and cloud data differ - merging')
      const merged = mergeSessions(localData, cloudData)
      sessions.value = merged.sessions
      activeSessionId.value = merged.activeSessionId
      nextSessionNumber = merged.nextSessionNumber
      saveToStorage()
      // Sync merged data to cloud
      scheduleFirestoreSync()
    } else {
      // Same data, use local (faster)
      console.log('Local and cloud data match - using local')
    }
  }
}

/**
 * Extract the next session number from existing sessions
 */
function extractNextSessionNumber(sessionList) {
  const maxNum = sessionList.reduce((max, s) => {
    const match = s.name.match(/Session (\d+)$/)
    return match ? Math.max(max, parseInt(match[1])) : max
  }, 0)
  return maxNum
}

/**
 * Initialize sessions - load from storage/cloud and set up auth listener
 */
async function initializeSessions() {
  await loadFromAllSources()

  // Ensure we have at least one session
  if (sessions.value.length === 0) {
    createNewSession()
  } else if (!activeSessionId.value || !sessions.value.find(s => s.id === activeSessionId.value)) {
    activeSessionId.value = sessions.value[0]?.id || null
  }

  // Set up auth state listener
  if (!authUnsubscribe) {
    const auth = getFirebaseAuth()
    authUnsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        // Just logged in - load from cloud and merge
        console.log('User logged in - syncing studio sessions from cloud')
        await loadFromAllSources()
      }
      // When logging out, keep local data
    })
  }

  return activeSessionId.value
}

/**
 * Create a new session
 * @returns {Object} The newly created session
 */
function createNewSession() {
  const id = crypto.randomUUID()
  const name = `Session ${nextSessionNumber++}`
  const now = Date.now()

  const newSession = {
    id,
    name,
    createdAt: now,
    updatedAt: now,
    // Chat state
    messages: [],
    nextMessageId: 1,
    // Canvas state
    canvasWindows: [],
    nextWindowId: 1,
    cascadeOffset: { x: 0, y: 0 },
    maxZIndex: 100,
    // Model selections (will be set when models are loaded)
    routerModel: null,
    executorModel: null
  }

  sessions.value.push(newSession)
  activeSessionId.value = id
  saveToStorageWithSync()

  return newSession
}

/**
 * Get the active session
 * @returns {Object|null} The active session or null
 */
function getActiveSession() {
  return sessions.value.find(s => s.id === activeSessionId.value) || null
}

/**
 * Update a session's chat state (call when messages change)
 * @param {Object} chatState - { messages, nextMessageId }
 */
function updateChatState(chatState) {
  const session = getActiveSession()
  if (session) {
    session.messages = chatState.messages
    session.nextMessageId = chatState.nextMessageId
    session.updatedAt = Date.now()
    saveToStorageWithSync()
  }
}

/**
 * Update a session's canvas state (call when windows change)
 * @param {Object} canvasState - { canvasWindows, nextWindowId, cascadeOffset, maxZIndex }
 */
function updateCanvasState(canvasState) {
  const session = getActiveSession()
  if (session) {
    session.canvasWindows = canvasState.canvasWindows
    session.nextWindowId = canvasState.nextWindowId
    session.cascadeOffset = canvasState.cascadeOffset
    session.maxZIndex = canvasState.maxZIndex
    session.updatedAt = Date.now()
    saveToStorageWithSync()
  }
}

/**
 * Update model selections for the active session
 * @param {string} routerModel - Router model ID
 * @param {string} executorModel - Executor model ID
 */
function updateModelSelections(routerModel, executorModel) {
  const session = getActiveSession()
  if (session) {
    session.routerModel = routerModel
    session.executorModel = executorModel
    saveToStorageWithSync()
  }
}

/**
 * Load chat state for a session
 * @param {string} sessionId - Session ID to load
 * @returns {Object|null} Chat state or null if session not found
 */
function loadChatState(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    return {
      messages: session.messages || [],
      nextMessageId: session.nextMessageId || 1
    }
  }
  return null
}

/**
 * Load canvas state for a session
 * @param {string} sessionId - Session ID to load
 * @returns {Object|null} Canvas state or null if session not found
 */
function loadCanvasState(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    return {
      canvasWindows: session.canvasWindows || [],
      nextWindowId: session.nextWindowId || 1,
      cascadeOffset: session.cascadeOffset || { x: 0, y: 0 },
      maxZIndex: session.maxZIndex || 100
    }
  }
  return null
}

/**
 * Get model selections for a session
 * @param {string} sessionId - Session ID
 * @returns {Object} Model selections { routerModel, executorModel }
 */
function getModelSelections(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    return {
      routerModel: session.routerModel,
      executorModel: session.executorModel
    }
  }
  return { routerModel: null, executorModel: null }
}

/**
 * Switch to a different session
 * @param {string} sessionId - Session ID to switch to
 * @returns {Object|null} Session data for loading chat/canvas, or null if not found
 */
function switchToSession(sessionId) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (!session) return null

  // First, save current state (should be done by caller before calling this)
  // Then switch
  activeSessionId.value = sessionId
  saveToStorageWithSync()

  // Return session data for loading
  return {
    chat: loadChatState(sessionId),
    canvas: loadCanvasState(sessionId),
    models: getModelSelections(sessionId)
  }
}

/**
 * Rename a session
 * @param {string} sessionId - Session ID to rename
 * @param {string} newName - New name
 */
function renameSession(sessionId, newName) {
  const session = sessions.value.find(s => s.id === sessionId)
  if (session) {
    session.name = newName
    session.updatedAt = Date.now()
    saveToStorageWithSync()
  }
}

/**
 * Delete a session
 * @param {string} sessionId - Session ID to delete
 * @returns {string|null} ID of session to switch to after deletion, or null
 */
async function deleteSession(sessionId) {
  const index = sessions.value.findIndex(s => s.id === sessionId)
  if (index === -1) return null

  sessions.value.splice(index, 1)

  // Delete from Firestore
  deleteStudioSessionFromFirestore(sessionId).catch(console.error)

  // Determine which session to switch to
  let switchToId = null
  if (activeSessionId.value === sessionId) {
    if (sessions.value.length > 0) {
      // Switch to the session before the deleted one, or the first one
      const newIndex = Math.max(0, index - 1)
      switchToId = sessions.value[newIndex].id
      activeSessionId.value = switchToId
    } else {
      // No sessions left, will create a new one
      activeSessionId.value = null
    }
  }

  saveToStorageWithSync()
  return switchToId
}

/**
 * Force immediate sync to Firestore (call before page unload)
 */
async function forceSyncToCloud() {
  if (pendingFirestoreSync) {
    clearTimeout(pendingFirestoreSync)
    pendingFirestoreSync = null
  }
  await performFirestoreSync()
}

/**
 * Computed: active session
 */
const activeSession = computed(() => getActiveSession())

/**
 * Computed: sorted sessions by updated time (most recent first)
 */
const sortedSessions = computed(() => {
  return [...sessions.value].sort((a, b) => b.updatedAt - a.updatedAt)
})

/**
 * Session management composable for AI Studio
 * Handles multi-session state with localStorage + Firestore persistence
 * Each session contains: chat messages, canvas windows, model selections
 */
export function useStudioSessions() {
  return {
    // State
    sessions,
    activeSessionId,
    activeSession,
    sortedSessions,

    // Initialization
    initializeSessions,

    // Session CRUD
    createNewSession,
    switchToSession,
    renameSession,
    deleteSession,

    // State loading/saving
    loadChatState,
    loadCanvasState,
    getModelSelections,
    updateChatState,
    updateCanvasState,
    updateModelSelections,

    // Cloud sync
    forceSyncToCloud
  }
}
