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
      loadChatStateSpy = vi.spyOn(storage, 'loadChatState').mockResolvedValue({ hasConflict: false, state: savedState })
      setActivePinia(createPinia())
    })
    afterEach(() => {
      loadChatStateSpy.mockRestore()
    })

    it('restores state and reconstructs Message objects', async () => {
      const store = useChatStore()
      await store.initializeStore()
      expect(store.messagesById.msg1).toBeInstanceOf(Message)
      expect(store.messagesById.msg2).toBeInstanceOf(Message)
      expect(store.rootMessageIds).toEqual(['msg1'])
      expect(store.currentMessageId).toBe('msg1')
      expect(store.currentModel).toBe('gpt-4')
      expect(store.messagesById.msg1.question).toBe('Q1')
      expect(store.messagesById.msg2.parentId).toBe('msg1')
    })

    it('restores all Message properties including questionSummarized and lastVisitedChild', async () => {
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

      loadChatStateSpy.mockResolvedValue({ hasConflict: false, state: savedStateWithAllProps })
      const store = useChatStore()
      await store.initializeStore()

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

  describe('Streaming control', () => {
    it('startStreaming should set isStreaming to true and create AbortController', () => {
      expect(chatStore.isStreaming).toBe(false)
      expect(chatStore.streamAbortController).toBeNull()

      const signal = chatStore.startStreaming()

      expect(chatStore.isStreaming).toBe(true)
      expect(chatStore.streamAbortController).toBeInstanceOf(AbortController)
      expect(signal).toBe(chatStore.streamAbortController.signal)
    })

    it('startStreaming should return the abort signal', () => {
      const signal = chatStore.startStreaming()

      expect(signal).toBeDefined()
      expect(signal.aborted).toBe(false)
    })

    it('stopStreaming should set isStreaming to false and abort the controller', () => {
      chatStore.startStreaming()
      const controller = chatStore.streamAbortController

      expect(chatStore.isStreaming).toBe(true)
      expect(controller.signal.aborted).toBe(false)

      chatStore.stopStreaming()

      expect(chatStore.isStreaming).toBe(false)
      expect(chatStore.streamAbortController).toBeNull()
      expect(controller.signal.aborted).toBe(true)
    })

    it('stopStreaming should handle case when no streaming is active', () => {
      expect(chatStore.isStreaming).toBe(false)
      expect(chatStore.streamAbortController).toBeNull()

      // Should not throw
      chatStore.stopStreaming()

      expect(chatStore.isStreaming).toBe(false)
      expect(chatStore.streamAbortController).toBeNull()
    })

    it('setIsStreaming should clear streamAbortController when set to false', () => {
      chatStore.startStreaming()
      expect(chatStore.streamAbortController).not.toBeNull()

      chatStore.setIsStreaming(false)

      expect(chatStore.isStreaming).toBe(false)
      expect(chatStore.streamAbortController).toBeNull()
    })

    it('setIsStreaming(true) should set isStreaming without creating controller', () => {
      chatStore.setIsStreaming(true)

      expect(chatStore.isStreaming).toBe(true)
      expect(chatStore.streamAbortController).toBeNull()
    })

    it('multiple startStreaming calls should create new controllers', () => {
      const signal1 = chatStore.startStreaming()
      const controller1 = chatStore.streamAbortController

      const signal2 = chatStore.startStreaming()
      const controller2 = chatStore.streamAbortController

      expect(controller1).not.toBe(controller2)
      expect(signal1).not.toBe(signal2)
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

    it('addCustomContent creates backlink on target message for question-link', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Source',
        response: 'Response with link'
      })
      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Target',
        response: 'Target response'
      })

      chatStore.addCustomContent('msg1', {
        id: 'link1',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'msg2',
        startOffset: 14,
        endOffset: 18
      })

      // Target message should have a backlink
      expect(chatStore.messagesById.msg2.linkedFrom).toHaveLength(1)
      expect(chatStore.messagesById.msg2.linkedFrom[0]).toEqual({
        sourceMessageId: 'msg1',
        linkId: 'link1'
      })
    })

    it('addCustomContent does not create backlink for non-question-link content', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Source',
        response: 'Response'
      })
      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Target',
        response: 'Target response'
      })

      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'highlight',
        startOffset: 0,
        endOffset: 8
      })

      // No backlink should be created for highlights
      expect(chatStore.messagesById.msg2.linkedFrom).toBeUndefined()
    })

    it('removeCustomContent removes backlink from target message for question-link', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Source',
        response: 'Response with link'
      })
      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Target',
        response: 'Target response'
      })

      chatStore.addCustomContent('msg1', {
        id: 'link1',
        type: 'question-link',
        text: 'link',
        targetMessageId: 'msg2',
        startOffset: 14,
        endOffset: 18
      })

      expect(chatStore.messagesById.msg2.linkedFrom).toHaveLength(1)

      chatStore.removeCustomContent('msg1', 'link1')

      // Backlink should be removed
      expect(chatStore.messagesById.msg2.linkedFrom).toHaveLength(0)
    })

    it('removeCustomContent handles multiple backlinks correctly', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Source 1',
        response: 'Response one'
      })
      chatStore.addRootMessage({
        id: 'msg2',
        question: 'Source 2',
        response: 'Response two'
      })
      chatStore.addRootMessage({
        id: 'msg3',
        question: 'Target',
        response: 'Target response'
      })

      // Add two links pointing to msg3
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

      expect(chatStore.messagesById.msg3.linkedFrom).toHaveLength(2)

      // Remove one link
      chatStore.removeCustomContent('msg1', 'link1')

      // Only one backlink should remain
      expect(chatStore.messagesById.msg3.linkedFrom).toHaveLength(1)
      expect(chatStore.messagesById.msg3.linkedFrom[0]).toEqual({
        sourceMessageId: 'msg2',
        linkId: 'link2'
      })
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

  describe('Highlight merging on overlap', () => {
    it('merges overlapping highlights into one with expanded range', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add first highlight: "world" (6-11)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11
      })

      // Add overlapping highlight: "world this" (6-16) - overlaps with h1
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'world this',
        colorIndex: 1,
        startOffset: 6,
        endOffset: 16
      })

      // Should have only 1 highlight after merge
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.startOffset).toBe(6)
      expect(merged.endOffset).toBe(16)
      expect(merged.text).toBe('world this')
    })

    it('merges highlight that extends before existing highlight', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add first highlight: "world" (6-11)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11
      })

      // Add highlight that starts before: "Hello world" (0-11)
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'Hello world',
        colorIndex: 1,
        startOffset: 0,
        endOffset: 11
      })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.startOffset).toBe(0)
      expect(merged.endOffset).toBe(11)
      expect(merged.text).toBe('Hello world')
    })

    it('merges highlight that extends both before and after existing', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add first highlight: "world" (6-11)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11
      })

      // Add highlight that encompasses: "Hello world this" (0-16)
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'Hello world this',
        colorIndex: 1,
        startOffset: 0,
        endOffset: 16
      })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.startOffset).toBe(0)
      expect(merged.endOffset).toBe(16)
      expect(merged.text).toBe('Hello world this')
    })

    it('merges multiple overlapping highlights into one', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add "Hello" (0-5)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'Hello',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 5
      })

      // Add "this is" (12-19)
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'this is',
        colorIndex: 0,
        startOffset: 12,
        endOffset: 19
      })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(2)

      // Add highlight that spans both: "Hello world this is" (0-19)
      chatStore.addCustomContent('msg1', {
        id: 'h3',
        type: 'highlight',
        text: 'Hello world this is',
        colorIndex: 2,
        startOffset: 0,
        endOffset: 19
      })

      // Should merge all three into one
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.startOffset).toBe(0)
      expect(merged.endOffset).toBe(19)
    })

    it('does not merge non-overlapping highlights', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add "Hello" (0-5)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'Hello',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 5
      })

      // Add "test" (22-26) - not overlapping
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'test',
        colorIndex: 1,
        startOffset: 22,
        endOffset: 26
      })

      // Should have 2 separate highlights
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(2)
    })

    it('merges adjacent highlights (touching at boundary)', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world'
      })

      // Add "Hello" (0-5)
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'Hello',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 5
      })

      // Add " world" (5-11) - adjacent, not overlapping
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: ' world',
        colorIndex: 1,
        startOffset: 5,
        endOffset: 11
      })

      // Adjacent highlights should NOT merge (endOffset === startOffset is not overlap)
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(2)
    })

    it('combines notes when merging highlights with notes', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add highlight with note
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11,
        hasNote: true,
        noteContent: 'Note 1'
      })

      // Add overlapping highlight with another note
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'world this',
        colorIndex: 1,
        startOffset: 6,
        endOffset: 16,
        hasNote: true,
        noteContent: 'Note 2'
      })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.hasNote).toBe(true)
      expect(merged.noteContent).toContain('Note 1')
      expect(merged.noteContent).toContain('Note 2')
      expect(merged.noteContent).toContain('---') // separator
    })

    it('preserves note from existing highlight when new highlight has no note', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add highlight with note
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 11,
        hasNote: true,
        noteContent: 'Existing note'
      })

      // Add overlapping highlight without note
      chatStore.addCustomContent('msg1', {
        id: 'h2',
        type: 'highlight',
        text: 'world this',
        colorIndex: 1,
        startOffset: 6,
        endOffset: 16
      })

      expect(chatStore.messagesById.msg1.customContent).toHaveLength(1)

      const merged = chatStore.messagesById.msg1.customContent[0]
      expect(merged.hasNote).toBe(true)
      expect(merged.noteContent).toBe('Existing note')
    })

    it('does not merge question-link type with highlights', () => {
      chatStore.addRootMessage({
        id: 'msg1',
        question: 'Test',
        response: 'Hello world this is a test'
      })

      // Add question-link
      chatStore.addCustomContent('msg1', {
        id: 'ql1',
        type: 'question-link',
        text: 'world',
        targetMessageId: 'msg-0',
        startOffset: 6,
        endOffset: 11
      })

      // Add overlapping highlight
      chatStore.addCustomContent('msg1', {
        id: 'h1',
        type: 'highlight',
        text: 'world this',
        colorIndex: 0,
        startOffset: 6,
        endOffset: 16
      })

      // Should have both - question-link and highlight should not merge
      expect(chatStore.messagesById.msg1.customContent).toHaveLength(2)
    })
  })
})
