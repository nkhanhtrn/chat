import { defineStore } from 'pinia'
import { useMessageTreeStore } from './messageTree'
import type { Notebook, NotebookListItem } from '@/types/notebook'
import { syncChatList, syncChatMessages, getLocalChatMessages, resolveChatListConflict } from '@/services/sync/IndexedDBService'
import { Message } from '@/models/Message'
import { debugLog } from '@/utils/debug'

export const useNotebookStore = defineStore('notebook', {
  state: () => ({
    /** All chat/notebook sessions */
    chats: [] as Notebook[],

    /** Currently active chat */
    currentChatId: null as string | null,

    /** Currently selected model */
    currentModel: null as string | null,

    /** Whether notebook list is loaded */
    isInitialized: false,

    /** Loading state for lazy-loading messages */
    isLoadingChatMessages: false,

    /** Session cache: notebooks loaded this session */
    _chatLastLoadedAt: {} as Record<string, number>,

    /** Last viewed content for cross-device sync */
    lastViewedContentType: null as string | null,
    lastViewedContentId: null as string | null,

    /** Last sync timestamp */
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

        if (chat.messageCount === undefined) {
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
          chat.messageCount = total
        }

        return {
          id: chat.id,
          title: chat.name || 'New Subject',
          messageCount: chat.messageCount,
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

    async initializeStore(): Promise<{ hasConflict: boolean; localChatCount?: number; cloudChatCount?: number; localChats?: Notebook[]; cloudChats?: Notebook[] }> {
      if (this.isInitialized) return { hasConflict: false }

      try {
        debugLog('[NotebookStore] Initializing store')
        const listData = await syncChatList()

        this.chats = (listData.chats as Notebook[]) ?? []
        this.currentChatId = (listData.currentChatId as string) ?? null
        this.currentModel = (listData.currentModel as string) ?? null
        this.lastSyncedAt = (listData.lastSyncedAt as number) ?? null
        this.isInitialized = true

        debugLog(`[NotebookStore] Initialized: ${this.chats.length} notebooks`)

        return {
          hasConflict: (listData.hasConflict as boolean) ?? false,
          localChatCount: listData.localChatCount as number | undefined,
          cloudChatCount: listData.cloudChatCount as number | undefined,
          localChats: listData.localChats as Notebook[] | undefined,
          cloudChats: listData.cloudChats as Notebook[] | undefined,
        }
      } catch (error) {
        console.error('[NotebookStore] Failed to initialize:', error)
        this.isInitialized = true
        return { hasConflict: false }
      }
    },

    async resolveListConflict(choice: string, conflictData: Record<string, unknown>): Promise<void> {
      try {
        const result = await resolveChatListConflict(choice, conflictData)

        this.chats = (result.chats as Notebook[]) ?? []
        this.currentChatId = (result.currentChatId as string) ?? null
        this.currentModel = (result.currentModel as string) ?? null
        this.lastSyncedAt = (result.lastSyncedAt as number) ?? null

        debugLog('[NotebookStore] Conflict resolved')
      } catch (error) {
        console.error('[NotebookStore] Failed to resolve conflict:', error)
      }
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

      return newChat
    },

    async switchToChat(chatId: string): Promise<void> {
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      this.currentChatId = chatId

      const treeStore = useMessageTreeStore()
      treeStore.setRootMessageIds([...chat.rootMessageIds])

      await this.loadNotebookData(chatId)
    },

    async loadNotebookData(chatId: string): Promise<void> {
      const treeStore = useMessageTreeStore()

      try {
        // Session cache: only download each notebook once per session
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

        const messagesData = await syncChatMessages(chatId)

        treeStore.loadMessages(messagesData.messagesById as Record<string, import('@/types/message').MessageData>)

        const chat = this.chats.find(c => c.id === chatId)
        if (chat) treeStore.setRootMessageIds([...chat.rootMessageIds])

        this.lastSyncedAt = (messagesData.lastSyncedAt as number) ?? Date.now()
        this._chatLastLoadedAt[chatId] = Date.now()

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

      // Remove all message trees
      const treeStore = useMessageTreeStore()
      treeStore.removeMessageTrees([...chat.rootMessageIds])

      this.chats.splice(chatIndex, 1)

      if (this.currentChatId === chatId) {
        if (this.chats.length > 0) {
          const newIndex = chatIndex > 0 ? chatIndex - 1 : 0
          this.switchToChat(this.chats[newIndex]?.id ?? this.chats[0]!.id)
        } else {
          this.createNewChat()
        }
      }
    },

    renameChat(chatId: string, newTitle: string): void {
      const chat = this.chats.find(c => c.id === chatId)
      if (chat) chat.name = newTitle
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
    },

    // ── In-chat operations ────────────────────────────────────

    syncCurrentChat(): void {
      if (!this.currentChatId) return
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (!chat) return

      const treeStore = useMessageTreeStore()
      chat.rootMessageIds = [...treeStore.rootMessageIds]
    },

    updateScratchpad(content: string): void {
      const chat = this.chats.find(c => c.id === this.currentChatId)
      if (chat) chat.scratchpad = content
    },

    setCurrentModel(model: string | null): void {
      this.currentModel = model
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

      // Remove from source
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

      return { newChatId: newChat.id, messageId }
    },

    moveMessageToExistingNotebook(messageId: string, sourceChatId: string, targetChatId: string): { targetChatId: string; messageId: string } | null {
      const treeStore = useMessageTreeStore()
      const message = treeStore.messagesById[messageId]
      if (!message) return null

      const sourceChat = this.chats.find(c => c.id === sourceChatId)
      const targetChat = this.chats.find(c => c.id === targetChatId)
      if (!sourceChat || !targetChat || sourceChatId === targetChatId) return null

      // Remove from source
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

      return { targetChatId, messageId }
    },

    deleteQuestion(messageId: string, chatId: string): void {
      const treeStore = useMessageTreeStore()
      const chat = this.chats.find(c => c.id === chatId)
      if (!chat) return

      const messageIndex = chat.rootMessageIds.indexOf(messageId)
      if (messageIndex === -1) return

      const removedCount = treeStore.countMessagesWithChildren(messageId)

      chat.rootMessageIds.splice(messageIndex, 1)

      const rootResult = treeStore.deleteQuestion(messageId, chatId, [...chat.rootMessageIds])
      if (rootResult === 'decrement') treeStore.currentRootIndex--

      if (chat.messageCount !== undefined) {
        chat.messageCount = Math.max(0, chat.messageCount - removedCount)
      }

      // If deleted the currently viewed message
      if (treeStore.currentMessageId === messageId) {
        if (chat.rootMessageIds.length > 0) {
          const newIndex = Math.min(messageIndex, chat.rootMessageIds.length - 1)
          treeStore.currentMessageId = chat.rootMessageIds[newIndex] ?? null
          treeStore.currentRootIndex = newIndex
        } else {
          this.deleteChat(chatId)
        }
      }

      // Sync rootMessageIds if current chat
      if (this.currentChatId === chatId) {
        treeStore.rootMessageIds = [...chat.rootMessageIds]
      }
    },
  },
})
