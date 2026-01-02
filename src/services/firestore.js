// Firestore service for syncing chat data
import { doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { ref, uploadString, getBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage } from './firebase.js'

// ============================================
// Settings Cache & Debouncing
// ============================================

// Cache for loaded settings to avoid redundant Firestore reads
let settingsCache = null
let settingsCacheTimestamp = 0
const CACHE_TTL_MS = 30000 // 30 seconds cache validity

// Pending settings to be saved (for batching)
let pendingSettings = {}
let saveDebounceTimer = null
const SAVE_DEBOUNCE_MS = 200 // Debounce saves by 200ms

// Active subscriptions
let settingsUnsubscribe = null
let chatStateUnsubscribe = null

// Flag to track if we're in the middle of processing a subscription update
// This prevents writing back settings that we just received from Firestore
let isProcessingSubscriptionUpdate = false

/**
 * Wait for Firebase Auth to be ready and return the current user
 * @returns {Promise<User|null>}
 */
const waitForAuth = () => {
  return new Promise((resolve) => {
    const auth = getFirebaseAuth()
    // Always use onAuthStateChanged to ensure auth is fully initialized
    // Checking auth.currentUser directly can throw "Params are not set" if auth isn't ready
    let unsubscribe = null
    let resolved = false
    unsubscribe = onAuthStateChanged(auth, (user) => {
      if (resolved) return
      resolved = true
      // Use queueMicrotask to ensure unsubscribe is assigned before we call it
      queueMicrotask(() => unsubscribe?.())
      resolve(user)
    })
  })
}

/**
 * Save chat state to Firestore (legacy - single document)
 * @deprecated Use syncChatStateWithSubcollections instead
 * @param {Object} state - The chat state to save
 * @returns {Promise<void>}
 */
export const syncChatStateToFirestore = async (state) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping Firestore sync')
      return
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    await setDoc(userDocRef, {
      ...state,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log('Chat state synced to Firestore')
  } catch (error) {
    console.error('Failed to sync chat state to Firestore:', error)
    throw error
  }
}

/**
 * Sync chat state using subcollections for messages
 * Structure:
 *   users/{uid}/chatData/metadata - chats array, currentModel, rootMessageIds
 *   users/{uid}/chatData/messages/{messageId} - individual message documents
 *
 * @param {Object} state - The full chat state
 * @param {Set<string>} changedMessageIds - Set of message IDs that changed (for incremental sync)
 * @param {Set<string>} deletedMessageIds - Set of message IDs that were deleted
 * @returns {Promise<void>}
 */
export const syncChatStateWithSubcollections = async (state, changedMessageIds = null, deletedMessageIds = null) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping Firestore sync')
      return
    }

    const db = getFirebaseDb()
    const batch = writeBatch(db)

    // Save metadata (everything except messagesById)
    const { messagesById, ...metadata } = state
    const metadataRef = doc(db, 'users', user.uid, 'chatData', 'metadata')
    batch.set(metadataRef, {
      ...metadata,
      schemaVersion: 2, // Mark as using subcollections
      lastUpdated: serverTimestamp()
    })

    // Determine which messages to sync
    const messageIdsToSync = changedMessageIds
      ? Array.from(changedMessageIds)
      : Object.keys(messagesById || {})

    // Sync changed messages - stored as subcollection under metadata document
    // Structure: users/{uid}/chatData/metadata/messages/{messageId}
    for (const messageId of messageIdsToSync) {
      const message = messagesById[messageId]
      if (message) {
        const messageRef = doc(db, 'users', user.uid, 'chatData', 'metadata', 'messages', messageId)
        batch.set(messageRef, message)
      }
    }

    // Delete removed messages
    if (deletedMessageIds) {
      for (const messageId of deletedMessageIds) {
        const messageRef = doc(db, 'users', user.uid, 'chatData', 'metadata', 'messages', messageId)
        batch.delete(messageRef)
      }
    }

    await batch.commit()
    console.log(`Chat state synced to Firestore (${messageIdsToSync.length} messages updated, ${deletedMessageIds?.size || 0} deleted)`)
  } catch (error) {
    console.error('Failed to sync chat state to Firestore:', error)
    throw error
  }
}

/**
 * Load chat state from Firestore using subcollections
 * Falls back to legacy single-document format if needed
 * @returns {Promise<Object|null>}
 */
export const loadChatStateWithSubcollections = async () => {
  try {
    const user = await waitForAuth()

    if (!user) {
      console.warn('No authenticated user, cannot load from Firestore')
      return null
    }

    const db = getFirebaseDb()

    // First try to load from new subcollection structure
    const metadataRef = doc(db, 'users', user.uid, 'chatData', 'metadata')
    const metadataSnap = await getDoc(metadataRef)

    if (metadataSnap.exists() && metadataSnap.data().schemaVersion === 2) {
      // Load from subcollections
      const metadata = metadataSnap.data()
      delete metadata.lastUpdated
      delete metadata.schemaVersion

      // Load all messages from subcollection under the metadata document
      // Structure: users/{uid}/chatData/metadata/messages/{messageId}
      const messagesRef = collection(db, 'users', user.uid, 'chatData', 'metadata', 'messages')
      const messagesSnap = await getDocs(messagesRef)

      const messagesById = {}
      messagesSnap.forEach(doc => {
        messagesById[doc.id] = doc.data()
      })

      console.log(`Chat state loaded from Firestore subcollections (${Object.keys(messagesById).length} messages)`)
      return { ...metadata, messagesById }
    }

    // Fall back to legacy single-document format
    const legacyRef = doc(db, 'users', user.uid, 'chatData', 'state')
    const legacySnap = await getDoc(legacyRef)

    if (legacySnap.exists()) {
      const data = legacySnap.data()
      delete data.lastUpdated
      console.log('Chat state loaded from Firestore (legacy format)')
      return data
    }

    return null
  } catch (error) {
    console.error('Failed to load chat state from Firestore:', error)
    return null
  }
}

/**
 * Migrate from legacy single-document format to subcollections
 * @returns {Promise<boolean>} True if migration was performed
 */
export const migrateToSubcollections = async () => {
  try {
    const user = await waitForAuth()
    if (!user) return false

    const db = getFirebaseDb()

    // Check if already migrated
    const metadataRef = doc(db, 'users', user.uid, 'chatData', 'metadata')
    const metadataSnap = await getDoc(metadataRef)

    if (metadataSnap.exists() && metadataSnap.data().schemaVersion === 2) {
      console.log('Already using subcollections, no migration needed')
      return false
    }

    // Load legacy data
    const legacyRef = doc(db, 'users', user.uid, 'chatData', 'state')
    const legacySnap = await getDoc(legacyRef)

    if (!legacySnap.exists()) {
      console.log('No legacy data to migrate')
      return false
    }

    const legacyData = legacySnap.data()
    const { messagesById, lastUpdated, ...metadata } = legacyData

    if (!messagesById || Object.keys(messagesById).length === 0) {
      console.log('No messages to migrate')
      return false
    }

    // Migrate in batches (Firestore batch limit is 500)
    const messageEntries = Object.entries(messagesById)
    const BATCH_SIZE = 450 // Leave room for metadata

    for (let i = 0; i < messageEntries.length; i += BATCH_SIZE) {
      const batch = writeBatch(db)
      const chunk = messageEntries.slice(i, i + BATCH_SIZE)

      // Add metadata to first batch
      if (i === 0) {
        batch.set(metadataRef, {
          ...metadata,
          schemaVersion: 2,
          lastUpdated: serverTimestamp()
        })
      }

      // Add messages - stored as subcollection under metadata document
      for (const [messageId, message] of chunk) {
        const messageRef = doc(db, 'users', user.uid, 'chatData', 'metadata', 'messages', messageId)
        batch.set(messageRef, message)
      }

      await batch.commit()
      console.log(`Migration batch ${Math.floor(i / BATCH_SIZE) + 1} complete (${chunk.length} messages)`)
    }

    // Optionally delete legacy document after successful migration
    // await deleteDoc(legacyRef)

    console.log(`Migration complete: ${messageEntries.length} messages moved to subcollections`)
    return true
  } catch (error) {
    console.error('Migration to subcollections failed:', error)
    throw error
  }
}

/**
 * Load chat state from Firestore
 * Automatically uses subcollections if available, falls back to legacy format
 * @returns {Promise<Object|null>}
 */
export const loadChatStateFromFirestore = async () => {
  // Use the new subcollection-aware loader
  return loadChatStateWithSubcollections()
}

/**
 * Subscribe to real-time chat state updates from Firestore
 * @param {Function} callback - Function to call when state updates
 * @returns {Function} Unsubscribe function
 */
export const subscribeToChatState = (callback) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot subscribe to Firestore')
      return () => {}
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    const unsubscribe = onSnapshot(userDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        delete data.lastUpdated
        callback(data)
      }
    }, (error) => {
      console.error('Error in Firestore subscription:', error)
    })

    console.log('Subscribed to Firestore chat state updates')
    return unsubscribe
  } catch (error) {
    console.error('Failed to subscribe to Firestore:', error)
    return () => {}
  }
}

/**
 * Delete chat state from Firestore
 * @returns {Promise<void>}
 */
export const deleteChatStateFromFirestore = async () => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot delete from Firestore')
      return
    }

    const db = getFirebaseDb()
    const userDocRef = doc(db, 'users', user.uid, 'chatData', 'state')

    await setDoc(userDocRef, {})
    console.log('Chat state deleted from Firestore')
  } catch (error) {
    console.error('Failed to delete chat state from Firestore:', error)
    throw error
  }
}

// ============================================
// User Settings (Theme & LLM Provider)
// ============================================

const SETTINGS_STORAGE_KEY = 'user-settings'

/**
 * Save settings to localStorage (fallback when not authenticated)
 * @param {Object} settings - The settings to save
 */
const saveSettingsToLocalStorage = (settings) => {
  try {
    const existing = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || '{}')
    const merged = { ...existing, ...settings }
    localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(merged))
  } catch (error) {
    console.error('Failed to save settings to localStorage:', error)
  }
}

/**
 * Load settings from localStorage (fallback when not authenticated)
 * @returns {Object|null}
 */
const loadSettingsFromLocalStorage = () => {
  try {
    const data = localStorage.getItem(SETTINGS_STORAGE_KEY)
    return data ? JSON.parse(data) : null
  } catch (error) {
    console.error('Failed to load settings from localStorage:', error)
    return null
  }
}

/**
 * Flush pending settings to Firestore immediately
 * @returns {Promise<void>}
 */
const flushPendingSettings = async () => {
  if (Object.keys(pendingSettings).length === 0) return

  const settingsToSave = { ...pendingSettings }
  pendingSettings = {}

  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      saveSettingsToLocalStorage(settingsToSave)
      console.log('User settings saved to localStorage (not authenticated)')
      return
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')

    await setDoc(settingsDocRef, {
      ...settingsToSave,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    // Update cache with saved settings
    if (settingsCache) {
      settingsCache = { ...settingsCache, ...settingsToSave }
    }

    console.log('User settings synced to Firestore (batched)')
  } catch (error) {
    saveSettingsToLocalStorage(settingsToSave)
    console.warn('Failed to sync to Firestore, saved to localStorage:', error)
  }
}

/**
 * Save user settings to Firestore (debounced and batched)
 * @param {Object} settings - The settings to save
 */
export const saveUserSettings = (settings) => {
  // Skip writes if we're processing a subscription update (prevents feedback loop)
  if (isProcessingSubscriptionUpdate) {
    // Still update cache and localStorage for responsiveness
    if (settingsCache) {
      settingsCache = { ...settingsCache, ...settings }
    }
    saveSettingsToLocalStorage(settings)
    return
  }

  // Check if any values actually changed (prevent feedback loop from subscription updates)
  let hasChanges = false
  for (const [key, value] of Object.entries(settings)) {
    // Compare with current cache value
    if (settingsCache && settingsCache[key] !== undefined && settingsCache[key] === value) {
      // Value hasn't changed, skip it
      continue
    }
    // Value changed or not in cache, add to pending
    if (pendingSettings[key] !== value) {
      pendingSettings[key] = value
      hasChanges = true
    }
  }

  if (!hasChanges) {
    // No actual changes, don't trigger a write
    return
  }

  // Also update cache immediately for responsive UI
  if (settingsCache) {
    settingsCache = { ...settingsCache, ...pendingSettings }
  }

  // Save to localStorage immediately for responsiveness
  saveSettingsToLocalStorage(pendingSettings)

  // Debounce Firestore save
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
  }
  saveDebounceTimer = setTimeout(() => {
    flushPendingSettings()
    saveDebounceTimer = null
  }, SAVE_DEBOUNCE_MS)
}

/**
 * Force flush any pending settings (call before page unload)
 */
export const flushSettings = () => {
  if (saveDebounceTimer) {
    clearTimeout(saveDebounceTimer)
    saveDebounceTimer = null
  }
  flushPendingSettings()
}

/**
 * Load user settings from Firestore (with caching to reduce reads)
 * @param {boolean} forceRefresh - If true, bypass cache and fetch fresh data
 * @returns {Promise<Object|null>}
 */
export const loadUserSettings = async (forceRefresh = false) => {
  // Check cache first (unless force refresh requested)
  const now = Date.now()
  if (!forceRefresh && settingsCache && (now - settingsCacheTimestamp) < CACHE_TTL_MS) {
    console.log('User settings loaded from cache')
    return settingsCache
  }

  try {
    const user = await waitForAuth()

    if (!user) {
      // Fall back to localStorage when not authenticated
      const localSettings = loadSettingsFromLocalStorage()
      if (localSettings) {
        console.log('User settings loaded from localStorage (not authenticated)')
        settingsCache = localSettings
        settingsCacheTimestamp = now
      }
      return localSettings
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')
    const docSnap = await getDoc(settingsDocRef)

    if (docSnap.exists()) {
      const data = docSnap.data()
      delete data.lastUpdated
      console.log('User settings loaded from Firestore')
      // Update cache
      settingsCache = data
      settingsCacheTimestamp = now
      return data
    }

    // If no Firestore settings, check localStorage (might have settings from before login)
    const localSettings = loadSettingsFromLocalStorage()
    if (localSettings) {
      console.log('User settings loaded from localStorage (no Firestore data)')
      settingsCache = localSettings
      settingsCacheTimestamp = now
    }
    return localSettings
  } catch (error) {
    console.error('Failed to load settings from Firestore:', error)
    // Fall back to localStorage on error
    return loadSettingsFromLocalStorage()
  }
}

/**
 * Invalidate the settings cache (call when settings might have changed externally)
 */
export const invalidateSettingsCache = () => {
  settingsCache = null
  settingsCacheTimestamp = 0
}

/**
 * Subscribe to real-time user settings updates from Firestore
 * @param {Function} callback - Function to call when settings update
 * @returns {Function} Unsubscribe function
 */
export const subscribeToUserSettings = (callback) => {
  // Unsubscribe from any existing subscription
  if (settingsUnsubscribe) {
    settingsUnsubscribe()
    settingsUnsubscribe = null
  }

  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, cannot subscribe to settings')
      return () => {}
    }

    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')

    settingsUnsubscribe = onSnapshot(settingsDocRef, (doc) => {
      if (doc.exists()) {
        const data = doc.data()
        delete data.lastUpdated
        // Update cache from subscription
        settingsCache = data
        settingsCacheTimestamp = Date.now()

        // Set flag to prevent saveUserSettings from writing back to Firestore
        isProcessingSubscriptionUpdate = true
        try {
          callback(data)
        } finally {
          // Clear flag after callback completes
          isProcessingSubscriptionUpdate = false
        }
      }
    }, (error) => {
      console.error('Error in settings subscription:', error)
    })

    console.log('Subscribed to Firestore user settings updates')
    return () => {
      if (settingsUnsubscribe) {
        settingsUnsubscribe()
        settingsUnsubscribe = null
      }
    }
  } catch (error) {
    console.error('Failed to subscribe to user settings:', error)
    return () => {}
  }
}

/**
 * Unsubscribe from all Firestore subscriptions
 */
export const unsubscribeAll = () => {
  if (settingsUnsubscribe) {
    settingsUnsubscribe()
    settingsUnsubscribe = null
  }
  if (chatStateUnsubscribe) {
    chatStateUnsubscribe()
    chatStateUnsubscribe = null
  }
}

/**
 * Migrate settings from localStorage to Firestore after user logs in
 * @returns {Promise<void>}
 */
export const migrateSettingsToFirestore = async () => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const localSettings = loadSettingsFromLocalStorage()
    if (!localSettings) return

    // Check if user already has Firestore settings
    const db = getFirebaseDb()
    const settingsDocRef = doc(db, 'users', user.uid, 'settings', 'preferences')
    const docSnap = await getDoc(settingsDocRef)

    if (!docSnap.exists()) {
      // Migrate localStorage settings to Firestore
      await setDoc(settingsDocRef, {
        ...localSettings,
        lastUpdated: serverTimestamp()
      })
      console.log('Migrated settings from localStorage to Firestore')
    }
  } catch (error) {
    console.error('Failed to migrate settings to Firestore:', error)
  }
}

// ============================================
// Tool Storage (Cloud Sync)
// ============================================

/**
 * Save a tool to Firestore
 * @param {Object} tool - The tool to save
 * @returns {Promise<void>}
 */
export const saveToolToFirestore = async (tool) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping tool cloud sync')
      return
    }

    const db = getFirebaseDb()
    const toolDocRef = doc(db, 'users', user.uid, 'tools', tool.id)

    await setDoc(toolDocRef, {
      ...tool,
      lastUpdated: serverTimestamp()
    })

    console.log(`Tool "${tool.name}" synced to cloud`)
  } catch (error) {
    console.error('Failed to save tool to Firestore:', error)
  }
}

/**
 * Load all tools from Firestore
 * @returns {Promise<Array>} Array of tools
 */
export const loadToolsFromFirestore = async () => {
  try {
    const user = await waitForAuth()

    if (!user) {
      console.warn('No authenticated user, cannot load tools from cloud')
      return []
    }

    const db = getFirebaseDb()
    const toolsRef = collection(db, 'users', user.uid, 'tools')
    const snapshot = await getDocs(toolsRef)

    const tools = []
    snapshot.forEach(doc => {
      const data = doc.data()
      delete data.lastUpdated
      tools.push(data)
    })

    console.log(`Loaded ${tools.length} tools from cloud`)
    return tools
  } catch (error) {
    console.error('Failed to load tools from Firestore:', error)
    return []
  }
}

/**
 * Delete a tool from Firestore (soft delete - sets deletedAt)
 * @param {string} toolId - The tool ID to delete
 * @returns {Promise<void>}
 */
export const deleteToolFromFirestore = async (toolId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const db = getFirebaseDb()
    const toolDocRef = doc(db, 'users', user.uid, 'tools', toolId)

    await setDoc(toolDocRef, {
      deletedAt: Date.now(),
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log(`Tool ${toolId} marked as deleted in cloud`)
  } catch (error) {
    console.error('Failed to delete tool from Firestore:', error)
  }
}

/**
 * Permanently delete a tool from Firestore
 * @param {string} toolId - The tool ID to delete
 * @returns {Promise<void>}
 */
export const permanentlyDeleteToolFromFirestore = async (toolId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const db = getFirebaseDb()
    const toolDocRef = doc(db, 'users', user.uid, 'tools', toolId)

    await deleteDoc(toolDocRef)
    console.log(`Tool ${toolId} permanently deleted from cloud`)
  } catch (error) {
    console.error('Failed to permanently delete tool from Firestore:', error)
  }
}

// ============================================
// Generic Merge Utility (for tools, sessions, notebooks)
// ============================================

/**
 * Generic bidirectional merge between cloud and local data
 * Strategy:
 * - Cloud has item local doesn't → add to local
 * - Local has item cloud doesn't → upload to cloud
 * - Both have same item → use newer version (by updatedAt), sync to both
 *
 * @param {Array} cloudItems - Items from cloud
 * @param {Array} localItems - Items from local storage
 * @returns {Object} { merged: Array, toUpload: Array, fromCloud: number, toCloud: number }
 */
export const mergeCloudLocal = (cloudItems, localItems) => {
  const cloudMap = new Map(cloudItems.map(item => [item.id, item]))
  const localMap = new Map(localItems.map(item => [item.id, item]))

  const merged = []
  const toUpload = []
  let fromCloud = 0
  let toCloud = 0

  // Get all unique IDs
  const allIds = new Set([...cloudItems.map(i => i.id), ...localItems.map(i => i.id)])

  for (const id of allIds) {
    const cloudItem = cloudMap.get(id)
    const localItem = localMap.get(id)

    if (!cloudItem) {
      // Local-only → use local, upload to cloud
      merged.push(localItem)
      toUpload.push(localItem)
      toCloud++
    } else if (!localItem) {
      // Cloud-only → use cloud, default showInTabs to true for new sessions
      merged.push({ ...cloudItem, showInTabs: true })
      fromCloud++
    } else if (cloudItem.updatedAt > localItem.updatedAt) {
      // Cloud is newer → use cloud, but preserve local showInTabs preference
      merged.push({ ...cloudItem, showInTabs: localItem.showInTabs ?? true })
      fromCloud++
    } else {
      // Local is newer or same → use local (preserves showInTabs)
      merged.push(localItem)
      if (localItem.updatedAt > cloudItem.updatedAt) {
        toUpload.push(localItem)
        toCloud++
      }
    }
  }

  return { merged, toUpload, fromCloud, toCloud }
}

// ============================================
// Firebase Storage Helpers for Large Data
// ============================================

const FIRESTORE_MAX_SIZE = 900000 // 900KB safe threshold for Firestore

/**
 * Check if data size exceeds Firestore limit
 * @param {*} data - Data to check
 * @returns {boolean} True if data is too large for Firestore
 */
function isDataTooLarge(data) {
  try {
    return JSON.stringify(data).length > FIRESTORE_MAX_SIZE
  } catch {
    return true // If we can't stringify, it's definitely too large
  }
}

/**
 * Save data to Firebase Storage
 * @param {string} path - Storage path (e.g., 'users/uid/sessions/sessionId/chatState.json')
 * @param {*} data - Data to save (will be JSON stringified)
 * @returns {Promise<void>}
 */
async function saveToStorage(path, data) {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser
    if (!user) {
      throw new Error('No authenticated user')
    }

    const storage = getFirebaseStorage()
    const storageRef = ref(storage, path)

    const jsonString = JSON.stringify(data)
    await uploadString(storageRef, jsonString, 'raw')

    console.log(`Saved large data to Firebase Storage: ${path}`)
  } catch (error) {
    console.error(`Failed to save to Firebase Storage (${path}):`, error)
    throw error
  }
}

/**
 * Load data from Firebase Storage
 * @param {string} path - Storage path
 * @returns {Promise<*>} Parsed JSON data or null if not found
 */
async function loadFromStorage(path) {
  try {
    const storage = getFirebaseStorage()
    const storageRef = ref(storage, path)

    const url = await getDownloadURL(storageRef)
    const response = await fetch(url)
    if (!response.ok) {
      return null
    }

    const text = await response.text()
    return JSON.parse(text)
  } catch (error) {
    if (error.code === 'storage/object-not-found') {
      return null
    }
    console.error(`Failed to load from Firebase Storage (${path}):`, error)
    return null
  }
}

// ============================================
// Studio Sessions (Cloud Sync)
// ============================================

import { debugLog } from '../utils/debug.js'

/**
 * Save studio sessions to Firestore
 * Structure: users/{uid}/studioSessions/{sessionId}
 * Large data (toolInstanceData) is stored in Firebase Storage
 * @param {Array} sessions - Array of session objects
 * @param {string} activeSessionId - Currently active session ID
 * @returns {Promise<void>}
 */
export const saveStudioSessionsToFirestore = async (sessions, activeSessionId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping studio sessions cloud sync')
      return
    }

    const db = getFirebaseDb()

    // Use batch to write all sessions
    const batch = writeBatch(db)

    // Process each session
    for (const session of sessions) {
      // Collect tool instance data for this session from localStorage
      const toolInstanceData = collectToolInstanceData(session.id)

      // Explicitly copy only the properties we want to save
      let sessionData = {
        id: String(session.id || ''),
        name: String(session.name || ''),
        createdAt: session.createdAt || Date.now(),
        updatedAt: session.updatedAt || Date.now(),
        lastUpdated: serverTimestamp()
      }

      // Check if toolInstanceData is too large for Firestore
      if (isDataTooLarge(toolInstanceData)) {
        // Save to Firebase Storage instead
        const storagePath = `users/${user.uid}/studioSessions/${session.id}/toolInstanceData.json`
        await saveToStorage(storagePath, toolInstanceData)
        sessionData.toolInstanceDataInStorage = true // Flag that data is in Storage
        sessionData.toolInstanceDataStoragePath = storagePath
      } else {
        // Store directly in Firestore
        sessionData.toolInstanceData = toolInstanceData
      }

      // Sanitize sessionData to remove any Vue internal properties or nested arrays
      sessionData = sanitizeForFirestore(sessionData)

      const sessionRef = doc(db, 'users', user.uid, 'studioSessions', session.id)
      batch.set(sessionRef, sessionData, { merge: true })
    }

    // Also save metadata (active session ID)
    const metadataRef = doc(db, 'users', user.uid, 'studioSessions', 'metadata')
    batch.set(metadataRef, {
      activeSessionId,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    await batch.commit()
    debugLog(`Synced ${sessions.length} studio sessions to cloud`)
  } catch (error) {
    console.error('Failed to save studio sessions to Firestore:', error)
    throw error
  }
}

/**
 * Save a single studio session to Firestore (more efficient than syncing all sessions)
 * Structure: users/{uid}/studioSessions/{sessionId}
 * Large data (chatState, canvasState, toolInstanceData) is stored in Firebase Storage
 * @param {Object} session - Single session object
 * @param {string} activeSessionId - Currently active session ID (for metadata)
 * @returns {Promise<void>}
 */
export const saveSingleSessionToFirestore = async (session, activeSessionId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      debugLog('[Session Sync] No authenticated user, skipping studio session cloud sync')
      return
    }

    const db = getFirebaseDb()

    // Collect tool instance data for this session from localStorage
    const toolInstanceData = collectToolInstanceData(session.id)

    // Load chat and canvas state from localStorage to include in sync
    const chatKey = `studio-chat-${session.id}`
    const canvasKey = `studio-canvas-windows-${session.id}`
    const chatStateRaw = localStorage.getItem(chatKey)
    const canvasStateRaw = localStorage.getItem(canvasKey)

    let chatState = chatStateRaw ? sanitizeForFirestore(JSON.parse(chatStateRaw)) : null
    let canvasState = canvasStateRaw ? sanitizeForFirestore(JSON.parse(canvasStateRaw)) : null

    // Explicitly copy only the properties we want to save
    let sessionData = {
      id: String(session.id || ''),
      name: String(session.name || ''),
      createdAt: session.createdAt || Date.now(),
      updatedAt: session.updatedAt || Date.now(),
      lastUpdated: serverTimestamp()
    }

    // Check each data type and move large ones to Firebase Storage
    if (isDataTooLarge(toolInstanceData)) {
      const storagePath = `users/${user.uid}/studioSessions/${session.id}/toolInstanceData.json`
      await saveToStorage(storagePath, toolInstanceData)
      sessionData.toolInstanceDataInStorage = true
      sessionData.toolInstanceDataStoragePath = storagePath
    } else {
      sessionData.toolInstanceData = toolInstanceData
    }

    if (chatState && isDataTooLarge(chatState)) {
      const storagePath = `users/${user.uid}/studioSessions/${session.id}/chatState.json`
      await saveToStorage(storagePath, chatState)
      sessionData.chatStateInStorage = true
      sessionData.chatStateStoragePath = storagePath
    } else {
      sessionData.chatState = chatState
    }

    if (canvasState && isDataTooLarge(canvasState)) {
      const storagePath = `users/${user.uid}/studioSessions/${session.id}/canvasState.json`
      await saveToStorage(storagePath, canvasState)
      sessionData.canvasStateInStorage = true
      sessionData.canvasStateStoragePath = storagePath
    } else {
      sessionData.canvasState = canvasState
    }

    // Sanitize sessionData to remove any Vue internal properties or nested arrays
    sessionData = sanitizeForFirestore(sessionData)

    const sessionRef = doc(db, 'users', user.uid, 'studioSessions', session.id)
    await setDoc(sessionRef, sessionData, { merge: true })

    // Also update metadata if active session changed
    const metadataRef = doc(db, 'users', user.uid, 'studioSessions', 'metadata')
    await setDoc(metadataRef, {
      activeSessionId,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    debugLog('[Session Sync] ✅ Single session synced to Firestore:', session.id)
  } catch (error) {
    console.error('Failed to save single studio session to Firestore:', error)
    throw error
  }
}

/**
 * Save tool instance data to Firestore (immediate sync when tool data changes)
 * Uses dot notation to update only the specific tool's nested field
 * Falls back to Firebase Storage if the document size exceeds Firestore limit
 * @param {string} sessionId - The session ID
 * @param {string} toolId - The tool ID
 * @param {Object} data - The tool instance data
 * @returns {Promise<void>}
 */
export const saveToolInstanceDataImmediate = async (sessionId, toolId, data) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) {
      console.warn('No authenticated user, skipping tool instance data cloud sync')
      return
    }

    const db = getFirebaseDb()
    const sessionRef = doc(db, 'users', user.uid, 'studioSessions', sessionId)

    // First, check if data is already in Firebase Storage
    const sessionSnap = await getDoc(sessionRef)
    const isInStorage = sessionSnap.get('toolInstanceDataInStorage') === true

    if (isInStorage) {
      // Update the data in localStorage, then sync all to Firebase Storage
      const storagePath = `users/${user.uid}/studioSessions/${sessionId}/toolInstanceData.json`
      const allToolData = collectToolInstanceData(sessionId)
      await saveToStorage(storagePath, allToolData)

      // Update the lastUpdated timestamp in Firestore
      await setDoc(sessionRef, {
        lastUpdated: serverTimestamp()
      }, { merge: true })

      console.log(`Tool instance data synced to Firebase Storage: ${sessionId}/${toolId}`)
      return
    }

    // Try to save directly to Firestore first
    try {
      await setDoc(sessionRef, {
        [`toolInstanceData.${toolId}`]: data,
        lastUpdated: serverTimestamp()
      }, { merge: true })
      console.log(`Tool instance data synced to cloud: ${sessionId}/${toolId}`)
    } catch (error) {
      // Check if this is a size limit error
      if (error.message?.includes('size') || error.message?.includes('exceeds')) {
        console.warn(`Firestore size limit exceeded for session ${sessionId}, moving toolInstanceData to Firebase Storage`)

        // Collect all tool instance data from localStorage
        const allToolData = collectToolInstanceData(sessionId)

        // Save all tool data to Firebase Storage
        const storagePath = `users/${user.uid}/studioSessions/${sessionId}/toolInstanceData.json`
        await saveToStorage(storagePath, allToolData)

        // Update the document to indicate data is in Storage and clear the old toolInstanceData
        await setDoc(sessionRef, {
          toolInstanceData: null, // Clear old data
          toolInstanceDataInStorage: true,
          toolInstanceDataStoragePath: storagePath,
          lastUpdated: serverTimestamp()
        }, { merge: true })

        console.log(`Tool instance data moved to Firebase Storage: ${sessionId}/${toolId}`)
      } else {
        throw error // Re-throw if it's not a size error
      }
    }
  } catch (error) {
    console.error('Failed to save tool instance data to Firestore:', error)
  }
}

/**
 * Collect tool instance data for a session from localStorage
 * @param {string} sessionId - The session ID
 * @returns {Object} Map of toolId -> instance data
 */
function collectToolInstanceData(sessionId) {
  try {
    const toolPrefix = `tool-instance-${sessionId}-`
    const result = {}

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(toolPrefix)) {
        const toolId = key.slice(toolPrefix.length)
        try {
          const data = JSON.parse(localStorage.getItem(key))
          result[toolId] = sanitizeForFirestore(data)
        } catch (e) {
          console.warn(`Failed to parse tool instance data for ${key}:`, e)
        }
      }
    }

    return result
  } catch (error) {
    console.error('Failed to collect tool instance data:', error)
    return {}
  }
}

/**
 * Sanitize data for Firestore by removing invalid field names and structures.
 * - Firestore doesn't allow fields that begin and end with "__" (e.g., Vue internal properties)
 * - Firestore doesn't support nested arrays (arrays containing arrays)
 * - Can't store: Functions, Symbols, DOM elements, Window objects
 * - BigInt converted to string
 * @param {*} value - The value to sanitize
 * @param {WeakSet} seen - Set of objects already visited (for circular reference detection)
 * @returns {*} Sanitized value
 */
function sanitizeForFirestore(value, seen = new WeakSet()) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Skip functions (can't be stored)
  if (typeof value === 'function') {
    return null
  }

  // Skip symbols (can't be stored)
  if (typeof value === 'symbol') {
    return null
  }

  // Convert BigInt to string (can't be stored directly)
  if (typeof value === 'bigint') {
    return value.toString()
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return value
  }

  // Skip DOM elements and Window objects
  if (value instanceof Element) {
    return null
  }
  if (value instanceof Window) {
    return null
  }
  if (value instanceof Node) {
    return null
  }

  // Check for circular references - skip them
  if (seen.has(value)) {
    return null
  }
  seen.add(value)

  // Handle arrays - check for nested arrays first
  if (Array.isArray(value)) {
    // Check if any element is an array (nested array)
    const hasNestedArray = value.some(item => Array.isArray(item))
    if (hasNestedArray) {
      // Convert to JSON string to avoid nested array error
      return JSON.stringify(value, (key, val) => {
        // Skip functions
        if (typeof val === 'function') {
          return null
        }
        // Skip symbols
        if (typeof val === 'symbol') {
          return null
        }
        // Convert BigInt to string
        if (typeof val === 'bigint') {
          return val.toString()
        }
        // Skip DOM elements
        if (val instanceof Element || val instanceof Window || val instanceof Node) {
          return null
        }
        // Skip WeakMap/WeakSet
        if (val instanceof WeakMap || val instanceof WeakSet) {
          return null
        }
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return null
          }
          seen.add(val)
        }
        return val
      })
    }
    // Simple array - recursively sanitize elements
    return value.map(item => sanitizeForFirestore(item, seen))
  }

  // For objects, first try to convert Vue reactive objects using JSON round-trip
  const isVueReactive = value.__v_isReactive === true ||
                        value.__v_isRef === true ||
                        value.__v_isReadonly === true ||
                        value.__v_isShallow === true

  if (isVueReactive) {
    // Convert Vue reactive object to plain object
    return JSON.parse(JSON.stringify(value, (key, val) => {
      // Skip functions
      if (typeof val === 'function') {
        return null
      }
      // Skip symbols
      if (typeof val === 'symbol') {
        return null
      }
      // Convert BigInt to string
      if (typeof val === 'bigint') {
        return val.toString()
      }
      // Skip DOM elements
      if (val instanceof Element || val instanceof Window || val instanceof Node) {
        return null
      }
      // Skip WeakMap/WeakSet
      if (val instanceof WeakMap || val instanceof WeakSet) {
        return null
      }
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return null
        }
        seen.add(val)
      }
      return val
    }))
  }

  // Regular object - remove __ properties and recursively sanitize
  const result = {}
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      // Skip Vue internal properties
      if (key.startsWith('__') && key.endsWith('__')) {
        continue
      }
      const val = value[key]
      // Skip functions
      if (typeof val === 'function') {
        continue
      }
      // Skip symbols
      if (typeof val === 'symbol') {
        continue
      }
      // Convert BigInt to string
      if (typeof val === 'bigint') {
        result[key] = val.toString()
        continue
      }
      // Skip DOM elements and nodes
      if (val instanceof Element || val instanceof Node || val instanceof Window) {
        continue
      }
      // Skip WeakMap/WeakSet
      if (val instanceof WeakMap || val instanceof WeakSet) {
        continue
      }
      try {
        result[key] = sanitizeForFirestore(val, seen)
      } catch (e) {
        console.warn(`Skipping property "${key}" due to sanitization error:`, e)
      }
    }
  }
  return result
}

/**
 * Deserialize data from Firestore by converting JSON strings back to nested arrays.
 * This is the inverse of sanitizeForFirestore.
 * @param {*} value - The value to deserialize
 * @returns {*} Deserialized value
 */
function deserializeFromFirestore(value) {
  if (value === null || value === undefined) {
    return value
  }

  // Handle primitives (strings, numbers, booleans)
  if (typeof value !== 'object') {
    // Check if this is a JSON string that was a nested array
    if (typeof value === 'string' && value.trim().startsWith('[') && value.trim().endsWith(']')) {
      try {
        const parsed = JSON.parse(value)
        // Only return the parsed value if it's actually an array
        if (Array.isArray(parsed)) {
          return deserializeFromFirestore(parsed)
        }
      } catch (e) {
        // Not valid JSON, return original string
      }
    }
    return value
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => deserializeFromFirestore(item))
  }

  // Handle objects
  const result = {}
  for (const key in value) {
    if (Object.prototype.hasOwnProperty.call(value, key)) {
      result[key] = deserializeFromFirestore(value[key])
    }
  }
  return result
}

/**
 * Load studio sessions from Firestore
 * Handles data stored both in Firestore and Firebase Storage
 * @returns {Promise<Object|null>} Object with { sessions, activeSessionId } or null
 */
export const loadStudioSessionsFromFirestore = async () => {
  try {
    const user = await waitForAuth()

    if (!user) {
      console.warn('No authenticated user, cannot load studio sessions from cloud')
      return null
    }

    const db = getFirebaseDb()

    // Load metadata to get active session ID
    const metadataRef = doc(db, 'users', user.uid, 'studioSessions', 'metadata')
    const metadataSnap = await getDoc(metadataRef)

    // Load all sessions
    const sessionsRef = collection(db, 'users', user.uid, 'studioSessions')
    const sessionsSnap = await getDocs(sessionsRef)

    const sessions = []
    let activeSessionId = null

    // Collect tool instance data that needs to be uploaded (local is newer)
    const toolDataToUpload = new Map() // sessionId -> { toolId -> data }

    for (const doc of sessionsSnap.docs) {
      if (doc.id === 'metadata') {
        continue
      }
      let data = deserializeFromFirestore(doc.data())

      // Extract flags and paths for Storage data
      const toolInstanceDataInStorage = data.toolInstanceDataInStorage
      const toolInstanceDataStoragePath = data.toolInstanceDataStoragePath
      const chatStateInStorage = data.chatStateInStorage
      const chatStateStoragePath = data.chatStateStoragePath
      const canvasStateInStorage = data.canvasStateInStorage
      const canvasStateStoragePath = data.canvasStateStoragePath

      // Clean up flags and paths from the data
      delete data.toolInstanceDataInStorage
      delete data.toolInstanceDataStoragePath
      delete data.chatStateInStorage
      delete data.chatStateStoragePath
      delete data.canvasStateInStorage
      delete data.canvasStateStoragePath

      // Extract and restore tool instance data (with merge)
      let toolInstanceData = data.toolInstanceData

      // Load from Firebase Storage if flag is set
      if (toolInstanceDataInStorage && toolInstanceDataStoragePath) {
        const storageData = await loadFromStorage(toolInstanceDataStoragePath)
        if (storageData) {
          toolInstanceData = storageData
        }
      }

      delete data.toolInstanceData

      // Load chatState from Storage if needed
      if (chatStateInStorage && chatStateStoragePath) {
        const storageData = await loadFromStorage(chatStateStoragePath)
        if (storageData) {
          data.chatState = storageData
        }
      }

      // Load canvasState from Storage if needed
      if (canvasStateInStorage && canvasStateStoragePath) {
        const storageData = await loadFromStorage(canvasStateStoragePath)
        if (storageData) {
          data.canvasState = storageData
        }
      }

      // Merge and restore tool instance data to localStorage, collect items needing upload
      if (toolInstanceData) {
        const toUpload = restoreToolInstanceData(doc.id, toolInstanceData)
        if (Object.keys(toUpload).length > 0) {
          toolDataToUpload.set(doc.id, toUpload)
        }
      }

      // Restore chat and canvas state to localStorage
      if (data.chatState) {
        try {
          localStorage.setItem(`studio-chat-${doc.id}`, JSON.stringify(data.chatState))
        } catch (e) {
          console.warn('Failed to restore chat state to localStorage:', e)
        }
        delete data.chatState
      }

      if (data.canvasState) {
        try {
          localStorage.setItem(`studio-canvas-windows-${doc.id}`, JSON.stringify(data.canvasState))
        } catch (e) {
          console.warn('Failed to restore canvas state to localStorage:', e)
        }
        delete data.canvasState
      }

      delete data.lastUpdated
      delete data._computed
      sessions.push({ id: doc.id, ...data })
    }

    if (metadataSnap.exists()) {
      activeSessionId = metadataSnap.data().activeSessionId
    }

    // Upload tool instance data where local was newer
    if (toolDataToUpload.size > 0) {
      uploadMergedToolInstanceData(toolDataToUpload).catch(err =>
        console.error('Failed to upload merged tool instance data:', err)
      )
    }

    console.log(`Loaded ${sessions.length} studio sessions from cloud`)
    return { sessions, activeSessionId }
  } catch (error) {
    console.error('Failed to load studio sessions from Firestore:', error)
    return null
  }
}

/**
 * Upload merged tool instance data where local was newer
 * Falls back to Firebase Storage if Firestore size limit is exceeded
 * @param {Map} toolDataToUpload - Map of sessionId -> { toolId -> data }
 */
async function uploadMergedToolInstanceData(toolDataToUpload) {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const db = getFirebaseDb()

    for (const [sessionId, toolData] of toolDataToUpload.entries()) {
      const sessionRef = doc(db, 'users', user.uid, 'studioSessions', sessionId)

      // First, collect ALL tool instance data (existing + new) to check total size
      const allToolData = collectToolInstanceData(sessionId)

      // Check if the total data would exceed Firestore limit
      if (isDataTooLarge(allToolData)) {
        // Move to Firebase Storage
        const storagePath = `users/${user.uid}/studioSessions/${sessionId}/toolInstanceData.json`
        await saveToStorage(storagePath, allToolData)

        // Update document to indicate data is in Storage
        await setDoc(sessionRef, {
          toolInstanceData: null, // Clear old data
          toolInstanceDataInStorage: true,
          toolInstanceDataStoragePath: storagePath,
          lastUpdated: serverTimestamp()
        }, { merge: true })

        console.log(`Merged tool data moved to Firebase Storage for session ${sessionId}`)
      } else {
        // Upload each tool instance data item to Firestore
        for (const [toolId, data] of Object.entries(toolData)) {
          await setDoc(sessionRef, {
            [`toolInstanceData.${toolId}`]: data,
            lastUpdated: serverTimestamp()
          }, { merge: true })
        }
        console.log(`Uploaded ${Object.keys(toolData).length} merged tool instances for session ${sessionId}`)
      }
    }
  } catch (error) {
    console.error('Failed to upload merged tool instance data:', error)
    throw error
  }
}

/**
 * Merge and restore tool instance data for a session (timestamp-based merge like notebooks)
 * Strategy:
 * - Cloud has item local doesn't → add to local
 * - Local has item cloud doesn't → return for upload to cloud
 * - Both have same item → use newer version (by _updatedAt), return local if newer
 *
 * @param {string} sessionId - The session ID
 * @param {Object} cloudToolData - Map of toolId -> instance data from cloud
 * @returns {Object} Map of toolId -> instance data that need to be uploaded to cloud
 */
function restoreToolInstanceData(sessionId, cloudToolData) {
  try {
    const toUpload = {}
    const toolPrefix = `tool-instance-${sessionId}-`

    // First, collect all existing local tool instance data
    const localToolData = {}
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith(toolPrefix)) {
        const toolId = key.slice(toolPrefix.length)
        try {
          localToolData[toolId] = JSON.parse(localStorage.getItem(key))
        } catch (e) {
          console.warn(`Failed to parse tool instance data for ${key}:`, e)
        }
      }
    }

    // Get all unique tool IDs
    const allToolIds = new Set([...Object.keys(cloudToolData), ...Object.keys(localToolData)])

    for (const toolId of allToolIds) {
      const key = `tool-instance-${sessionId}-${toolId}`
      const cloudItem = cloudToolData[toolId]
      const localItem = localToolData[toolId]

      if (!cloudItem) {
        // Local-only → keep local, queue for upload
        toUpload[toolId] = localItem
      } else if (!localItem) {
        // Cloud-only → use cloud data
        localStorage.setItem(key, JSON.stringify(cloudItem))
      } else {
        // Both exist → use newer by _updatedAt timestamp
        const cloudTime = cloudItem._updatedAt || 0
        const localTime = localItem._updatedAt || 0

        if (cloudTime > localTime) {
          // Cloud is newer → use cloud data
          localStorage.setItem(key, JSON.stringify(cloudItem))
        } else {
          // Local is newer or same → keep local data, queue for upload if newer
          localStorage.setItem(key, JSON.stringify(localItem))
          if (localTime > cloudTime) {
            toUpload[toolId] = localItem
          }
        }
      }
    }

    const restoredCount = allToolIds.size
    const uploadCount = Object.keys(toUpload).length
    console.log(`Merged ${restoredCount} tool instances for session ${sessionId}, ${uploadCount} need upload`)

    return toUpload
  } catch (error) {
    console.error('Failed to restore tool instance data:', error)
    return {}
  }
}

/**
 * Delete a studio session from Firestore and Firebase Storage
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<void>}
 */
export const deleteStudioSessionFromFirestore = async (sessionId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const db = getFirebaseDb()
    const storage = getFirebaseStorage()

    // Delete from Firestore
    const sessionRef = doc(db, 'users', user.uid, 'studioSessions', sessionId)
    await deleteDoc(sessionRef)

    // Also delete from Firebase Storage (all files for this session)
    const storageBasePath = `users/${user.uid}/studioSessions/${sessionId}`

    // Delete individual files (since we don't have a function to delete a folder)
    const filesToDelete = [
      `${storageBasePath}/toolInstanceData.json`,
      `${storageBasePath}/chatState.json`,
      `${storageBasePath}/canvasState.json`
    ]

    await Promise.allSettled(
      filesToDelete.map(path => {
        const storageRef = ref(storage, path)
        return deleteObject(storageRef).catch(err => {
          // Ignore "not found" errors
          if (err.code !== 'storage/object-not-found') {
            console.warn(`Failed to delete ${path}:`, err)
          }
        })
      })
    )

    console.log(`Studio session ${sessionId} deleted from cloud`)
  } catch (error) {
    console.error('Failed to delete studio session from Firestore:', error)
  }
}
