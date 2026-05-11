import { defineStore } from 'pinia'
import { saveChatList, saveChatMessages } from '@/services/sync/IndexedDBService'
import { useMessageTreeStore } from './messageTree'
import { useNotebookStore } from './notebook'
import { useVocabStore } from './vocab'
import { debugLog } from '@/utils/debug'
import type { SyncStatus } from '@/types/sync'

let _firestoreSyncTimer: ReturnType<typeof setTimeout> | null = null
const FIRESTORE_SYNC_DEBOUNCE_MS = 3000

export const useSyncStore = defineStore('sync', {
  state: () => ({
    isSyncing: false,
    syncStatus: null as SyncStatus | null,
    syncMessage: '',
    _isLoadingFromStorage: false,
  }),

  actions: {
    /** Save chat list to IndexedDB */
    async persistChatList(): Promise<void> {
      if (this._isLoadingFromStorage) return

      try {
        const notebookStore = useNotebookStore()
        const vocabStore = useVocabStore()

        await saveChatList({
          chats: notebookStore.chats,
          currentChatId: notebookStore.currentChatId,
          currentModel: notebookStore.currentModel,
          vocabData: vocabStore.vocabData,
          vocabScratchpad: vocabStore.scratchpad,
          lastSyncedAt: notebookStore.lastSyncedAt ?? Date.now(),
        })
      } catch (error) {
        console.error('[Sync] Failed to persist chat list:', error)
      }
    },

    /** Save current chat messages to IndexedDB */
    async persistChatMessages(): Promise<void> {
      if (this._isLoadingFromStorage) return

      try {
        const notebookStore = useNotebookStore()
        const treeStore = useMessageTreeStore()

        if (notebookStore.currentChatId && Object.keys(treeStore.messagesById).length > 0) {
          await saveChatMessages(notebookStore.currentChatId, {
            messagesById: treeStore.messagesById,
            lastSyncedAt: notebookStore.lastSyncedAt ?? Date.now(),
          })
        }
      } catch (error) {
        console.error('[Sync] Failed to persist messages:', error)
      }
    },

    /** Full persist (list + messages) */
    async persistAll(): Promise<void> {
      await Promise.all([this.persistChatList(), this.persistChatMessages()])
    },

    /** Sync changes to Firestore */
    async syncToFirestore(
      mutation: { events?: { key?: string } },
      _state: Record<string, unknown>
    ): Promise<void> {
      const treeStore = useMessageTreeStore()
      const notebookStore = useNotebookStore()
      const vocabStore = useVocabStore()

      if (treeStore.messagesById === undefined || !navigator.onLine) return

      try {
        const changedMessageIds = new Set<string>()
        const deletedMessageIds = new Set<string>()

        const { syncChatStateWithSubcollections } = await import('@/services/firestore/firestore-chat')
        await syncChatStateWithSubcollections(
          {
            messagesById: treeStore.messagesById,
            rootMessageIds: treeStore.rootMessageIds,
            chats: notebookStore.chats,
            currentChatId: notebookStore.currentChatId,
            currentModel: notebookStore.currentModel,
            vocabData: vocabStore.vocabData,
            vocabScratchpad: vocabStore.scratchpad,
          },
          changedMessageIds.size > 0 ? changedMessageIds : null,
          deletedMessageIds.size > 0 ? deletedMessageIds : null,
        )

        notebookStore.lastSyncedAt = Date.now()
      } catch (error) {
        console.error('[Sync] Firestore sync failed:', error)
      }
    },

    /** Handle a Pinia subscription mutation */
    async handleMutation(
      mutation: { events?: { key?: string } },
      _state: Record<string, unknown>
    ): Promise<void> {
      if (this._isLoadingFromStorage) return

      try {
        const changedKey = mutation.events?.key

        if (changedKey === 'chats' || changedKey === 'currentChatId' ||
            changedKey === 'currentModel' || changedKey === 'vocabData' ||
            changedKey === 'scratchpad') {
          await this.persistChatList()
        }

        if (changedKey === 'messagesById' || changedKey === 'rootMessageIds') {
          await this.persistChatMessages()
        }

        await this.syncToFirestore(mutation, _state)
      } catch (error) {
        console.error('[Sync] Persistence failed:', error)
      }
    },

    /** Set loading-from-storage flag (prevents save loops during init) */
    setLoadingFromStorage(loading: boolean): void {
      this._isLoadingFromStorage = loading
    },

    scheduleFirestoreSync(): void {
      if (!navigator.onLine) return
      if (_firestoreSyncTimer) clearTimeout(_firestoreSyncTimer)
      _firestoreSyncTimer = setTimeout(async () => {
        try {
          await this.syncToFirestore({ events: {} }, {})
        } catch (error) {
          console.error('[Sync] Debounced Firestore sync failed:', error)
        }
      }, FIRESTORE_SYNC_DEBOUNCE_MS)
    },

    clearSyncStatus(): void {
      this.syncStatus = null
      this.syncMessage = ''
    },
  },
})
