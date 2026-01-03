/**
 * ChatStorage - Centralized storage for main chat (non-Studio)
 *
 * Responsibilities:
 * - Manage chat state in IndexedDB
 * - Provide read-only mode for safe data viewing
 * - Provide clean API for storage operations
 *
 * Storage:
 * - IndexedDB: app-data store with 'chat-state' key
 */

import { debugLog } from '../utils/debug.js'
import { getDB } from './indexedDB.js'

// IndexedDB store name
const APP_DATA_STORE = 'app-data'
const CHAT_STATE_KEY = 'chat-state'

// Read-only mode flag - when true, no data is saved
let readOnlyMode = false

/**
 * Storage errors
 */
export class StorageError extends Error {
  constructor(message, key, cause) {
    super(message)
    this.name = 'StorageError'
    this.key = key
    this.cause = cause
  }
}

/**
 * ChatStorage class - handles all main chat storage
 */
export class ChatStorage {
  /**
   * Enable or disable read-only mode
   * @param {boolean} enabled - Whether to enable read-only mode
   */
  static setReadOnlyMode(enabled) {
    readOnlyMode = enabled
    console.log(`[ChatStorage] Read-only mode ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Check if read-only mode is enabled
   * @returns {boolean}
   */
  static isReadOnlyMode() {
    return readOnlyMode
  }

  /**
   * Serialize state by converting objects to plain JSON-safe format
   * @param {Object} state - The state to serialize
   * @returns {Object} Serialized state
   */
  static serializeState(state) {
    return JSON.parse(JSON.stringify(state))
  }

  /**
   * Save chat state to IndexedDB
   * @param {Object} state - The chat state to save
   * @returns {Promise<void>}
   */
  static async saveState(state) {
    // Check read-only mode using the method
    if (this.isReadOnlyMode()) {
      debugLog('[ChatStorage.saveState] Skipping save - read-only mode')
      return
    }

    // Don't save while streaming to avoid excessive writes
    if (state.isStreaming) {
      debugLog('[ChatStorage.saveState] Skipping save - streaming in progress')
      return
    }

    try {
      const serializedState = this.serializeState(state)
      serializedState.lastUpdated = Date.now()
      const db = await getDB()
      debugLog('[ChatStorage.saveState] Writing chat state to IndexedDB:', { messageCount: state.messages?.length })
      await db.put(APP_DATA_STORE, serializedState, CHAT_STATE_KEY)
    } catch (error) {
      console.error('[ChatStorage] Failed to save chat state:', error)
      throw new StorageError('Failed to save chat state', CHAT_STATE_KEY, error)
    }
  }

  /**
   * Load chat state from IndexedDB
   * @returns {Promise<Object|null>} The chat state or null if not found
   */
  static async loadState() {
    try {
      const db = await getDB()
      const state = await db.get(APP_DATA_STORE, CHAT_STATE_KEY)
      debugLog('[ChatStorage.loadState] Reading from IndexedDB:', state ? 'found' : 'not found')
      return state || null
    } catch (error) {
      console.error('[ChatStorage] Failed to load chat state:', error)
      return null
    }
  }

  /**
   * Delete chat state from IndexedDB
   * @returns {Promise<void>}
   */
  static async clearState() {
    try {
      const db = await getDB()
      debugLog('[ChatStorage.clearState] Deleting chat state from IndexedDB')
      await db.delete(APP_DATA_STORE, CHAT_STATE_KEY)
    } catch (error) {
      console.error('[ChatStorage] Failed to clear chat state:', error)
      throw new StorageError('Failed to clear chat state', CHAT_STATE_KEY, error)
    }
  }

  /**
   * Get current state without migration (for sync operations)
   * @returns {Promise<Object|null>} The chat state or null if not found
   */
  static async getState() {
    try {
      const db = await getDB()
      const state = await db.get(APP_DATA_STORE, CHAT_STATE_KEY)
      debugLog('[ChatStorage.getState] Reading from IndexedDB:', state ? 'found' : 'not found')
      return state || null
    } catch (error) {
      console.error('[ChatStorage] Failed to get chat state:', error)
      return null
    }
  }

  /**
   * Resolve a sync conflict by saving the chosen state
   * @param {Object} state - The state to save as resolved
   * @returns {Promise<Object>} The saved state
   */
  static async resolveConflict(state) {
    try {
      const plainState = this.serializeState(state)
      const db = await getDB()
      await db.put(APP_DATA_STORE, plainState, CHAT_STATE_KEY)
      debugLog('[ChatStorage.resolveConflict] Saved resolved state')
      return plainState
    } catch (error) {
      console.error('[ChatStorage] Failed to resolve conflict:', error)
      throw new StorageError('Failed to resolve conflict', CHAT_STATE_KEY, error)
    }
  }
}

export default ChatStorage
