import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ChatMessage from '../ChatMessage.vue'
import { useChatStore } from '../../stores/chat.js'
import Message from '../../stores/Message.js'
import * as api from '../../services/api.js'

// Mock the API module
vi.mock('../../services/api.js', () => ({
  sendChatMessage: vi.fn()
}))

describe('ChatMessage - handleHighlight', () => {
  let wrapper
  let pinia
  let chatStore

  beforeEach(() => {
    if (wrapper) {
      wrapper.unmount()
    }
    pinia = createPinia()

    // Mount component with a basic message
    wrapper = mount(ChatMessage, {
      props: {
        message: {
          id: 'parent-1',
          question: 'What is JavaScript?',
          response: 'JavaScript is a programming language',
          childIds: [],
          parentId: null
        }
      },
      global: {
        plugins: [pinia],
        stubs: {
          MarkdownRenderer: true,
          ContextMenu: true
        }
      }
    })

    chatStore = useChatStore()

    // Add the parent message to the store
    chatStore.messagesById['parent-1'] = {
      id: 'parent-1',
      question: 'What is JavaScript?',
      response: 'JavaScript is a programming language',
      childIds: [],
      parentId: null
    }
    chatStore.rootMessageIds = ['parent-1']
    chatStore.currentMessageId = 'parent-1'

    // Reset mocks
    vi.clearAllMocks()
  })

  it('should not process if question is empty', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'selected text'

    await wrapper.vm.handleHighlight('')

    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state.isChildStreaming).toBe(false)
  })

  it('should not process if question is null', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'selected text'

    await wrapper.vm.handleHighlight(null)

    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state.isChildStreaming).toBe(false)
  })

  it('should not process if question is undefined', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'selected text'

    await wrapper.vm.handleHighlight(undefined)

    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state.isChildStreaming).toBe(false)
  })

  it('should not process if already streaming', async () => {
    wrapper.vm.state.isChildStreaming = true
    wrapper.vm.state.contextMenu.selectedText = 'selected text'

    await wrapper.vm.handleHighlight('Follow up question?')

    expect(api.sendChatMessage).not.toHaveBeenCalled()
    expect(wrapper.vm.state.isChildStreaming).toBe(true)
  })

  it('should close context menu immediately', async () => {
    wrapper.vm.state.contextMenu.visible = true
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'

    // Mock sendChatMessage to never resolve
    api.sendChatMessage.mockImplementation(() => new Promise(() => {}))

    wrapper.vm.handleHighlight('What is JavaScript?')

    // Context menu should be closed immediately
    expect(wrapper.vm.state.contextMenu.visible).toBe(false)
  })

  it('should create child message with highlighted text', async () => {
    const question = 'Tell me more about this'
    const selectedText = 'programming language'
    wrapper.vm.state.contextMenu.selectedText = selectedText

    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight(question)

    // Check that a child was added to the store
    const parent = chatStore.messagesById['parent-1']
    expect(parent.childIds.length).toBe(1)

    const childId = parent.childIds[0]
    const child = chatStore.messagesById[childId]

    expect(child.question).toBe(question)
    expect(child.highlightedText).toBe(selectedText)
    expect(child.parentId).toBe('parent-1')
  })

  it('should set streaming state to true during API call', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'

    let streamingDuringCall = false
    api.sendChatMessage.mockImplementation(() => {
      streamingDuringCall = wrapper.vm.state.isChildStreaming
      return Promise.resolve()
    })

    await wrapper.vm.handleHighlight('What is this?')

    expect(streamingDuringCall).toBe(true)
  })

  it('should set streaming state to false after successful API call', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'
    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight('What is this?')

    expect(wrapper.vm.state.isChildStreaming).toBe(false)
  })

  it('should call sendChatMessage with correct parameters', async () => {
    const question = 'Explain this concept'
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'
    chatStore.currentModel = 'gpt-4'

    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight(question)

    expect(api.sendChatMessage).toHaveBeenCalledWith(
      question,
      'gpt-4',
      expect.any(Function)
    )
  })

  it('should update child response via streaming callback', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'

    let capturedCallback
    api.sendChatMessage.mockImplementation((_q, _m, callback) => {
      capturedCallback = callback
      return Promise.resolve()
    })

    await wrapper.vm.handleHighlight('What is this?')

    // Get the child message that was created
    const parent = chatStore.messagesById['parent-1']
    const childId = parent.childIds[0]
    const child = chatStore.messagesById[childId]

    // Simulate streaming chunks
    capturedCallback('This is ')
    expect(child.response).toBe('This is ')

    capturedCallback('a test')
    expect(child.response).toBe('This is a test')
  })

  it('should clear error state before processing', async () => {
    wrapper.vm.state.error = 'Previous error'
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'

    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight('What is this?')

    expect(wrapper.vm.state.error).toBe(null)
  })

  it('should set error state on API failure', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'
    const errorMessage = 'Network error'

    api.sendChatMessage.mockRejectedValue(new Error(errorMessage))

    await wrapper.vm.handleHighlight('What is this?')

    expect(wrapper.vm.state.error).toBe(errorMessage)
  })

  it('should set streaming to false even on API failure', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'JavaScript'

    api.sendChatMessage.mockRejectedValue(new Error('API error'))

    await wrapper.vm.handleHighlight('What is this?')

    expect(wrapper.vm.state.isChildStreaming).toBe(false)
  })

  it('should use currentMessage as parent when navigated to a child', async () => {
    // Create a child message and navigate to it
    const childMsg = new Message({
      id: 'child-1',
      question: 'Follow up',
      response: 'Child response with important text',
      parentId: 'parent-1',
      childIds: []
    })

    chatStore.addChildMessage('parent-1', childMsg)
    chatStore.currentMessageId = 'child-1'

    wrapper.vm.state.contextMenu.selectedText = 'important text'
    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight('Tell me more')

    // The new child should have child-1 as parent
    const parent = chatStore.messagesById['child-1']
    expect(parent.childIds.length).toBe(1)

    const grandchildId = parent.childIds[0]
    const grandchild = chatStore.messagesById[grandchildId]
    expect(grandchild.parentId).toBe('child-1')
  })

  it('should handle multiple consecutive highlights on same parent', async () => {
    wrapper.vm.state.contextMenu.selectedText = 'text1'
    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight('Question 1')

    const parent = chatStore.messagesById['parent-1']
    expect(parent.childIds.length).toBe(1)

    // Second highlight should be added to the current message (which is now the first child)
    const firstChild = chatStore.messagesById[parent.childIds[0]]
    chatStore.currentMessageId = firstChild.id

    wrapper.vm.state.contextMenu.selectedText = 'text2'
    await wrapper.vm.handleHighlight('Question 2')

    // First child should now have a child of its own
    expect(firstChild.childIds.length).toBe(1)

    // Parent should still have only 1 direct child
    expect(parent.childIds.length).toBe(1)
  })

  it('should preserve selectedText for child message creation', async () => {
    const selectedText = 'specific phrase'
    wrapper.vm.state.contextMenu.selectedText = selectedText

    api.sendChatMessage.mockResolvedValue()

    await wrapper.vm.handleHighlight('Explain this')

    const parent = chatStore.messagesById['parent-1']
    const childId = parent.childIds[0]
    const child = chatStore.messagesById[childId]

    expect(child.highlightedText).toBe(selectedText)
  })
})
