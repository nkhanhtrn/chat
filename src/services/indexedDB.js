// IndexedDB service for storing chat state (replaces localStorage for large data)
import { openDB } from 'idb'

const DB_NAME = 'chat-clone-db'
const DB_VERSION = 1
const STORE_NAME = 'app-data'
const CHAT_STATE_KEY = 'chat-state'

let dbPromise = null

/**
 * Initialize and get the IndexedDB database instance
 * @returns {Promise<IDBDatabase>}
 */
const getDB = () => {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        // Create object store if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }
  return dbPromise
}

/**
 * Save chat state to IndexedDB
 * @param {Object} state - The chat state to save
 * @returns {Promise<void>}
 */
export const saveChatStateToIDB = async (state) => {
  try {
    const db = await getDB()
    await db.put(STORE_NAME, state, CHAT_STATE_KEY)
  } catch (error) {
    console.error('Failed to save chat state to IndexedDB:', error)
    throw error
  }
}

/**
 * Load chat state from IndexedDB
 * @returns {Promise<Object|null>}
 */
export const loadChatStateFromIDB = async () => {
  try {
    const db = await getDB()
    const state = await db.get(STORE_NAME, CHAT_STATE_KEY)
    return state || null
  } catch (error) {
    console.error('Failed to load chat state from IndexedDB:', error)
    return null
  }
}

/**
 * Clear chat state from IndexedDB
 * @returns {Promise<void>}
 */
export const clearChatStateFromIDB = async () => {
  try {
    const db = await getDB()
    await db.delete(STORE_NAME, CHAT_STATE_KEY)
  } catch (error) {
    console.error('Failed to clear chat state from IndexedDB:', error)
    throw error
  }
}

/**
 * Check if IndexedDB is available in the browser
 * @returns {boolean}
 */
export const isIndexedDBAvailable = () => {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

/**
 * Migrate data from localStorage to IndexedDB (one-time migration)
 * @returns {Promise<boolean>} True if migration occurred, false otherwise
 */
export const migrateFromLocalStorage = async () => {
  const STORAGE_KEY = 'chat-state'

  try {
    // Check if data exists in localStorage
    const localData = localStorage.getItem(STORAGE_KEY)
    if (!localData) {
      return false
    }

    // Check if IndexedDB already has data
    const idbData = await loadChatStateFromIDB()
    if (idbData) {
      // IndexedDB already has data, skip migration
      // Clear localStorage to free up space
      localStorage.removeItem(STORAGE_KEY)
      console.log('IndexedDB already has data, cleared localStorage')
      return false
    }

    // Migrate localStorage data to IndexedDB
    const parsedData = JSON.parse(localData)
    await saveChatStateToIDB(parsedData)

    // Clear localStorage after successful migration
    localStorage.removeItem(STORAGE_KEY)
    console.log('Successfully migrated chat state from localStorage to IndexedDB')
    return true
  } catch (error) {
    console.error('Failed to migrate from localStorage to IndexedDB:', error)
    return false
  }
}
