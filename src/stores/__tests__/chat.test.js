import * as storage from '../../services/storage.js'
import { vi } from 'vitest'
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useChatStore } from '../chat.js'
import Message from '../Message.js'

describe('useChatStore', () => {
  let chatStore

  describe('state restoration', () => {
    const savedState = {
      messagesById: {
        msg1: { id: 'msg1', question: 'Q1', response: 'R1', parentId: null, childIds: [] },
        msg2: { id: 'msg2', question: 'Q2', response: 'R2', parentId: 'msg1', childIds: [] }
      },
      rootMessageIds: ['msg1'],
      currentMessageId: 'msg1',
      currentModel: 'gpt-4'
    }

    let loadChatStateSpy
    beforeEach(() => {
      loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockReturnValue(savedState)
      setActivePinia(createPinia())
    })
    afterEach(() => {
      loadChatStateSpy.mockRestore()
    })

    it('restores state and reconstructs Message objects', () => {
      const store = useChatStore()
      expect(store.messagesById.msg1).toBeInstanceOf(Message)
      expect(store.messagesById.msg2).toBeInstanceOf(Message)
      expect(store.rootMessageIds).toEqual(['msg1'])
      expect(store.currentMessageId).toBe('msg1')
      expect(store.currentModel).toBe('gpt-4')
      expect(store.messagesById.msg1.question).toBe('Q1')
      expect(store.messagesById.msg2.parentId).toBe('msg1')
    })

    it('restores all Message properties including questionSummarized and lastVisitedChild', () => {
      const savedStateWithAllProps = {
        messagesById: {
          msg1: {
            id: 'msg1',
            question: 'This is a very long question that exceeds one hundred characters and should have been truncated',
            questionSummarized: 'Custom summary for msg1',
            response: 'R1',
            parentId: null,
            childIds: ['msg2', 'msg3'],
            highlightedText: 'some text',
            lastVisitedChild: 'msg2'
          },
          msg2: {
            id: 'msg2',
            question: 'Q2',
            questionSummarized: 'Q2 summary',
            response: 'R2',
            parentId: 'msg1',
            childIds: [],
            highlightedText: null,
            lastVisitedChild: null
          },
          msg3: {
            id: 'msg3',
            question: 'Q3',
            questionSummarized: 'Q3',
            response: 'R3',
            parentId: 'msg1',
            childIds: [],
            highlightedText: 'highlighted',
            lastVisitedChild: null
          }
        },
        rootMessageIds: ['msg1'],
        currentMessageId: 'msg1',
        currentModel: 'gpt-4'
      }

      loadChatStateSpy.mockReturnValue(savedStateWithAllProps)
      const store = useChatStore()

      // Verify msg1 has all properties restored
      expect(store.messagesById.msg1.questionSummarized).toBe('Custom summary for msg1')
      expect(store.messagesById.msg1.lastVisitedChild).toBe('msg2')
      expect(store.messagesById.msg1.highlightedText).toBe('some text')
      expect(store.messagesById.msg1.childIds).toEqual(['msg2', 'msg3'])

      // Verify msg2 has all properties restored
      expect(store.messagesById.msg2.questionSummarized).toBe('Q2 summary')
      expect(store.messagesById.msg2.lastVisitedChild).toBe(null)
      expect(store.messagesById.msg2.highlightedText).toBe(null)

      // Verify msg3 has all properties restored
      expect(store.messagesById.msg3.questionSummarized).toBe('Q3')
      expect(store.messagesById.msg3.highlightedText).toBe('highlighted')
    })
  })

  beforeEach(() => {
    setActivePinia(createPinia())
    chatStore = useChatStore()
    // Explicitly clear state to avoid leakage between tests
    chatStore.messagesById = {}
    chatStore.rootMessageIds = []
    chatStore.currentMessageId = null
  })

  // ...getters tests moved to chat.getters.test.js...

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

  describe('addChildMessage', () => {
    it('should throw error when parent message is not found', () => {
      expect(() => {
        chatStore.addChildMessage('nonexistent-parent', {
          id: 'child1',
          question: 'Child question',
          response: 'Child response'
        })
      }).toThrow('Parent message nonexistent-parent not found')
    })
  })

  describe('setError', () => {
    it('should set error state', () => {
      expect(chatStore.error).toBeNull()

      chatStore.setError('Test error message')

      expect(chatStore.error).toBe('Test error message')
    })

    it('should clear error state when set to null', () => {
      chatStore.setError('Error message')
      expect(chatStore.error).toBe('Error message')

      chatStore.setError(null)

      expect(chatStore.error).toBeNull()
    })
  })

  describe('End-to-end persistence of all Message properties', () => {
    let saveChatStateSpy

    beforeEach(() => {
      saveChatStateSpy = vi.spyOn(storage, 'saveChatState')
    })

    afterEach(() => {
      saveChatStateSpy.mockRestore()
    })

    it('persists questionSummarized when updated', () => {
      chatStore.addRootMessage({
        id: 'root1',
        question: 'This is a very long question that exceeds one hundred characters and will be truncated by default',
        response: 'Test response'
      })

      // Update the questionSummarized
      chatStore.setQuestionSummarized('root1', 'Custom Summary')

      // Verify _persistState was called
      expect(saveChatStateSpy).toHaveBeenCalled()

      // Get the last call's argument
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]

      // Verify the custom summary is in the persisted state
      expect(savedState.messagesById.root1.questionSummarized).toBe('Custom Summary')
    })

    it('persists lastVisitedChild when navigating to a child', () => {
      chatStore.addRootMessage({
        id: 'root',
        question: 'Root question',
        response: 'Root response'
      })

      chatStore.addChildMessage('root', {
        id: 'child1',
        question: 'Child 1',
        response: 'Child 1 response'
      })

      chatStore.navigateToMessage('root')

      chatStore.addChildMessage('root', {
        id: 'child2',
        question: 'Child 2',
        response: 'Child 2 response'
      })

      // Navigate to child1
      chatStore.navigateToChild('root', 0)

      // Verify _persistState was called
      expect(saveChatStateSpy).toHaveBeenCalled()

      // Get the last call's argument
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]

      // Verify lastVisitedChild is persisted
      expect(savedState.messagesById.root.lastVisitedChild).toBe('child1')
    })

    it('persists all Message properties including highlightedText', () => {
      const msgData = {
        id: 'msg1',
        question: 'What is this highlighted text about?',
        response: '',
        highlightedText: 'This is some highlighted text from the parent message'
      }

      chatStore.addRootMessage(msgData)

      // Verify _persistState was called
      expect(saveChatStateSpy).toHaveBeenCalled()

      // Get the last call's argument
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]

      // Verify all properties are persisted
      expect(savedState.messagesById.msg1.id).toBe(msgData.id)
      expect(savedState.messagesById.msg1.question).toBe(msgData.question)
      expect(savedState.messagesById.msg1.response).toBe(msgData.response)
      expect(savedState.messagesById.msg1.highlightedText).toBe(msgData.highlightedText)
      expect(savedState.messagesById.msg1.childIds).toEqual([])
      expect(savedState.messagesById.msg1.parentId).toBe(null)
    })

    it('persists complete message tree with all properties', () => {
      // Create a complex tree structure
      chatStore.addRootMessage({
        id: 'root',
        question: 'Root question that is quite long and will be auto-summarized unless we provide a custom summary',
        response: 'Root response'
      })

      chatStore.setQuestionSummarized('root', 'Root summary')

      chatStore.addChildMessage('root', {
        id: 'child1',
        question: 'Child 1 question',
        response: 'Child 1 response',
        parentId: 'root',
        highlightedText: 'highlighted from root'
      })

      chatStore.navigateToMessage('root')
      chatStore.addChildMessage('root', {
        id: 'child2',
        question: 'Child 2 question',
        response: 'Child 2 response',
        parentId: 'root'
      })

      // Navigate to child1 to set lastVisitedChild
      chatStore.navigateToChild('root', 0)

      // Get the final persisted state
      const savedState = saveChatStateSpy.mock.calls[saveChatStateSpy.mock.calls.length - 1][0]

      // Verify root message has all properties
      expect(savedState.messagesById.root.questionSummarized).toBe('Root summary')
      expect(savedState.messagesById.root.childIds).toEqual(['child1', 'child2'])
      expect(savedState.messagesById.root.lastVisitedChild).toBe('child1')

      // Verify child1 has all properties
      expect(savedState.messagesById.child1.parentId).toBe('root')
      expect(savedState.messagesById.child1.highlightedText).toBe('highlighted from root')
      expect(savedState.messagesById.child1.questionSummarized).toBe('Child 1 question')

      // Verify child2 has all properties
      expect(savedState.messagesById.child2.parentId).toBe('root')
      expect(savedState.messagesById.child2.highlightedText).toBe(null)
    })
  })

  describe('Custom content actions', () => {
    it('addCustomContent adds content to a message', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      const highlight = {
        id: 'h1',
        type: 'highlight',
        text: 'test',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 4
      }

      const resultId = chatStore.addCustomContent('msg1', highlight)

      expect(resultId).toBe('h1')
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)
      expect(chatStore.messagesById.msg1.customContent[0]).toEqual(highlight)
    })

    it('addCustomContent initializes customContent array if missing', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      // Ensure no customContent exists
      chatStore.messagesById.msg1.customContent = undefined

      chatStore.addCustomContent('msg1', { id: 'h1', type: 'highlight' })

      expect(Array.isArray(chatStore.messagesById.msg1.customContent)).toBe(true)
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)
    })

    it('addCustomContent returns null for non-existent message', () => {
      const result = chatStore.addCustomContent('nonexistent', { id: 'h1' })
      expect(result).toBe(null)
    })

    it('removeCustomContent removes content by ID', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      chatStore.addCustomContent('msg1', { id: 'h1', type: 'highlight' })
      chatStore.addCustomContent('msg1', { id: 'h2', type: 'highlight' })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(2)

      chatStore.removeCustomContent('msg1', 'h1')

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)
      expect(chatStore.messagesById.msg1.customContent[0].id).toBe('h2')
    })

    it('removeCustomContent does nothing for non-existent content', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      chatStore.addCustomContent('msg1', { id: 'h1', type: 'highlight' })

      chatStore.removeCustomContent('msg1', 'nonexistent')

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)
    })

    it('removeCustomContent does nothing for non-existent message', () => {
      expect(() => chatStore.removeCustomContent('nonexistent', 'h1')).not.toThrow()
    })

    it('updateCustomContent updates content properties', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      chatStore.addCustomContent('msg1', { id: 'h1', type: 'highlight', colorIndex: 0 })

      chatStore.updateCustomContent('msg1', 'h1', { colorIndex: 2 })

      expect(chatStore.messagesById.msg1.customContent[0].colorIndex).toBe(2)
    })

    it('updateCustomContent does nothing for non-existent content', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Response'
      })

      chatStore.addCustomContent('msg1', { id: 'h1', colorIndex: 0 })

      chatStore.updateCustomContent('msg1', 'nonexistent', { colorIndex: 2 })

      expect(chatStore.messagesById.msg1.customContent[0].colorIndex).toBe(0)
    })

    it('updateCustomContent does nothing for non-existent message', () => {
      expect(() => chatStore.updateCustomContent('nonexistent', 'h1', { colorIndex: 2 })).not.toThrow()
    })
  })
})
