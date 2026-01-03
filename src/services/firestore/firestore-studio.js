/**
 * Firestore Studio Sync Module
 *
 * Handles cloud sync for Studio sessions:
 * - Save/load studio sessions to/from Firestore
 * - Save single session (more efficient)
 * - Save tool instance data immediately
 * - Delete studio sessions
 * - Helper functions for tool instance data
 */

import { debugLog } from '../../utils/debug.js'
import { doc, setDoc, getDoc, getDocs, deleteDoc, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import { getFirebaseDb, getFirebaseAuth, getFirebaseStorage } from '../firebase.js'
import { waitForAuth, sanitizeForFirestore, deserializeFromFirestore, saveToStorage, loadFromStorage, isDataTooLarge } from './firestore-utils.js'

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
    debugLog('[firestore.syncStudioSessionToFirestore] Reading from localStorage:', chatKey, canvasKey)
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
    debugLog('[firestore.collectToolInstanceData] Scanning localStorage for tool instances:', toolPrefix)
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

    debugLog('[firestore.collectToolInstanceData] Found tool instances:', Object.keys(result).length)
    return result
  } catch (error) {
    console.error('Failed to collect tool instance data:', error)
    return {}
  }
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
          const key = `studio-chat-${doc.id}`
          debugLog('[firestore.loadStudioSessionsFromFirestore] Writing chat state to localStorage:', key)
          localStorage.setItem(key, JSON.stringify(data.chatState))
        } catch (e) {
          console.warn('Failed to restore chat state to localStorage:', e)
        }
        delete data.chatState
      }

      if (data.canvasState) {
        try {
          const key = `studio-canvas-windows-${doc.id}`
          debugLog('[firestore.loadStudioSessionsFromFirestore] Writing canvas state to localStorage:', key)
          localStorage.setItem(key, JSON.stringify(data.canvasState))
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
    debugLog('[firestore.restoreToolInstanceData] Restoring tool data for session:', sessionId)

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

    debugLog('[firestore.restoreToolInstanceData] Local tools:', Object.keys(localToolData).length, 'Cloud tools:', Object.keys(cloudToolData).length)

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
        debugLog('[firestore.restoreToolInstanceData] Writing cloud tool to localStorage:', key)
        localStorage.setItem(key, JSON.stringify(cloudItem))
      } else {
        // Both exist → use newer by _updatedAt timestamp
        const cloudTime = cloudItem._updatedAt || 0
        const localTime = localItem._updatedAt || 0

        if (cloudTime > localTime) {
          // Cloud is newer → use cloud data
          debugLog('[firestore.restoreToolInstanceData] Cloud is newer, writing to localStorage:', key)
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
