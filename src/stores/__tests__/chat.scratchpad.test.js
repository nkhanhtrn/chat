import { ChatStorage } from '../../services/ChatStorage.js'
import { vi } from 'vitest'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'

// Mock ChatStorage
vi.mock('../../services/ChatStorage.js', () => ({
  ChatStorage: {
    saveState: vi.fn(() => Promise.resolve()),
    loadState: vi.fn(() => Promise.resolve(null))
  }
}))

describe('useChatStore - Scratchpad', () => {
  let chatStore
  let saveChatStateSpy
  let loadChatStateSpy

  beforeEach(() => {
    // Mock loadState to return null (default state)
    loadChatStateSpy = vi.spyOn(ChatStorage, 'loadState').mockResolvedValue(null)

    setActivePinia(createPinia())
    chatStore = useChatStore()

    // Explicitly clear state to ensure isolation
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
    chatStore.chats = []
    chatStore.currentChatId = null

    saveChatStateSpy = vi.spyOn(ChatStorage, 'saveState')
  })

  afterEach(() => {
    saveChatStateSpy.mockRestore()
    loadChatStateSpy.mockRestore()
  })

  describe('createNewChat with scratchpad', () => {
    it('should create a new chat with empty scratchpad', () => {
      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(1)
      expect(chatStore.chats[0]).toHaveProperty('scratchpad')
      expect(chatStore.chats[0].scratchpad).toBe('')
    })

    it('should create multiple chats with separate scratchpads', () => {
      chatStore.createNewChat()
      chatStore.createNewChat()
      chatStore.createNewChat()

      expect(chatStore.chats).toHaveLength(3)
      chatStore.chats.forEach(chat => {
        expect(chat).toHaveProperty('scratchpad')
        expect(chat.scratchpad).toBe('')
      })
    })
  })

  describe('updateScratchpad', () => {
    it('should update scratchpad content for current chat', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId

      chatStore.updateScratchpad('My notes here')

      const chat = chatStore.chats.find(c => c.id === chatId)
      expect(chat.scratchpad).toBe('My notes here')
    })

    it('should persist state after updating scratchpad', () => {
      chatStore.createNewChat()

      chatStore.updateScratchpad('Test content')

      expect(saveChatStateSpy).toHaveBeenCalled()
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]
      expect(savedState.chats[0].scratchpad).toBe('Test content')
    })

    it('should handle empty string update', () => {
      chatStore.createNewChat()
      chatStore.updateScratchpad('Some content')
      chatStore.updateScratchpad('')

      const chat = chatStore.chats.find(c => c.id === chatStore.currentChatId)
      expect(chat.scratchpad).toBe('')
    })

    it('should handle multiline content', () => {
      chatStore.createNewChat()
      const multilineContent = 'Line 1\nLine 2\nLine 3'

      chatStore.updateScratchpad(multilineContent)

      const chat = chatStore.chats.find(c => c.id === chatStore.currentChatId)
      expect(chat.scratchpad).toBe(multilineContent)
    })

    it('should handle special characters', () => {
      chatStore.createNewChat()
      const specialContent = '<script>alert("test")</script> & "quotes" \'apostrophes\''

      chatStore.updateScratchpad(specialContent)

      const chat = chatStore.chats.find(c => c.id === chatStore.currentChatId)
      expect(chat.scratchpad).toBe(specialContent)
    })

    it('should do nothing when currentChatId is null', () => {
      chatStore.currentChatId = null

      // Should not throw error
      chatStore.updateScratchpad('Test')

      expect(saveChatStateSpy).not.toHaveBeenCalled()
    })

    it('should do nothing when chat does not exist', () => {
      chatStore.createNewChat()
      chatStore.currentChatId = 'nonexistent-id'

      // Should not throw error
      chatStore.updateScratchpad('Test')
    })
  })

  describe('currentScratchpad getter', () => {
    it('should return empty string when no current chat', () => {
      expect(chatStore.currentScratchpad).toBe('')
    })

    it('should return empty string for new chat', () => {
      chatStore.createNewChat()

      expect(chatStore.currentScratchpad).toBe('')
    })

    it('should return scratchpad content for current chat', () => {
      chatStore.createNewChat()
      chatStore.updateScratchpad('My notes')

      expect(chatStore.currentScratchpad).toBe('My notes')
    })

    it('should return correct scratchpad after switching chats', () => {
      // Create chat 1 with scratchpad
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.updateScratchpad('Chat 1 notes')

      // Create chat 2 with different scratchpad
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.updateScratchpad('Chat 2 notes')

      // Verify current is chat 2
      expect(chatStore.currentScratchpad).toBe('Chat 2 notes')

      // Switch to chat 1
      chatStore.switchToChat(chat1Id)
      expect(chatStore.currentScratchpad).toBe('Chat 1 notes')

      // Switch back to chat 2
      chatStore.switchToChat(chat2Id)
      expect(chatStore.currentScratchpad).toBe('Chat 2 notes')
    })

    it('should return empty string when currentChatId does not match any chat', () => {
      chatStore.createNewChat()
      chatStore.currentChatId = 'nonexistent-id'

      expect(chatStore.currentScratchpad).toBe('')
    })
  })

  describe('Scratchpad persistence across chat switches', () => {
    it('should preserve scratchpad when switching between chats', () => {
      // Create and setup chat 1
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.updateScratchpad('Notes for chat 1')

      // Create and setup chat 2
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.updateScratchpad('Notes for chat 2')

      // Switch back and forth
      chatStore.switchToChat(chat1Id)
      expect(chatStore.currentScratchpad).toBe('Notes for chat 1')

      chatStore.switchToChat(chat2Id)
      expect(chatStore.currentScratchpad).toBe('Notes for chat 2')

      chatStore.switchToChat(chat1Id)
      expect(chatStore.currentScratchpad).toBe('Notes for chat 1')
    })

    it('should maintain scratchpad when adding messages to chat', () => {
      chatStore.createNewChat()
      chatStore.updateScratchpad('My notes')
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      expect(chatStore.currentScratchpad).toBe('My notes')

      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      expect(chatStore.currentScratchpad).toBe('My notes')
    })

    it('should maintain scratchpad when navigating between messages', () => {
      chatStore.createNewChat()
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addChildMessage('msg1', { id: 'child1', question: 'C1', response: 'RC1' })
      chatStore.updateScratchpad('My notes')

      // Navigate to child
      chatStore.navigateToMessage('child1')
      expect(chatStore.currentScratchpad).toBe('My notes')

      // Navigate back to parent
      chatStore.navigateToMessage('msg1')
      expect(chatStore.currentScratchpad).toBe('My notes')
    })
  })

  describe('Scratchpad with chat deletion', () => {
    it('should remove scratchpad when chat is deleted', () => {
      chatStore.createNewChat()
      const chatId = chatStore.currentChatId
      chatStore.updateScratchpad('Some notes')

      chatStore.deleteChat(chatId)

      // Old chat should not exist
      const oldChat = chatStore.chats.find(c => c.id === chatId)
      expect(oldChat).toBeUndefined()
    })

    it('should preserve other chats scratchpads when one chat is deleted', () => {
      // Create chat 1
      chatStore.createNewChat()
      const chat1Id = chatStore.currentChatId
      chatStore.updateScratchpad('Chat 1 notes')

      // Create chat 2
      chatStore.createNewChat()
      const chat2Id = chatStore.currentChatId
      chatStore.updateScratchpad('Chat 2 notes')

      // Delete chat 2
      chatStore.deleteChat(chat2Id)

      // Chat 1 should still have its scratchpad
      chatStore.switchToChat(chat1Id)
      expect(chatStore.currentScratchpad).toBe('Chat 1 notes')
    })
  })

  describe('Scratchpad state restoration', () => {
    it('should restore scratchpad from saved state', async () => {
      const savedState = {
        messagesById: {
          'msg1': { id: 'msg1', question: 'Q1', response: 'R1', parentId: null, childIds: [] }
        },
        rootMessageIds: ['msg1'],
        currentMessageId: 'msg1',
        currentModel: 'gpt-4',
        chats: [
          { id: 'chat1', rootMessageIds: ['msg1'], scratchpad: 'Restored notes' }
        ],
        currentChatId: 'chat1'
      }

      loadChatStateSpy.mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
      const store = useChatStore()
      await store.initializeStore()

      expect(store.currentScratchpad).toBe('Restored notes')

      loadChatStateSpy.mockRestore()
    })

    it('should handle restored state with missing scratchpad property', async () => {
      const savedState = {
        messagesById: {},
        rootMessageIds: [],
        currentMessageId: null,
        currentModel: null,
        chats: [
          { id: 'chat1', rootMessageIds: [] }  // No scratchpad property
        ],
        currentChatId: 'chat1'
      }

      loadChatStateSpy.mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
      const store = useChatStore()
      await store.initializeStore()

      // Should return empty string (falsy value)
      expect(store.currentScratchpad).toBe('')

      loadChatStateSpy.mockRestore()
    })

    it('should restore multiple chats with different scratchpads', async () => {
      const savedState = {
        messagesById: {
          'msg1': { id: 'msg1', question: 'Q1', response: 'R1', parentId: null, childIds: [] },
          'msg2': { id: 'msg2', question: 'Q2', response: 'R2', parentId: null, childIds: [] }
        },
        rootMessageIds: ['msg1'],
        currentMessageId: 'msg1',
        currentModel: 'gpt-4',
        chats: [
          { id: 'chat1', rootMessageIds: ['msg1'], scratchpad: 'Chat 1 notes' },
          { id: 'chat2', rootMessageIds: ['msg2'], scratchpad: 'Chat 2 notes' }
        ],
        currentChatId: 'chat1'
      }

      loadChatStateSpy.mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
      const store = useChatStore()
      await store.initializeStore()

      expect(store.currentScratchpad).toBe('Chat 1 notes')

      store.switchToChat('chat2')
      expect(store.currentScratchpad).toBe('Chat 2 notes')

      loadChatStateSpy.mockRestore()
    })
  })

  describe('Edge cases', () => {
    it('should handle very long scratchpad content', () => {
      chatStore.createNewChat()
      const longContent = 'a'.repeat(100000)

      chatStore.updateScratchpad(longContent)

      expect(chatStore.currentScratchpad).toBe(longContent)
      expect(chatStore.currentScratchpad).toHaveLength(100000)
    })

    it('should handle unicode characters in scratchpad', () => {
      chatStore.createNewChat()
      const unicodeContent = '你好世界 🌍 Привет мир 日本語'

      chatStore.updateScratchpad(unicodeContent)

      expect(chatStore.currentScratchpad).toBe(unicodeContent)
    })

    it('should handle rapid updates to scratchpad', () => {
      chatStore.createNewChat()

      for (let i = 0; i < 100; i++) {
        chatStore.updateScratchpad(`Update ${i}`)
      }

      expect(chatStore.currentScratchpad).toBe('Update 99')
    })
  })
})
