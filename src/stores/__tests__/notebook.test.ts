import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useNotebookStore } from '../notebook'
import { useMessageTreeStore } from '../messageTree'

vi.mock('@/services/sync/IndexedDBService', () => ({
  getLocalChatList: vi.fn().mockResolvedValue(null),
  getLocalChatMessages: vi.fn().mockResolvedValue(null),
  saveChatList: vi.fn().mockResolvedValue(undefined),
  saveChatMessages: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/firestore/firestore-chat', () => ({
  saveChatMetadataToCloud: vi.fn().mockResolvedValue(undefined),
  loadChatMetadataFromCloud: vi.fn().mockResolvedValue(null),
  saveChatMessagesToCloud: vi.fn().mockResolvedValue(undefined),
  loadChatMessagesFromCloud: vi.fn().mockResolvedValue({}),
  deleteChatMessagesFromCloud: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/services/auth', () => ({
  getCurrentUser: () => null,
}))

describe('useNotebookStore', () => {
  let store: ReturnType<typeof useNotebookStore>
  let treeStore: ReturnType<typeof useMessageTreeStore>

  beforeEach(() => {
    setActivePinia(createPinia())
    store = useNotebookStore()
    treeStore = useMessageTreeStore()
  })

  function setupNotebook(id = 'nb1', name = 'Test Notebook', rootIds: string[] = []) {
    store.chats.push({ id, name, rootMessageIds: rootIds, scratchpad: '' })
    return id
  }

  // ── Getters ──

  describe('chatList', () => {
    it('returns NotebookListItem with title and questions', () => {
      const nbId = setupNotebook('nb1', 'Math')
      treeStore.loadMessages({
        'r1': { id: 'r1', question: 'What is calculus?', response: '', questionSummarized: 'Calculus' } as any,
      })
      store.chats[0].rootMessageIds = ['r1']
      store.currentChatId = nbId
      treeStore.setRootMessageIds(['r1'])

      const list = store.chatList
      expect(list).toHaveLength(1)
      expect(list[0].title).toBe('Math')
      expect(list[0].questions).toHaveLength(1)
      expect(list[0].questions[0].text).toBe('Calculus')
    })

    it('uses default title for unnamed notebooks', () => {
      setupNotebook('nb1', '')
      expect(store.chatList[0].title).toBe('New Subject')
    })
  })

  describe('currentChat', () => {
    it('returns the currently selected chat', () => {
      setupNotebook('nb1', 'Test')
      store.currentChatId = 'nb1'
      expect(store.currentChat?.id).toBe('nb1')
    })

    it('returns null when no chat is selected', () => {
      expect(store.currentChat).toBeNull()
    })
  })

  describe('currentScratchpad', () => {
    it('returns scratchpad content for current chat', () => {
      store.chats.push({ id: 'nb1', name: 'Test', rootMessageIds: [], scratchpad: 'My notes' })
      store.currentChatId = 'nb1'
      expect(store.currentScratchpad).toBe('My notes')
    })

    it('returns empty string when no chat selected', () => {
      expect(store.currentScratchpad).toBe('')
    })
  })

  // ── CRUD ──

  describe('createNewChat', () => {
    it('creates a new notebook and sets it as current', () => {
      const chat = store.createNewChat()
      expect(chat.name).toBe('')
      expect(chat.rootMessageIds).toEqual([])
      expect(store.currentChatId).toBe(chat.id)
      expect(store.chats).toHaveLength(1)
    })

    it('clears tree store root message IDs', () => {
      treeStore.rootMessageIds = ['old-id']
      store.createNewChat()
      expect(treeStore.rootMessageIds).toEqual([])
    })
  })

  describe('renameChat', () => {
    it('updates chat name', () => {
      setupNotebook('nb1', 'Old Name')
      store.renameChat('nb1', 'New Name')
      expect(store.chats[0].name).toBe('New Name')
    })

    it('is a no-op for nonexistent chat', () => {
      store.renameChat('missing', 'Name')
      expect(store.chats).toHaveLength(0)
    })
  })

  describe('reorderChats', () => {
    it('reorders chats by ID', () => {
      setupNotebook('nb1')
      setupNotebook('nb2')
      setupNotebook('nb3')
      store.reorderChats(['nb3', 'nb1', 'nb2'])
      expect(store.chats.map(c => c.id)).toEqual(['nb3', 'nb1', 'nb2'])
    })

    it('preserves chats not in the order list', () => {
      setupNotebook('nb1')
      setupNotebook('nb2')
      setupNotebook('nb3')
      store.reorderChats(['nb2'])
      expect(store.chats.map(c => c.id)).toEqual(['nb2', 'nb1', 'nb3'])
    })
  })

  describe('syncCurrentChat', () => {
    it('copies rootMessageIds from tree store to chat', () => {
      setupNotebook('nb1')
      store.currentChatId = 'nb1'
      treeStore.setRootMessageIds(['r1', 'r2'])
      store.syncCurrentChat()
      expect(store.chats[0].rootMessageIds).toEqual(['r1', 'r2'])
    })

    it('is a no-op when no current chat', () => {
      store.syncCurrentChat()
    })
  })

  describe('updateScratchpad', () => {
    it('updates scratchpad on current chat', () => {
      store.chats.push({ id: 'nb1', name: 'Test', rootMessageIds: [], scratchpad: '' })
      store.currentChatId = 'nb1'
      store.updateScratchpad('New notes')
      expect(store.chats[0].scratchpad).toBe('New notes')
    })
  })

  describe('deleteChat', () => {
    it('removes the chat from the list', () => {
      setupNotebook('nb1')
      setupNotebook('nb2')
      store.deleteChat('nb1')
      expect(store.chats.map(c => c.id)).toEqual(['nb2'])
    })

    it('switches to adjacent chat when deleting current', () => {
      setupNotebook('nb1', 'First')
      setupNotebook('nb2', 'Second')
      store.currentChatId = 'nb2'
      store.deleteChat('nb2')
      expect(store.currentChatId).toBe('nb1')
    })

    it('creates a new chat when deleting the last one', () => {
      setupNotebook('nb1')
      store.currentChatId = 'nb1'
      store.deleteChat('nb1')
      expect(store.chats).toHaveLength(1)
      expect(store.chats[0].id).not.toBe('nb1')
    })

    it('removes message trees from tree store', () => {
      setupNotebook('nb1', 'Test', ['r1'])
      treeStore.loadMessages({ 'r1': { id: 'r1', question: 'Q', response: '' } as any })
      treeStore.setRootMessageIds(['r1'])
      store.currentChatId = 'nb1'
      store.deleteChat('nb1')
      expect(treeStore.getMessageById('r1')).toBeNull()
    })
  })

  // ── Move operations ──

  describe('moveMessageToNewNotebook', () => {
    it('creates a new notebook and moves message there', () => {
      setupNotebook('nb1', 'Source', ['r1'])
      treeStore.loadMessages({ 'r1': { id: 'r1', question: 'Q1', response: '', questionSummarized: 'Summary' } as any })
      treeStore.setRootMessageIds(['r1'])
      store.currentChatId = 'nb1'

      const result = store.moveMessageToNewNotebook('r1', 'nb1')
      expect(result).not.toBeNull()
      expect(result!.messageId).toBe('r1')

      expect(store.chats.find(c => c.id === 'nb1')?.rootMessageIds).toEqual([])
      const newChat = store.chats.find(c => c.id === result!.newChatId)
      expect(newChat?.rootMessageIds).toContain('r1')
      expect(newChat?.name).toBe('Summary')
    })
  })

  describe('moveMessageToExistingNotebook', () => {
    it('moves message from source to target notebook', () => {
      setupNotebook('nb1', 'Source', ['r1'])
      setupNotebook('nb2', 'Target', [])
      treeStore.loadMessages({ 'r1': { id: 'r1', question: 'Q1', response: '' } as any })
      treeStore.setRootMessageIds(['r1'])
      store.currentChatId = 'nb1'

      const result = store.moveMessageToExistingNotebook('r1', 'nb1', 'nb2')
      expect(result).not.toBeNull()
      expect(result!.targetChatId).toBe('nb2')
      expect(store.chats.find(c => c.id === 'nb1')?.rootMessageIds).toEqual([])
      expect(store.chats.find(c => c.id === 'nb2')?.rootMessageIds).toContain('r1')
    })

    it('returns null when source and target are the same', () => {
      setupNotebook('nb1', 'Same', ['r1'])
      treeStore.loadMessages({ 'r1': { id: 'r1', question: 'Q', response: '' } as any })
      const result = store.moveMessageToExistingNotebook('r1', 'nb1', 'nb1')
      expect(result).toBeNull()
    })
  })

  describe('deleteQuestion', () => {
    it('removes question from chat', () => {
      setupNotebook('nb1', 'Test', ['r1', 'r2'])
      treeStore.loadMessages({
        'r1': { id: 'r1', question: 'Q1', response: 'A1' } as any,
        'r2': { id: 'r2', question: 'Q2', response: 'A2' } as any,
      })
      treeStore.setRootMessageIds(['r1', 'r2'])
      store.currentChatId = 'nb1'

      store.deleteQuestion('r1', 'nb1')
      expect(store.chats[0].rootMessageIds).toEqual(['r2'])
      expect(treeStore.getMessageById('r1')).toBeNull()
    })

    it('deletes chat when removing last question', () => {
      setupNotebook('nb1', 'Last', ['r1'])
      treeStore.loadMessages({ 'r1': { id: 'r1', question: 'Q', response: '' } as any })
      treeStore.setRootMessageIds(['r1'])
      store.currentChatId = 'nb1'
      treeStore.currentMessageId = 'r1'

      store.deleteQuestion('r1', 'nb1')
      expect(store.chats.find(c => c.id === 'nb1')).toBeUndefined()
    })
  })
})
