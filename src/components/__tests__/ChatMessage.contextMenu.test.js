import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ChatMessage from '../ChatMessage.vue'
import * as api from '../../services/api.js'
import * as extraPrompt from '../../services/extraPrompt.js'

// Helper to access state from setup script
function getState(wrapper) {
  const setupState = wrapper.vm.$.setupState
  // Vue 3 setup refs are auto-unwrapped when accessed through setupState
  // But for nested reactive objects (like popup.state), we need to access them directly
  return {
    get popup() { return setupState.popup.state },
    get tempHighlight() { return setupState.tempHighlight },
    set tempHighlight(val) { setupState.tempHighlight = val },
    get error() { return setupState.error },
    set error(val) { setupState.error = val },
    get isChildStreaming() { return setupState.isChildStreaming },
    set isChildStreaming(val) { setupState.isChildStreaming = val }
  }
}

describe('ChatMessage context menu integration', () => {
  let wrapper
  let mockGetSelection
  let mockRemoveAllRanges

  beforeEach(() => {
    // Mock window.getSelection
    mockRemoveAllRanges = vi.fn()
    mockGetSelection = vi.fn(() => ({
      removeAllRanges: mockRemoveAllRanges
    }))
    window.getSelection = mockGetSelection

    wrapper = mount(ChatMessage, {
      props: {
        message: { id: '1', question: 'Q', response: 'A', children: [] }
      },
      global: { plugins: [createPinia()] }
    })
  })

  describe('Text Selection Behavior', () => {
    it('showContextMenu does NOT create permanent highlight immediately when text is selected', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'test selection',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 10,
        endOffset: 25
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'A test selection here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()
      const state = getState(wrapper)

      // Context menu should be visible with stored data
      expect(state.popup.mode).toBe('context-menu')
      expect(state.popup.selectedText).toBe('test selection')
      expect(state.popup.startOffset).toBe(10)
      expect(state.popup.endOffset).toBe(25)
      expect(state.popup.x).toBe(100)
      expect(state.popup.y).toBe(200)

      // But NO permanent highlight should be created yet
      expect(state.popup.highlightId).toBe(null)
      expect(wrapper.vm.$.props.message.customContent).toEqual([])
    })

    it('showContextMenu creates temporary highlight when text is selected', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'temp text',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 5,
        endOffset: 14
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Some temp text here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()
      const state = getState(wrapper)

      // Temporary highlight should be created
      expect(state.tempHighlight).not.toBe(null)
      expect(state.tempHighlight.id).toBe('__temp_highlight__')
      expect(state.tempHighlight.type).toBe('highlight')
      expect(state.tempHighlight.text).toBe('temp text')
      expect(state.tempHighlight.startOffset).toBe(5)
      expect(state.tempHighlight.endOffset).toBe(14)
    })

    it('showContextMenu clears browser selection when creating temp highlight', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'selected',
        x: 50,
        y: 100,
        visible: true,
        startOffset: 0,
        endOffset: 8
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'selected text', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      // Browser selection should be cleared
      expect(mockRemoveAllRanges).toHaveBeenCalled()
    })

    it('showContextMenu stores offsets for later use', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'selected',
        x: 50,
        y: 100,
        visible: true,
        startOffset: 5,
        endOffset: 13
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Text selected here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()
      const state = getState(wrapper)

      expect(state.popup.startOffset).toBe(5)
      expect(state.popup.endOffset).toBe(13)
    })

    it('showContextMenu hides contextMenu if no text selected', () => {
      const mockSelection = { toString: () => '', getRangeAt: vi.fn() }
      window.getSelection = vi.fn(() => mockSelection)
      wrapper.vm.showContextMenu()
      const state = getState(wrapper)
      expect(state.popup.mode).toBe(null)
      expect(state.popup.selectedText).toBe('')
    })
  })

  describe('Keep Highlight Behavior', () => {
    it('keepHighlight creates permanent highlight from stored selection data', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-keep',
        question: 'Q',
        response: 'test highlight text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      // Register message in store
      wrapper.vm.chatStore.messagesById['msg-keep'] = testMessage

      const state = getState(wrapper)

      // Simulate stored selection data from showContextMenu
      state.popup.selectedText = 'test highlight'
      state.popup.startOffset = 0
      state.popup.endOffset = 14
      state.popup.mode = 'context-menu'

      // Call keepHighlight
      wrapper.vm.keepHighlight()

      // Highlight should now be created in the store
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-keep']
      expect(storeMessage.customContent).toBeDefined()
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].type).toBe('highlight')
      expect(storeMessage.customContent[0].text).toBe('test highlight')
      expect(storeMessage.customContent[0].startOffset).toBe(0)
      expect(storeMessage.customContent[0].endOffset).toBe(14)

      // Context menu should be closed
      expect(state.popup.mode).toBe(null)

      // Temporary highlight should be cleared
      expect(state.tempHighlight).toBe(null)
    })

    it('keepHighlight clears temporary highlight', () => {
      const state = getState(wrapper)
      state.popup.selectedText = 'text'
      state.popup.startOffset = 0
      state.popup.endOffset = 4
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'text',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.keepHighlight()

      expect(state.tempHighlight).toBe(null)
    })

    it('keepHighlight does nothing if no valid selection data', () => {
      const state = getState(wrapper)
      state.popup.selectedText = ''
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      const initialContent = wrapper.vm.$.props.message.customContent || []
      wrapper.vm.keepHighlight()

      // No highlight should be added
      expect(wrapper.vm.$.props.message.customContent || []).toEqual(initialContent)
    })
  })

  describe('Close Context Menu Behavior', () => {
    it('closePopup clears temporary highlight', () => {
      const state = getState(wrapper)
      state.popup.mode = 'context-menu'
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'temp',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.closePopup()

      expect(state.tempHighlight).toBe(null)
      expect(state.popup.mode).toBe(null)
    })

    it('closePopup does not remove highlights when closed', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-close',
        question: 'Q',
        response: 'temp text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      // Register message in store
      wrapper.vm.chatStore.messagesById['msg-close'] = testMessage

      const state = getState(wrapper)

      // Manually create a highlight to simulate the scenario
      state.popup.selectedText = 'temp'
      state.popup.startOffset = 0
      state.popup.endOffset = 4
      wrapper.vm.keepHighlight()

      // Get the created highlight ID from the store
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-close']
      const highlightId = storeMessage.customContent[0].id

      // Set it in state as if context menu had it
      state.popup.highlightId = highlightId
      state.popup.mode = 'context-menu'

      // Close context menu
      wrapper.vm.closePopup()

      // Highlight should NOT be removed
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].id).toBe(highlightId)
    })

    it('closePopup does nothing if no highlight exists', () => {
      const state = getState(wrapper)
      state.popup.mode = 'context-menu'
      state.popup.highlightId = null

      // Should not throw error
      expect(() => wrapper.vm.closePopup()).not.toThrow()
      expect(state.popup.mode).toBe(null)
    })

    it('ContextMenu @close event clears temporary highlight (regression test)', async () => {
      // This test verifies the fix for the bug where closing the context menu
      // via backdrop click, Escape key, or copy action did not clear the temp highlight
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'selected text',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 13
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'selected text here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      // Open context menu which creates temp highlight
      wrapper.vm.showContextMenu()
      const state = getState(wrapper)

      expect(state.popup.mode).toBe('context-menu')
      expect(state.tempHighlight).not.toBe(null)
      expect(state.tempHighlight.id).toBe('__temp_highlight__')

      // Find the ContextMenu component and emit 'close' event
      // This simulates clicking outside or pressing Escape
      const contextMenu = wrapper.findComponent({ name: 'ContextMenu' })
      await contextMenu.vm.$emit('close')

      // Both popup and temp highlight should be cleared
      expect(state.popup.mode).toBe(null)
      expect(state.tempHighlight).toBe(null)
    })
  })

  describe('Ask Question Behavior', () => {
    it('handleAskQuestion clears temporary highlight', async () => {
      const pinia = createPinia()

      // Create a properly initialized message in the store
      const testMessage = {
        id: '1',
        question: 'Q',
        response: 'question text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      // Add message to store
      wrapper.vm.chatStore.messagesById['1'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'question text'
      state.popup.startOffset = 0
      state.popup.endOffset = 13
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'question text',
        startOffset: 0,
        endOffset: 13
      }

      // Mock the API calls to prevent actual requests
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue(undefined)

      await wrapper.vm.handleAskQuestion('What is this?')

      expect(state.tempHighlight).toBe(null)
    })

    it('handleAskQuestion uses stored offsets without requiring pre-existing highlight', async () => {
      const pinia = createPinia()

      // Create a properly initialized message in the store
      const testMessage = {
        id: '2',
        question: 'Q2',
        response: 'some selected text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      // Add message to store
      wrapper.vm.chatStore.messagesById['2'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'selected text'
      state.popup.startOffset = 5
      state.popup.endOffset = 18

      // No highlight should exist at this point
      expect(state.popup.highlightId).toBe(null)

      // Mock the API calls
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue(undefined)

      // Should work without errors
      await wrapper.vm.handleAskQuestion('Explain this')

      // Context menu should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleAskQuestion validates selection data before proceeding', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      // Invalid data - missing offsets
      state.popup.selectedText = 'text'
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      await wrapper.vm.handleAskQuestion('Question?')

      // Should log error and not proceed
      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data')
      consoleSpy.mockRestore()
    })

    it('handleAskQuestion adds [DEEPDIVE] tag to the question', async () => {
      const pinia = createPinia()

      const testMessage = {
        id: 'msg-deepdive',
        question: 'Q',
        response: 'some text to select',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-deepdive'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'text to select'
      state.popup.startOffset = 5
      state.popup.endOffset = 19

      // Spy on getMainPrompts to capture the question passed
      const getMainPromptsSpy = vi.spyOn(extraPrompt, 'getMainPrompts')
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue(undefined)

      await wrapper.vm.handleAskQuestion('Explain this concept')

      // Verify getMainPrompts was called with [DEEPDIVE] tag
      expect(getMainPromptsSpy).toHaveBeenCalled()
      const callArgs = getMainPromptsSpy.mock.calls[0]
      expect(callArgs[0]).toBe('[DEEPDIVE] Explain this concept')

      getMainPromptsSpy.mockRestore()
    })
  })

  describe('Highlight Click Behavior', () => {
    it('handleHighlightClick shows context menu with highlight data', () => {
      const highlightData = {
        highlightId: 'h-123',
        text: 'highlighted text',
        startOffset: 10,
        endOffset: 26,
        x: 150,
        y: 250
      }

      wrapper.vm.handleHighlightClick(highlightData)
      const state = getState(wrapper)

      expect(state.popup.mode).toBe('context-menu')
      expect(state.popup.selectedText).toBe('highlighted text')
      expect(state.popup.startOffset).toBe(10)
      expect(state.popup.endOffset).toBe(26)
      expect(state.popup.x).toBe(150)
      expect(state.popup.y).toBe(250)
      expect(state.popup.highlightId).toBe('h-123')
    })

    it('handleHighlightClick stores highlight ID for later removal', () => {
      const highlightData = {
        highlightId: 'existing-highlight',
        text: 'test',
        startOffset: 0,
        endOffset: 4,
        x: 100,
        y: 200
      }

      wrapper.vm.handleHighlightClick(highlightData)
      const state = getState(wrapper)

      // The highlightId should be stored so closing the menu can remove it
      expect(state.popup.highlightId).toBe('existing-highlight')
    })

    it('handleHighlightClick sets context menu position from click coordinates', () => {
      const highlightData = {
        highlightId: 'h-pos',
        text: 'text',
        startOffset: 0,
        endOffset: 4,
        x: 300,
        y: 400
      }

      wrapper.vm.handleHighlightClick(highlightData)
      const state = getState(wrapper)

      expect(state.popup.x).toBe(300)
      expect(state.popup.y).toBe(400)
    })

    it('handleHighlightClick does NOT create temporary highlight for existing highlights', () => {
      const highlightData = {
        highlightId: 'existing-h',
        text: 'existing text',
        startOffset: 0,
        endOffset: 13,
        x: 100,
        y: 200
      }

      wrapper.vm.handleHighlightClick(highlightData)
      const state = getState(wrapper)

      // Should NOT create a temporary highlight when clicking on existing highlight
      expect(state.tempHighlight).toBe(null)
    })

    it('handleHighlightClick allows asking question about highlighted text', async () => {
      const pinia = createPinia()

      const testMessage = {
        id: 'msg-1',
        question: 'Q',
        response: 'This is highlighted content',
        customContent: [{
          id: 'h-1',
          type: 'highlight',
          text: 'highlighted',
          startOffset: 8,
          endOffset: 19
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-1'] = testMessage

      const highlightData = {
        highlightId: 'h-1',
        text: 'highlighted',
        startOffset: 8,
        endOffset: 19,
        x: 200,
        y: 300
      }

      // Click on highlight
      wrapper.vm.handleHighlightClick(highlightData)

      const state = getState(wrapper)
      expect(state.popup.mode).toBe('context-menu')
      expect(state.popup.selectedText).toBe('highlighted')

      // User can now ask question using the stored highlight data
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue(undefined)

      await wrapper.vm.handleAskQuestion('What does this mean?')

      expect(state.popup.mode).toBe(null)
    })
  })

  describe('Temporary Highlight in effectiveCustomContent', () => {
    it('effectiveCustomContent includes temporary highlight when present', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'temp selection',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 14
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'temp selection here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent
      expect(effectiveContent.length).toBe(1)
      expect(effectiveContent[0].id).toBe('__temp_highlight__')
    })

    it('effectiveCustomContent merges temp highlight with existing customContent', () => {
      const existingHighlight = {
        id: 'existing-h',
        type: 'highlight',
        text: 'existing',
        colorIndex: 1,
        startOffset: 20,
        endOffset: 28
      }

      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'new selection',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 13
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'new selection text existing', customContent: [existingHighlight] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent
      expect(effectiveContent.length).toBe(2)
      expect(effectiveContent[0].id).toBe('existing-h')
      expect(effectiveContent[1].id).toBe('__temp_highlight__')
    })

    it('effectiveCustomContent returns only customContent when no temp highlight', () => {
      const existingHighlight = {
        id: 'h-1',
        type: 'highlight',
        text: 'text',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 4
      }

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'text here', customContent: [existingHighlight] }
        },
        global: { plugins: [createPinia()] }
      })

      const effectiveContent = wrapper.vm.effectiveCustomContent
      expect(effectiveContent.length).toBe(1)
      expect(effectiveContent[0].id).toBe('h-1')
    })

    it('temporary highlight always uses first color (index 0)', () => {
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'colored text',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 12
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'colored text here', customContent: [] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()
      const state = getState(wrapper)

      // Temp highlight should always use first color
      expect(state.tempHighlight.colorIndex).toBe(0)
      // And popup colorIndex should be reset to 0 for new selections
      expect(state.popup.colorIndex).toBe(0)
    })

    it('effectiveCustomContent merges temp highlight with overlapping existing highlight', () => {
      const existingHighlight = {
        id: 'existing-h',
        type: 'highlight',
        text: 'world',
        colorIndex: 1,
        startOffset: 6,
        endOffset: 11
      }

      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'world this',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 6,
        endOffset: 16
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Hello world this is a test', customContent: [existingHighlight] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent

      // Should have only 1 item (merged)
      expect(effectiveContent.length).toBe(1)

      // Merged highlight should have expanded range
      const merged = effectiveContent[0]
      expect(merged.startOffset).toBe(6)
      expect(merged.endOffset).toBe(16)
    })

    it('effectiveCustomContent expands temp highlight range when overlapping existing', () => {
      const existingHighlight = {
        id: 'existing-h',
        type: 'highlight',
        text: 'Hello world',
        colorIndex: 1,
        startOffset: 0,
        endOffset: 11
      }

      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'world this',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 6,
        endOffset: 16
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Hello world this is a test', customContent: [existingHighlight] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent

      // Should have merged highlight with min start (0) and max end (16)
      expect(effectiveContent.length).toBe(1)
      expect(effectiveContent[0].startOffset).toBe(0)
      expect(effectiveContent[0].endOffset).toBe(16)
      expect(effectiveContent[0].text).toBe('Hello world this')
    })

    it('effectiveCustomContent merges temp with multiple overlapping highlights', () => {
      const highlight1 = {
        id: 'h1',
        type: 'highlight',
        text: 'Hello',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 5
      }

      const highlight2 = {
        id: 'h2',
        type: 'highlight',
        text: 'this is',
        colorIndex: 1,
        startOffset: 12,
        endOffset: 19
      }

      // Temp selection spans both
      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'Hello world this is',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 19
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Hello world this is a test', customContent: [highlight1, highlight2] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent

      // Should have only 1 merged highlight
      expect(effectiveContent.length).toBe(1)
      expect(effectiveContent[0].startOffset).toBe(0)
      expect(effectiveContent[0].endOffset).toBe(19)
    })

    it('effectiveCustomContent does not merge temp with non-overlapping highlights', () => {
      const existingHighlight = {
        id: 'existing-h',
        type: 'highlight',
        text: 'test',
        colorIndex: 1,
        startOffset: 22,
        endOffset: 26
      }

      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'Hello',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 0,
        endOffset: 5
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Hello world this is a test', customContent: [existingHighlight] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent

      // Should have both highlights (no merge)
      expect(effectiveContent.length).toBe(2)
      expect(effectiveContent.find(h => h.id === 'existing-h')).toBeDefined()
      expect(effectiveContent.find(h => h.id === '__temp_highlight__')).toBeDefined()
    })

    it('effectiveCustomContent does not merge temp highlight with question-links', () => {
      const questionLink = {
        id: 'ql1',
        type: 'question-link',
        text: 'world',
        targetMessageId: 'msg-0',
        startOffset: 6,
        endOffset: 11
      }

      const mockSelectionHelper = vi.fn(() => ({
        selectedText: 'world this',
        x: 100,
        y: 200,
        visible: true,
        startOffset: 6,
        endOffset: 16
      }))

      wrapper = mount(ChatMessage, {
        props: {
          message: { id: '1', question: 'Q', response: 'Hello world this is a test', customContent: [questionLink] },
          getSelectedTextAndPosition: mockSelectionHelper
        },
        global: { plugins: [createPinia()] }
      })

      wrapper.vm.showContextMenu()

      const effectiveContent = wrapper.vm.effectiveCustomContent

      // Should have both (question-link should not be merged)
      expect(effectiveContent.length).toBe(2)
      expect(effectiveContent.find(h => h.type === 'question-link')).toBeDefined()
      expect(effectiveContent.find(h => h.id === '__temp_highlight__')).toBeDefined()
    })
  })

  describe('Note Edit Mode Behavior', () => {
    it('handleAddNote validates selection data before proceeding', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      // Invalid data - missing offsets
      state.popup.selectedText = 'text'
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      wrapper.vm.handleAddNote()

      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data for note')
      consoleSpy.mockRestore()
    })

    it('handleNoteClick opens note in view mode (startInEditMode = false)', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-note',
        question: 'Q',
        response: 'text with note',
        customContent: [{
          id: 'note-1',
          type: 'highlight',
          text: 'with note',
          startOffset: 5,
          endOffset: 14,
          hasNote: true,
          noteContent: 'This is a note'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-note'] = testMessage

      const noteData = {
        noteId: 'note-1',
        noteContent: 'This is a note',
        x: 100,
        y: 200
      }

      wrapper.vm.handleNoteClick(noteData)
      const state = getState(wrapper)

      expect(state.popup.mode).toBe('note')
      expect(state.popup.highlightId).toBe('note-1')
      expect(state.popup.noteContent).toBe('This is a note')
      expect(state.popup.isNewNote).toBe(false)
      expect(state.popup.startInEditMode).toBe(false)
    })

    it('handleAddNote on existing highlight opens note in edit mode (startInEditMode = true)', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-add-note',
        question: 'Q',
        response: 'text with highlight',
        customContent: [{
          id: 'highlight-1',
          type: 'highlight',
          text: 'with highlight',
          startOffset: 5,
          endOffset: 19,
          colorIndex: 0
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-add-note'] = testMessage

      const state = getState(wrapper)

      // Simulate context menu on existing highlight
      state.popup.selectedText = 'with highlight'
      state.popup.startOffset = 5
      state.popup.endOffset = 19
      state.popup.highlightId = 'highlight-1'
      state.popup.noteContent = ''
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      wrapper.vm.handleAddNote()

      expect(state.popup.mode).toBe('note')
      expect(state.popup.isNewNote).toBe(true)
      expect(state.popup.startInEditMode).toBe(true)
    })

    it('handleAddNote on existing highlight with note opens in edit mode', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-edit-note',
        question: 'Q',
        response: 'text with note',
        customContent: [{
          id: 'note-2',
          type: 'highlight',
          text: 'with note',
          startOffset: 5,
          endOffset: 14,
          hasNote: true,
          noteContent: 'Existing note content'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-edit-note'] = testMessage

      const state = getState(wrapper)

      // Simulate context menu on highlight with existing note
      state.popup.selectedText = 'with note'
      state.popup.startOffset = 5
      state.popup.endOffset = 14
      state.popup.highlightId = 'note-2'
      state.popup.noteContent = 'Existing note content'
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      wrapper.vm.handleAddNote()

      expect(state.popup.mode).toBe('note')
      expect(state.popup.isNewNote).toBe(false) // Not a new note, editing existing
      expect(state.popup.startInEditMode).toBe(true)
    })

    it('handleAddNote on new selection creates temp highlight and opens in edit mode', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-new-note',
        question: 'Q',
        response: 'some text to select',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-new-note'] = testMessage

      const state = getState(wrapper)

      // Simulate context menu with fresh selection (no existing highlight)
      state.popup.selectedText = 'text to select'
      state.popup.startOffset = 5
      state.popup.endOffset = 19
      state.popup.highlightId = null
      state.popup.noteContent = ''
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      wrapper.vm.handleAddNote()

      expect(state.popup.mode).toBe('note')
      expect(state.popup.highlightId).toBe('__temp_highlight_with_note__')
      expect(state.popup.isNewNote).toBe(true)
      expect(state.popup.startInEditMode).toBe(true)
      expect(state.tempHighlight).not.toBe(null)
      expect(state.tempHighlight.hasNote).toBe(true)
    })

    it('closePopup resets startInEditMode to false', () => {
      const state = getState(wrapper)

      state.popup.mode = 'note'
      state.popup.startInEditMode = true
      state.popup.isNewNote = true
      state.popup.highlightId = 'some-id'
      state.popup.noteContent = 'content'

      wrapper.vm.closePopup()

      expect(state.popup.mode).toBe(null)
      expect(state.popup.startInEditMode).toBe(false)
      expect(state.popup.isNewNote).toBe(false)
      expect(state.popup.highlightId).toBe(null)
      expect(state.popup.noteContent).toBe('')
    })
  })

  describe('Quick Explain Behavior', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('handleQuickExplain switches to note mode with streaming state', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick',
        question: 'Q',
        response: 'text to explain here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'text to explain'
      state.popup.startOffset = 0
      state.popup.endOffset = 15
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      // Mock the API to resolve immediately
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Quick explanation')

      // Start the quick explain (don't await yet)
      const promise = wrapper.vm.handleQuickExplain()

      // Check immediate state changes
      expect(state.popup.mode).toBe('note')
      expect(state.popup.isStreaming).toBe(true)
      expect(state.popup.isNewNote).toBe(false)
      expect(state.popup.startInEditMode).toBe(false)
      expect(state.popup.noteContent).toBe('')

      await promise
    })

    it('handleQuickExplain creates temp highlight when no existing highlight', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-temp',
        question: 'Q',
        response: 'some text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-temp'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'some text'
      state.popup.startOffset = 0
      state.popup.endOffset = 9
      state.popup.colorIndex = 2
      state.popup.highlightId = null
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Explanation')

      const promise = wrapper.vm.handleQuickExplain()

      // Should create temp highlight
      expect(state.tempHighlight).not.toBe(null)
      expect(state.tempHighlight.text).toBe('some text')
      expect(state.tempHighlight.colorIndex).toBe(2)
      expect(state.tempHighlight.hasNote).toBe(true)

      await promise
    })

    it('handleQuickExplain does NOT create temp highlight for existing highlight', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-existing',
        question: 'Q',
        response: 'highlighted text here',
        customContent: [{
          id: 'existing-h',
          type: 'highlight',
          text: 'highlighted',
          startOffset: 0,
          endOffset: 11,
          colorIndex: 1
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-existing'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'highlighted'
      state.popup.startOffset = 0
      state.popup.endOffset = 11
      state.popup.colorIndex = 1
      state.popup.highlightId = 'existing-h'
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Explanation')

      const promise = wrapper.vm.handleQuickExplain()

      // Should NOT create temp highlight for existing
      expect(state.tempHighlight).toBe(null)

      await promise
    })

    it('handleQuickExplain updates existing highlight note content', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-update',
        question: 'Q',
        response: 'text with highlight',
        customContent: [{
          id: 'h-update',
          type: 'highlight',
          text: 'with highlight',
          startOffset: 5,
          endOffset: 19,
          colorIndex: 0,
          hasNote: true,
          noteContent: 'Old note'
        }],
        childIds: [],
        parentId: null
      }

      // Mock chat service
      const mockChatService = {
        sendMessageForFeature: vi.fn((_featureType, _messages, callback) => {
          if (callback) callback('New explanation')
          return Promise.resolve('New explanation')
        })
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-update'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'with highlight'
      state.popup.startOffset = 5
      state.popup.endOffset = 19
      state.popup.colorIndex = 0
      state.popup.highlightId = 'h-update'
      state.popup.noteContent = 'Old note'
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleQuickExplain()

      // Should stream content to popup.noteContent (not auto-save)
      expect(state.popup.noteContent).toBe('New explanation')
      expect(state.popup.mode).toBe('note')

      // Original highlight should not be updated until user saves
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-quick-update']
      expect(storeMessage.customContent[0].noteContent).toBe('Old note')
    })

    it('handleQuickExplain creates new highlight with note for new selection', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-new',
        question: 'Q',
        response: 'brand new selection',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Mock chat service
      const mockChatService = {
        sendMessageForFeature: vi.fn((_featureType, _messages, callback) => {
          if (callback) callback('New explanation')
          return Promise.resolve('New explanation')
        })
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-new'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'brand new'
      state.popup.startOffset = 0
      state.popup.endOffset = 9
      state.popup.colorIndex = 1
      state.popup.highlightId = null
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleQuickExplain()

      // Should stream content to popup.noteContent (not auto-save to store)
      expect(state.popup.noteContent).toBe('New explanation')
      expect(state.popup.mode).toBe('note')

      // Should create temp highlight for display (not saved yet)
      expect(state.tempHighlight).toBeTruthy()
      expect(state.tempHighlight.text).toBe('brand new')
      expect(state.tempHighlight.colorIndex).toBe(1)

      // Store should NOT have the highlight yet (requires user to click Save)
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-quick-new']
      expect(storeMessage.customContent.length).toBe(0)
    })

    it('handleQuickExplain sets isStreaming to false after completion', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-stream-end',
        question: 'Q',
        response: 'test text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-stream-end'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'test'
      state.popup.startOffset = 0
      state.popup.endOffset = 4
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Done')

      await wrapper.vm.handleQuickExplain()

      expect(state.popup.isStreaming).toBe(false)
      expect(state.isChildStreaming).toBe(false)
    })

    it('handleQuickExplain validates selection data before proceeding', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      state.popup.selectedText = 'text'
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      await wrapper.vm.handleQuickExplain()

      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data for quick explain')
      consoleSpy.mockRestore()
    })

    it('handleQuickExplain closes popup and clears state on error', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-error',
        question: 'Q',
        response: 'error text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Create mock chat service that rejects
      const mockChatService = {
        sendMessageForFeature: vi.fn().mockRejectedValue(new Error('API Error'))
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-error'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'error'
      state.popup.startOffset = 0
      state.popup.endOffset = 5
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleQuickExplain()

      expect(state.popup.mode).toBe(null)
      expect(state.popup.isStreaming).toBe(false)
      expect(state.error).toBe('API Error')
    })

    it('handleQuickExplain streams content to noteContent', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-stream',
        question: 'Q',
        response: 'streaming test',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Create mock chat service
      const mockChatService = {
        sendMessageForFeature: vi.fn((_featureType, _messages, callback) => {
          callback('Hello ')
          callback('World')
          return Promise.resolve('Hello World')
        })
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-stream'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'streaming'
      state.popup.startOffset = 0
      state.popup.endOffset = 9
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleQuickExplain()

      // After streaming completes, noteContent should have the streamed content
      expect(state.popup.noteContent).toBe('Hello World')
    })

    it('closePopup resets isStreaming to false', () => {
      const state = getState(wrapper)

      state.popup.mode = 'note'
      state.popup.isStreaming = true
      state.popup.highlightId = 'some-id'
      state.popup.noteContent = 'content'

      wrapper.vm.closePopup()

      expect(state.popup.mode).toBe(null)
      expect(state.popup.isStreaming).toBe(false)
    })
  })

  describe('Note Detail Explain', () => {
    it('handleNoteClick stores selectedText and offsets from noteData', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-note-detail',
        question: 'Q',
        response: 'text with note here',
        customContent: [{
          id: 'note-detail-1',
          type: 'highlight',
          text: 'with note',
          startOffset: 5,
          endOffset: 14,
          hasNote: true,
          noteContent: 'This is a note'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-note-detail'] = testMessage

      const noteData = {
        noteId: 'note-detail-1',
        text: 'with note',
        noteContent: 'This is a note',
        startOffset: 5,
        endOffset: 14,
        x: 100,
        y: 200
      }

      wrapper.vm.handleNoteClick(noteData)
      const state = getState(wrapper)

      expect(state.popup.mode).toBe('note')
      expect(state.popup.selectedText).toBe('with note')
      expect(state.popup.startOffset).toBe(5)
      expect(state.popup.endOffset).toBe(14)
    })

    it('handleNoteDetailExplain triggers detail explanation flow', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-detail-explain',
        question: 'Q',
        response: 'some highlighted text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-detail-explain'] = testMessage

      const state = getState(wrapper)

      // Set up popup state as if note was opened via handleNoteClick
      state.popup.mode = 'note'
      state.popup.selectedText = 'highlighted text'
      state.popup.startOffset = 5
      state.popup.endOffset = 21
      state.popup.highlightId = 'highlight-1'
      state.popup.noteContent = 'Some note content'

      // handleNoteDetailExplain calls handleAskQuestion which requires valid selection data
      // The function should close popup and start streaming
      wrapper.vm.handleNoteDetailExplain({ noteId: 'highlight-1', text: 'highlighted text' })

      // Verify that popup was closed (handleAskQuestion calls closePopup)
      expect(state.popup.mode).toBe(null)
      // Verify streaming was started
      expect(state.isChildStreaming).toBe(true)
    })
  })

  describe('Custom Prompt Behavior', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('handleCustomPrompt calls handleQuickExplain with the custom prompt', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-custom',
        question: 'Q',
        response: 'text to query',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-custom'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'text to query'
      state.popup.startOffset = 0
      state.popup.endOffset = 13
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Custom response')

      const promise = wrapper.vm.handleCustomPrompt('explain this in simple terms')

      // Should be in note mode with streaming
      expect(state.popup.mode).toBe('note')
      expect(state.popup.isStreaming).toBe(true)
      expect(state.popup.isCustomPrompt).toBe(true)

      await promise
    })

    it('handleCustomPrompt sets isCustomPrompt flag to true', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-custom-flag',
        question: 'Q',
        response: 'selected text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-custom-flag'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'selected text'
      state.popup.startOffset = 0
      state.popup.endOffset = 13
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Response')

      const promise = wrapper.vm.handleCustomPrompt('custom query')

      expect(state.popup.isCustomPrompt).toBe(true)

      await promise
    })

    it('handleCustomPrompt sets customPromptText with combined prompt and context', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-custom-text',
        question: 'Q',
        response: 'some context text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-custom-text'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'context text'
      state.popup.startOffset = 5
      state.popup.endOffset = 17
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Response')

      const promise = wrapper.vm.handleCustomPrompt('what does this mean')

      expect(state.popup.customPromptText).toBe('what does this mean\nfor more context: context text')

      await promise
    })

    it('handleCustomPrompt does NOT auto-save highlight after streaming completes', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-no-autosave',
        question: 'Q',
        response: 'text for custom',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-no-autosave'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'text for custom'
      state.popup.startOffset = 0
      state.popup.endOffset = 15
      state.popup.highlightId = null
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockImplementation((_model, _messages, callback) => {
        if (callback) callback('Custom explanation')
        return Promise.resolve('Custom explanation')
      })

      await wrapper.vm.handleCustomPrompt('explain this')

      // Custom prompt should NOT auto-save - customContent should remain empty
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-no-autosave']
      expect(storeMessage.customContent.length).toBe(0)

      // Temp highlight should still exist (not saved)
      expect(state.tempHighlight).not.toBe(null)
    })

    it('handleNoteSave saves custom prompt result when isCustomPrompt is true', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-save-custom',
        question: 'Q',
        response: 'text to save',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-save-custom'] = testMessage

      const state = getState(wrapper)

      // Simulate state after custom prompt streaming completed
      state.popup.mode = 'note'
      state.popup.isCustomPrompt = true
      state.popup.customPromptText = 'custom prompt\nfor more context: text to save' // Required for handleNoteSave to save
      state.popup.noteContent = 'AI generated explanation'
      state.popup.highlightId = 'temp-id'
      state.tempHighlight = {
        id: 'temp-id',
        type: 'highlight',
        text: 'text to save',
        colorIndex: 0,
        startOffset: 0,
        endOffset: 12,
        hasNote: true,
        noteContent: ''
      }

      // Call handleNoteSave (simulating user clicking Save button)
      wrapper.vm.handleNoteSave({
        noteId: 'temp-id',
        content: 'AI generated explanation'
      })

      // Should create permanent highlight
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-save-custom']
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].text).toBe('text to save')
      expect(storeMessage.customContent[0].noteContent).toBe('AI generated explanation')
      expect(storeMessage.customContent[0].hasNote).toBe(true)

      // Temp highlight should be cleared
      expect(state.tempHighlight).toBe(null)

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteExplore triggers handleAskQuestion with customPromptText', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-explore',
        question: 'Q',
        response: 'explore this text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-explore'] = testMessage

      const state = getState(wrapper)

      // Set up state as if custom prompt note is open
      state.popup.mode = 'note'
      state.popup.isCustomPrompt = true
      state.popup.customPromptText = 'detailed question\nfor more context: explore this'
      state.popup.selectedText = 'explore this'
      state.popup.startOffset = 0
      state.popup.endOffset = 12

      // Call handleNoteExplore
      wrapper.vm.handleNoteExplore({ text: 'detailed question\nfor more context: explore this' })

      // Should have started child streaming (handleAskQuestion was called)
      expect(state.isChildStreaming).toBe(true)

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('closePopup resets isCustomPrompt and customPromptText', () => {
      const state = getState(wrapper)

      state.popup.mode = 'note'
      state.popup.isCustomPrompt = true
      state.popup.customPromptText = 'some prompt text'
      state.popup.isStreaming = false

      wrapper.vm.closePopup()

      expect(state.popup.isCustomPrompt).toBe(false)
      expect(state.popup.customPromptText).toBe('')
    })

    it('handleQuickExplain without custom prompt does NOT set isCustomPrompt', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-no-custom',
        question: 'Q',
        response: 'quick explain text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-no-custom'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'quick explain'
      state.popup.startOffset = 0
      state.popup.endOffset = 13
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Explanation')

      const promise = wrapper.vm.handleQuickExplain() // No argument = not custom prompt

      expect(state.popup.isCustomPrompt).toBe(false)
      // customPromptText is set to the selectedText for the Save/Explore buttons
      expect(state.popup.customPromptText).toBe('quick explain')

      await promise
    })

    it('handleQuickExplain does not auto-save - requires user to click Save', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-quick-autosave',
        question: 'Q',
        response: 'auto save text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Create mock chat service
      const mockChatService = {
        sendMessageForFeature: vi.fn((_featureType, _messages, callback) => {
          if (callback) callback('Quick explanation')
          return Promise.resolve('Quick explanation')
        })
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-quick-autosave'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'auto save'
      state.popup.startOffset = 0
      state.popup.endOffset = 9
      state.popup.highlightId = null
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleQuickExplain() // No argument = regular quick explain

      // Quick explain does NOT auto-save - shows note popup for user to save
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-quick-autosave']
      expect(storeMessage.customContent.length).toBe(0)

      // Content should be streamed to popup
      expect(state.popup.noteContent).toBe('Quick explanation')
      expect(state.popup.mode).toBe('note')
    })

    it('handleCustomPromptDeepDive creates child message with full context', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-deepdive-custom',
        question: 'Q',
        response: 'some selected context here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-deepdive-custom'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'selected context'
      state.popup.startOffset = 5
      state.popup.endOffset = 21
      state.popup.mode = 'context-menu'

      // Spy on getMainPrompts to capture the question passed
      const getMainPromptsSpy = vi.spyOn(extraPrompt, 'getMainPrompts')
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue(undefined)

      await wrapper.vm.handleCustomPromptDeepDive('explain in detail')

      // Verify getMainPrompts was called with [DEEPDIVE] tag and full context
      expect(getMainPromptsSpy).toHaveBeenCalled()
      const callArgs = getMainPromptsSpy.mock.calls[0]
      expect(callArgs[0]).toBe('[DEEPDIVE] explain in detail\n\nContext: selected context')

      getMainPromptsSpy.mockRestore()
    })
  })

  describe('Link to Question Behavior', () => {
    it('handleLinkToQuestion stores selection context and opens search modal', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-link',
        question: 'Q',
        response: 'text to link here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-link'] = testMessage

      const state = getState(wrapper)

      // Simulate context menu with selection
      state.popup.selectedText = 'text to link'
      state.popup.startOffset = 0
      state.popup.endOffset = 12
      state.popup.highlightId = null
      state.popup.noteContent = ''
      state.popup.mode = 'context-menu'

      wrapper.vm.handleLinkToQuestion()

      // Should store context for later use
      expect(wrapper.vm.questionSearchContext).toEqual({
        selectedText: 'text to link',
        startOffset: 0,
        endOffset: 12,
        highlightId: null,
        noteContent: ''
      })

      // Should open search modal
      expect(wrapper.vm.showQuestionSearch).toBe(true)

      // Should close context menu
      expect(state.popup.mode).toBe(null)
    })

    it('handleLinkToQuestion validates selection data before proceeding', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      // Invalid data - missing offsets
      state.popup.selectedText = 'text'
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      wrapper.vm.handleLinkToQuestion()

      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data for link to question')
      expect(wrapper.vm.showQuestionSearch).toBe(false)
      consoleSpy.mockRestore()
    })

    it('handleLinkToQuestion stores existing highlight context', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-link-existing',
        question: 'Q',
        response: 'highlighted text here',
        customContent: [{
          id: 'existing-h',
          type: 'highlight',
          text: 'highlighted',
          startOffset: 0,
          endOffset: 11,
          colorIndex: 1,
          hasNote: true,
          noteContent: 'Some note'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-link-existing'] = testMessage

      const state = getState(wrapper)

      // Simulate context menu on existing highlight
      state.popup.selectedText = 'highlighted'
      state.popup.startOffset = 0
      state.popup.endOffset = 11
      state.popup.highlightId = 'existing-h'
      state.popup.noteContent = 'Some note'
      state.popup.mode = 'context-menu'

      wrapper.vm.handleLinkToQuestion()

      // Should store highlight context including ID and note
      expect(wrapper.vm.questionSearchContext).toEqual({
        selectedText: 'highlighted',
        startOffset: 0,
        endOffset: 11,
        highlightId: 'existing-h',
        noteContent: 'Some note'
      })
    })

    it('handleQuestionSearchSelect creates question link from new selection', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-select-new',
        question: 'Q',
        response: 'text to link',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-select-new'] = testMessage

      // Set up context as if handleLinkToQuestion was called
      wrapper.vm.questionSearchContext = {
        selectedText: 'text to link',
        startOffset: 0,
        endOffset: 12,
        highlightId: null,
        noteContent: ''
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchSelect({ targetMessageId: 'target-msg-123' })

      // Should create question link
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-select-new']
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].type).toBe('question-link')
      expect(storeMessage.customContent[0].text).toBe('text to link')
      expect(storeMessage.customContent[0].targetMessageId).toBe('target-msg-123')
      expect(storeMessage.customContent[0].startOffset).toBe(0)
      expect(storeMessage.customContent[0].endOffset).toBe(12)

      // Should close search modal
      expect(wrapper.vm.showQuestionSearch).toBe(false)

      // Should clear context
      expect(wrapper.vm.questionSearchContext).toBe(null)
    })

    it('handleQuestionSearchSelect converts existing highlight to question link', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-convert',
        question: 'Q',
        response: 'highlighted text here',
        customContent: [{
          id: 'h-to-convert',
          type: 'highlight',
          text: 'highlighted',
          startOffset: 0,
          endOffset: 11,
          colorIndex: 2
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-convert'] = testMessage

      // Set up context with existing highlight
      wrapper.vm.questionSearchContext = {
        selectedText: 'highlighted',
        startOffset: 0,
        endOffset: 11,
        highlightId: 'h-to-convert',
        noteContent: ''
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchSelect({ targetMessageId: 'target-msg-456' })

      // Should have removed highlight and created question link
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-convert']
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].type).toBe('question-link')
      expect(storeMessage.customContent[0].targetMessageId).toBe('target-msg-456')
    })

    it('handleQuestionSearchSelect preserves note content when converting highlight', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-preserve-note',
        question: 'Q',
        response: 'highlighted with note',
        customContent: [{
          id: 'h-with-note',
          type: 'highlight',
          text: 'highlighted',
          startOffset: 0,
          endOffset: 11,
          colorIndex: 0,
          hasNote: true,
          noteContent: 'Important note'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-preserve-note'] = testMessage

      // Set up context with note content
      wrapper.vm.questionSearchContext = {
        selectedText: 'highlighted',
        startOffset: 0,
        endOffset: 11,
        highlightId: 'h-with-note',
        noteContent: 'Important note'
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchSelect({ targetMessageId: 'target-msg-789' })

      // Should preserve note content
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-preserve-note']
      expect(storeMessage.customContent[0].noteContent).toBe('Important note')
      expect(storeMessage.customContent[0].hasNote).toBe(true)
    })

    it('handleQuestionSearchSelect does nothing if no context', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-no-context',
        question: 'Q',
        response: 'some text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-no-context'] = testMessage
      wrapper.vm.questionSearchContext = null

      wrapper.vm.handleQuestionSearchSelect({ targetMessageId: 'target-123' })

      // Should not create anything
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-no-context']
      expect(storeMessage.customContent.length).toBe(0)
    })

    it('handleQuestionSearchSelect clears temp highlight', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-clear-temp',
        question: 'Q',
        response: 'text to link',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-clear-temp'] = testMessage

      const state = getState(wrapper)
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'text to link',
        startOffset: 0,
        endOffset: 12
      }

      wrapper.vm.questionSearchContext = {
        selectedText: 'text to link',
        startOffset: 0,
        endOffset: 12,
        highlightId: null,
        noteContent: ''
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchSelect({ targetMessageId: 'target-123' })

      expect(state.tempHighlight).toBe(null)
    })

    it('handleQuestionSearchCancel closes modal and clears state', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-cancel',
        question: 'Q',
        response: 'some text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      const state = getState(wrapper)
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'some',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.questionSearchContext = {
        selectedText: 'some',
        startOffset: 0,
        endOffset: 4,
        highlightId: null,
        noteContent: ''
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchCancel()

      expect(wrapper.vm.showQuestionSearch).toBe(false)
      expect(wrapper.vm.questionSearchContext).toBe(null)
      expect(state.tempHighlight).toBe(null)
    })

    it('handleQuestionSearchCancel does not create question link', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-cancel-no-link',
        question: 'Q',
        response: 'some text',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-cancel-no-link'] = testMessage

      wrapper.vm.questionSearchContext = {
        selectedText: 'some',
        startOffset: 0,
        endOffset: 4,
        highlightId: null,
        noteContent: ''
      }
      wrapper.vm.showQuestionSearch = true

      wrapper.vm.handleQuestionSearchCancel()

      // Should not create any custom content
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-cancel-no-link']
      expect(storeMessage.customContent.length).toBe(0)
    })
  })

  describe('Dictionary Behavior', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('handleDictionary opens dictionary modal with streaming state', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict',
        question: 'Q',
        response: 'word to define here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 0
      state.popup.endOffset = 4
      state.popup.colorIndex = 0
      state.popup.mode = 'context-menu'

      // Mock the API to resolve immediately
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Definition response')

      // Start the dictionary lookup (don't await yet)
      const promise = wrapper.vm.handleDictionary()

      // Check immediate state changes - now uses DictionaryModal
      expect(wrapper.vm.showDictionaryModal).toBe(true)
      expect(wrapper.vm.dictionaryWord).toBe('word')
      expect(wrapper.vm.isDictionaryStreaming).toBe(true)
      // Context menu should be closed
      expect(state.popup.mode).toBe(null)

      await promise
    })

    it('handleDictionary opens modal and sets word correctly', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-temp',
        question: 'Q',
        response: 'some word here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-temp'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 5
      state.popup.endOffset = 9
      state.popup.colorIndex = 2
      state.popup.highlightId = null
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Definition')

      const promise = wrapper.vm.handleDictionary()

      // Should open dictionary modal with the word
      expect(wrapper.vm.showDictionaryModal).toBe(true)
      expect(wrapper.vm.dictionaryWord).toBe('word')

      await promise
    })

    it('handleDictionary does NOT create temp highlight for existing highlight', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-existing',
        question: 'Q',
        response: 'highlighted word here',
        customContent: [{
          id: 'existing-h',
          type: 'highlight',
          text: 'word',
          startOffset: 12,
          endOffset: 16,
          colorIndex: 1
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-existing'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 12
      state.popup.endOffset = 16
      state.popup.colorIndex = 1
      state.popup.highlightId = 'existing-h'
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Definition')

      const promise = wrapper.vm.handleDictionary()

      // Should NOT create temp highlight for existing
      expect(state.tempHighlight).toBe(null)

      await promise
    })

    it('handleDictionary validates selection data before proceeding', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      state.popup.selectedText = 'word'
      state.popup.startOffset = undefined
      state.popup.endOffset = undefined

      await wrapper.vm.handleDictionary()

      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data for dictionary')
      consoleSpy.mockRestore()
    })

    it('handleDictionary streams content to dictionaryDefinition', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-stream',
        question: 'Q',
        response: 'dictionary test',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Create mock chat service
      const mockChatService = {
        sendMessageForFeature: vi.fn((_featureType, _messages, callback) => {
          callback('**Spelling**: ')
          callback('word')
          return Promise.resolve('**Spelling**: word')
        })
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-stream'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 0
      state.popup.endOffset = 4
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleDictionary()

      // After streaming completes, dictionaryDefinition should have the streamed content
      expect(wrapper.vm.dictionaryDefinition).toBe('**Spelling**: word')
    })

    it('handleDictionary sets isDictionaryStreaming to false after completion', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-end',
        question: 'Q',
        response: 'test word',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-end'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 5
      state.popup.endOffset = 9
      state.popup.mode = 'context-menu'

      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Done')

      await wrapper.vm.handleDictionary()

      expect(wrapper.vm.isDictionaryStreaming).toBe(false)
    })

    it('handleDictionary sets error on API failure', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-error',
        question: 'Q',
        response: 'error word',
        customContent: [],
        childIds: [],
        parentId: null
      }

      // Create mock chat service that rejects
      const mockChatService = {
        sendMessageForFeature: vi.fn().mockRejectedValue(new Error('API Error'))
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage, chatService: mockChatService },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-error'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'word'
      state.popup.startOffset = 6
      state.popup.endOffset = 10
      state.popup.mode = 'context-menu'

      await wrapper.vm.handleDictionary()

      expect(wrapper.vm.isDictionaryStreaming).toBe(false)
      expect(state.error).toBe('API Error')
    })

    it('handleDictionary uses getDictionaryPrompts', async () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-dict-prompts',
        question: 'Q',
        response: 'ephemeral word here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-dict-prompts'] = testMessage

      const state = getState(wrapper)
      state.popup.selectedText = 'ephemeral'
      state.popup.startOffset = 0
      state.popup.endOffset = 9
      state.popup.mode = 'context-menu'

      // Spy on getDictionaryPrompts
      const getDictionaryPromptsSpy = vi.spyOn(extraPrompt, 'getDictionaryPrompts')
      vi.spyOn(api, 'sendChatMessage').mockResolvedValue('Definition')

      await wrapper.vm.handleDictionary()

      expect(getDictionaryPromptsSpy).toHaveBeenCalled()
      expect(getDictionaryPromptsSpy).toHaveBeenCalledWith('ephemeral', expect.any(Array))

      getDictionaryPromptsSpy.mockRestore()
    })
  })

  describe('Note Save/Cancel/Delete Behavior', () => {
    it('handleNoteSave creates new highlight with note from tempHighlight when isNewNote', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-save-temp-new',
        question: 'Q',
        response: 'text to highlight with note',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-save-temp-new'] = testMessage

      const state = getState(wrapper)

      // Simulate new note with temp highlight (from handleAddNote on new selection)
      state.popup.mode = 'note'
      state.popup.isNewNote = true
      state.popup.highlightId = '__temp_highlight_with_note__'
      state.popup.selectedText = 'to highlight'
      state.popup.startOffset = 5
      state.popup.endOffset = 17
      state.popup.noteContent = ''
      state.popup.customPromptText = ''
      state.tempHighlight = {
        id: '__temp_highlight_with_note__',
        type: 'highlight',
        text: 'to highlight',
        startOffset: 5,
        endOffset: 17,
        colorIndex: 2,
        hasNote: true,
        noteContent: ''
      }

      wrapper.vm.handleNoteSave({
        noteId: '__temp_highlight_with_note__',
        content: 'My new note'
      })

      // Should create permanent highlight with note
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-save-temp-new']
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].text).toBe('to highlight')
      expect(storeMessage.customContent[0].colorIndex).toBe(2)
      expect(storeMessage.customContent[0].noteContent).toBe('My new note')
      expect(storeMessage.customContent[0].hasNote).toBe(true)

      // Temp highlight should be cleared
      expect(state.tempHighlight).toBe(null)

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteSave updates existing highlight with note when customPromptText and highlightId exist', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-save-existing',
        question: 'Q',
        response: 'text with highlight',
        customContent: [{
          id: 'existing-highlight',
          type: 'highlight',
          text: 'with highlight',
          startOffset: 5,
          endOffset: 19,
          colorIndex: 0
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-save-existing'] = testMessage

      const state = getState(wrapper)

      // Simulate custom prompt on existing highlight (no tempHighlight)
      state.popup.mode = 'note'
      state.popup.customPromptText = 'custom prompt text'
      state.popup.highlightId = 'existing-highlight'
      state.popup.noteContent = 'Generated explanation'
      state.tempHighlight = null // No temp highlight

      wrapper.vm.handleNoteSave({
        noteId: 'existing-highlight',
        content: 'Generated explanation'
      })

      // Should update existing highlight with note
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-save-existing']
      expect(storeMessage.customContent[0].hasNote).toBe(true)
      expect(storeMessage.customContent[0].noteContent).toBe('Generated explanation')

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteSave creates highlight from isNewNote without tempHighlight', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-save-new-no-temp',
        question: 'Q',
        response: 'text to highlight',
        customContent: [{
          id: 'highlight-no-note',
          type: 'highlight',
          text: 'to highlight',
          startOffset: 5,
          endOffset: 17,
          colorIndex: 0
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-save-new-no-temp'] = testMessage

      const state = getState(wrapper)

      // Simulate adding note to existing highlight (isNewNote true, no tempHighlight)
      state.popup.mode = 'note'
      state.popup.isNewNote = true
      state.popup.highlightId = 'highlight-no-note'
      state.popup.noteContent = ''
      state.popup.customPromptText = ''
      state.tempHighlight = null

      wrapper.vm.handleNoteSave({
        noteId: 'highlight-no-note',
        content: 'New note content'
      })

      // Should update existing highlight with note
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-save-new-no-temp']
      expect(storeMessage.customContent[0].hasNote).toBe(true)
      expect(storeMessage.customContent[0].noteContent).toBe('New note content')

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteSave updates note content when editing existing note (not new)', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-edit-existing-note',
        question: 'Q',
        response: 'text with existing note',
        customContent: [{
          id: 'note-to-edit',
          type: 'highlight',
          text: 'with existing',
          startOffset: 5,
          endOffset: 18,
          colorIndex: 0,
          hasNote: true,
          noteContent: 'Original note'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-edit-existing-note'] = testMessage

      const state = getState(wrapper)

      // Simulate editing existing note (not new, not custom prompt)
      state.popup.mode = 'note'
      state.popup.isNewNote = false
      state.popup.highlightId = 'note-to-edit'
      state.popup.noteContent = 'Original note'
      state.popup.customPromptText = ''
      state.tempHighlight = null

      wrapper.vm.handleNoteSave({
        noteId: 'note-to-edit',
        content: 'Updated note content'
      })

      // Should update note content without closing popup
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-edit-existing-note']
      expect(storeMessage.customContent[0].noteContent).toBe('Updated note content')

      // Should update popup state but NOT close
      expect(state.popup.noteContent).toBe('Updated note content')
      expect(state.popup.mode).toBe('note') // Still in note mode
    })

    it('handleNoteCancel clears tempHighlight when isNewNote is true', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-cancel-new',
        question: 'Q',
        response: 'text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      const state = getState(wrapper)

      // Simulate new note with temp highlight
      state.popup.mode = 'note'
      state.popup.isNewNote = true
      state.tempHighlight = {
        id: '__temp_highlight_with_note__',
        type: 'highlight',
        text: 'temp',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.handleNoteCancel()

      // Temp highlight should be cleared
      expect(state.tempHighlight).toBe(null)
      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteCancel clears tempHighlight when customPromptText exists', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-cancel-custom',
        question: 'Q',
        response: 'text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      const state = getState(wrapper)

      // Simulate custom prompt note with temp highlight
      state.popup.mode = 'note'
      state.popup.isNewNote = false
      state.popup.customPromptText = 'some custom prompt'
      state.tempHighlight = {
        id: 'temp-id',
        type: 'highlight',
        text: 'temp',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.handleNoteCancel()

      // Temp highlight should be cleared
      expect(state.tempHighlight).toBe(null)
      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteCancel does not clear tempHighlight when editing existing note', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-cancel-existing',
        question: 'Q',
        response: 'text here',
        customContent: [],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      const state = getState(wrapper)

      // Simulate editing existing note (not new, no custom prompt)
      state.popup.mode = 'note'
      state.popup.isNewNote = false
      state.popup.customPromptText = ''
      state.tempHighlight = null // No temp highlight for existing notes

      wrapper.vm.handleNoteCancel()

      // Should just close popup
      expect(state.popup.mode).toBe(null)
    })

    it('handleNoteDelete removes note from highlight', () => {
      const pinia = createPinia()
      const testMessage = {
        id: 'msg-delete-note',
        question: 'Q',
        response: 'text with note to delete',
        customContent: [{
          id: 'note-to-delete',
          type: 'highlight',
          text: 'with note',
          startOffset: 5,
          endOffset: 14,
          colorIndex: 0,
          hasNote: true,
          noteContent: 'Note to be deleted'
        }],
        childIds: [],
        parentId: null
      }

      wrapper = mount(ChatMessage, {
        props: { message: testMessage },
        global: { plugins: [pinia] }
      })

      wrapper.vm.chatStore.messagesById['msg-delete-note'] = testMessage

      const state = getState(wrapper)
      state.popup.mode = 'note'
      state.popup.highlightId = 'note-to-delete'

      wrapper.vm.handleNoteDelete({ noteId: 'note-to-delete' })

      // Note should be removed from highlight
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-delete-note']
      expect(storeMessage.customContent[0].hasNote).toBe(false)
      expect(storeMessage.customContent[0].noteContent).toBe('')

      // Popup should be closed
      expect(state.popup.mode).toBe(null)
    })
  })
})
