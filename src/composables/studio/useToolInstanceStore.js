/**
 * Per-instance persistence for generated tools using IndexedDB.
 * Each tool instance gets its own isolated storage.
 * Storage key is based on sessionId + toolId to isolate data between sessions.
 * Tool instance data syncs immediately to Firestore when changed.
 */

import { watchEffect } from 'vue'
import { saveToolInstanceDataImmediate } from '../../services/firestore.js'
import {
  saveToolInstanceState,
  loadToolInstanceState,
  deleteToolInstanceState,
  migrateToolInstancesFromLocalStorage
} from '../../services/indexedDB.js'

// Track pending sync timers to avoid excessive Firestore writes
const syncTimers = new Map()

// Track migration state
let migrationPromise = null
let migrationComplete = false

/**
 * Run one-time migration from localStorage to IndexedDB
 */
async function ensureMigration() {
  if (migrationComplete) return
  if (migrationPromise) return migrationPromise

  migrationPromise = migrateToolInstancesFromLocalStorage()
  await migrationPromise
  migrationComplete = true
  return migrationPromise
}

/**
 * Safely stringify a value, handling circular references
 * @param {*} value - The value to stringify
 * @returns {string} JSON string or empty object on error
 */
function safeStringify(value) {
  try {
    return JSON.stringify(value)
  } catch (e) {
    // Handle circular references by using a replacer
    const seen = new WeakSet()
    try {
      return JSON.stringify(value, (key, val) => {
        if (typeof val === 'object' && val !== null) {
          if (seen.has(val)) {
            return '[Circular]'
          }
          seen.add(val)
        }
        return val
      })
    } catch (e2) {
      // If still fails, return empty object
      console.warn('Failed to stringify state with circular reference handler:', e2)
      return '{}'
    }
  }
}

/**
 * Create a per-instance storage for a tool.
 * @param {string} toolName - The name/identifier of the tool type (for logging only)
 * @param {string} toolId - The unique tool identifier
 * @param {string} sessionId - The session identifier for isolation
 * @returns {Object} Storage API (async functions)
 */
export function useToolInstanceStore(toolName, toolId, sessionId) {
  if (!toolId) {
    console.warn('useToolInstanceStore: toolId is required', { toolName, toolId, sessionId })
    // Return a no-op API for safety
    return createNoOpStore()
  }

  // Use sessionId + toolId for storage key to isolate data between sessions
  // If no sessionId provided, use 'default' for backwards compatibility
  const sessionSuffix = sessionId ? `${sessionId}` : 'default'

  // Trigger migration in background (non-blocking)
  ensureMigration().catch(err => console.error('Migration failed:', err))

  // Cache state locally to avoid excessive IndexedDB reads
  let cachedState = null
  let statePromise = null

  /**
   * Get the current state (cached if available)
   * @returns {Promise<Object>}
   */
  async function getState() {
    // Return cached state if available
    if (cachedState !== null) {
      return cachedState
    }

    // Use existing promise if loading in progress
    if (statePromise) {
      return statePromise
    }

    statePromise = (async () => {
      try {
        const stored = await loadToolInstanceState(sessionSuffix, toolId)
        cachedState = stored || {}
        return cachedState
      } catch (e) {
        console.error('Error loading tool instance state:', e)
        cachedState = {}
        return cachedState
      }
    })()

    // Clear promise after completion
    statePromise.finally(() => {
      statePromise = null
    })

    return statePromise
  }

  /**
   * Set the state (updates cache and IndexedDB)
   * @param {Object} state - The state to save
   */
  async function setState(state) {
    try {
      cachedState = state
      await saveToolInstanceState(sessionSuffix, toolId, state)
    } catch (e) {
      console.error('Error saving tool instance state:', e)
      throw e
    }

    // Sync to Firestore (debounced to avoid excessive writes)
    scheduleSync()
  }

  /**
   * Schedule a debounced Firestore sync
   */
  function scheduleSync() {
    const key = `${sessionSuffix}-${toolId}`

    // Clear existing timer
    if (syncTimers.has(key)) {
      clearTimeout(syncTimers.get(key))
    }

    // Schedule new sync (1 second debounce)
    const timer = setTimeout(async () => {
      const state = await getState()
      saveToolInstanceDataImmediate(sessionSuffix, toolId, state)
        .catch(err => console.error('Tool instance sync failed:', err))
      syncTimers.delete(key)
    }, 1000)

    syncTimers.set(key, timer)
  }

  /**
   * Get a value from storage
   * @param {string} key - The key to retrieve
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {Promise<*>} The stored value or defaultValue
   */
  async function get(key, defaultValue = undefined) {
    const state = await getState()
    return key in state ? state[key] : defaultValue
  }

  /**
   * Set a value in storage
   * @param {string} key - The key to set
   * @param {*} value - The value to store
   */
  async function set(key, value) {
    const state = await getState()
    state[key] = value
    await setState(state)
  }

  /**
   * Update multiple values at once
   * @param {Object} updates - Object with key-value pairs to update
   */
  async function update(updates) {
    const state = await getState()
    Object.assign(state, updates)
    await setState(state)
  }

  /**
   * Remove a key from storage
   * @param {string} key - The key to remove
   */
  async function remove(key) {
    const state = await getState()
    delete state[key]
    await setState(state)
  }

  /**
   * Clear all data for this instance
   */
  async function clear() {
    await setState({})
  }

  /**
   * Watch a reactive value and persist changes automatically
   * @param {Ref|Function} source - A ref or function that returns the value
   * @param {string} key - The key to store the value under
   */
  function watchAndPersist(source, key = 'value') {
    watchEffect(async () => {
      const value = typeof source === 'function' ? source() : source.value
      await set(key, value)
    })
  }

  /**
   * Get all keys in storage
   * @returns {Promise<string[]>} Array of keys
   */
  async function keys() {
    const state = await getState()
    return Object.keys(state)
  }

  /**
   * Check if a key exists
   * @param {string} key - The key to check
   * @returns {Promise<boolean>} True if key exists
   */
  async function has(key) {
    const state = await getState()
    return key in state
  }

  /**
   * Delete this tool instance from storage
   */
  async function deleteInstance() {
    try {
      cachedState = null
      await deleteToolInstanceState(sessionSuffix, toolId)
    } catch (e) {
      console.error('Error deleting tool instance state:', e)
      throw e
    }
  }

  /**
   * Synchronous getter for cached state.
   * Returns the cached state (may be empty if not yet loaded from IndexedDB).
   * Use this when you need synchronous access (e.g., in Vue's data() function).
   * @returns {Object} The cached state (empty object if not loaded)
   */
  function getStateSync() {
    return cachedState || {}
  }

  return {
    get,
    set,
    update,
    remove,
    clear,
    watchAndPersist,
    getState,
    getStateSync, // Synchronous version for Vue data() hook
    setState,
    keys,
    has,
    delete: deleteInstance // Use shorthand to avoid reserved keyword issue
  }
}

/**
 * Create a no-op store for when toolName/instanceId are missing
 */
function createNoOpStore() {
  return {
    get: async (_key, defaultValue) => defaultValue,
    set: async () => {},
    update: async () => {},
    remove: async () => {},
    clear: async () => {},
    watchAndPersist: () => {},
    getState: async () => ({}),
    getStateSync: () => ({}),
    setState: async () => {},
    keys: async () => [],
    has: async () => false,
    delete: async () => {}
  }
}
