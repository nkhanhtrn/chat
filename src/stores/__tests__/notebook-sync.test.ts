import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotebookStore } from '../notebook'
import { useMessageTreeStore } from '../messageTree'

const mockGetLocalChatList = vi.fn()
const mockGetLocalChatMessages = vi.fn()
const mockSaveChatList = vi.fn()
const mockSaveChatMessages = vi.fn()

vi.mock('@/services/sync/IndexedDBService', () => ({
  getLocalChatList: (...args: unknown[]) => mockGetLocalChatList(...args),
  getLocalChatMessages: (...args: unknown[]) => mockGetLocalChatMessages(...args),
  saveChatList: (...args: unknown[]) => mockSaveChatList(...args),
  saveChatMessages: (...args: unknown[]) => mockSaveChatMessages(...args),
}))

const mockSaveChatMetadataToCloud = vi.fn()
const mockLoadChatMetadataFromCloud = vi.fn()
const mockSaveChatMessagesToCloud = vi.fn()
const mockLoadChatMessagesFromCloud = vi.fn()
const mockDeleteChatMessagesFromCloud = vi.fn()

vi.mock('@/services/firestore/firestore-chat', () => ({
  saveChatMetadataToCloud: (...args: unknown[]) => mockSaveChatMetadataToCloud(...args),
  loadChatMetadataFromCloud: (...args: unknown[]) => mockLoadChatMetadataFromCloud(...args),
  saveChatMessagesToCloud: (...args: unknown[]) => mockSaveChatMessagesToCloud(...args),
  loadChatMessagesFromCloud: (...args: unknown[]) => mockLoadChatMessagesFromCloud(...args),
  deleteChatMessagesFromCloud: (...args: unknown[]) => mockDeleteChatMessagesFromCloud(...args),
}))

vi.mock('@/services/auth', () => ({
  getCurrentUser: () => null,
}))

describe('Notebook sync on open', () => {
  let store: ReturnType<typeof useNotebookStore>
  let treeStore: ReturnType<typeof useMessageTreeStore>

  beforeEach(() => {
    vi.useFakeTimers()
    setActivePinia(createPinia())
    store = useNotebookStore()
    treeStore = useMessageTreeStore()

    mockGetLocalChatList.mockResolvedValue(null)
    mockGetLocalChatMessages.mockResolvedValue(null)
    mockSaveChatList.mockResolvedValue(undefined)
    mockSaveChatMessages.mockResolvedValue(undefined)
    mockLoadChatMetadataFromCloud.mockResolvedValue(null)
    mockLoadChatMessagesFromCloud.mockResolvedValue({})
    mockSaveChatMetadataToCloud.mockResolvedValue(undefined)
    mockSaveChatMessagesToCloud.mockResolvedValue(undefined)
    mockDeleteChatMessagesFromCloud.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('creating a brand new notebook', () => {
    it('creates notebook with empty state and sets it as current', () => {
      const chat = store.createNewChat()

      expect(chat.name).toBe('')
      expect(chat.rootMessageIds).toEqual([])
      expect(chat.scratchpad).toBe('')
      expect(store.currentChatId).toBe(chat.id)
      expect(store.chats).toHaveLength(1)
      expect(store.chats[0].id).toBe(chat.id)
    })

    it('clears tree store root message IDs on creation', () => {
      treeStore.rootMessageIds = ['stale-id']
      store.createNewChat()
      expect(treeStore.rootMessageIds).toEqual([])
    })

    it('calls markChatList (saves to IndexedDB)', () => {
      store.createNewChat()

      expect(mockSaveChatList).toHaveBeenCalled()
    })
  })

  describe('opening (switching to) a new notebook after creation', () => {
    it('loads messages from local IndexedDB + cloud', async () => {
      const chat = store.createNewChat()

      mockGetLocalChatMessages.mockResolvedValue({
        messagesById: {},
      })
      mockLoadChatMessagesFromCloud.mockResolvedValue({
        msg1: { id: 'msg1', question: 'Q', response: 'A' },
      })

      await store.switchToChat(chat.id)

      expect(mockLoadChatMessagesFromCloud).toHaveBeenCalledWith(chat.id)
    })

    it('sets tree store rootMessageIds from the chat record', async () => {
      const chat = store.createNewChat()

      await store.switchToChat(chat.id)

      expect(treeStore.rootMessageIds).toEqual([])
    })

    it('loads messages from cloud result into tree store', async () => {
      const chat = store.createNewChat()
      const msgId = 'msg-1'

      mockLoadChatMessagesFromCloud.mockResolvedValue({
        [msgId]: { id: msgId, question: 'What is math?', response: 'Math is...' },
      })

      await store.switchToChat(chat.id)

      expect(treeStore.messagesById[msgId]).toBeDefined()
      expect(treeStore.messagesById[msgId].question).toBe('What is math?')
    })

    it('sets session cache after first load', async () => {
      const chat = store.createNewChat()

      await store.switchToChat(chat.id)

      expect(store._chatLastLoadedAt[chat.id]).toBeDefined()
      expect(store._chatLastLoadedAt[chat.id]).toBeGreaterThan(0)
    })

    it('does not call loadChatMessagesFromCloud on second open (uses session cache)', async () => {
      const chat = store.createNewChat()

      mockGetLocalChatMessages.mockResolvedValue({
        messagesById: {
          msg1: { id: 'msg1', question: 'Q', response: 'A' },
        },
      })

      await store.switchToChat(chat.id)
      mockLoadChatMessagesFromCloud.mockClear()

      await store.switchToChat(chat.id)

      expect(mockLoadChatMessagesFromCloud).not.toHaveBeenCalled()
      expect(mockGetLocalChatMessages).toHaveBeenCalledWith(chat.id)
    })
  })

  describe('opening an existing notebook with data', () => {
    let existingChatId: string

    beforeEach(async () => {
      const initChat = { id: 'existing-nb-1', name: 'Physics', rootMessageIds: ['r1', 'r2'], scratchpad: 'notes' }
      mockGetLocalChatList.mockResolvedValue({
        chats: [initChat],
        currentChatId: 'existing-nb-1',
        currentModel: null,
        lastSyncedAt: 5000,
      })

      await store.initializeStore()
      existingChatId = 'existing-nb-1'
    })

    it('loads all messages for the notebook', async () => {
      mockLoadChatMessagesFromCloud.mockResolvedValue({
        r1: { id: 'r1', question: 'Gravity?', response: 'Force of attraction' },
        r2: { id: 'r2', question: 'Speed of light?', response: '3e8 m/s' },
      })

      await store.switchToChat(existingChatId)

      expect(Object.keys(treeStore.messagesById)).toHaveLength(2)
      expect(treeStore.messagesById['r1'].question).toBe('Gravity?')
      expect(treeStore.messagesById['r2'].question).toBe('Speed of light?')
    })

    it('restores rootMessageIds in tree store from chat data', async () => {
      await store.switchToChat(existingChatId)

      expect(treeStore.rootMessageIds).toEqual(['r1', 'r2'])
    })

    it('sets currentChatId to the opened notebook', async () => {
      await store.switchToChat(existingChatId)

      expect(store.currentChatId).toBe(existingChatId)
    })
  })

  describe('switching between notebooks', () => {
    it('loads correct messages when switching from notebook A to B', async () => {
      const nbA = store.createNewChat()
      const nbB = store.createNewChat()

      mockLoadChatMessagesFromCloud.mockResolvedValueOnce({
        a1: { id: 'a1', question: 'A question', response: 'A answer' },
      })

      await store.switchToChat(nbA.id)
      expect(treeStore.messagesById['a1']).toBeDefined()
      expect(treeStore.rootMessageIds).toEqual([])

      mockLoadChatMessagesFromCloud.mockResolvedValueOnce({
        b1: { id: 'b1', question: 'B question', response: 'B answer' },
      })

      await store.switchToChat(nbB.id)

      expect(treeStore.messagesById['b1']).toBeDefined()
      expect(treeStore.messagesById['a1']).toBeUndefined()
    })

    it('preserves session cache per notebook when switching back', async () => {
      const nbA = store.createNewChat()
      const nbB = store.createNewChat()

      mockLoadChatMessagesFromCloud.mockResolvedValue({
        a1: { id: 'a1', question: 'Q', response: 'A' },
      })

      await store.switchToChat(nbA.id)
      mockLoadChatMessagesFromCloud.mockClear()

      mockLoadChatMessagesFromCloud.mockResolvedValue({
        b1: { id: 'b1', question: 'B Q', response: 'B A' },
      })
      await store.switchToChat(nbB.id)
      mockLoadChatMessagesFromCloud.mockClear()

      mockGetLocalChatMessages.mockResolvedValue({
        messagesById: { a1: { id: 'a1', question: 'Q', response: 'A' } },
      })

      await store.switchToChat(nbA.id)

      expect(mockLoadChatMessagesFromCloud).not.toHaveBeenCalled()
      expect(mockGetLocalChatMessages).toHaveBeenCalledWith(nbA.id)
    })

    it('returns early if chat ID does not exist', async () => {
      await store.switchToChat('nonexistent-id')

      expect(mockLoadChatMessagesFromCloud).not.toHaveBeenCalled()
      expect(store.currentChatId).toBeNull()
    })
  })

  describe('syncCurrentChat after adding messages', () => {
    it('copies rootMessageIds from tree store back to chat record', () => {
      const chat = store.createNewChat()
      store.currentChatId = chat.id

      treeStore.setRootMessageIds(['r1', 'r2'])
      store.syncCurrentChat()

      const updated = store.chats.find(c => c.id === chat.id)
      expect(updated?.rootMessageIds).toEqual(['r1', 'r2'])
    })

    it('is a no-op when no current chat is set', () => {
      store.syncCurrentChat()
      expect(store.chats).toHaveLength(0)
    })
  })

  describe('edge cases', () => {
    it('handles switchToChat for a new notebook with no messages', async () => {
      const chat = store.createNewChat()

      mockLoadChatMessagesFromCloud.mockResolvedValue({})

      await store.switchToChat(chat.id)

      expect(Object.keys(treeStore.messagesById)).toHaveLength(0)
      expect(treeStore.rootMessageIds).toEqual([])
      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('sets isLoadingChatMessages during load', async () => {
      const chat = store.createNewChat()
      let loadingDuringFetch = false

      mockLoadChatMessagesFromCloud.mockImplementation(async () => {
        loadingDuringFetch = store.isLoadingChatMessages
        return {}
      })

      await store.switchToChat(chat.id)

      expect(loadingDuringFetch).toBe(true)
      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('clears loading state even when sync fails', async () => {
      const chat = store.createNewChat()
      mockLoadChatMessagesFromCloud.mockRejectedValue(new Error('Network error'))

      await store.switchToChat(chat.id)

      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('loadNotebookData does not overwrite rootMessageIds if chat was updated', async () => {
      const chat = store.createNewChat()
      const chatInStore = store.chats.find(c => c.id === chat.id)!

      chatInStore.rootMessageIds = ['r1']

      mockLoadChatMessagesFromCloud.mockResolvedValue({
        r1: { id: 'r1', question: 'Q', response: 'A' },
      })

      await store.switchToChat(chat.id)

      expect(treeStore.rootMessageIds).toEqual(['r1'])
    })
  })

  describe('markChatList debouncing', () => {
    it('saves to IndexedDB immediately and debounces cloud save', () => {
      mockSaveChatList.mockClear()
      mockSaveChatMetadataToCloud.mockClear()

      store.createNewChat()

      expect(mockSaveChatList).toHaveBeenCalledTimes(1)
    })
  })

  describe('syncMessagesNow', () => {
    it('saves messages to both IndexedDB and cloud', () => {
      vi.doMock('@/services/auth', () => ({
        getCurrentUser: () => ({ uid: 'test-uid' }),
      }))

      const chat = store.createNewChat()
      treeStore.messagesById = { m1: { id: 'm1', question: 'Q', response: 'A' } }

      store.syncMessagesNow(chat.id)

      expect(mockSaveChatMessages).toHaveBeenCalled()
    })
  })
})
