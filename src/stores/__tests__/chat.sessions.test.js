import * as storage from '../../services/storage.js'
import { vi } from 'vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import Message from '../Message.js'

describe('useChatStore - Chat Sessions', () => {
  let chatStore
  let saveChatStateSpy
  let loadChatStateSpy

  beforeEach(() => {
    // Mock loadChatState to return null (default state)
    loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockReturnValue(null)

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

  describe('chatList getter', () => {
    it('should return empty array when no chats', () => {
      expect(chatStore.chatList).toEqual([])
    })

    it('should return chat with title from first message', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'First Question', response: 'R1' })

      const chatList = chatStore.chatList
      expect(chatList).toHaveLength(1)
      expect(chatList[0].title).toBe('First Question')
    })

    it('should return "New Chat" for chat without messages', () => {
      chatStore.createNewChat()

      const chatList = chatStore.chatList
      expect(chatList).toHaveLength(1)
      expect(chatList[0].title).toBe('New Chat')
    })

    it('should include all questions in chat', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      const chatList = chatStore.chatList
      expect(chatList[0].questions).toHaveLength(3)
      expect(chatList[0].questions[0].text).toBe('Q1')
      expect(chatList[0].questions[1].text).toBe('Q2')
      expect(chatList[0].questions[2].text).toBe('Q3')
    })

    it('should include question IDs', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      const chatList = chatStore.chatList
      expect(chatList[0].questions[0].id).toBe('msg1')
    })

    it('should include message count', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      const chatList = chatStore.chatList
      expect(chatList[0].messageCount).toBe(2)
    })

    it('should handle multiple chats', () => {
      // Chat 1
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Chat 1 Q1', response: 'R1' })

      // Chat 2
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg2', question: 'Chat 2 Q1', response: 'R2' })

      const chatList = chatStore.chatList
      expect(chatList).toHaveLength(2)
      expect(chatList[0].title).toBe('Chat 1 Q1')
      expect(chatList[1].title).toBe('Chat 2 Q1')
    })

    it('should filter out deleted messages', () => {
      chatStore.createNewChat()
      const chat = chatStore.chats[0]

      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      // Manually remove a message from messagesById but leave ID in rootMessageIds
      delete chatStore.messagesById['msg2']

      const chatList = chatStore.chatList
      expect(chatList[0].questions).toHaveLength(1)
      expect(chatList[0].questions[0].text).toBe('Q1')
    })

    it('should use "Untitled" for messages without question text', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: '', response: 'R1' })

      const chatList = chatStore.chatList
      expect(chatList[0].questions[0].text).toBe('Untitled')
    })

    it('should preserve chat IDs', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      const chatList = chatStore.chatList
      expect(chatList[0].id).toBe(chatId)
    })
  })

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

    it('should restore state with multiple chats', () => {
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

      const loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockReturnValue(savedState)
      setActivePinia(createPinia())
      const store = useChatStore()

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
