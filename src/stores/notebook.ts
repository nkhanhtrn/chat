import { defineStore } from 'pinia'
import { useMessageTreeStore } from './messageTree'
import { useVocabStore } from './vocab'
import type { Notebook, NotebookListItem } from '@/types/notebook'
import { Message } from '@/models/Message'
import { debugLog } from '@/utils/debug'
import { saveChatList, saveChatMessages, getLocalChatList, getLocalChatMessages } from '@/services/sync/IndexedDBService'
import {
  saveChatMetadataToCloud,
  loadChatMetadataFromCloud,
  saveChatMessagesToCloud,
  loadChatMessagesFromCloud,
  deleteChatMessagesFromCloud,
} from '@/services/firestore/firestore-chat'
import { getCurrentUser } from '@/services/auth'

let chatListSyncTimer: ReturnType<typeof setTimeout> | null = null
let isApplyingCloud = false
const loadedCloudChatIds = new Set<string>()
let syncInitialized = false

const CHAT_LIST_DEBOUNCE_MS = 100

export const useNotebookStore = defineStore('notebook', {
  state: () => ({
    chats: [] as Notebook[],
    currentChatId: null as string | null,
    currentModel: null as string | null,
    isInitialized: false,
    isLoadingChatMessages: false,
    _chatLastLoadedAt: {} as Record<string, number>,
    lastViewedContentType: null as string | null,
    lastViewedContentId: null as string | null,
    lastSyncedAt: null as number | null,
  }),

  getters: {
    chatList(state): NotebookListItem[] {
      const treeStore = useMessageTreeStore()
      return state.chats.map(chat => {
        const questions = chat.rootMessageIds
          .map(id => treeStore.messagesById[id])
          .filter((m): m is Message => m != null)
          .map(msg => ({
            id: msg.id,
            text: msg.questionSummarized || msg.question || 'Untitled',
            chatId: chat.id,
            rootIndex: chat.rootMessageIds.indexOf(msg.id),
          }))

        return {
          id: chat.id,
          title: chat.name || 'New Subject',
          messageCount: chat.rootMessageIds.length,
          questions,
        }
      })
    },

    currentChat(state): Notebook | null {
      return state.chats.find(c => c.id === state.currentChatId) ?? null
    },

    currentScratchpad(state): string {
      const chat = state.chats.find(c => c.id === state.currentChatId)
      return chat?.scratchpad ?? ''
    },

    getTotalMessageCount(state) {
      return (chatId: string): number => {
        const treeStore = useMessageTreeStore()
        const chat = state.chats.find(c => c.id === chatId)
        if (!chat) return 0

        const countWithChildren = (messageId: string): number => {
          const m = treeStore.messagesById[messageId]
          if (!m) return 1
          let count = 1
          if (m.childIds?.length) {
            for (const childId of m.childIds) count += countWithChildren(childId)
          }
          return count
        }

        let total = 0
        for (const rootId of chat.rootMessageIds) total += countWithChildren(rootId)
        return total
      }
    },
  },

  actions: {
    // ── Initialization ────────────────────────────────────────

    async initializeStore(): Promise<{ hasConflict: boolean }> {
      if (this.isInitialized) return { hasConflict: false }

      try {
        debugLog('[NotebookStore] Initializing store')

        let localData = await getLocalChatList()

        if (!localData) {
          const { getDB } = await import('@/services/sync/IndexedDBService')
          const db = await getDB()
          const oldData = await db.get('app-data', 'chat-state') as Record<string, unknown> | null
          if (oldData) {
            localData = {
              chats: oldData.chats ?? [],
              currentChatId: oldData.currentChatId ?? null,
              currentModel: oldData.currentModel ?? null,
              vocabData: oldData.vocabData ?? {},
              vocabScratchpad: oldData.vocabScratchpad ?? '',
              lastSyncedAt: oldData.lastSyncedAt ?? Date.now(),
            }
            await saveChatList(localData)
            await db.delete('app-data', 'chat-state')
          }
        }

        if (localData) {
          this.chats = (localData.chats as Notebook[]) ?? []
          this.currentChatId = (localData.currentChatId as string) ?? null
          this.currentModel = (localData.currentModel as string) ?? null
          this.lastSyncedAt = (localData.lastSyncedAt as number) ?? null

          const vd = localData.vocabData as Record<string, unknown> | undefined
          if (vd && typeof vd === 'object' && Object.keys(vd).length > 0) {
            const vocabStore = useVocabStore()
            vocabStore._loadFromData(vd)
          }
          const vs = localData.vocabScratchpad as string | undefined
          if (vs !== undefined) {
            const vocabStore = useVocabStore()
            vocabStore.updateScratchpad(vs)
          }
        }

        this.isInitialized = true
        debugLog(`[NotebookStore] Initialized: ${this.chats.length} notebooks`)
        return { hasConflict: false }
      } catch (error) {
        console.error('[NotebookStore] Failed to initialize:', error)
        this.isInitialized = true
        return { hasConflict: false }
      }
    },

    // ── Cloud sync: mark & flush (studio pattern) ───────────

    markChatList(): void {
      if (isApplyingCloud) return

      const treeStore = useMessageTreeStore()
      const vocabStore = useVocabStore()
      saveChatList({
        chats: this.chats,
        currentChatId: this.currentChatId,
        currentModel: this.currentModel,
        vocabData: vocabStore.vocabData,
        vocabScratchpad: vocabStore.scratchpad,
        lastSyncedAt: this.lastSyncedAt ?? Date.now(),
      }).catch(err => console.error('[NotebookSync] Local save failed:', err))

      if (chatListSyncTimer) clearTimeout(chatListSyncTimer)
      chatListSyncTimer = setTimeout(async () => {
        const user = getCurrentUser()
        if (!user || !navigator.onLine) return
        try {
          await saveChatMetadataToCloud({
            chats: this.chats,
            currentChatId: this.currentChatId,
            currentModel: this.currentModel,
            vocabData: vocabStore.vocabData,
            vocabScratchpad: vocabStore.scratchpad,
          })
          this.lastSyncedAt = Date.now()
        } catch (err) {
          console.error('[NotebookSync] Cloud save failed:', err)
        }
      }, CHAT_LIST_DEBOUNCE_MS)
    },

    syncMessagesNow(chatId: string): void {
      const user = getCurrentUser()
      if (!user || !navigator.onLine) return

      const treeStore = useMessageTreeStore()
      if (!chatId || Object.keys(treeStore.messagesById).length === 0) return

      saveChatMessages(chatId, {
        messagesById: treeStore.messagesById,
        lastSyncedAt: Date.now(),
      }).catch(err => console.error('[NotebookSync] Local messages save failed:', err))

      saveChatMessagesToCloud(chatId, treeStore.messagesById).catch(err =>
        console.error('[NotebookSync] Cloud messages save failed:', err)
      )
    },

    // ── Cloud sync: pull ──

    async pullChatListFromCloud(): Promise<void> {
      const user = getCurrentUser()
      if (!user || !navigator.onLine) return

      const cloud = await loadChatMetadataFromCloud()
      if (!cloud) return

      isApplyingCloud = true
      try {
        const localById = new Map(this.chats.map(c => [c.id, c]))
        const result: Notebook[] = []

        for (const cloudChat of cloud.chats) {
          const local = localById.get(cloudChat.id)
          localById.delete(cloudChat.id)
          if (!local) {
            result.push(cloudChat)
          } else {
            result.push(local)
          }
        }
        for (const local of localById.values()) {
          result.push(local)
        }

        this.chats.splice(0, this.chats.length, ...result)
        this.lastSyncedAt = cloud.lastUpdated

        const vocabStore = useVocabStore()
        if (cloud.vocabData && Object.keys(cloud.vocabData).length > 0) {
          vocabStore._loadFromData(cloud.vocabData as Record<string, unknown>)
        }
        if (cloud.vocabScratchpad) {
          vocabStore.updateScratchpad(cloud.vocabScratchpad)
        }
      } finally {
        isApplyingCloud = false
      }
    },

    async pullChatMessagesFromCloud(chatId: string): Promise<void> {
      const user = getCurrentUser()
      if (!user || !navigator.onLine) return
      if (loadedCloudChatIds.has(chatId)) return
      loadedCloudChatIds.add(chatId)

      const cloudMessages = await loadChatMessagesFromCloud(chatId)
      if (Object.keys(cloudMessages).length === 0) return

      isApplyingCloud = true
      try {
        const treeStore = useMessageTreeStore()
        treeStore.loadMessages(cloudMessages as Record<string, import('@/types/message').MessageData>)

        const chat = this.chats.find(c => c.id === chatId)
        if (chat) treeStore.setRootMessageIds([...chat.rootMessageIds])

        await saveChatMessages(chatId, {
          messagesById: cloudMessages,
          lastSyncedAt: Date.now(),
        })
      } finally {
        isApplyingCloud = false
      }
    },

    handleOnline(): void {
      const user = getCurrentUser()
      if (!user) return

      this.pullChatListFromCloud().catch(err =>
        console.error('[NotebookSync] Online pull failed:', err)
      )
      if (this.currentChatId) {
        loadedCloudChatIds.delete(this.currentChatId)
        this.pullChatMessagesFromCloud(this.currentChatId).catch(err =>
          console.error('[NotebookSync] Online messages pull failed:', err)
        )
      }
    },

    initSync(): void {
      if (syncInitialized) return
      syncInitialized = true

      this.pullChatListFromCloud().catch(err =>
        console.error('[NotebookSync] Initial pull failed:', err)
      )

      window.addEventListener('online', () => this.handleOnline())

      if (import.meta.hot) {
        import.meta.hot?.dispose(() => {
          if (chatListSyncTimer) clearTimeout(chatListSyncTimer)
          syncInitialized = false
          loadedCloudChatIds.clear()
        })
      }
    },

    // ── Local persist (for SettingsModal restore) ──

    async persistAll(): Promise<void> {
      const vocabStore = useVocabStore()
      const treeStore = useMessageTreeStore()

      await Promise.all([
        saveChatList({
          chats: this.chats,
          currentChatId: this.currentChatId,
          currentModel: this.currentModel,
          vocabData: vocabStore.vocabData,
          vocabScratchpad: vocabStore.scratchpad,
          lastSyncedAt: this.lastSyncedAt ?? Date.now(),
        }),
        this.currentChatId && Object.keys(treeStore.messagesById).length > 0
          ? saveChatMessages(this.currentChatId, {
              messagesById: treeStore.messagesById,
              lastSyncedAt: Date.now(),
            })
          : Promise.resolve(),
      ])

      this.markChatList()
    },

    // ── Chat CRUD ─────────────────────────────────────────────

    createNewChat(): Notebook {
      const chatId = crypto.randomUUID()
      const newChat: Notebook = {
        id: chatId,
        name: '',
        rootMessageIds: [],
        scratchpad: '',
      }
      this.chats.push(newChat)
      this.currentChatId = chatId

      const treeStore = useMessageTreeStore()
      treeStore.setRootMessageIds([])

      this.markChatList()
      return newChat
    },

    async switchToChat(chatId: string): Promise<void> {
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      this.currentChatId = chatId

      const treeStore = useMessageTreeStore()
      treeStore.setRootMessageIds([...chat.rootMessageIds])

      await this.loadNotebookData(chatId)
      this.markChatList()
    },

    async loadNotebookData(chatId: string): Promise<void> {
      const treeStore = useMessageTreeStore()

      try {
        if (this._chatLastLoadedAt[chatId]) {
          debugLog(`[NotebookStore] Using session cache for ${chatId.slice(0, 8)}`)
          const messagesData = await getLocalChatMessages(chatId)
          if (messagesData?.messagesById) {
            treeStore.loadMessages(messagesData.messagesById as Record<string, import('@/types/message').MessageData>)
            const chat = this.chats.find(c => c.id === chatId)
            if (chat) treeStore.setRootMessageIds([...chat.rootMessageIds])
            return
          }
        }

        debugLog(`[NotebookStore] Loading notebook data for ${chatId.slice(0, 8)}`)
        this.isLoadingChatMessages = true

        let messagesById: Record<string, unknown> = {}
        let fromCache = true

        const localData = await getLocalChatMessages(chatId)
        if (localData?.messagesById && Object.keys(localData.messagesById).length > 0) {
          messagesById = localData.messagesById
          fromCache = true
        }

        if (navigator.onLine) {
          try {
            const cloudMessages = await loadChatMessagesFromCloud(chatId)
            if (Object.keys(cloudMessages).length > 0) {
              messagesById = cloudMessages
              fromCache = false
            }
          } catch (err) {
            console.error('[NotebookStore] Cloud load failed, using local:', err)
          }
        }

        treeStore.loadMessages(messagesById as Record<string, import('@/types/message').MessageData>)

        const chat = this.chats.find(c => c.id === chatId)
        if (chat) treeStore.setRootMessageIds([...chat.rootMessageIds])

        this.lastSyncedAt = fromCache ? this.lastSyncedAt : Date.now()
        this._chatLastLoadedAt[chatId] = Date.now()

        await saveChatMessages(chatId, {
          messagesById,
          lastSyncedAt: this.lastSyncedAt ?? Date.now(),
        })

        debugLog(`[NotebookStore] Loaded: ${Object.keys(treeStore.messagesById).length} messages`)
      } catch (error) {
        console.error('[NotebookStore] Failed to load notebook data:', error)
      } finally {
        this.isLoadingChatMessages = false
      }
    },

    deleteChat(chatId: string): void {
      const chatIndex = this.chats.findIndex(c => c.id === chatId)
      if (chatIndex === -1) return

      const chat = this.chats[chatIndex]

      const treeStore = useMessageTreeStore()
      treeStore.removeMessageTrees([...chat.rootMessageIds])

      this.chats.splice(chatIndex, 1)

      deleteChatMessagesFromCloud(chatId).catch(err =>
        console.error('[NotebookSync] Cloud messages delete failed:', err)
      )

      if (this.currentChatId === chatId) {
        if (this.chats.length > 0) {
          const newIndex = chatIndex > 0 ? chatIndex - 1 : 0
          this.switchToChat(this.chats[newIndex]?.id ?? this.chats[0]!.id)
        } else {
          this.createNewChat()
        }
      }

      this.markChatList()
    },

    renameChat(chatId: string, newTitle: string): void {
      const chat = this.chats.find(c => c.id === chatId)
      if (chat) chat.name = newTitle
      this.markChatList()
    },

    reorderChats(newOrder: string[]): void {
      const reordered = newOrder
        .map(id => this.chats.find(c => c.id === id))
        .filter((c): c is Notebook => c != null)

      const existingIds = new Set(newOrder)
      for (const chat of this.chats) {
        if (!existingIds.has(chat.id)) reordered.push(chat)
      }

      this.chats = reordered
      this.markChatList()
    },

    // ── In-chat operations ────────────────────────────────────

    syncCurrentChat(): void {
      if (!this.currentChatId) return
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (!chat) return

      const treeStore = useMessageTreeStore()
      chat.rootMessageIds = [...treeStore.rootMessageIds]
      this.markChatList()
    },

    updateScratchpad(content: string): void {
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat) chat.scratchpad = content
      this.markChatList()
    },

    setCurrentModel(model: string | null): void {
      this.currentModel = model
      this.markChatList()
    },

    setLastViewedContent(type: string | null, id: string | null): void {
      this.lastViewedContentType = type
      this.lastViewedContentId = id
    },

    // ── Move operations ───────────────────────────────────────

    moveMessageToNewNotebook(messageId: string, sourceChatId: string): { newChatId: string; messageId: string } | null {
      const treeStore = useMessageTreeStore()
      const message = treeStore.messagesById[messageId]
      if (!message) return null

      const sourceChat = this.chats.find(c => c.id === sourceChatId)
      if (!sourceChat) return null

      const newChat = this.createNewChat()
      this.renameChat(newChat.id, message.questionSummarized || message.question || 'New Notebook')

      const targetChat = this.chats.find(c => c.id === newChat.id)
      if (!targetChat) return null

      if (message.parentId) {
        const parent = treeStore.messagesById[message.parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) parent.childIds.splice(idx, 1)
        }
      } else {
        const idx = sourceChat.rootMessageIds.indexOf(messageId)
        if (idx !== -1) sourceChat.rootMessageIds.splice(idx, 1)
      }

      message.parentId = null
      targetChat.rootMessageIds.push(messageId)

      this.currentChatId = newChat.id
      treeStore.currentMessageId = messageId
      treeStore.setRootMessageIds([...targetChat.rootMessageIds])

      this.markChatList()
      return { newChatId: newChat.id, messageId }
    },

    moveMessageToExistingNotebook(messageId: string, sourceChatId: string, targetChatId: string): { targetChatId: string; messageId: string } | null {
      const treeStore = useMessageTreeStore()
      const message = treeStore.messagesById[messageId]
      if (!message) return null

      const sourceChat = this.chats.find(c => c.id === sourceChatId)
      const targetChat = this.chats.find(c => c.id === targetChatId)
      if (!sourceChat || !targetChat || sourceChatId === targetChatId) return null

      if (message.parentId) {
        const parent = treeStore.messagesById[message.parentId]
        if (parent?.childIds) {
          const idx = parent.childIds.indexOf(messageId)
          if (idx !== -1) parent.childIds.splice(idx, 1)
        }
      } else {
        const idx = sourceChat.rootMessageIds.indexOf(messageId)
        if (idx !== -1) sourceChat.rootMessageIds.splice(idx, 1)
      }

      message.parentId = null
      targetChat.rootMessageIds.push(messageId)

      this.currentChatId = targetChatId
      treeStore.currentMessageId = messageId
      treeStore.setRootMessageIds([...targetChat.rootMessageIds])

      this.markChatList()
      return { targetChatId, messageId }
    },

    deleteQuestion(messageId: string, chatId: string): void {
      const treeStore = useMessageTreeStore()
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      const messageIndex = chat.rootMessageIds.indexOf(messageId)
      if (messageIndex === -1) return

      const removedCount = treeStore.countMessagesWithChildren(messageId)

      const rootIdsBeforeDelete = [...chat.rootMessageIds]
      chat.rootMessageIds.splice(messageIndex, 1)

      const rootResult = treeStore.deleteQuestion(messageId, chatId, rootIdsBeforeDelete)
      if (rootResult === 'decrement') treeStore.currentRootIndex--

      if (chat.messageCount !== undefined) {
        chat.messageCount = Math.max(0, chat.messageCount - removedCount)
      }

      if (treeStore.currentMessageId === messageId) {
        if (chat.rootMessageIds.length > 0) {
          const newIndex = Math.min(messageIndex, chat.rootMessageIds.length - 1)
          treeStore.currentMessageId = chat.rootMessageIds[newIndex] ?? null
          treeStore.currentRootIndex = newIndex
        } else {
          this.deleteChat(chatId)
          return
        }
      }

      if (this.currentChatId === chatId) {
        treeStore.rootMessageIds = [...chat.rootMessageIds]
      }

      this.markChatList()
    },
  },
})
