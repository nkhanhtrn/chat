// IndexedDB service for low-level database operations
// Stores: tools, books, tool instances, and session data
import { debugLog } from '../utils/debug.js'
import { openDB } from 'idb'

const DB_NAME = 'chat-clone-db'
const DB_VERSION = 5
const STORE_NAME = 'app-data'
const TOOLS_STORE = 'saved-tools'
const BOOKS_STORE = 'books'
const TOOL_INSTANCES_STORE = 'tool-instances'
const SESSION_CANVAS_STORE = 'session-canvas'  // Canvas state (windows) per session
const SESSION_TOOLS_STORE = 'session-tools'    // Tools (with code) per session

let currentDbVersion = 2

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
export const getDB = () => {
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
      if (!db.objectStoreNames.contains(SESSION_CANVAS_STORE)) {
        db.createObjectStore(SESSION_CANVAS_STORE)
        console.log('Created session-canvas store in IndexedDB')
      }
      if (!db.objectStoreNames.contains(SESSION_TOOLS_STORE)) {
        db.createObjectStore(SESSION_TOOLS_STORE)
        console.log('Created session-tools store in IndexedDB')
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

// ============ Tool Storage (IndexedDB only) ============

/**
 * Save a tool to IndexedDB (always session-scoped)
 */
export const saveTool = async (tool, sessionId) => {
  if (!sessionId) {
    throw new Error('sessionId is required for saving tools')
  }

  const db = await getDB()

  // Look up by name within this session
  const existing = await getToolByNameInSession(tool.name, sessionId)

  const record = {
    id: existing?.id || crypto.randomUUID(),
    sessionId,
    name: tool.name,
    emoji: tool.emoji || null,
    type: tool.type,
    code: tool.code,
    sourcePrompt: tool.sourcePrompt || null,
    createdAt: existing?.createdAt || Date.now(),
    updatedAt: Date.now()
  }

  await db.put(TOOLS_STORE, record)
  return record
}

/**
 * Get a tool by name (session-scoped)
 */
export const getToolByNameInSession = async (name, sessionId) => {
  if (!sessionId) return null
  const db = await getDB()
  const index = db.transaction(TOOLS_STORE).store.index('name')
  const allMatching = await index.getAll(name)
  // Find the one matching our session
  return allMatching.find(t => t.sessionId === sessionId) || null
}

/**
 * Get all tools for a specific session
 */
export const getSessionTools = async (sessionId) => {
  if (!sessionId) return []
  const db = await getDB()
  const all = await db.getAll(TOOLS_STORE)
  return all.filter(t => t.sessionId === sessionId && !t.deletedAt)
}

/**
 * Search for existing tools by query string (session-scoped)
 * Searches tool name and sourcePrompt for matches
 * @param {string} query - Search query
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object|null>} Best matching tool or null
 */
export const searchToolByQuery = async (query, sessionId) => {
  if (!sessionId) return null
  const tools = await getSessionToolxs(sessionId)
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
 * Get all saved tools from IndexedDB (excludes deleted)
 */
export const getDeletedTools = async (sessionId) => {
  if (!sessionId) return []
  const db = await getDB()
  const all = await db.getAll(TOOLS_STORE)
  return all.filter(t => t.deletedAt && t.sessionId === sessionId).sort((a, b) => b.deletedAt - a.deletedAt)
}

/**
 * Soft delete a tool (move to recycle bin)
 */
export const deleteTool = async (id) => {
  const db = await getDB()
  const tool = await db.get(TOOLS_STORE, id)
  if (tool) {
    tool.deletedAt = Date.now()
    await db.put(TOOLS_STORE, tool)
  }
}

/**
 * Restore a tool from recycle bin
 */
export const restoreTool = async (id) => {
  const db = await getDB()
  const tool = await db.get(TOOLS_STORE, id)
  if (tool) {
    delete tool.deletedAt
    await db.put(TOOLS_STORE, tool)
  }
}

/**
 * Permanently delete a tool
 */
export const permanentlyDeleteTool = async (id) => {
  const db = await getDB()
  await db.delete(TOOLS_STORE, id)
}

/**
 * Empty the recycle bin
 */
export const emptyRecycleBin = async (sessionId) => {
  const db = await getDB()
  const deleted = await getDeletedTools(sessionId)
  for (const tool of deleted) {
    await db.delete(TOOLS_STORE, tool.id)
  }
}
