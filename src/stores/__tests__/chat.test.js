import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import Message from '../Message.js'

describe('useChatStore', () => {
  let chatStore

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
  })

  describe('removeRootMessage', () => {
    it('should remove a root message without children', () => {
      const msg = chatStore.addRootMessage({
        id: 'root1',
        question: 'Test question',
        response: 'Test response'
      })

      expect(chatStore.rootMessageIds).toContain('root1')
      expect(chatStore.messagesById['root1']).toBeDefined()

      chatStore.removeRootMessage(msg.id)

      expect(chatStore.rootMessageIds).not.toContain('root1')
      expect(chatStore.messagesById['root1']).toBeUndefined()
    })

    it('should remove a root message and all its children', () => {
      const rootMsg = chatStore.addRootMessage({
        id: 'root',
        question: 'Root question',
        response: 'Root response'
      })

      const child1 = chatStore.addChildMessage('root', {
        id: 'child1',
        question: 'Child 1',
        response: 'Child response 1'
      })

      const child2 = chatStore.addChildMessage('child1', {
        id: 'child2',
        question: 'Child 2',
        response: 'Child response 2'
      })

      expect(chatStore.messagesById['root']).toBeDefined()
      expect(chatStore.messagesById['child1']).toBeDefined()
      expect(chatStore.messagesById['child2']).toBeDefined()

      chatStore.removeRootMessage('root')

      expect(chatStore.messagesById['root']).toBeUndefined()
      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['child2']).toBeUndefined()
      expect(chatStore.rootMessageIds).not.toContain('root')
    })

    it('should clear currentMessageId if the removed message was current', () => {
      const msg = chatStore.addRootMessage({
        id: 'root1',
        question: 'Test',
        response: 'Response'
      })

      expect(chatStore.currentMessageId).toBe('root1')

      chatStore.removeRootMessage('root1')

      expect(chatStore.currentMessageId).toBeNull()
    })

    it('should not clear currentMessageId if a different message was removed', () => {
      chatStore.addRootMessage({
        id: 'root1',
        question: 'Test 1',
        response: 'Response 1'
      })

      chatStore.addRootMessage({
        id: 'root2',
        question: 'Test 2',
        response: 'Response 2'
      })

      expect(chatStore.currentMessageId).toBe('root2')

      chatStore.removeRootMessage('root1')

      expect(chatStore.currentMessageId).toBe('root2')
    })

    it('should do nothing if message ID does not exist', () => {
      chatStore.addRootMessage({
        id: 'root1',
        question: 'Test',
        response: 'Response'
      })

      const originalRootIds = [...chatStore.rootMessageIds]
      const originalMessagesCount = Object.keys(chatStore.messagesById).length

      chatStore.removeRootMessage('nonexistent')

      expect(chatStore.rootMessageIds).toEqual(originalRootIds)
      expect(Object.keys(chatStore.messagesById).length).toBe(originalMessagesCount)
    })

    it('should handle removing message with multiple children', () => {
      const root = chatStore.addRootMessage({
        id: 'root',
        question: 'Root',
        response: 'Root response'
      })

      chatStore.addChildMessage('root', {
        id: 'child1',
        question: 'Child 1',
        response: ''
      })

      chatStore.navigateToMessage('root')

      chatStore.addChildMessage('root', {
        id: 'child2',
        question: 'Child 2',
        response: ''
      })

      expect(chatStore.messagesById['root'].childIds).toHaveLength(2)
      expect(chatStore.messagesById['child1']).toBeDefined()
      expect(chatStore.messagesById['child2']).toBeDefined()

      chatStore.removeRootMessage('root')

      expect(chatStore.messagesById['root']).toBeUndefined()
      expect(chatStore.messagesById['child1']).toBeUndefined()
      expect(chatStore.messagesById['child2']).toBeUndefined()
    })

    it('should remove message from correct position in rootMessageIds array', () => {
      chatStore.addRootMessage({ id: 'root1', question: 'Q1', response: 'R1' })
      chatStore.addRootMessage({ id: 'root2', question: 'Q2', response: 'R2' })
      chatStore.addRootMessage({ id: 'root3', question: 'Q3', response: 'R3' })

      expect(chatStore.rootMessageIds).toEqual(['root1', 'root2', 'root3'])

      chatStore.removeRootMessage('root2')

      expect(chatStore.rootMessageIds).toEqual(['root1', 'root3'])
      expect(chatStore.messagesById['root1']).toBeDefined()
      expect(chatStore.messagesById['root2']).toBeUndefined()
      expect(chatStore.messagesById['root3']).toBeDefined()
    })
  })

  describe('_removeMessageTree', () => {
    it('should recursively remove nested children', () => {
      chatStore.addRootMessage({ id: 'root', question: 'Root', response: 'R' })
      chatStore.addChildMessage('root', { id: 'c1', question: 'C1', response: '' })
      chatStore.addChildMessage('c1', { id: 'c2', question: 'C2', response: '' })
      chatStore.addChildMessage('c2', { id: 'c3', question: 'C3', response: '' })

      expect(Object.keys(chatStore.messagesById)).toHaveLength(4)

      chatStore._removeMessageTree('root')

      expect(chatStore.messagesById['root']).toBeUndefined()
      expect(chatStore.messagesById['c1']).toBeUndefined()
      expect(chatStore.messagesById['c2']).toBeUndefined()
      expect(chatStore.messagesById['c3']).toBeUndefined()
    })

    it('should handle removing non-existent message gracefully', () => {
      chatStore.addRootMessage({ id: 'root', question: 'Root', response: 'R' })

      chatStore._removeMessageTree('nonexistent')

      expect(chatStore.messagesById['root']).toBeDefined()
    })
  })
})
