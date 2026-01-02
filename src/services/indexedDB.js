// IndexedDB service for storing chat state and saved tools
import { openDB } from 'idb'
import {
  saveToolToFirestore,
  loadToolsFromFirestore,
  deleteToolFromFirestore,
  permanentlyDeleteToolFromFirestore,
  mergeCloudLocal
} from './firestore.js'

const DB_NAME = 'chat-clone-db'
const DB_VERSION = 4
const STORE_NAME = 'app-data'
const TOOLS_STORE = 'saved-tools'
const BOOKS_STORE = 'books'
const TOOL_INSTANCES_STORE = 'tool-instances'
const CHAT_STATE_KEY = 'chat-state'

let dbPromise = null
let currentDbVersion = 2  // Track the version we have a promise for

/**
 * Delete the existing database (used for recovery from version conflicts)
 * @returns {Promise<void>}
 */
export const deleteDatabase = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

/**
 * Initialize and get the IndexedDB database instance
 * @returns {Promise<IDBDatabase>}
 */
const getDB = () => {
  // Always return a fresh promise to ensure version upgrades happen
  // The idb library handles connection pooling internally
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, newVersion) {
      console.log(`IndexedDB upgrade: v${oldVersion} → v${newVersion}`)

      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
      if (!db.objectStoreNames.contains(TOOLS_STORE)) {
        const toolsStore = db.createObjectStore(TOOLS_STORE, { keyPath: 'id' })
        toolsStore.createIndex('name', 'name', { unique: false })
        toolsStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(BOOKS_STORE)) {
        const booksStore = db.createObjectStore(BOOKS_STORE, { keyPath: 'id' })
        booksStore.createIndex('createdAt', 'createdAt', { unique: false })
        booksStore.createIndex('lastReadAt', 'lastReadAt', { unique: false })
        console.log('Created books store in IndexedDB')
      }
      if (!db.objectStoreNames.contains(TOOL_INSTANCES_STORE)) {
        db.createObjectStore(TOOL_INSTANCES_STORE)
        console.log('Created tool-instances store in IndexedDB')
      }
      currentDbVersion = DB_VERSION
    },
    blocked() {
      console.error('IndexedDB upgrade blocked - close all tabs and refresh')
    },
    blocking() {
      console.error('IndexedDB upgrade blocking - please close other tabs')
    }
  })
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

// ============ Tool Storage ============

/**
 * Save a tool to IndexedDB (upsert by id or name) and sync to cloud
 * If tool.id is provided, updates the existing record (supports renaming)
 * Otherwise, falls back to upsert by name
 */
export const saveTool = async (tool) => {
  const db = await getDB()

  // Look up by id first (for updates including renames), then by name
  let existing = null
  if (tool.id) {
    existing = await db.get(TOOLS_STORE, tool.id)
  }
  if (!existing) {
    existing = await getToolByName(tool.name)
  }

  const record = {
    id: existing?.id || crypto.randomUUID(),
    name: tool.name,
    emoji: tool.emoji || null,
    type: tool.type,
    code: tool.code,
    sourcePrompt: tool.sourcePrompt || null,
    scope: tool.scope || existing?.scope || 'global',
    sessionId: tool.sessionId || existing?.sessionId || null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  }

  await db.put(TOOLS_STORE, record)

  // Sync to cloud (non-blocking)
  saveToolToFirestore(record).catch(err => console.error('Cloud sync failed:', err))

  return record
}

/**
 * Get a tool by name
 */
export const getToolByName = async (name) => {
  const db = await getDB()
  const index = db.transaction(TOOLS_STORE).store.index('name')
  return await index.get(name)
}

/**
 * Search for existing tools by query string
 * Searches tool name and sourcePrompt for matches
 * @param {string} query - Search query
 * @returns {Promise<Object|null>} Best matching tool or null
 */
export const searchToolByQuery = async (query) => {
  const tools = await getAllTools()
  if (tools.length === 0) return null

  const q = query.toLowerCase().trim()
  const words = q.split(/\s+/).filter(w => w.length > 2)

  // Score each tool based on match quality
  const scored = tools.map(tool => {
    const name = (tool.name || '').toLowerCase()
    const prompt = (tool.sourcePrompt || '').toLowerCase()
    const nameWords = name.split(/\s+/)

    let score = 0

    // Exact name match is best
    if (name === q) score += 100

    // Name contains query or vice versa
    if (name.includes(q)) score += 50
    if (q.includes(name)) score += 40

    // Word matches in name (key words like "calculator", "timer", etc.)
    for (const word of words) {
      if (name.includes(word)) score += 15
    }

    // Name words appear in query
    for (const nameWord of nameWords) {
      if (nameWord.length > 2 && q.includes(nameWord)) score += 15
    }

    // Source prompt exact match
    if (prompt === q) score += 80

    // Source prompt contains query or vice versa
    if (prompt.includes(q)) score += 30
    if (q.includes(prompt) && prompt.length > 5) score += 25

    // Word matches in source prompt
    for (const word of words) {
      if (prompt.includes(word)) score += 5
    }

    return { tool, score }
  })

  // Return best match if score is above threshold
  const best = scored.sort((a, b) => b.score - a.score)[0]
  return best.score >= 15 ? best.tool : null
}

/**
 * Get all saved tools (excludes deleted)
 */
export const getAllTools = async () => {
  const db = await getDB()
  const all = await db.getAll(TOOLS_STORE)
  return all.filter(t => !t.deletedAt)
}

/**
 * Get deleted tools (recycle bin)
 */
export const getDeletedTools = async () => {
  const db = await getDB()
  const all = await db.getAll(TOOLS_STORE)
  return all.filter(t => t.deletedAt).sort((a, b) => b.deletedAt - a.deletedAt)
}

/**
 * Soft delete a tool (move to recycle bin) and sync to cloud
 */
export const deleteTool = async (id) => {
  const db = await getDB()
  const tool = await db.get(TOOLS_STORE, id)
  if (tool) {
    tool.deletedAt = Date.now()
    await db.put(TOOLS_STORE, tool)
    // Sync to cloud (non-blocking)
    deleteToolFromFirestore(id).catch(err => console.error('Cloud sync failed:', err))
  }
}

/**
 * Restore a tool from recycle bin and sync to cloud
 */
export const restoreTool = async (id) => {
  const db = await getDB()
  const tool = await db.get(TOOLS_STORE, id)
  if (tool) {
    delete tool.deletedAt
    await db.put(TOOLS_STORE, tool)
    // Sync restored tool to cloud (non-blocking)
    saveToolToFirestore(tool).catch(err => console.error('Cloud sync failed:', err))
  }
}

/**
 * Permanently delete a tool and sync to cloud
 */
export const permanentlyDeleteTool = async (id) => {
  const db = await getDB()
  await db.delete(TOOLS_STORE, id)
  // Sync to cloud (non-blocking)
  permanentlyDeleteToolFromFirestore(id).catch(err => console.error('Cloud sync failed:', err))
}

/**
 * Empty the recycle bin and sync to cloud
 */
export const emptyRecycleBin = async () => {
  const db = await getDB()
  const deleted = await getDeletedTools()
  for (const tool of deleted) {
    await db.delete(TOOLS_STORE, tool.id)
    // Sync to cloud (non-blocking)
    permanentlyDeleteToolFromFirestore(tool.id).catch(err => console.error('Cloud sync failed:', err))
  }
}

/**
 * Update tool scope (promote session tool to global, or demote global tool to session)
 */
export const updateToolScope = async (id, newScope, sessionId = null) => {
  const db = await getDB()
  const tool = await db.get(TOOLS_STORE, id)
  if (tool) {
    tool.scope = newScope
    tool.sessionId = newScope === 'session' ? sessionId : null
    tool.updatedAt = Date.now()
    await db.put(TOOLS_STORE, tool)
    // Sync to cloud (non-blocking)
    saveToolToFirestore(tool).catch(err => console.error('Cloud sync failed:', err))
    return tool
  }
  return null
}

/**
 * Get tools by scope
 */
export const getToolsByScope = async (scope, sessionId = null) => {
  const tools = await getAllTools()
  if (scope === 'global') {
    return tools.filter(t => t.scope === 'global' || !t.scope)
  }
  // For session scope, filter by sessionId
  return tools.filter(t => t.scope === 'session' && t.sessionId === sessionId)
}

/**
 * Sync tools between cloud and local IndexedDB (bidirectional merge)
 * Uses generic mergeCloudLocal utility
 * @returns {Promise<{fromCloud: number, toCloud: number}>} Sync counts
 */
export const syncToolsFromCloud = async () => {
  try {
    const cloudTools = await loadToolsFromFirestore()
    const localTools = await getAllTools()

    const db = await getDB()

    // Use generic merge utility
    const { merged, toUpload, fromCloud, toCloud } = mergeCloudLocal(cloudTools, localTools)

    // Write merged tools to IndexedDB
    for (const tool of merged) {
      await db.put(TOOLS_STORE, tool)
    }

    // Upload local-only and newer tools to cloud
    for (const tool of toUpload) {
      saveToolToFirestore(tool).catch(err => console.error('Cloud sync failed:', err))
    }

    console.log(`Tools sync: ${fromCloud} from cloud, ${toCloud} to cloud`)
    return { fromCloud, toCloud }
  } catch (error) {
    console.error('Failed to sync tools:', error)
    return { fromCloud: 0, toCloud: 0 }
  }
}

// ============ Book Storage ============

/**
 * Save a book to IndexedDB (upsert by id)
 * Preserves existing fileData if not present in the update
 */
export const saveBookToIDB = async (book) => {
  const db = await getDB()
  // If this update doesn't include fileData, preserve existing fileData
  if (!book.fileData) {
    const existing = await db.get(BOOKS_STORE, book.id)
    if (existing?.fileData) {
      book.fileData = existing.fileData
      book.fileCachedAt = existing.fileCachedAt
    }
  }
  await db.put(BOOKS_STORE, book)
}

/**
 * Load all books from IndexedDB
 */
export const loadBooksFromIDB = async () => {
  const db = await getDB()
  const all = await db.getAll(BOOKS_STORE)
  return all.filter(b => !b.deletedAt)
}

/**
 * Get a single book by ID from IndexedDB
 */
export const getBookFromIDB = async (id) => {
  const db = await getDB()
  return await db.get(BOOKS_STORE, id)
}

/**
 * Delete a book from IndexedDB
 */
export const deleteBookFromIDB = async (id) => {
  const db = await getDB()
  await db.delete(BOOKS_STORE, id)
}

/**
 * Get book file data (ArrayBuffer) from IndexedDB
 * The file data is stored alongside the book metadata
 */
export const getBookFileFromIDB = async (id) => {
  const db = await getDB()
  const book = await db.get(BOOKS_STORE, id)
  if (!book || !book.fileData) {
    return null
  }

  const fileData = book.fileData

  // Handle cases where IndexedDB returns Uint8Array instead of ArrayBuffer
  let result = fileData
  if (fileData instanceof Uint8Array) {
    result = fileData.buffer.slice(fileData.byteOffset, fileData.byteOffset + fileData.byteLength)
  } else if (!(fileData instanceof ArrayBuffer) && fileData?.buffer instanceof ArrayBuffer) {
    result = fileData.buffer
  }

  return result
}

/**
 * Save book file data to IndexedDB
 */
export const saveBookFileToIDB = async (id, fileData) => {
  const db = await getDB()
  const book = await db.get(BOOKS_STORE, id)
  if (book) {
    book.fileData = fileData
    book.fileCachedAt = Date.now()
    await db.put(BOOKS_STORE, book)
  } else {
    throw new Error(`Book ${id} not found in IndexedDB - cannot cache file data. Was the book record saved first?`)
  }
}

/**
 * Delete all book file data (cached EPUB files) from IndexedDB
 * This removes the fileData property from all books while keeping the book metadata
 */
export const deleteAllBookFilesFromIDB = async () => {
  const db = await getDB()
  const books = await db.getAll(BOOKS_STORE)

  let deletedCount = 0
  let totalSize = 0

  for (const book of books) {
    if (book.fileData) {
      // Calculate size before deleting
      const size = book.fileData.byteLength || 0
      totalSize += size

      // Remove file data and cache timestamp
      delete book.fileData
      delete book.fileCachedAt

      // Update the book record
      await db.put(BOOKS_STORE, book)
      deletedCount++
    }
  }

  return { deletedCount, totalSize }
}

// ============ Tool Instance Storage ============

/**
 * Save tool instance state to IndexedDB
 * @param {string} sessionId - The session identifier
 * @param {string} toolId - The tool identifier
 * @param {Object} state - The state object to store
 * @returns {Promise<void>}
 */
export const saveToolInstanceState = async (sessionId, toolId, state) => {
  try {
    // Sanitize state to convert Proxy objects to plain objects
    // IndexedDB uses structured clone which can't clone Proxies
    const sanitizedState = sanitizeForIndexedDB(state)

    const db = await getDB()
    const key = `${sessionId}-${toolId}`
    await db.put(TOOL_INSTANCES_STORE, sanitizedState, key)
  } catch (error) {
    console.error('Failed to save tool instance state to IndexedDB:', error)
    throw error
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

/**
 * Load tool instance state from IndexedDB
 * @param {string} sessionId - The session identifier
 * @param {string} toolId - The tool identifier
 * @returns {Promise<Object|null>} The state object or null if not found
 */
export const loadToolInstanceState = async (sessionId, toolId) => {
  try {
    const db = await getDB()
    const key = `${sessionId}-${toolId}`
    const state = await db.get(TOOL_INSTANCES_STORE, key)
    return state || {}
  } catch (error) {
    console.error('Failed to load tool instance state from IndexedDB:', error)
    return {}
  }
}

/**
 * Delete tool instance state from IndexedDB
 * @param {string} sessionId - The session identifier
 * @param {string} toolId - The tool identifier
 * @returns {Promise<void>}
 */
export const deleteToolInstanceState = async (sessionId, toolId) => {
  try {
    const db = await getDB()
    const key = `${sessionId}-${toolId}`
    await db.delete(TOOL_INSTANCES_STORE, key)
  } catch (error) {
    console.error('Failed to delete tool instance state from IndexedDB:', error)
    throw error
  }
}

/**
 * Get all tool instance keys from IndexedDB
 * @returns {Promise<string[]>} Array of keys
 */
export const getAllToolInstanceKeys = async () => {
  try {
    const db = await getDB()
    const keys = await db.getAllKeys(TOOL_INSTANCES_STORE)
    return keys
  } catch (error) {
    console.error('Failed to get tool instance keys from IndexedDB:', error)
    return []
  }
}

/**
 * Migrate tool instance data from localStorage to IndexedDB
 * @returns {Promise<number>} Number of entries migrated
 */
export const migrateToolInstancesFromLocalStorage = async () => {
  const STORAGE_PREFIX = 'tool-instance-'

  try {
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
    return migratedCount
  } catch (error) {
    console.error('Failed to migrate tool instances from localStorage:', error)
    return 0
  }
}
