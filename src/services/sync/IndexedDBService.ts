import { openDB, type IDBPDatabase } from 'idb'
import { debugLog } from '@/utils/debug'

const DB_NAME = 'chat-clone-db'
const DB_VERSION = 11

const STORE_NAME = 'app-data'
const TOOLS_STORE = 'saved-tools'
const BOOKS_STORE = 'books'
const BOOK_FILES_STORE = 'book-files'
const TOOL_INSTANCES_STORE = 'tool-instances'
const SESSION_CANVAS_STORE = 'session-canvas'
const SESSION_TOOLS_STORE = 'session-tools'
const CHAT_LIST_STORE = 'chat-list'
const CHAT_MESSAGES_PREFIX = 'chat-messages-'
const STUDIO_SESSIONS_STORE = 'studio-sessions'

let dbInstance: IDBPDatabase | null = null

export async function getDB(): Promise<IDBPDatabase> {
  if (dbInstance) return dbInstance

  dbInstance = await openDB(DB_NAME, DB_VERSION, {
    upgrade(db, oldVersion, _newVersion) {
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
      }
      if (!db.objectStoreNames.contains(TOOL_INSTANCES_STORE)) {
        db.createObjectStore(TOOL_INSTANCES_STORE)
      }
      if (!db.objectStoreNames.contains(SESSION_CANVAS_STORE)) {
        db.createObjectStore(SESSION_CANVAS_STORE)
      }
      if (!db.objectStoreNames.contains(SESSION_TOOLS_STORE)) {
        db.createObjectStore(SESSION_TOOLS_STORE)
      }

      if (oldVersion < 6) {
        if (!db.objectStoreNames.contains(CHAT_LIST_STORE)) {
          db.createObjectStore(CHAT_LIST_STORE)
        }
        ;(window as any).__indexedDBNeedsMigration = true
      }

      if (oldVersion < 7) {
        if (!db.objectStoreNames.contains(STUDIO_SESSIONS_STORE)) {
          db.createObjectStore(STUDIO_SESSIONS_STORE)
        }
      }

      if (oldVersion < 8) {
        if (!db.objectStoreNames.contains(STUDIO_SESSIONS_STORE)) {
          db.createObjectStore(STUDIO_SESSIONS_STORE)
        }
      }

      // Always ensure these stores exist regardless of version
      if (!db.objectStoreNames.contains(BOOK_FILES_STORE)) {
        db.createObjectStore(BOOK_FILES_STORE)
      }
    },
    blocked() {
      console.error('IndexedDB upgrade blocked - close all tabs and refresh')
    },
    blocking() {
      console.error('IndexedDB upgrade blocking - please close other tabs')
    }
  })

  return dbInstance
}

export function isIndexedDBAvailable(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null
  } catch {
    return false
  }
}

export const deleteDatabase = (): Promise<void> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

// ============ LightSync Operations ============

const APP_DATA_STORE = 'app-data'
const LIST_KEY = 'list'

function getChatMessagesKey(chatId: string): string {
  return `${CHAT_MESSAGES_PREFIX}${chatId}`
}

export async function saveChatList(listData: Record<string, unknown>): Promise<void> {
  try {
    const db = await getDB()

    const serializedVocabData: Record<string, unknown> = {}
    for (const [id, card] of Object.entries((listData.vocabData as Record<string, unknown>) ?? {})) {
      serializedVocabData[id] = JSON.parse(JSON.stringify(card))
    }
    const serializedChats = JSON.parse(JSON.stringify(listData.chats ?? []))

    const dataToSave = {
      chats: serializedChats,
      currentChatId: listData.currentChatId ?? null,
      currentModel: listData.currentModel ?? null,
      vocabData: serializedVocabData,
      vocabScratchpad: listData.vocabScratchpad ?? '',
      lastSyncedAt: listData.lastSyncedAt ?? Date.now()
    }

    if (!db.objectStoreNames?.contains(CHAT_LIST_STORE)) return
    await db.put(CHAT_LIST_STORE, dataToSave, LIST_KEY)
  } catch (error) {
    console.error('[LightSync] saveChatList Error:', error)
    throw error
  }
}

export async function saveChatMessages(chatId: string, messagesData: Record<string, unknown>): Promise<void> {
  try {
    const db = await getDB()
    const messagesKey = getChatMessagesKey(chatId)

    const serializedMessages: Record<string, unknown> = {}
    for (const [id, msg] of Object.entries((messagesData.messagesById as Record<string, unknown>) ?? {})) {
      serializedMessages[id] = JSON.parse(JSON.stringify(msg))
    }

    const dataToSave = {
      messagesById: serializedMessages,
      lastSyncedAt: messagesData.lastSyncedAt ?? Date.now()
    }

    await db.put(APP_DATA_STORE, dataToSave, messagesKey)
  } catch (error) {
    console.error('[LightSync] saveChatMessages Error:', error)
    throw error
  }
}

export async function getLocalChatList(): Promise<Record<string, unknown> | null> {
  try {
    const db = await getDB()
    const data = await db.get(CHAT_LIST_STORE, LIST_KEY)
    return data ?? null
  } catch (error) {
    console.error('[LightSync] getLocalChatList Error:', error)
    return null
  }
}

export async function getLocalChatMessages(chatId: string): Promise<Record<string, unknown> | null> {
  try {
    const db = await getDB()
    const messagesKey = getChatMessagesKey(chatId)
    const data = await db.get(APP_DATA_STORE, messagesKey)
    return data ?? null
  } catch (error) {
    console.error('[LightSync] getLocalChatMessages Error:', error)
    return null
  }
}

export async function clearAllChatData(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(CHAT_LIST_STORE, LIST_KEY)

    const tx = db.transaction(APP_DATA_STORE, 'readwrite')
    const store = tx.objectStore(APP_DATA_STORE)
    const keys = await store.getAllKeys()
    for (const key of keys) {
      if (typeof key === 'string' && key.startsWith('chat-messages-')) {
        await store.delete(key)
      }
    }
  } catch (error) {
    console.error('[LightSync] clearAllChatData Error:', error)
    throw error
  }
}

export async function deleteChatMessages(chatId: string): Promise<void> {
  try {
    const db = await getDB()
    const messagesKey = getChatMessagesKey(chatId)
    await db.delete(APP_DATA_STORE, messagesKey)
  } catch (error) {
    console.error('[LightSync] deleteChatMessages Error:', error)
    throw error
  }
}
