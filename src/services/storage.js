
// Storage service for persisting chat data (IndexedDB + Firestore sync)
import { syncChatStateToFirestore, loadChatStateFromFirestore, deleteChatStateFromFirestore, syncChatStateWithSubcollections, migrateToSubcollections } from './firestore.js'
import { saveChatStateToIDB, loadChatStateFromIDB, clearChatStateFromIDB, migrateFromLocalStorage, isIndexedDBAvailable } from './indexedDB.js'

const STORAGE_KEY_CHAT_STATE = 'chat-state' // kept for migration purposes

// Track changed and deleted messages for incremental sync
let changedMessageIds = new Set()
let deletedMessageIds = new Set()
let previousMessagesById = {}

// Configuration flag - set to false to disable Firestore sync
let ENABLE_FIRESTORE_SYNC = true

// Read-only mode flag - when true, no data is saved to localStorage or Firestore
let READ_ONLY_MODE = false

/**
 * Enable or disable read-only mode
 * When enabled, no data is saved to localStorage or Firestore
 * @param {boolean} enabled - Whether to enable read-only mode
 */
export const setReadOnlyMode = (enabled) => {
  READ_ONLY_MODE = enabled
  console.log(`Read-only mode ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Check if read-only mode is enabled
 * @returns {boolean}
 */
export const isReadOnlyMode = () => READ_ONLY_MODE

// Throttle configuration for Firestore writes (1 second = 1000ms)
const FIRESTORE_SYNC_THROTTLE_MS = 1000
let lastFirestoreSyncTime = 0
let pendingFirestoreSync = null
let pendingState = null
let lastSyncedStateHash = null

/**
 * Reset throttle state (for testing purposes)
 */
export const _resetThrottleState = () => {
  lastFirestoreSyncTime = 0
  if (pendingFirestoreSync) {
    clearTimeout(pendingFirestoreSync)
  }
  pendingFirestoreSync = null
  pendingState = null
  lastSyncedStateHash = null
  changedMessageIds = new Set()
  deletedMessageIds = new Set()
  previousMessagesById = {}
}

/**
 * Simple hash function to compare state objects
 */
const hashState = (state) => {
  return JSON.stringify(state)
}

/**
 * Enable or disable Firestore synchronization
 * @param {boolean} enabled - Whether to enable Firestore sync
 */
export const setFirestoreSyncEnabled = (enabled) => {
  ENABLE_FIRESTORE_SYNC = enabled
  console.log(`Firestore sync ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Serialize state by converting Message objects to plain objects
 * @param {Object} state - The state to serialize
 * @returns {Object} Serialized state with plain objects
 */
const serializeState = (state) => {
  // Use JSON parse/stringify to deep clone and convert Message instances to plain objects
  return JSON.parse(JSON.stringify(state))
}

/**
 * Detect which messages have changed between previous and current state
 * @param {Object} currentMessagesById - Current messages
 */
const detectChangedMessages = (currentMessagesById) => {
  const currentIds = new Set(Object.keys(currentMessagesById || {}))
  const previousIds = new Set(Object.keys(previousMessagesById))

  // Find new and modified messages
  for (const id of currentIds) {
    if (!previousIds.has(id)) {
      // New message
      changedMessageIds.add(id)
    } else {
      // Check if message content changed
      const current = JSON.stringify(currentMessagesById[id])
      const previous = JSON.stringify(previousMessagesById[id])
      if (current !== previous) {
        changedMessageIds.add(id)
      }
    }
  }

  // Find deleted messages
  for (const id of previousIds) {
    if (!currentIds.has(id)) {
      deletedMessageIds.add(id)
      // Remove from changed set if it was there
      changedMessageIds.delete(id)
    }
  }

  // Update previous state for next comparison
  previousMessagesById = JSON.parse(JSON.stringify(currentMessagesById || {}))
}

/**
 * Throttled Firestore sync - ensures writes happen at most once per FIRESTORE_SYNC_THROTTLE_MS
 * @param {Object} serializedState - The serialized state to sync
 */
const throttledFirestoreSync = (serializedState) => {
  // Detect which messages changed
  detectChangedMessages(serializedState.messagesById)

  // Skip sync if no data has changed
  const stateHash = hashState(serializedState)
  if (stateHash === lastSyncedStateHash) {
    return
  }

  // Store the latest state to sync
  pendingState = serializedState

  const now = Date.now()
  const timeSinceLastSync = now - lastFirestoreSyncTime

  // If enough time has passed, sync immediately
  if (timeSinceLastSync >= FIRESTORE_SYNC_THROTTLE_MS) {
    performFirestoreSync()
    return
  }

  // Otherwise, schedule a sync if not already scheduled
  if (!pendingFirestoreSync) {
    const delay = FIRESTORE_SYNC_THROTTLE_MS - timeSinceLastSync
    pendingFirestoreSync = setTimeout(() => {
      performFirestoreSync()
    }, delay)
  }
}

/**
 * Perform the actual Firestore sync
 */
const performFirestoreSync = async () => {
  if (!pendingState) return

  const stateToSync = pendingState
  const messagesToSync = new Set(changedMessageIds)
  const messagesToDelete = new Set(deletedMessageIds)

  // Clear pending state and change tracking
  pendingState = null
  pendingFirestoreSync = null
  changedMessageIds = new Set()
  deletedMessageIds = new Set()
  lastFirestoreSyncTime = Date.now()

  try {
    // Use incremental sync with subcollections
    await syncChatStateWithSubcollections(stateToSync, messagesToSync, messagesToDelete)
    // Update hash after successful sync
    lastSyncedStateHash = hashState(stateToSync)
  } catch (firestoreError) {
    console.warn('Firestore sync failed:', firestoreError)
    // On failure, add the messages back to be retried
    messagesToSync.forEach(id => changedMessageIds.add(id))
    messagesToDelete.forEach(id => deletedMessageIds.add(id))
  }
}

/**
 * Save chat state to IndexedDB and optionally sync to Firestore
 * @param {Object} state - The chat state to save
 */
export const saveChatState = async (state) => {
  // Skip saving entirely when in read-only mode
  if (READ_ONLY_MODE) {
    return
  }

  try {
    const serializedState = serializeState(state)

    // Add timestamp for conflict detection
    serializedState.lastUpdated = Date.now()

    // Always save to IndexedDB for offline access (replaces localStorage)
    await saveChatStateToIDB(serializedState)

    // Skip Firestore sync while streaming to avoid excessive writes
    if (state.isStreaming) {
      return
    }

    // Optionally sync to Firestore if enabled and user is authenticated
    // Uses throttling to limit writes to once per second
    if (ENABLE_FIRESTORE_SYNC) {
      // Exclude UI-only state from Firestore sync
      // These are session-specific and don't need to be synced across devices
      const { currentMessageId, currentChatId, currentRootIndex, previousLocation, ...dataState } = serializedState
      throttledFirestoreSync(dataState)
    }
  } catch (error) {
    console.error('Failed to save chat state to IndexedDB:', error)
  }
}

/**
 * Check if cloud contains all local data plus potentially more
 * (i.e., cloud is a superset of local)
 * @param {Object} localState
 * @param {Object} cloudState
 * @returns {boolean}
 */
const cloudIsSupersetOfLocal = (localState, cloudState) => {
  if (!localState || !cloudState) return false

  // Get local chat IDs
  const localChatIds = new Set((localState.chats || []).map(c => c.id))
  const cloudChatIds = new Set((cloudState.chats || []).map(c => c.id))

  // Check all local chats exist in cloud
  for (const chatId of localChatIds) {
    if (!cloudChatIds.has(chatId)) return false
  }

  // Get local message IDs
  const localMessageIds = new Set(Object.keys(localState.messagesById || {}))
  const cloudMessageIds = new Set(Object.keys(cloudState.messagesById || {}))

  // Check all local messages exist in cloud
  for (const messageId of localMessageIds) {
    if (!cloudMessageIds.has(messageId)) return false
  }

  // Cloud has all local data - check if it has MORE data
  const cloudHasMore = cloudChatIds.size > localChatIds.size ||
                       cloudMessageIds.size > localMessageIds.size

  return cloudHasMore
}

/**
 * Check if two states have meaningful data differences
 * @param {Object} state1
 * @param {Object} state2
 * @returns {boolean}
 */
const hasDataDifference = (state1, state2) => {
  if (!state1 || !state2) return false

  // Compare number of chats
  const chats1 = state1.chats?.length || 0
  const chats2 = state2.chats?.length || 0
  if (chats1 !== chats2) return true

  // Compare number of messages
  const messages1 = Object.keys(state1.messagesById || {}).length
  const messages2 = Object.keys(state2.messagesById || {}).length
  if (messages1 !== messages2) return true

  // Compare message IDs
  const ids1 = Object.keys(state1.messagesById || {}).sort().join(',')
  const ids2 = Object.keys(state2.messagesById || {}).sort().join(',')
  if (ids1 !== ids2) return true

  return false
}

/**
 * Load chat state from Firestore and IndexedDB, detecting conflicts
 * @returns {Promise<Object>} Result object with state and conflict info
 */
export const loadChatState = async () => {
  try {
    let localState = null
    let cloudState = null

    // First, migrate any existing localStorage data to IndexedDB
    await migrateFromLocalStorage()

    // Load from IndexedDB (replaces localStorage)
    localState = await loadChatStateFromIDB()
    if (localState) {
      console.log('Loaded local state from IndexedDB')
    }

    // Try to load from Firestore if sync is enabled
    if (ENABLE_FIRESTORE_SYNC) {
      try {
        // Attempt migration from legacy format to subcollections
        await migrateToSubcollections()

        cloudState = await loadChatStateFromFirestore()
        if (cloudState) {
          console.log('Loaded cloud state from Firestore')
        }
      } catch (firestoreError) {
        console.warn('Failed to load from Firestore:', firestoreError)
      }
    }

    // If both exist and have different data, check if cloud is a superset
    if (localState && cloudState && hasDataDifference(localState, cloudState)) {
      // If cloud contains all local data plus more, auto-use cloud (no conflict modal)
      if (cloudIsSupersetOfLocal(localState, cloudState)) {
        console.log('Cloud has all local data plus more - auto-syncing from cloud')
        await saveChatStateToIDB(cloudState)
        initializePreviousState(cloudState)
        return { hasConflict: false, state: cloudState }
      }

      // Otherwise, there's a real conflict - local has data that cloud doesn't
      console.log('Detected sync conflict between local and cloud data')
      return {
        hasConflict: true,
        localData: localState,
        cloudData: cloudState
      }
    }

    // No conflict - return whichever has data (prefer cloud)
    if (cloudState) {
      // Sync cloud to IndexedDB
      await saveChatStateToIDB(cloudState)
      initializePreviousState(cloudState)
      return { hasConflict: false, state: cloudState }
    }

    if (localState) {
      initializePreviousState(localState)
      return { hasConflict: false, state: localState }
    }

    return { hasConflict: false, state: null }
  } catch (error) {
    console.error('Failed to load chat state:', error)
    return { hasConflict: false, state: null }
  }
}

/**
 * Initialize previous state for change detection
 * Call this after loading state to avoid treating all messages as "changed"
 * @param {Object} state - The loaded state
 */
const initializePreviousState = (state) => {
  if (state?.messagesById) {
    previousMessagesById = JSON.parse(JSON.stringify(state.messagesById))
  }
  changedMessageIds = new Set()
  deletedMessageIds = new Set()
}

/**
 * Resolve a sync conflict by choosing local or cloud data
 * @param {'local' | 'cloud'} choice - Which data to keep
 * @param {Object} localData - Local state
 * @param {Object} cloudData - Cloud state
 * @returns {Promise<Object>} The chosen state
 */
export const resolveConflict = async (choice, localData, cloudData) => {
  const chosenState = choice === 'local' ? localData : cloudData

  // Save chosen state to both IndexedDB and Firestore
  await saveChatStateToIDB(chosenState)

  // Initialize previous state for change tracking
  initializePreviousState(chosenState)

  if (ENABLE_FIRESTORE_SYNC) {
    try {
      // Sync all messages when resolving conflict (full sync)
      await syncChatStateWithSubcollections(chosenState, null, null)
      console.log(`Conflict resolved: using ${choice} data, synced to both storage`)
    } catch (error) {
      console.warn('Failed to sync resolved state to Firestore:', error)
    }
  }

  return chosenState
}

/**
 * Force upload local data to cloud, overwriting cloud data
 * @returns {Promise<boolean>} True if successful
 */
export const forceUploadToCloud = async () => {
  try {
    const localState = await loadChatStateFromIDB()
    if (!localState) {
      console.warn('No local data to upload')
      return false
    }

    if (!ENABLE_FIRESTORE_SYNC) {
      console.warn('Firestore sync is disabled')
      return false
    }

    // Full sync - upload all messages
    await syncChatStateWithSubcollections(localState, null, null)
    lastSyncedStateHash = hashState(localState)
    initializePreviousState(localState)
    console.log('Force uploaded local data to cloud')
    return true
  } catch (error) {
    console.error('Failed to force upload to cloud:', error)
    throw error
  }
}

/**
 * Clear all storage data (IndexedDB and Firestore)
 */
export const clearAllStorage = async () => {
  try {
    // Clear IndexedDB
    await clearChatStateFromIDB()

    // Clear Firestore if sync is enabled
    if (ENABLE_FIRESTORE_SYNC) {
      try {
        await deleteChatStateFromFirestore()
      } catch (firestoreError) {
        console.warn('Failed to clear Firestore data:', firestoreError)
      }
    }
  } catch (error) {
    console.error('Failed to clear storage:', error)
  }
}

/**
 * Get current local state from IndexedDB (for external access)
 * @returns {Promise<Object|null>}
 */
export const getLocalState = async () => {
  return await loadChatStateFromIDB()
}
