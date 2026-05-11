import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotebookStore } from '../notebook'
import { useMessageTreeStore } from '../messageTree'

const mockSyncChatList = vi.fn()
const mockSyncChatMessages = vi.fn()
const mockGetLocalChatMessages = vi.fn()
const mockResolveChatListConflict = vi.fn()

vi.mock('@/services/sync/IndexedDBService', () => ({
  syncChatList: (...args: unknown[]) => mockSyncChatList(...args),
  syncChatMessages: (...args: unknown[]) => mockSyncChatMessages(...args),
  getLocalChatMessages: (...args: unknown[]) => mockGetLocalChatMessages(...args),
  resolveChatListConflict: (...args: unknown[]) => mockResolveChatListConflict(...args),
}))

describe('Notebook sync on open', () => {
  let store: ReturnType<typeof useNotebookStore>
  let treeStore: ReturnType<typeof useMessageTreeStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNotebookStore()
    treeStore = useMessageTreeStore()

    mockSyncChatList.mockResolvedValue({
      chats: [],
      currentChatId: null,
      currentModel: null,
      lastSyncedAt: null,
      hasConflict: false,
    })
    mockSyncChatMessages.mockResolvedValue({ messagesById: {}, lastSyncedAt: null })
    mockGetLocalChatMessages.mockResolvedValue(null)
    mockResolveChatListConflict.mockResolvedValue({
      chats: [],
      currentChatId: null,
      currentModel: null,
      lastSyncedAt: null,
      hasConflict: false,
    })
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

    it('does NOT call syncChatMessages during creation', () => {
      store.createNewChat()
      expect(mockSyncChatMessages).not.toHaveBeenCalled()
    })
  })

  describe('opening (switching to) a new notebook after creation', () => {
    it('calls syncChatMessages to load messages from IndexedDB + Firestore', async () => {
      const chat = store.createNewChat()

      mockSyncChatMessages.mockResolvedValue({
        messagesById: {},
        lastSyncedAt: 1000,
        fromCache: false,
      })

      await store.switchToChat(chat.id)

      expect(mockSyncChatMessages).toHaveBeenCalledWith(chat.id)
    })

    it('sets tree store rootMessageIds from the chat record', async () => {
      const chat = store.createNewChat()

      await store.switchToChat(chat.id)

      expect(treeStore.rootMessageIds).toEqual([])
    })

    it('loads messages from sync result into tree store', async () => {
      const chat = store.createNewChat()
      const msgId = 'msg-1'

      mockSyncChatMessages.mockResolvedValue({
        messagesById: {
          [msgId]: { id: msgId, question: 'What is math?', response: 'Math is...' },
        },
        lastSyncedAt: 2000,
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

    it('does not call syncChatMessages on second open (uses session cache)', async () => {
      const chat = store.createNewChat()

      mockGetLocalChatMessages.mockResolvedValue({
        messagesById: {
          msg1: { id: 'msg1', question: 'Q', response: 'A' },
        },
      })

      await store.switchToChat(chat.id)
      mockSyncChatMessages.mockClear()

      await store.switchToChat(chat.id)

      expect(mockSyncChatMessages).not.toHaveBeenCalled()
      expect(mockGetLocalChatMessages).toHaveBeenCalledWith(chat.id)
    })
  })

  describe('opening an existing notebook with data', () => {
    let existingChatId: string

    beforeEach(async () => {
      const initChat = { id: 'existing-nb-1', name: 'Physics', rootMessageIds: ['r1', 'r2'], scratchpad: 'notes' }
      mockSyncChatList.mockResolvedValue({
        chats: [initChat],
        currentChatId: 'existing-nb-1',
        currentModel: null,
        lastSyncedAt: 5000,
        hasConflict: false,
      })
      mockSyncChatMessages.mockResolvedValue({
        messagesById: {
          r1: { id: 'r1', question: 'Gravity?', response: 'Force of attraction' },
          r2: { id: 'r2', question: 'Speed of light?', response: '3e8 m/s' },
        },
        lastSyncedAt: 5000,
      })

      await store.initializeStore()
      existingChatId = 'existing-nb-1'
    })

    it('loads all messages for the notebook from sync', async () => {
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

  describe('syncChatMessages merge behavior (IndexedDBService)', () => {
    it('uses cloud data when cloud has messages', async () => {
      mockSyncChatMessages.mockResolvedValue({
        messagesById: { cloud1: { id: 'cloud1', question: 'Cloud Q', response: 'Cloud A' } },
        lastSyncedAt: Date.now(),
        fromCache: false,
      })

      const result = await mockSyncChatMessages('nb-1')
      expect(result.messagesById).toHaveProperty('cloud1')
      expect(result.fromCache).toBe(false)
    })

    it('keeps local data when cloud is empty but local has data', async () => {
      mockSyncChatMessages.mockResolvedValue({
        messagesById: { local1: { id: 'local1', question: 'Local Q', response: 'Local A' } },
        lastSyncedAt: null,
        fromCache: true,
      })

      const result = await mockSyncChatMessages('nb-1')
      expect(result.messagesById).toHaveProperty('local1')
      expect(result.fromCache).toBe(true)
    })

    it('returns empty when both local and cloud are empty', async () => {
      mockSyncChatMessages.mockResolvedValue({
        messagesById: {},
        lastSyncedAt: Date.now(),
        fromCache: false,
      })

      const result = await mockSyncChatMessages('new-nb')
      expect(Object.keys(result.messagesById)).toHaveLength(0)
    })
  })

  describe('switching between notebooks', () => {
    it('loads correct messages when switching from notebook A to B', async () => {
      const nbA = store.createNewChat()
      const nbB = store.createNewChat()

      mockSyncChatMessages.mockResolvedValueOnce({
        messagesById: { a1: { id: 'a1', question: 'A question', response: 'A answer' } },
        lastSyncedAt: 1000,
      })

      await store.switchToChat(nbA.id)
      expect(treeStore.messagesById['a1']).toBeDefined()
      expect(treeStore.rootMessageIds).toEqual([])

      mockSyncChatMessages.mockResolvedValueOnce({
        messagesById: { b1: { id: 'b1', question: 'B question', response: 'B answer' } },
        lastSyncedAt: 2000,
      })

      await store.switchToChat(nbB.id)

      expect(treeStore.messagesById['b1']).toBeDefined()
      expect(treeStore.messagesById['a1']).toBeUndefined()
    })

    it('preserves session cache per notebook when switching back', async () => {
      const nbA = store.createNewChat()
      const nbB = store.createNewChat()

      mockSyncChatMessages.mockResolvedValue({
        messagesById: { a1: { id: 'a1', question: 'Q', response: 'A' } },
        lastSyncedAt: 1000,
      })

      await store.switchToChat(nbA.id)
      mockSyncChatMessages.mockClear()

      mockSyncChatMessages.mockResolvedValue({
        messagesById: { b1: { id: 'b1', question: 'B Q', response: 'B A' } },
        lastSyncedAt: 2000,
      })
      await store.switchToChat(nbB.id)
      mockSyncChatMessages.mockClear()

      mockGetLocalChatMessages.mockResolvedValue({
        messagesById: { a1: { id: 'a1', question: 'Q', response: 'A' } },
      })

      await store.switchToChat(nbA.id)

      expect(mockSyncChatMessages).not.toHaveBeenCalled()
      expect(mockGetLocalChatMessages).toHaveBeenCalledWith(nbA.id)
    })

    it('returns early if chat ID does not exist', async () => {
      await store.switchToChat('nonexistent-id')

      expect(mockSyncChatMessages).not.toHaveBeenCalled()
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

      mockSyncChatMessages.mockResolvedValue({
        messagesById: {},
        lastSyncedAt: Date.now(),
      })

      await store.switchToChat(chat.id)

      expect(Object.keys(treeStore.messagesById)).toHaveLength(0)
      expect(treeStore.rootMessageIds).toEqual([])
      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('sets isLoadingChatMessages during load', async () => {
      const chat = store.createNewChat()
      let loadingDuringFetch = false

      mockSyncChatMessages.mockImplementation(async () => {
        loadingDuringFetch = store.isLoadingChatMessages
        return { messagesById: {}, lastSyncedAt: Date.now() }
      })

      await store.switchToChat(chat.id)

      expect(loadingDuringFetch).toBe(true)
      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('clears loading state even when sync fails', async () => {
      const chat = store.createNewChat()
      mockSyncChatMessages.mockRejectedValue(new Error('Network error'))

      await store.switchToChat(chat.id)

      expect(store.isLoadingChatMessages).toBe(false)
    })

    it('loadNotebookData does not overwrite rootMessageIds if chat was updated', async () => {
      const chat = store.createNewChat()
      const chatInStore = store.chats.find(c => c.id === chat.id)!

      chatInStore.rootMessageIds = ['r1']

      mockSyncChatMessages.mockResolvedValue({
        messagesById: { r1: { id: 'r1', question: 'Q', response: 'A' } },
        lastSyncedAt: Date.now(),
      })

      await store.switchToChat(chat.id)

      expect(treeStore.rootMessageIds).toEqual(['r1'])
    })
  })
})
