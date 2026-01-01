// Firestore service for syncing chat data
import { doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'
import { getFirebaseDb, getFirebaseAuth } from './firebase.js'

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
// Studio Sessions (Cloud Sync)
// ============================================

import { debugLog } from '../utils/debug.js'

/**
 * Save studio sessions to Firestore
 * Structure: users/{uid}/studioSessions/{sessionId}
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

    // Add each session to batch (including tool instance data)
    for (const session of sessions) {
      // Collect tool instance data for this session from localStorage
      const toolInstanceData = collectToolInstanceData(session.id)

      const sessionRef = doc(db, 'users', user.uid, 'studioSessions', session.id)
      batch.set(sessionRef, {
        id: session.id,
        name: session.name,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        toolInstanceData, // Include tool instance data in session document
        lastUpdated: serverTimestamp()
        // Note: showInTabs is NOT synced to cloud (local-only preference)
      }, { merge: true })
    }

    // Also save metadata (active session ID, next session number)
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
    const chatState = localStorage.getItem(chatKey)
    const canvasState = localStorage.getItem(canvasKey)

    const sessionRef = doc(db, 'users', user.uid, 'studioSessions', session.id)
    await setDoc(sessionRef, {
      id: session.id,
      name: session.name,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      chatState: chatState ? JSON.parse(chatState) : null,
      canvasState: canvasState ? JSON.parse(canvasState) : null,
      toolInstanceData,
      lastUpdated: serverTimestamp()
      // Note: showInTabs is NOT synced to cloud (local-only preference)
    }, { merge: true })

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

    // Use dot notation to update only the specific tool's data
    // This prevents overwriting other tools' data
    await setDoc(sessionRef, {
      [`toolInstanceData.${toolId}`]: data,
      lastUpdated: serverTimestamp()
    }, { merge: true })

    console.log(`Tool instance data synced to cloud: ${sessionId}/${toolId}`)
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
          result[toolId] = data
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
 * Load studio sessions from Firestore
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

    sessionsSnap.forEach(doc => {
      if (doc.id === 'metadata') {
        // Skip metadata document
        return
      }
      const data = doc.data()

      // Extract and restore tool instance data (with merge)
      const toolInstanceData = data.toolInstanceData
      delete data.toolInstanceData

      // Merge and restore tool instance data to localStorage, collect items needing upload
      if (toolInstanceData) {
        const toUpload = restoreToolInstanceData(doc.id, toolInstanceData)
        if (Object.keys(toUpload).length > 0) {
          toolDataToUpload.set(doc.id, toUpload)
        }
      }

      delete data.lastUpdated
      delete data._computed
      sessions.push({ id: doc.id, ...data })
    })

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

      // Upload each tool instance data item
      for (const [toolId, data] of Object.entries(toolData)) {
        await setDoc(sessionRef, {
          [`toolInstanceData.${toolId}`]: data,
          lastUpdated: serverTimestamp()
        }, { merge: true })
      }

      console.log(`Uploaded ${Object.keys(toolData).length} merged tool instances for session ${sessionId}`)
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
 * Delete a studio session from Firestore
 * @param {string} sessionId - Session ID to delete
 * @returns {Promise<void>}
 */
export const deleteStudioSessionFromFirestore = async (sessionId) => {
  try {
    const auth = getFirebaseAuth()
    const user = auth.currentUser

    if (!user) return

    const db = getFirebaseDb()
    const sessionRef = doc(db, 'users', user.uid, 'studioSessions', sessionId)

    await deleteDoc(sessionRef)
    console.log(`Studio session ${sessionId} deleted from cloud`)
  } catch (error) {
    console.error('Failed to delete studio session from Firestore:', error)
  }
}
