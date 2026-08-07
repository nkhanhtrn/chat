import { openDB, type IDBPDatabase } from 'idb'
import { debugLog } from '@/utils/debug'

const DB_NAME = 'chat-clone-db'
const DB_VERSION = 17

const STORE_NAME = 'app-data'
const TOOLS_STORE = 'saved-tools'
const BOOKS_STORE = 'books'
const BOOK_FILES_STORE = 'book-files'
const STROKES_STORE = 'strokes'
const HIGHLIGHTS_STORE = 'highlights'
const TOOL_INSTANCES_STORE = 'tool-instances'
const SESSION_CANVAS_STORE = 'session-canvas'
const SESSION_TOOLS_STORE = 'session-tools'
const CHAT_LIST_STORE = 'chat-list'
const CHAT_MESSAGES_PREFIX = 'chat-messages-'
const STUDIO_SESSIONS_STORE = 'studio-sessions'
export const SKETCHBOOKS_STORE = 'sketchbooks'

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

      if (oldVersion < 12) {
        if (!db.objectStoreNames.contains(STROKES_STORE)) {
          const strokesStore = db.createObjectStore(STROKES_STORE, { keyPath: 'id' })
          strokesStore.createIndex('bookId', 'bookId', { unique: false })
        }
      }

      // Always ensure these stores exist regardless of version
      if (!db.objectStoreNames.contains(SKETCHBOOKS_STORE)) {
        const sketchbooksStore = db.createObjectStore(SKETCHBOOKS_STORE, { keyPath: 'id' })
        sketchbooksStore.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(BOOK_FILES_STORE)) {
        db.createObjectStore(BOOK_FILES_STORE)
      }
      if (!db.objectStoreNames.contains(HIGHLIGHTS_STORE)) {
        const highlightsStore = db.createObjectStore(HIGHLIGHTS_STORE, { keyPath: 'id' })
        highlightsStore.createIndex('bookId', 'bookId', { unique: false })
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

export async function syncChatList(): Promise<Record<string, unknown>> {
  try {
    const db = await getDB()
    const storeNames = db.objectStoreNames
    const hasChatListStore = storeNames?.contains ? storeNames.contains(CHAT_LIST_STORE) : false

    let localData: Record<string, unknown> | null = null
    if (hasChatListStore) {
      localData = await db.get(CHAT_LIST_STORE, LIST_KEY)
    }

    if (!localData) {
      const oldData = await db.get(APP_DATA_STORE, 'chat-state')
      if (oldData) {
        const od = oldData as Record<string, unknown>
        localData = {
          chats: od.chats ?? [],
          currentChatId: od.currentChatId ?? null,
          currentModel: od.currentModel ?? null,
          vocabData: od.vocabData ?? {},
          vocabScratchpad: od.vocabScratchpad ?? '',
          lastSyncedAt: od.lastSyncedAt ?? Date.now()
        }
        if (hasChatListStore) {
          await db.put(CHAT_LIST_STORE, localData, LIST_KEY)
          await db.delete(APP_DATA_STORE, 'chat-state')
        }
      }
      delete (window as any).__indexedDBNeedsMigration
    }

    const localChats = (localData?.chats ?? []) as unknown[]
    const localChatCount = localChats.length

    let cloudData: Record<string, unknown> | null = null
    let cloudChatCount = 0
    let hasConflict = false

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { loadChatMetadata } = await import('@/services/firestore/firestore-chat')
        cloudData = (await loadChatMetadata()) as Record<string, unknown> | null
        cloudChatCount = (cloudData?.chats as unknown[])?.length ?? 0
      } catch (error) {
        console.error('[LightSync] Failed to load from Firestore:', error)
      }
    }

    if (localChatCount > cloudChatCount) {
      hasConflict = true
      return {
        chats: localChats,
        currentChatId: localData?.currentChatId ?? null,
        currentModel: localData?.currentModel ?? null,
        vocabData: localData?.vocabData ?? {},
        vocabScratchpad: localData?.vocabScratchpad ?? '',
        lastSyncedAt: localData?.lastSyncedAt ?? null,
        hasConflict,
        localChatCount,
        cloudChatCount,
        localChats,
        cloudChats: (cloudData?.chats ?? []) as unknown[]
      }
    }

    if (cloudData) {
      const localScratchpad = (localData?.vocabScratchpad as string) ?? ''
      const cloudScratchpad = (cloudData.vocabScratchpad as string) ?? ''
      const result = {
        chats: cloudData.chats ?? [],
        currentChatId: cloudData.currentChatId ?? null,
        currentModel: cloudData.currentModel ?? null,
        vocabData: cloudData.vocabData ?? {},
        vocabScratchpad: cloudScratchpad.length >= localScratchpad.length ? cloudScratchpad : localScratchpad,
        lastSyncedAt: cloudData.lastUpdated ?? Date.now(),
        hasConflict: false
      }
      if (hasChatListStore) await saveChatList(result)
      return result
    }

    return {
      chats: localChats,
      currentChatId: localData?.currentChatId ?? null,
      currentModel: localData?.currentModel ?? null,
      vocabData: localData?.vocabData ?? {},
      vocabScratchpad: localData?.vocabScratchpad ?? '',
      lastSyncedAt: localData?.lastSyncedAt ?? null,
      hasConflict: false
    }
  } catch (error) {
    console.error('[LightSync] syncChatList Error:', error)
    throw error
  }
}

export async function syncChatMessages(chatId: string): Promise<Record<string, unknown>> {
  try {
    const messagesKey = getChatMessagesKey(chatId)
    const db = await getDB()
    const localData = await db.get(APP_DATA_STORE, messagesKey) as Record<string, unknown> | null
    const localMessages = (localData?.messagesById ?? {}) as Record<string, unknown>

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { loadMessagesForChat } = await import('@/services/firestore/firestore-chat')
        const cloudMessages = (await loadMessagesForChat(chatId)) as Record<string, unknown>
        const cloudMessageCount = Object.keys(cloudMessages).length

        let result: Record<string, unknown>
        if (cloudMessageCount === 0 && Object.keys(localMessages).length > 0) {
          result = { messagesById: localMessages, lastSyncedAt: localData?.lastSyncedAt, fromCache: true }
        } else {
          result = { messagesById: cloudMessages, lastSyncedAt: Date.now(), fromCache: false }
        }

        await saveChatMessages(chatId, result)
        return result
      } catch (error) {
        console.error('[LightSync] Failed to load from Firestore:', error)
      }
    }

    return { messagesById: localMessages, fromCache: true }
  } catch (error) {
    console.error('[LightSync] syncChatMessages Error:', error)
    throw error
  }
}

export async function resolveChatListConflict(
  choice: string,
  conflictData: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { localChats, cloudChats, currentChatId, currentModel, vocabData } = conflictData as Record<string, unknown>

  if (choice === 'local') {
    const result = {
      chats: localChats,
      currentChatId, currentModel, vocabData,
      lastSyncedAt: Date.now(),
      hasConflict: false
    }
    await saveChatList(result)

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      try {
        const { syncChatStateWithSubcollections } = await import('@/services/firestore/firestore-chat')
        await syncChatStateWithSubcollections({
          chats: localChats, currentChatId, currentModel, vocabData,
          rootMessageIds: [], messagesById: {}
        }, null, null)
      } catch (error) {
        console.error('[LightSync] resolveChatListConflict: Failed to sync to Firestore', error)
      }
    }
    return result
  }

  const result = {
    chats: cloudChats,
    currentChatId, currentModel,
    vocabData: vocabData ?? {},
    lastSyncedAt: Date.now(),
    hasConflict: false
  }
  await saveChatList(result)
  return result
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    dbInstance?.close()
    dbInstance = null
  })
}
