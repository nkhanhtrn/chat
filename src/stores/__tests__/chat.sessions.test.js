import * as storage from '../../services/storage.js'
import { vi } from 'vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'

describe('useChatStore - Chat Sessions', () => {
  let chatStore
  let saveChatStateSpy
  let loadChatStateSpy

  beforeEach(() => {
    // Mock loadChatState to return null (default state)
    loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockResolvedValue({ hasConflict: false, state: null })

    setActivePinia(createPinia())
    chatStore = useChatStore()

    // Explicitly clear state to ensure isolation
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
    chatStore.chats = []
    chatStore.currentChatId = null

    saveChatStateSpy = vi.spyOn(storage, 'saveChatState')
  })

  afterEach(() => {
    saveChatStateSpy.mockRestore()
    loadChatStateSpy.mockRestore()
  })

  describe('createNewChat', () => {
    it('should create a new chat session', () => {
      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(1)
      expect(chatStore.chats[0]).toHaveProperty('id')
      expect(chatStore.chats[0]).toHaveProperty('rootMessageIds')
      expect(chatStore.chats[0].rootMessageIds).toEqual([])
    })

    it('should set currentChatId to new chat', () => {
      chatStore.createNewChat()

      expect(chatStore.currentChatId).toBe(chatStore.chats[0].id)
    })

    it('should clear rootMessageIds', () => {
      // Add some messages first
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      expect(chatStore.rootMessageIds).toHaveLength(1)

      chatStore.createNewChat()

      expect(chatStore.rootMessageIds).toEqual([])
    })

    it('should clear currentMessageId', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      expect(chatStore.currentMessageId).toBe('msg1')

      chatStore.createNewChat()

      expect(chatStore.currentMessageId).toBeNull()
    })

    it('should persist state after creating new chat', () => {
      chatStore.createNewChat()

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.chats).toHaveLength(1)
      expect(savedState.currentChatId).toBe(chatStore.chats[0].id)
    })

    it('should generate unique IDs for multiple chats', () => {
      chatStore.createNewChat()
      chatStore.createNewChat()
      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(3)
      const ids = chatStore.chats.map(chat => chat.id)
      const uniqueIds = new Set(ids)
      expect(uniqueIds.size).toBe(3)
    })

    it('should not affect existing chats when creating new chat', () => {
      chatStore.createNewChat()
      const firstChatId = chatStore.chats[0].id
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(2)
      expect(chatStore.chats[0].id).toBe(firstChatId)
      expect(chatStore.chats[0].rootMessageIds).toEqual(['msg1'])
    })
  })

  describe('switchToChat', () => {
    it('should switch to an existing chat', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.switchToChat(chat1Id)

      expect(chatStore.currentChatId).toBe(chat1Id)
      expect(chatStore.rootMessageIds).toEqual(['msg1'])
    })

    it('should save current chat messages before switching', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.switchToChat(chat1Id)

      // Check that chat2 has saved messages
      const chat2 = chatStore.chats.find(c => c.id === chat2Id)
      expect(chat2.rootMessageIds).toEqual(['msg2'])
    })

    it('should load messages from target chat', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.switchToChat(chat1Id)

      expect(chatStore.rootMessageIds).toEqual(['msg1'])
    })

    it('should clear currentMessageId when switching chats', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      expect(chatStore.currentMessageId).toBe('msg1')

      chatStore.createNewChat()
      chatStore.switchToChat(chat1Id)

      expect(chatStore.currentMessageId).toBeNull()
    })

    it('should do nothing when switching to non-existent chat', () => {
      chatStore.createNewChat()
      const originalChatId = chatStore.currentChatId
      const originalRootMessageIds = [...chatStore.rootMessageIds]

      chatStore.switchToChat('nonexistent-id')

      expect(chatStore.currentChatId).toBe(originalChatId)
      expect(chatStore.rootMessageIds).toEqual(originalRootMessageIds)
    })

    it('should persist state after switching chats', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      chatStore.switchToChat(chat1Id)

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.currentChatId).toBe(chat1Id)
    })

    it('should handle switching between chats with messages', () => {
      // Create chat 1 with messages
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      // Create chat 2 with messages
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      // Switch back to chat 1
      chatStore.switchToChat(chat1Id)
      expect(chatStore.rootMessageIds).toEqual(['msg1', 'msg2'])

      // Switch to chat 2
      chatStore.switchToChat(chat2Id)
      expect(chatStore.rootMessageIds).toEqual(['msg3'])
    })

    it('should create a copy of rootMessageIds array when switching', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()
      chatStore.switchToChat(chat1Id)

      // Modify current rootMessageIds
      chatStore.rootMessageIds.push('new-msg')

      // Original chat should not be affected
      const chat1 = chatStore.chats.find(c => c.id === chat1Id)
      expect(chat1.rootMessageIds).toEqual(['msg1'])
    })

    it('should handle empty chats', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.switchToChat(chat1Id)

      expect(chatStore.rootMessageIds).toEqual([])
      expect(chatStore.currentMessageId).toBeNull()
    })
  })

  describe('_syncCurrentChat', () => {
    it('should sync rootMessageIds to current chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.rootMessageIds).toEqual(['msg1'])
    })

    it('should update chat when adding multiple messages', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.rootMessageIds).toEqual(['msg1', 'msg2', 'msg3'])
    })

    it('should do nothing when currentChatId is null', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      // Should not throw error
      expect(chatStore.chats).toHaveLength(0)
    })

    it('should do nothing when currentChatId does not match any chat', () => {
      chatStore.createNewChat()
      chatStore.currentChatId = 'nonexistent-id'

      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      // Should not throw error
      expect(chatStore.rootMessageIds).toEqual(['msg1'])
    })
  })

  // Note: chatList getter tests are in chat.getters.test.js

  describe('Integration: Chat Sessions with Messages', () => {
    it('should maintain separate message trees for different chats', () => {
      // Chat 1: Create a message tree
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'c1-msg1', question: 'Chat 1 Q1', response: 'R1' })
      chatStore.addChildMessage('c1-msg1', { id: 'c1-msg2', question: 'Chat 1 Q2', response: 'R2' })

      // Chat 2: Create different message tree
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'c2-msg1', question: 'Chat 2 Q1', response: 'R1' })

      // Switch back to Chat 1
      chatStore.switchToChat(chat1Id)

      // Verify Chat 1's messages are loaded
      expect(chatStore.rootMessageIds).toEqual(['c1-msg1'])
      expect(chatStore.messagesById['c1-msg1']).toBeDefined()
      expect(chatStore.messagesById['c1-msg2']).toBeDefined()
      expect(chatStore.messagesById['c1-msg1'].childIds).toContain('c1-msg2')

      // Switch to Chat 2
      chatStore.switchToChat(chat2Id)

      // Verify Chat 2's messages
      expect(chatStore.rootMessageIds).toEqual(['c2-msg1'])

      // All messages should still exist in messagesById (shared storage)
      expect(chatStore.messagesById['c1-msg1']).toBeDefined()
      expect(chatStore.messagesById['c2-msg1']).toBeDefined()
    })

    it('should restore state with multiple chats', async () => {
      const savedState = {
        messagesById: {
          'msg1': { id: 'msg1', question: 'Q1', response: 'R1', parentId: null, childIds: [] },
          'msg2': { id: 'msg2', question: 'Q2', response: 'R2', parentId: null, childIds: [] }
        },
        rootMessageIds: ['msg1'],
        currentMessageId: 'msg1',
        currentModel: 'gpt-4',
        chats: [
          { id: 'chat1', rootMessageIds: ['msg1'] },
          { id: 'chat2', rootMessageIds: ['msg2'] }
        ],
        currentChatId: 'chat1'
      }

      const loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
      const store = useChatStore()
      await store.initializeStore()

      expect(store.chats).toHaveLength(2)
      expect(store.currentChatId).toBe('chat1')
      expect(store.rootMessageIds).toEqual(['msg1'])

      loadChatStateSpy.mockRestore()
    })

    it('should handle adding messages to current chat after switching', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.switchToChat(chat1Id)
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      const chat1 = chatStore.chats.find(c => c.id === chat1Id)
      expect(chat1.rootMessageIds).toEqual(['msg1'])
    })

    it('should keep all messages accessible across chat switches', () => {
      // Create messages in chat 1
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      // Create messages in chat 2
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      // Both messages should exist in messagesById
      expect(chatStore.messagesById['msg1']).toBeDefined()
      expect(chatStore.messagesById['msg2']).toBeDefined()
    })
  })

  describe('deleteChat', () => {
    it('should delete a chat session when multiple chats exist', () => {
      chatStore.createNewChat()
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.deleteChat(chat2Id)

      expect(chatStore.chats).toHaveLength(1)
    })

    it('should remove all messages from deleted chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.deleteChat(chatId)

      expect(chatStore.messagesById['msg1']).toBeUndefined()
      expect(chatStore.messagesById['msg2']).toBeUndefined()
    })

    it('should remove entire message tree from deleted chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addChildMessage('msg1', { id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addChildMessage('msg2', { id: 'msg3', question: 'Q3', response: 'R3' })

      chatStore.deleteChat(chatId)

      expect(chatStore.messagesById['msg1']).toBeUndefined()
      expect(chatStore.messagesById['msg2']).toBeUndefined()
      expect(chatStore.messagesById['msg3']).toBeUndefined()
    })

    it('should switch to chat above when deleting current chat', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat3Id = chatStore.currentChatId

      // Delete the last chat (chat3, which is current)
      chatStore.deleteChat(chat3Id)

      // Should switch to chat2 (the one above it)
      expect(chatStore.currentChatId).toBe(chat2Id)
      expect(chatStore.chats).toHaveLength(2)
    })

    it('should switch to first chat when deleting the first chat', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.createNewChat()

      // Switch to and delete the first chat
      chatStore.switchToChat(chat1Id)
      chatStore.deleteChat(chat1Id)

      expect(chatStore.currentChatId).toBe(chat2Id)
      expect(chatStore.chats).toHaveLength(2)
    })

    it('should create new chat when deleting the last chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.deleteChat(chatId)

      expect(chatStore.chats).toHaveLength(1)
      expect(chatStore.currentChatId).not.toBe(chatId)
      expect(chatStore.currentChatId).not.toBeNull()
    })

    it('should do nothing when deleting non-existent chat', () => {
      chatStore.createNewChat()
      const originalChatsCount = chatStore.chats.length

      chatStore.deleteChat('nonexistent-id')

      expect(chatStore.chats).toHaveLength(originalChatsCount)
    })

    it('should not affect other chats when deleting one', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.deleteChat(chat2Id)

      expect(chatStore.chats).toHaveLength(1)
      expect(chatStore.messagesById['msg1']).toBeDefined()
      expect(chatStore.messagesById['msg2']).toBeUndefined()
    })

    it('should persist state after deleting chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.deleteChat(chatId)

      expect(saveChatStateSpy).toHaveBeenCalled()
    })

    it('should not affect current chat if deleting a different chat', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId

      chatStore.deleteChat(chat1Id)

      expect(chatStore.currentChatId).toBe(chat2Id)
    })
  })

  describe('renameChat', () => {
    it('should rename a chat by updating the name field', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Original Title', response: 'R1' })

      chatStore.renameChat(chatId, 'New Title')

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.name).toBe('New Title')
      // Message should remain unchanged
      expect(chatStore.messagesById['msg1'].question).toBe('Original Title')
    })

    it('should update chat title in chatList getter', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Original Title', response: 'R1' })

      chatStore.renameChat(chatId, 'Renamed Chat')

      const chatList = chatStore.chatList
      expect(chatList[0].title).toBe('Renamed Chat')
    })

    it('should rename chat even when it has no messages', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.renameChat(chatId, 'New Title')

      const chatList = chatStore.chatList
      expect(chatList[0].title).toBe('New Title')
    })

    it('should do nothing when chat does not exist', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Title', response: 'R1' })

      chatStore.renameChat('nonexistent-id', 'New Title')

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.name).toBe('Title')
    })

    it('should persist state after renaming chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Original', response: 'R1' })

      chatStore.renameChat(chatId, 'New Name')

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      const chat = savedState.chats.find(c => c.id === chatId)
      expect(chat.name).toBe('New Name')
    })

    it('should only rename the first message, not other messages', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'First', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Second', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Third', response: 'R3' })

      chatStore.renameChat(chatId, 'Renamed')

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.name).toBe('Renamed')
      // Messages should remain unchanged
      expect(chatStore.messagesById['msg1'].question).toBe('First')
      expect(chatStore.messagesById['msg2'].question).toBe('Second')
      expect(chatStore.messagesById['msg3'].question).toBe('Third')
    })

    it('should work across multiple chats independently', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Chat 1', response: 'R1' })

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg2', question: 'Chat 2', response: 'R2' })

      chatStore.renameChat(chat1Id, 'Renamed Chat 1')
      chatStore.renameChat(chat2Id, 'Renamed Chat 2')

      const chat1 = chatStore.chats.find(c => c.id === chat1Id)
      const chat2 = chatStore.chats.find(c => c.id === chat2Id)
      expect(chat1.name).toBe('Renamed Chat 1')
      expect(chat2.name).toBe('Renamed Chat 2')
    })

    it('should handle renaming a chat that is not currently active', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Chat 1', response: 'R1' })

      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg2', question: 'Chat 2', response: 'R2' })

      // Rename chat1 while chat2 is active
      chatStore.renameChat(chat1Id, 'Updated Chat 1')

      const chat1 = chatStore.chats.find(c => c.id === chat1Id)
      expect(chat1.name).toBe('Updated Chat 1')
      expect(chatStore.currentChatId).toBe(chat2Id)
    })
  })

  describe('deleteQuestion', () => {
    it('should delete a question from a chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.deleteQuestion('msg1', chatId)

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.rootMessageIds).toEqual(['msg2'])
      expect(chatStore.messagesById['msg1']).toBeUndefined()
      expect(chatStore.messagesById['msg2']).toBeDefined()
    })

    it('should delete message and all its children', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addChildMessage('msg1', { id: 'child1', question: 'C1', response: 'R1' })
      chatStore.addChildMessage('child1', { id: 'grandchild1', question: 'GC1', response: 'R1' })

      chatStore.deleteQuestion('msg1', chatId)

      expect(chatStore.messagesById['msg1']).toBeUndefined()
      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['grandchild1']).toBeUndefined()
    })

    it('should sync rootMessageIds when deleting from current chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      chatStore.deleteQuestion('msg2', chatId)

      // rootMessageIds should be synced with chat.rootMessageIds
      expect(chatStore.rootMessageIds).toEqual(['msg1', 'msg3'])
    })

    it('should update currentRootIndex when deleting currently viewed question', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      // Navigate to msg2 (index 1)
      chatStore.currentRootIndex = 1
      chatStore.currentMessageId = 'msg2'

      chatStore.deleteQuestion('msg2', chatId)

      // Should switch to msg3 (now at index 1)
      expect(chatStore.currentMessageId).toBe('msg3')
      expect(chatStore.currentRootIndex).toBe(1)
    })

    it('should adjust currentRootIndex when deleting question before current', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      // Navigate to msg3 (index 2)
      chatStore.currentRootIndex = 2
      chatStore.currentMessageId = 'msg3'

      chatStore.deleteQuestion('msg1', chatId)

      // currentRootIndex should decrease since we deleted before it
      expect(chatStore.currentMessageId).toBe('msg3')
      expect(chatStore.currentRootIndex).toBe(1)
    })

    it('should delete chat when last question is deleted', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.deleteQuestion('msg1', chatId)

      // Chat should be deleted and a new one created
      expect(chatStore.chats.find(c => c.id === chatId)).toBeUndefined()
      expect(chatStore.chats.length).toBe(1)
    })

    it('should do nothing when chat does not exist', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.deleteQuestion('msg1', 'nonexistent-chat')

      expect(chatStore.messagesById['msg1']).toBeDefined()
    })

    it('should do nothing when message does not exist in chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.deleteQuestion('nonexistent-msg', chatId)

      expect(chatStore.messagesById['msg1']).toBeDefined()
    })

    it('should persist state after deleting question', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.deleteQuestion('msg1', chatId)

      expect(saveChatStateSpy).toHaveBeenCalled()
    })

    it('should handle deleting last question when viewing it', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      // View the last question
      chatStore.currentRootIndex = 1
      chatStore.currentMessageId = 'msg2'

      chatStore.deleteQuestion('msg2', chatId)

      // Should switch to msg1
      expect(chatStore.currentMessageId).toBe('msg1')
      expect(chatStore.currentRootIndex).toBe(0)
    })

    it('should remove questionLinks pointing to deleted question', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'Response with link' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      // Add a questionLink from msg1 pointing to msg2
      chatStore.addCustomContent('msg1', {
        id: 'link1',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'msg2',
        startOffset: 14,
        endOffset: 18
      })

      expect(chatStore.messagesById['msg1'].customContent).toHaveLength(1)

      // Delete msg2 - should also remove the questionLink from msg1
      chatStore.deleteQuestion('msg2', chatId)

      expect(chatStore.messagesById['msg2']).toBeUndefined()
      expect(chatStore.messagesById['msg1'].customContent).toHaveLength(0)
    })

    it('should remove questionLinks pointing to deleted child messages', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addChildMessage('msg1', { id: 'child1', question: 'C1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'Response with link' })

      // Add a questionLink from msg2 pointing to child1
      chatStore.addCustomContent('msg2', {
        id: 'link1',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'child1',
        startOffset: 14,
        endOffset: 18
      })

      expect(chatStore.messagesById['msg2'].customContent).toHaveLength(1)

      // Delete msg1 (which also deletes child1) - should remove the questionLink from msg2
      chatStore.deleteQuestion('msg1', chatId)

      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['msg2'].customContent).toHaveLength(0)
    })

    it('should remove multiple questionLinks pointing to same deleted question', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'Response one' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'Response two' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      // Add questionLinks from msg1 and msg2 both pointing to msg3
      chatStore.addCustomContent('msg1', {
        id: 'link1',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'msg3',
        startOffset: 0,
        endOffset: 4
      })
      chatStore.addCustomContent('msg2', {
        id: 'link2',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'msg3',
        startOffset: 0,
        endOffset: 4
      })

      expect(chatStore.messagesById['msg1'].customContent).toHaveLength(1)
      expect(chatStore.messagesById['msg2'].customContent).toHaveLength(1)

      // Delete msg3 - should remove questionLinks from both msg1 and msg2
      chatStore.deleteQuestion('msg3', chatId)

      expect(chatStore.messagesById['msg1'].customContent).toHaveLength(0)
      expect(chatStore.messagesById['msg2'].customContent).toHaveLength(0)
    })
  })

  describe('reorderChats', () => {
    it('should reorder chats according to new order', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id
      chatStore.createNewChat()
      const chat3Id = chatStore.chats[2].id

      // Reorder: move chat3 to first position
      chatStore.reorderChats([chat3Id, chat1Id, chat2Id])

      expect(chatStore.chats[0].id).toBe(chat3Id)
      expect(chatStore.chats[1].id).toBe(chat1Id)
      expect(chatStore.chats[2].id).toBe(chat2Id)
    })

    it('should persist state after reordering', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id

      chatStore.reorderChats([chat2Id, chat1Id])

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.chats[0].id).toBe(chat2Id)
      expect(savedState.chats[1].id).toBe(chat1Id)
    })

    it('should handle partial order (missing chats appended at end)', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id
      chatStore.createNewChat()
      const chat3Id = chatStore.chats[2].id

      // Only specify order for chat2 and chat1, chat3 should be appended
      chatStore.reorderChats([chat2Id, chat1Id])

      expect(chatStore.chats[0].id).toBe(chat2Id)
      expect(chatStore.chats[1].id).toBe(chat1Id)
      expect(chatStore.chats[2].id).toBe(chat3Id)
    })

    it('should ignore non-existent chat IDs in order', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id

      chatStore.reorderChats(['nonexistent-id', chat2Id, chat1Id])

      expect(chatStore.chats).toHaveLength(2)
      expect(chatStore.chats[0].id).toBe(chat2Id)
      expect(chatStore.chats[1].id).toBe(chat1Id)
    })

    it('should handle empty order array', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id

      chatStore.reorderChats([])

      // All chats should be appended in original order
      expect(chatStore.chats).toHaveLength(2)
      expect(chatStore.chats[0].id).toBe(chat1Id)
      expect(chatStore.chats[1].id).toBe(chat2Id)
    })

    it('should handle single chat reorder', () => {
      chatStore.createNewChat()
      const chatId = chatStore.chats[0].id

      chatStore.reorderChats([chatId])

      expect(chatStore.chats).toHaveLength(1)
      expect(chatStore.chats[0].id).toBe(chatId)
    })

    it('should preserve chat data after reordering', () => {
      chatStore.createNewChat()
      const chat1Id = chatStore.chats[0].id
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.createNewChat()
      const chat2Id = chatStore.chats[1].id
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      chatStore.reorderChats([chat2Id, chat1Id])

      const chat1 = chatStore.chats.find(c => c.id === chat1Id)
      const chat2 = chatStore.chats.find(c => c.id === chat2Id)
      expect(chat1.rootMessageIds).toContain('msg1')
      expect(chat2.rootMessageIds).toContain('msg2')
    })
  })

  describe('Edge Cases', () => {
    it('should handle creating chat when no current chat exists', () => {
      expect(chatStore.currentChatId).toBeNull()
      expect(chatStore.chats).toHaveLength(0)

      chatStore.createNewChat()

      expect(chatStore.currentChatId).not.toBeNull()
      expect(chatStore.chats).toHaveLength(1)
    })

    it('should handle switching to same chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      chatStore.switchToChat(chatId)

      expect(chatStore.currentChatId).toBe(chatId)
      expect(chatStore.rootMessageIds).toEqual(['msg1'])
    })

    it('should handle empty chat sessions correctly', () => {
      chatStore.createNewChat()
      chatStore.createNewChat()
      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(3)
      chatStore.chats.forEach(chat => {
        expect(chat.rootMessageIds).toEqual([])
      })
    })
  })
})
