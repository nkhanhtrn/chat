/**
 * Firestore Chat Sync Module
 *
 * Handles cloud sync for chat data (messages, notebooks):
 * - Sync chat state using subcollections for messages
 * - Load chat state from Firestore
 * - Migrate from legacy format to subcollections
 * - Subscribe to real-time updates
 * - Delete chat state
 */

import { doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, serverTimestamp, collection, writeBatch } from 'firebase/firestore'
import { getFirebaseDb, getFirebaseAuth } from '../firebase.js'
import { waitForAuth } from './firestore-utils.js'

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
