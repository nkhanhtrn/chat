
// Storage service for persisting chat data (localStorage + Firestore sync)
import { syncChatStateToFirestore, loadChatStateFromFirestore } from './firestore.js'

const STORAGE_KEY_CHAT_STATE = 'chat-state'

// Configuration flag - set to false to disable Firestore sync
let ENABLE_FIRESTORE_SYNC = true

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
 * Save chat state to localStorage and optionally sync to Firestore
 * @param {Object} state - The chat state to save
 */
export const saveChatState = async (state) => {
  try {
    const serializedState = serializeState(state)

    // Add timestamp for conflict detection
    serializedState.lastUpdated = Date.now()

    // Always save to localStorage for offline access
    localStorage.setItem(STORAGE_KEY_CHAT_STATE, JSON.stringify(serializedState))

    // Skip Firestore sync while streaming to avoid excessive writes
    if (state.isStreaming) {
      return
    }

    // Optionally sync to Firestore if enabled and user is authenticated
    if (ENABLE_FIRESTORE_SYNC) {
      try {
        await syncChatStateToFirestore(serializedState)
      } catch (firestoreError) {
        // Don't block localStorage save if Firestore fails
        console.warn('Firestore sync failed, but localStorage saved successfully:', firestoreError)
      }
    }
  } catch (error) {
    console.error('Failed to save chat state to localStorage:', error)
  }
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
 * Load chat state from Firestore and localStorage, detecting conflicts
 * @returns {Promise<Object>} Result object with state and conflict info
 */
export const loadChatState = async () => {
  try {
    let localState = null
    let cloudState = null

    // Load from localStorage
    const saved = localStorage.getItem(STORAGE_KEY_CHAT_STATE)
    if (saved) {
      localState = JSON.parse(saved)
      console.log('Loaded local state from localStorage')
    }

    // Try to load from Firestore if sync is enabled
    if (ENABLE_FIRESTORE_SYNC) {
      try {
        cloudState = await loadChatStateFromFirestore()
        if (cloudState) {
          console.log('Loaded cloud state from Firestore')
        }
      } catch (firestoreError) {
        console.warn('Failed to load from Firestore:', firestoreError)
      }
    }

    // If both exist and have different data, return conflict info
    if (localState && cloudState && hasDataDifference(localState, cloudState)) {
      console.log('Detected sync conflict between local and cloud data')
      return {
        hasConflict: true,
        localData: localState,
        cloudData: cloudState
      }
    }

    // No conflict - return whichever has data (prefer cloud)
    if (cloudState) {
      // Sync cloud to localStorage
      localStorage.setItem(STORAGE_KEY_CHAT_STATE, JSON.stringify(cloudState))
      return { hasConflict: false, state: cloudState }
    }

    if (localState) {
      return { hasConflict: false, state: localState }
    }

    return { hasConflict: false, state: null }
  } catch (error) {
    console.error('Failed to load chat state:', error)
    return { hasConflict: false, state: null }
  }
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

  // Save chosen state to both localStorage and Firestore
  localStorage.setItem(STORAGE_KEY_CHAT_STATE, JSON.stringify(chosenState))

  if (ENABLE_FIRESTORE_SYNC) {
    try {
      await syncChatStateToFirestore(chosenState)
      console.log(`Conflict resolved: using ${choice} data, synced to both storage`)
    } catch (error) {
      console.warn('Failed to sync resolved state to Firestore:', error)
    }
  }

  return chosenState
}

/**
 * Clear all storage data (localStorage and Firestore)
 */
export const clearAllStorage = async () => {
  try {
    // Clear localStorage
    localStorage.removeItem(STORAGE_KEY_CHAT_STATE)

    // Clear Firestore if sync is enabled
    if (ENABLE_FIRESTORE_SYNC) {
      try {
        const { deleteChatStateFromFirestore } = await import('./firestore.js')
        await deleteChatStateFromFirestore()
      } catch (firestoreError) {
        console.warn('Failed to clear Firestore data:', firestoreError)
      }
    }
  } catch (error) {
    console.error('Failed to clear storage:', error)
  }
}
