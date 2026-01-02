/**
 * Per-instance persistence for generated tools.
 * Each tool instance gets its own isolated storage.
 * Storage key is based on sessionId + toolId to isolate data between sessions.
 * Tool instance data syncs immediately to Firestore when changed.
 */

import { watchEffect } from 'vue'
import { saveToolInstanceDataImmediate } from '../../services/firestore.js'

const STORAGE_PREFIX = 'tool-instance-'

// Track pending sync timers to avoid excessive Firestore writes
const syncTimers = new Map()

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
 * @returns {Object} Storage API
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
  const storageKey = `${STORAGE_PREFIX}${sessionSuffix}-${toolId}`

  function getState() {
    try {
      const stored = localStorage.getItem(storageKey)
      return stored ? JSON.parse(stored) : {}
    } catch (e) {
      console.error('Error loading tool instance state:', e)
      return {}
    }
  }

  function setState(state) {
    try {
      localStorage.setItem(storageKey, safeStringify(state))
    } catch (e) {
      console.error('Error saving tool instance state:', e)
    }

    // Sync to Firestore (debounced to avoid excessive writes)
    scheduleSync()
  }

  /**
   * Schedule a debounced Firestore sync
   */
  function scheduleSync() {
    const key = `${sessionId}-${toolId}`

    // Clear existing timer
    if (syncTimers.has(key)) {
      clearTimeout(syncTimers.get(key))
    }

    // Schedule new sync (1 second debounce)
    const timer = setTimeout(() => {
      const state = getState()
      saveToolInstanceDataImmediate(sessionId, toolId, state)
        .catch(err => console.error('Tool instance sync failed:', err))
      syncTimers.delete(key)
    }, 1000)

    syncTimers.set(key, timer)
  }

  /**
   * Get a value from storage
   * @param {string} key - The key to retrieve
   * @param {*} defaultValue - Default value if key doesn't exist
   * @returns {*} The stored value or defaultValue
   */
  function get(key, defaultValue = undefined) {
    const state = getState()
    return key in state ? state[key] : defaultValue
  }

  /**
   * Set a value in storage
   * @param {string} key - The key to set
   * @param {*} value - The value to store
   */
  function set(key, value) {
    const state = getState()
    state[key] = value
    setState(state)
  }

  /**
   * Update multiple values at once
   * @param {Object} updates - Object with key-value pairs to update
   */
  function update(updates) {
    const state = getState()
    Object.assign(state, updates)
    setState(state)
  }

  /**
   * Remove a key from storage
   * @param {string} key - The key to remove
   */
  function remove(key) {
    const state = getState()
    delete state[key]
    setState(state)
  }

  /**
   * Clear all data for this instance
   */
  function clear() {
    setState({})
  }

  /**
   * Watch a reactive value and persist changes automatically
   * @param {Ref|Function} source - A ref or function that returns the value
   * @param {string} key - The key to store the value under
   */
  function watchAndPersist(source, key = 'value') {
    watchEffect(() => {
      const value = typeof source === 'function' ? source() : source.value
      set(key, value)
    })
  }

  /**
   * Get all keys in storage
   * @returns {string[]} Array of keys
   */
  function keys() {
    return Object.keys(getState())
  }

  /**
   * Check if a key exists
   * @param {string} key - The key to check
   * @returns {boolean} True if key exists
   */
  function has(key) {
    return key in getState()
  }

  return {
    get,
    set,
    update,
    remove,
    clear,
    watchAndPersist,
    getState,
    setState,
    keys,
    has
  }
}

/**
 * Create a no-op store for when toolName/instanceId are missing
 */
function createNoOpStore() {
  return {
    get: (_key, defaultValue) => defaultValue,
    set: () => {},
    update: () => {},
    remove: () => {},
    clear: () => {},
    watchAndPersist: () => {},
    getState: () => ({}),
    setState: () => {},
    keys: () => [],
    has: () => false
  }
}
