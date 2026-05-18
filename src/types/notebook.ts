/** A single chat/notebook session */
export interface Notebook {
  id: string
  name: string
  rootMessageIds: string[]
  scratchpad?: string
  messageCount?: number
  lastAccessedAt?: number
}

/** Computed list item for the notebooks home page */
export interface NotebookListItem {
  id: string
  title: string
  messageCount: number
  questions: Array<{
    id: string
    text: string
    chatId: string
    rootIndex: number
  }>
}

/** Persisted notebook list data (IndexedDB + Firestore) */
export interface NotebookListData {
  chats: Notebook[]
  currentChatId: string | null
  currentModel: string | null
  vocabData: Record<string, unknown>
  lastSyncedAt: number | null
  hasConflict?: boolean
  localChatCount?: number
  cloudChatCount?: number
  localChats?: Notebook[]
  cloudChats?: Notebook[]
}

/** Persisted notebook messages data */
export interface NotebookMessagesData {
  messagesById: Record<string, unknown>
  lastSyncedAt: number | null
  fromCache?: boolean
}
