import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'

describe('root message navigation', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
    chatStore.currentRootIndex = 0
  })

  describe('currentRootIndex state', () => {
    it('should initialize to 0', () => {
      expect(chatStore.currentRootIndex).toBe(0)
    })

    it('should update to last index when adding a root message', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      expect(chatStore.currentRootIndex).toBe(0)

      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      expect(chatStore.currentRootIndex).toBe(1)

      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })
      expect(chatStore.currentRootIndex).toBe(2)
    })
  })

  describe('currentRootMessage getter', () => {
    it('should return null when no root messages exist', () => {
      expect(chatStore.currentRootMessage).toBeNull()
    })

    it('should return the first root message when index is 0', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentRootIndex = 0

      expect(chatStore.currentRootMessage.id).toBe('msg1')
    })

    it('should return the correct root message based on index', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      chatStore.currentRootIndex = 1
      expect(chatStore.currentRootMessage.id).toBe('msg2')

      chatStore.currentRootIndex = 2
      expect(chatStore.currentRootMessage.id).toBe('msg3')
    })
  })

  describe('canGoToPrevRoot getter', () => {
    it('should return false when index is 0', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.currentRootIndex = 0

      expect(chatStore.canGoToPrevRoot).toBe(false)
    })

    it('should return true when index is greater than 0', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentRootIndex = 1

      expect(chatStore.canGoToPrevRoot).toBe(true)
    })
  })

  describe('canGoToNextRoot getter', () => {
    it('should return false when at last message', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentRootIndex = 1

      expect(chatStore.canGoToNextRoot).toBe(false)
    })

    it('should return true when not at last message', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.currentRootIndex = 0

      expect(chatStore.canGoToNextRoot).toBe(true)
    })

    it('should return false when only one message exists', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.currentRootIndex = 0

      expect(chatStore.canGoToNextRoot).toBe(false)
    })
  })

  describe('goToPrevRoot action', () => {
    it('should decrement currentRootIndex', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      expect(chatStore.currentRootIndex).toBe(2)

      chatStore.goToPrevRoot()
      expect(chatStore.currentRootIndex).toBe(1)

      chatStore.goToPrevRoot()
      expect(chatStore.currentRootIndex).toBe(0)
    })

    it('should not go below 0', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.currentRootIndex = 0

      chatStore.goToPrevRoot()
      expect(chatStore.currentRootIndex).toBe(0)
    })
  })

  describe('goToNextRoot action', () => {
    it('should increment currentRootIndex', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })
      chatStore.currentRootIndex = 0

      chatStore.goToNextRoot()
      expect(chatStore.currentRootIndex).toBe(1)

      chatStore.goToNextRoot()
      expect(chatStore.currentRootIndex).toBe(2)
    })

    it('should not go beyond last index', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      expect(chatStore.currentRootIndex).toBe(1)

      chatStore.goToNextRoot()
      expect(chatStore.currentRootIndex).toBe(1)
    })
  })

  describe('removeRootMessage adjusts currentRootIndex', () => {
    it('should adjust index when removing message before current', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      expect(chatStore.currentRootIndex).toBe(2)

      chatStore.removeRootMessage('msg1')

      // Index should still be valid, pointing to msg3
      expect(chatStore.currentRootIndex).toBe(1)
      expect(chatStore.rootMessageIds).toEqual(['msg2', 'msg3'])
    })

    it('should adjust index when removing last message while viewing it', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })

      expect(chatStore.currentRootIndex).toBe(1)

      chatStore.removeRootMessage('msg2')

      expect(chatStore.currentRootIndex).toBe(0)
      expect(chatStore.rootMessageIds).toEqual(['msg1'])
    })

    it('should set index to 0 when removing the only message', () => {
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })

      expect(chatStore.currentRootIndex).toBe(0)

      chatStore.removeRootMessage('msg1')

      expect(chatStore.currentRootIndex).toBe(0)
      expect(chatStore.rootMessageIds).toEqual([])
    })
  })

  describe('switchToChat resets currentRootIndex', () => {
    it('should reset index to 0 when switching chats', () => {
      // Create first chat with messages
      chatStore.createNewChat()
      const firstChatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'msg2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'msg3', question: 'Q3', response: 'R3' })

      expect(chatStore.currentRootIndex).toBe(2)

      // Create second chat
      chatStore.createNewChat()
      const secondChatId = chatStore.currentChatId
      chatStore.addRootMessage({ id: 'msg4', question: 'Q4', response: 'R4' })

      // Switch back to first chat
      chatStore.switchToChat(firstChatId)

      expect(chatStore.currentRootIndex).toBe(0)
    })
  })
})
