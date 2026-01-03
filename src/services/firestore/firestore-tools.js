/**
 * Firestore Tools Sync Module
 *
 * Handles cloud sync for shared tools:
 * - Save/load tools to/from Firestore
 * - Delete tools (soft and permanent)
 * - Generic merge utility for bidirectional sync
 */

import { doc, setDoc, getDoc, getDocs, deleteDoc, collection } from 'firebase/firestore'
import { getFirebaseDb, getFirebaseAuth } from '../firebase.js'
import { waitForAuth } from './firestore-utils.js'

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
