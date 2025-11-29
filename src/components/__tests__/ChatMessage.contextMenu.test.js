import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import ChatMessage from '../ChatMessage.vue'

// Helper to access state from setup script
function getState(wrapper) {
  return wrapper.vm.$.setupState.state
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
      expect(state.contextMenu.visible).toBe(true)
      expect(state.contextMenu.selectedText).toBe('test selection')
      expect(state.contextMenu.startOffset).toBe(10)
      expect(state.contextMenu.endOffset).toBe(25)
      expect(state.contextMenu.x).toBe(100)
      expect(state.contextMenu.y).toBe(200)

      // But NO permanent highlight should be created yet
      expect(state.contextMenu.highlightId).toBe(null)
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

      expect(state.contextMenu.startOffset).toBe(5)
      expect(state.contextMenu.endOffset).toBe(13)
    })

    it('showContextMenu hides contextMenu if no text selected', () => {
      const mockSelection = { toString: () => '', getRangeAt: vi.fn() }
      window.getSelection = vi.fn(() => mockSelection)
      wrapper.vm.showContextMenu()
      const state = getState(wrapper)
      expect(state.contextMenu.visible).toBe(false)
      expect(state.contextMenu.selectedText).toBe('')
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
      state.contextMenu.selectedText = 'test highlight'
      state.contextMenu.startOffset = 0
      state.contextMenu.endOffset = 14
      state.contextMenu.visible = true

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
      expect(state.contextMenu.visible).toBe(false)

      // Temporary highlight should be cleared
      expect(state.tempHighlight).toBe(null)
    })

    it('keepHighlight clears temporary highlight', () => {
      const state = getState(wrapper)
      state.contextMenu.selectedText = 'text'
      state.contextMenu.startOffset = 0
      state.contextMenu.endOffset = 4
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
      state.contextMenu.selectedText = ''
      state.contextMenu.startOffset = undefined
      state.contextMenu.endOffset = undefined

      const initialContent = wrapper.vm.$.props.message.customContent || []
      wrapper.vm.keepHighlight()

      // No highlight should be added
      expect(wrapper.vm.$.props.message.customContent || []).toEqual(initialContent)
    })
  })

  describe('Close Context Menu Behavior', () => {
    it('closeContextMenu clears temporary highlight', () => {
      const state = getState(wrapper)
      state.contextMenu.visible = true
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'temp',
        startOffset: 0,
        endOffset: 4
      }

      wrapper.vm.closeContextMenu()

      expect(state.tempHighlight).toBe(null)
      expect(state.contextMenu.visible).toBe(false)
    })

    it('closeContextMenu does not remove highlights when closed', () => {
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
      state.contextMenu.selectedText = 'temp'
      state.contextMenu.startOffset = 0
      state.contextMenu.endOffset = 4
      wrapper.vm.keepHighlight()

      // Get the created highlight ID from the store
      const storeMessage = wrapper.vm.chatStore.messagesById['msg-close']
      const highlightId = storeMessage.customContent[0].id

      // Set it in state as if context menu had it
      state.contextMenu.highlightId = highlightId
      state.contextMenu.visible = true

      // Close context menu
      wrapper.vm.closeContextMenu()

      // Highlight should NOT be removed
      expect(storeMessage.customContent.length).toBe(1)
      expect(storeMessage.customContent[0].id).toBe(highlightId)
    })

    it('closeContextMenu does nothing if no highlight exists', () => {
      const state = getState(wrapper)
      state.contextMenu.visible = true
      state.contextMenu.highlightId = null

      // Should not throw error
      expect(() => wrapper.vm.closeContextMenu()).not.toThrow()
      expect(state.contextMenu.visible).toBe(false)
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
      state.contextMenu.selectedText = 'question text'
      state.contextMenu.startOffset = 0
      state.contextMenu.endOffset = 13
      state.tempHighlight = {
        id: '__temp_highlight__',
        type: 'highlight',
        text: 'question text',
        startOffset: 0,
        endOffset: 13
      }

      // Mock the API calls to prevent actual requests
      const mockGetQuestionSummary = vi.fn().mockResolvedValue('Summary')
      const mockSendChatMessage = vi.fn().mockResolvedValue(undefined)

      vi.doMock('../../services/api.js', () => ({
        getQuestionSummary: mockGetQuestionSummary,
        sendChatMessage: mockSendChatMessage
      }))

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
      state.contextMenu.selectedText = 'selected text'
      state.contextMenu.startOffset = 5
      state.contextMenu.endOffset = 18

      // No highlight should exist at this point
      expect(state.contextMenu.highlightId).toBe(null)

      // Mock the API calls
      const mockGetQuestionSummary = vi.fn().mockResolvedValue('Summary')
      const mockSendChatMessage = vi.fn().mockResolvedValue(undefined)

      vi.doMock('../../services/api.js', () => ({
        getQuestionSummary: mockGetQuestionSummary,
        sendChatMessage: mockSendChatMessage
      }))

      // Should work without errors
      await wrapper.vm.handleAskQuestion('Explain this')

      // Context menu should be closed
      expect(state.contextMenu.visible).toBe(false)
    })

    it('handleAskQuestion validates selection data before proceeding', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
      const state = getState(wrapper)

      // Invalid data - missing offsets
      state.contextMenu.selectedText = 'text'
      state.contextMenu.startOffset = undefined
      state.contextMenu.endOffset = undefined

      await wrapper.vm.handleAskQuestion('Question?')

      // Should log error and not proceed
      expect(consoleSpy).toHaveBeenCalledWith('Invalid selection data')
      consoleSpy.mockRestore()
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

      expect(state.contextMenu.visible).toBe(true)
      expect(state.contextMenu.selectedText).toBe('highlighted text')
      expect(state.contextMenu.startOffset).toBe(10)
      expect(state.contextMenu.endOffset).toBe(26)
      expect(state.contextMenu.x).toBe(150)
      expect(state.contextMenu.y).toBe(250)
      expect(state.contextMenu.highlightId).toBe('h-123')
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
      expect(state.contextMenu.highlightId).toBe('existing-highlight')
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

      expect(state.contextMenu.x).toBe(300)
      expect(state.contextMenu.y).toBe(400)
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
      expect(state.contextMenu.visible).toBe(true)
      expect(state.contextMenu.selectedText).toBe('highlighted')

      // User can now ask question using the stored highlight data
      const mockGetQuestionSummary = vi.fn().mockResolvedValue('Summary')
      const mockSendChatMessage = vi.fn().mockResolvedValue(undefined)

      vi.doMock('../../services/api.js', () => ({
        getQuestionSummary: mockGetQuestionSummary,
        sendChatMessage: mockSendChatMessage
      }))

      await wrapper.vm.handleAskQuestion('What does this mean?')

      expect(state.contextMenu.visible).toBe(false)
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

      // Set a non-default color index before selecting
      const state = getState(wrapper)
      state.contextMenu.colorIndex = 3

      wrapper.vm.showContextMenu()

      // Temp highlight should always use first color, regardless of contextMenu.colorIndex
      expect(state.tempHighlight.colorIndex).toBe(0)
      // But the context menu colorIndex should remain unchanged
      expect(state.contextMenu.colorIndex).toBe(3)
    })
  })
})
