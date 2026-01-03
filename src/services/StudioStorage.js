/**
 * StudioStorage - Centralized storage for Studio sessions
 *
 * Responsibilities:
 * - Manage session metadata in localStorage
 * - Manage canvas (windows) and tools (with code) in IndexedDB
 * - Manage tool instance state (runtime state for each tool)
 * - Handle migration from legacy storage
 * - Provide clean API for composables to use
 *
 * Storage:
 * - localStorage: studio-sessions (metadata only), studio-chat-{sessionId}
 * - IndexedDB: session-canvas (windows), session-tools (with code), tool-instances (runtime state)
 */

import { debugLog } from '../utils/debug.js'
import { getDB } from './indexedDB.js'

// IndexedDB store names
const TOOL_INSTANCES_STORE = 'tool-instances'
const SESSION_TOOLS_STORE = 'session-tools'
const SESSION_CANVAS_STORE = 'session-canvas'

const STORAGE_PREFIX = 'studio'

// Keys (localStorage only - for metadata and chat)
const KEYS = {
  SESSIONS: `${STORAGE_PREFIX}-sessions`,
  CHAT: (sessionId) => `${STORAGE_PREFIX}-chat-${sessionId}`
}

// Legacy keys (for migration)
const LEGACY_KEYS = {
  CHAT: `${STORAGE_PREFIX}-chat`,
  CANVAS: `${STORAGE_PREFIX}-canvas-windows`
}

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
 * Sanitize data for IndexedDB by converting Vue Proxy/reactive objects to plain objects.
 * IndexedDB uses structured clone algorithm which can't clone:
 * - Proxies, Functions, Symbols
 * - BigInt, DOM elements, Window objects
 * - WeakMap, WeakSet (empty after serialization)
 * @param {*} value - The value to sanitize
 * @param {WeakSet} seen - Set of objects already visited (for circular reference detection)
 * @returns {*} Sanitized value
 */
function sanitizeForIndexedDB(value, seen = new WeakSet()) {
  // Handle null/undefined
  if (value === null || value === undefined) {
    return value
  }

  // Skip functions (can't be cloned)
  if (typeof value === 'function') {
    return undefined
  }

  // Skip symbols (can't be cloned)
  if (typeof value === 'symbol') {
    return undefined
  }

  // Skip BigInt (can't be serialized with JSON)
  if (typeof value === 'bigint') {
    return value.toString() // Convert to string
  }

  // Handle primitives
  if (typeof value !== 'object') {
    return value
  }

  // Skip DOM elements and Window objects
  if (value instanceof Element) {
    return undefined
  }
  if (value instanceof Window) {
    return undefined
  }
  if (value instanceof Node) {
    return undefined
  }

  // Check for circular references - skip them
  if (seen.has(value)) {
    return undefined
  }
  seen.add(value)

  // Handle arrays
  if (Array.isArray(value)) {
    return value.map(item => sanitizeForIndexedDB(item, seen))
  }

  // Handle objects - convert to plain object
  // Try JSON round-trip first (handles Dates, Maps, Sets, etc.)
  try {
    return JSON.parse(JSON.stringify(value, (key, val) => {
      // Skip functions during JSON stringify
      if (typeof val === 'function') {
        return undefined
      }
      // Skip symbols
      if (typeof val === 'symbol') {
        return undefined
      }
      // Convert BigInt to string
      if (typeof val === 'bigint') {
        return val.toString()
      }
      // Skip DOM elements
      if (val instanceof Element) {
        return undefined
      }
      if (val instanceof Window) {
        return undefined
      }
      if (val instanceof Node) {
        return undefined
      }
      // Skip WeakMap/WeakSet (become empty object anyway)
      if (val instanceof WeakMap || val instanceof WeakSet) {
        return undefined
      }
      // Handle circular references during JSON stringify - skip them
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) {
          return undefined
        }
        seen.add(val)
      }
      return val
    }))
  } catch (e) {
    // If JSON round-trip fails, do manual conversion
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
          result[key] = sanitizeForIndexedDB(val, seen)
        } catch (e2) {
          // Skip values that can't be sanitized
          console.warn(`Skipping property "${key}" due to sanitization error:`, e2)
        }
      }
    }
    return result
  }
}

export class StudioStorage {
  /**
   * Save session metadata to localStorage
   */
  static saveSessions(state) {
    try {
      const serialized = JSON.stringify(state)
      debugLog('[StudioStorage.saveSessions] Writing to localStorage:', KEYS.SESSIONS, state)
      localStorage.setItem(KEYS.SESSIONS, serialized)
      return true
    } catch (e) {
      console.warn('[StudioStorage] Failed to save sessions:', e)
      throw new StorageError('Failed to save sessions', KEYS.SESSIONS, e)
    }
  }

  /**
   * Load session metadata from localStorage
   */
  static loadSessions() {
    try {
      const stored = localStorage.getItem(KEYS.SESSIONS)
      debugLog('[StudioStorage.loadSessions] Reading from localStorage:', KEYS.SESSIONS, stored ? 'found' : 'not found')
      if (stored) {
        return JSON.parse(stored)
      }
      return null
    } catch (e) {
      console.warn('[StudioStorage] Failed to load sessions:', e)
      throw new StorageError('Failed to load sessions', KEYS.SESSIONS, e)
    }
  }

  /**
   * Save chat state for a specific session
   */
  static saveChatState(sessionId, chatState) {
    if (!sessionId) {
      console.warn('[StudioStorage] Cannot save chat state without sessionId')
      return false
    }

    try {
      const key = KEYS.CHAT(sessionId)
      debugLog('[StudioStorage.saveChatState] Writing to localStorage:', key, chatState)
      localStorage.setItem(key, JSON.stringify(chatState))
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to save chat state for session ${sessionId}:`, e)
      throw new StorageError('Failed to save chat state', KEYS.CHAT(sessionId), e)
    }
  }

  /**
   * Load chat state for a specific session
   */
  static loadChatState(sessionId) {
    if (!sessionId) {
      return { messages: [], nextMessageId: 1 }
    }

    try {
      const key = KEYS.CHAT(sessionId)
      const stored = localStorage.getItem(key)
      debugLog('[StudioStorage.loadChatState] Reading from localStorage:', key, stored ? 'found' : 'not found')
      if (stored) {
        return JSON.parse(stored)
      }
      return { messages: [], nextMessageId: 1 }
    } catch (e) {
      console.warn(`[StudioStorage] Failed to load chat state for session ${sessionId}:`, e)
      return { messages: [], nextMessageId: 1 }
    }
  }

  /**
   * Delete chat state for a specific session
   */
  static deleteChatState(sessionId) {
    if (!sessionId) return false

    try {
      const key = KEYS.CHAT(sessionId)
      debugLog('[StudioStorage.deleteChatState] Removing from localStorage:', key)
      localStorage.removeItem(key)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to delete chat state for session ${sessionId}:`, e)
      return false
    }
  }

  /**
   * Save canvas state (windows) for a specific session (uses IndexedDB)
   */
  static async saveCanvasState(sessionId, canvasState) {
    if (!sessionId) {
      console.warn('[StudioStorage] Cannot save canvas state without sessionId')
      return false
    }

    try {
      const db = await getDB()
      debugLog('[StudioStorage.saveCanvasState] Writing canvas state for session:', sessionId, { windowCount: canvasState.windows?.length })
      await db.put(SESSION_CANVAS_STORE, canvasState, sessionId)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to save canvas state for session ${sessionId}:`, e)
      throw new StorageError('Failed to save canvas state', `session-canvas:${sessionId}`, e)
    }
  }

  /**
   * Load canvas state (windows) for a specific session (uses IndexedDB)
   */
  static async loadCanvasState(sessionId) {
    if (!sessionId) {
      return {
        windows: [],
        nextWindowId: 1,
        maxZIndex: 100
      }
    }

    try {
      const db = await getDB()
      const canvasState = await db.get(SESSION_CANVAS_STORE, sessionId)
      const result = canvasState || { windows: [], nextWindowId: 1, maxZIndex: 100 }
      debugLog('[StudioStorage.loadCanvasState] Reading canvas state for session:', sessionId, result)
      return result
    } catch (e) {
      console.warn(`[StudioStorage] Failed to load canvas state for session ${sessionId}:`, e)
      return {
        windows: [],
        nextWindowId: 1,
        maxZIndex: 100
      }
    }
  }

  /**
   * Delete canvas state for a specific session (uses IndexedDB)
   */
  static async deleteCanvasState(sessionId) {
    if (!sessionId) return false

    try {
      const db = await getDB()
      debugLog('[StudioStorage.deleteCanvasState] Deleting canvas state for session:', sessionId)
      await db.delete(SESSION_CANVAS_STORE, sessionId)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to delete canvas state for session ${sessionId}:`, e)
      return false
    }
  }

  /**
   * Save tools for a specific session (uses IndexedDB)
   */
  static async saveTools(sessionId, tools) {
    if (!sessionId) {
      console.warn('[StudioStorage] Cannot save tools without sessionId')
      return false
    }

    try {
      const db = await getDB()
      debugLog('[StudioStorage.saveTools] Writing tools for session:', sessionId, { toolCount: Object.keys(tools).length })
      await db.put(SESSION_TOOLS_STORE, tools, sessionId)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to save tools for session ${sessionId}:`, e)
      throw new StorageError('Failed to save tools', `session-tools:${sessionId}`, e)
    }
  }

  /**
   * Load tools for a specific session (uses IndexedDB)
   */
  static async loadTools(sessionId) {
    if (!sessionId) {
      return {}
    }

    try {
      const db = await getDB()
      const tools = await db.get(SESSION_TOOLS_STORE, sessionId)
      const result = tools || {}
      debugLog('[StudioStorage.loadTools] Reading tools for session:', sessionId, result)
      return result
    } catch (e) {
      console.warn(`[StudioStorage] Failed to load tools for session ${sessionId}:`, e)
      return {}
    }
  }

  /**
   * Delete tools for a specific session (uses IndexedDB)
   */
  static async deleteTools(sessionId) {
    if (!sessionId) return false

    try {
      const db = await getDB()
      debugLog('[StudioStorage.deleteTools] Deleting tools for session:', sessionId)
      await db.delete(SESSION_TOOLS_STORE, sessionId)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to delete tools for session ${sessionId}:`, e)
      return false
    }
  }

  // ============ Tool Instance State Storage ============

  /**
   * Save tool instance state to IndexedDB
   * Used for storing runtime state of individual tool instances (form data, selections, etc.)
   * @param {string} sessionId - The session identifier
   * @param {string} toolId - The tool identifier
   * @param {Object} state - The state object to store
   * @returns {Promise<boolean>} True if successful
   */
  static async saveToolState(sessionId, toolId, state) {
    if (!sessionId || !toolId) {
      console.warn('[StudioStorage] Cannot save tool state without sessionId and toolId')
      return false
    }

    try {
      // Sanitize state to convert Proxy objects to plain objects
      const sanitizedState = sanitizeForIndexedDB(state)
      const db = await getDB()
      const key = `${sessionId}-${toolId}`
      debugLog('[StudioStorage.saveToolState] Writing tool state to IndexedDB:', { sessionId, toolId, keys: Object.keys(state) })
      await db.put(TOOL_INSTANCES_STORE, sanitizedState, key)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to save tool state for session ${sessionId}, tool ${toolId}:`, e)
      throw new StorageError('Failed to save tool state', `tool-instance:${sessionId}-${toolId}`, e)
    }
  }

  /**
   * Load tool instance state from IndexedDB
   * @param {string} sessionId - The session identifier
   * @param {string} toolId - The tool identifier
   * @returns {Promise<Object>} The state object (empty if not found)
   */
  static async loadToolState(sessionId, toolId) {
    if (!sessionId || !toolId) {
      return {}
    }

    try {
      const db = await getDB()
      const key = `${sessionId}-${toolId}`
      const state = await db.get(TOOL_INSTANCES_STORE, key)
      const result = state || {}
      debugLog('[StudioStorage.loadToolState] Reading tool state from IndexedDB:', { sessionId, toolId, found: !!Object.keys(result).length })
      return result
    } catch (e) {
      console.warn(`[StudioStorage] Failed to load tool state for session ${sessionId}, tool ${toolId}:`, e)
      return {}
    }
  }

  /**
   * Delete tool instance state from IndexedDB
   * @param {string} sessionId - The session identifier
   * @param {string} toolId - The tool identifier
   * @returns {Promise<boolean>} True if successful
   */
  static async deleteToolState(sessionId, toolId) {
    if (!sessionId || !toolId) return false

    try {
      const db = await getDB()
      const key = `${sessionId}-${toolId}`
      debugLog('[StudioStorage.deleteToolState] Deleting tool state from IndexedDB:', { sessionId, toolId })
      await db.delete(TOOL_INSTANCES_STORE, key)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to delete tool state for session ${sessionId}, tool ${toolId}:`, e)
      return false
    }
  }

  /**
   * Migrate tool instance data from localStorage to IndexedDB
   * Called on app initialization
   * @returns {Promise<number>} Number of entries migrated
   */
  static async migrateToolInstances() {
    const STORAGE_PREFIX = 'tool-instance-'

    try {
      debugLog('[StudioStorage.migrateToolInstances] Starting migration...')
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX))
      if (keys.length === 0) {
        return 0
      }

      const db = await getDB()
      let migratedCount = 0

      for (const key of keys) {
        try {
          const data = localStorage.getItem(key)
          if (data) {
            const parsed = JSON.parse(data)
            // Extract sessionId and toolId from key (format: tool-instance-{sessionId}-{toolId})
            const parts = key.replace(STORAGE_PREFIX, '').split('-')
            if (parts.length >= 2) {
              const sessionId = parts.slice(0, -1).join('-')
              const toolId = parts[parts.length - 1]
              const idbKey = `${sessionId}-${toolId}`
              await db.put(TOOL_INSTANCES_STORE, parsed, idbKey)
              localStorage.removeItem(key)
              migratedCount++
            }
          }
        } catch (e) {
          console.warn(`Failed to migrate key ${key}:`, e)
        }
      }

      console.log(`Migrated ${migratedCount} tool instance entries from localStorage to IndexedDB`)
      debugLog('[StudioStorage.migrateToolInstances] Migrated entries:', migratedCount)
      return migratedCount
    } catch (e) {
      console.warn('[StudioStorage] Failed to migrate tool instances:', e)
      return 0
    }
  }

  /**
   * Delete all data for a specific session
   * Used when deleting a session (async - uses IndexedDB)
   */
  static async deleteSession(sessionId) {
    if (!sessionId) return false

    try {
      this.deleteChatState(sessionId)
      await this.deleteCanvasState(sessionId)
      await this.deleteTools(sessionId)
      // Note: Tool instance states are kept as they use {sessionId}-{toolId} keys
      // They will be cleaned up when individual tools are deleted

      console.log(`[StudioStorage] Deleted session ${sessionId}`)
      return true
    } catch (e) {
      console.warn(`[StudioStorage] Failed to delete session ${sessionId}:`, e)
      return false
    }
  }

  /**
   * Migrate legacy storage to new session
   * Called when initializing sessions for the first time
   * NOTE: Only migrates chat state now. Canvas/tools use IndexedDB (clean slate).
   */
  static migrateLegacyData(sessionId) {
    if (!sessionId) return false

    try {
      const legacyChat = localStorage.getItem(LEGACY_KEYS.CHAT)
      debugLog('[StudioStorage.migrateLegacyData] Found legacy data:', legacyChat ? 'yes' : 'no')

      let migrated = false

      if (legacyChat) {
        localStorage.setItem(KEYS.CHAT(sessionId), legacyChat)
        localStorage.removeItem(LEGACY_KEYS.CHAT)
        migrated = true
        console.log(`[StudioStorage] Migrated legacy chat data to session ${sessionId}`)
      }

      return migrated
    } catch (e) {
      console.warn(`[StudioStorage] Failed to migrate legacy data:`, e)
      return false
    }
  }

  /**
   * Clear all studio storage
   * Useful for testing or reset
   */
  static clearAll() {
    try {
      // Remove all studio-prefixed keys
      const keysToRemove = []
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_PREFIX)) {
          keysToRemove.push(key)
        }
      }
      debugLog('[StudioStorage.clearAll] Removing all studio storage keys:', keysToRemove)
      keysToRemove.forEach(key => localStorage.removeItem(key))
      console.log(`[StudioStorage] Cleared ${keysToRemove.length} storage entries`)
      return true
    } catch (e) {
      console.warn('[StudioStorage] Failed to clear all storage:', e)
      return false
    }
  }

  /**
   * Get storage info for debugging
   */
  static getStorageInfo() {
    const info = {
      sessions: 0,
      totalKeys: 0,
      keys: []
    }

    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key && key.startsWith(STORAGE_PREFIX)) {
          info.totalKeys++
          info.keys.push(key)
          if (key === KEYS.SESSIONS) {
            const data = this.loadSessions()
            if (data?.sessions) {
              info.sessions = data.sessions.length
            }
          }
        }
      }
    } catch (e) {
      console.warn('[StudioStorage] Failed to get storage info:', e)
    }

    return info
  }
}

export default StudioStorage
