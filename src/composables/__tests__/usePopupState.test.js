import { describe, it, expect } from 'vitest'
import { usePopupState } from '../usePopupState.js'

describe('usePopupState', () => {
  describe('initial state', () => {
    it('starts with mode null', () => {
      const { state } = usePopupState()
      expect(state.mode).toBe(null)
    })

    it('starts with all properties at defaults', () => {
      const { state } = usePopupState()
      expect(state.x).toBe(0)
      expect(state.y).toBe(0)
      expect(state.selectedText).toBe('')
      expect(state.highlightId).toBe(null)
      expect(state.colorIndex).toBe(0)
      expect(state.noteContent).toBe('')
      expect(state.isNewNote).toBe(false)
      expect(state.startInEditMode).toBe(false)
      expect(state.isStreaming).toBe(false)
      expect(state.isCustomPrompt).toBe(false)
      expect(state.customPromptText).toBe('')
    })
  })

  describe('computed properties', () => {
    it('isOpen is false initially', () => {
      const { isOpen } = usePopupState()
      expect(isOpen.value).toBe(false)
    })

    it('isContextMenuOpen is false initially', () => {
      const { isContextMenuOpen } = usePopupState()
      expect(isContextMenuOpen.value).toBe(false)
    })

    it('isNoteOpen is false initially', () => {
      const { isNoteOpen } = usePopupState()
      expect(isNoteOpen.value).toBe(false)
    })
  })

  describe('openContextMenu', () => {
    it('sets mode to context-menu', () => {
      const { state, openContextMenu } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.mode).toBe('context-menu')
    })

    it('sets position and text data', () => {
      const { state, openContextMenu } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test text',
        startOffset: 5,
        endOffset: 14
      })

      expect(state.x).toBe(100)
      expect(state.y).toBe(200)
      expect(state.selectedText).toBe('test text')
      expect(state.startOffset).toBe(5)
      expect(state.endOffset).toBe(14)
    })

    it('sets optional highlight data', () => {
      const { state, openContextMenu } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4,
        highlightId: 'h123',
        colorIndex: 2,
        noteContent: 'existing note'
      })

      expect(state.highlightId).toBe('h123')
      expect(state.colorIndex).toBe(2)
      expect(state.noteContent).toBe('existing note')
    })

    it('updates isContextMenuOpen computed', () => {
      const { isContextMenuOpen, openContextMenu } = usePopupState()

      openContextMenu({
        x: 0,
        y: 0,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(isContextMenuOpen.value).toBe(true)
    })

    it('resets note-related flags', () => {
      const { state, openContextMenu } = usePopupState()

      // Set some flags first
      state.isNewNote = true
      state.startInEditMode = true
      state.isStreaming = true

      openContextMenu({
        x: 0,
        y: 0,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.isNewNote).toBe(false)
      expect(state.startInEditMode).toBe(false)
      expect(state.isStreaming).toBe(false)
    })
  })

  describe('openNote', () => {
    it('sets mode to note', () => {
      const { state, openNote } = usePopupState()

      openNote({
        highlightId: 'h123',
        noteContent: 'content',
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.mode).toBe('note')
    })

    it('sets note data', () => {
      const { state, openNote } = usePopupState()

      openNote({
        highlightId: 'h123',
        noteContent: 'my note',
        selectedText: 'highlighted',
        startOffset: 10,
        endOffset: 21,
        isNewNote: true,
        startInEditMode: true
      })

      expect(state.highlightId).toBe('h123')
      expect(state.noteContent).toBe('my note')
      expect(state.selectedText).toBe('highlighted')
      expect(state.isNewNote).toBe(true)
      expect(state.startInEditMode).toBe(true)
    })

    it('updates isNoteOpen computed', () => {
      const { isNoteOpen, openNote } = usePopupState()

      openNote({
        highlightId: 'h123',
        startOffset: 0,
        endOffset: 4
      })

      expect(isNoteOpen.value).toBe(true)
    })
  })

  describe('openNoteForStreaming', () => {
    it('sets mode to note with streaming enabled', () => {
      const { state, openNoteForStreaming } = usePopupState()

      openNoteForStreaming({
        highlightId: 'h123',
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.mode).toBe('note')
      expect(state.isStreaming).toBe(true)
    })

    it('sets custom prompt data', () => {
      const { state, openNoteForStreaming } = usePopupState()

      openNoteForStreaming({
        highlightId: 'h123',
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4,
        isCustomPrompt: true,
        customPromptText: 'explain this'
      })

      expect(state.isCustomPrompt).toBe(true)
      expect(state.customPromptText).toBe('explain this')
    })

    it('resets noteContent', () => {
      const { state, openNoteForStreaming } = usePopupState()
      state.noteContent = 'old content'

      openNoteForStreaming({
        highlightId: 'h123',
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.noteContent).toBe('')
    })
  })

  describe('appendToNoteContent', () => {
    it('appends chunk to noteContent', () => {
      const { state, appendToNoteContent } = usePopupState()

      appendToNoteContent('Hello ')
      appendToNoteContent('world')

      expect(state.noteContent).toBe('Hello world')
    })
  })

  describe('stopStreaming', () => {
    it('sets isStreaming to false', () => {
      const { state, openNoteForStreaming, stopStreaming } = usePopupState()

      openNoteForStreaming({
        highlightId: 'h123',
        selectedText: 'text',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.isStreaming).toBe(true)

      stopStreaming()

      expect(state.isStreaming).toBe(false)
    })
  })

  describe('updateColorIndex', () => {
    it('updates colorIndex', () => {
      const { state, updateColorIndex } = usePopupState()

      updateColorIndex(3)

      expect(state.colorIndex).toBe(3)
    })
  })

  describe('close', () => {
    it('resets mode to null', () => {
      const { state, openContextMenu, close } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      close()

      expect(state.mode).toBe(null)
    })

    it('resets all relevant properties', () => {
      const { state, openContextMenu, close } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4,
        highlightId: 'h123',
        noteContent: 'note'
      })

      close()

      expect(state.highlightId).toBe(null)
      expect(state.noteContent).toBe('')
      expect(state.isNewNote).toBe(false)
      expect(state.startInEditMode).toBe(false)
      expect(state.isStreaming).toBe(false)
      expect(state.isCustomPrompt).toBe(false)
      expect(state.customPromptText).toBe('')
    })

    it('updates isOpen computed', () => {
      const { isOpen, openContextMenu, close } = usePopupState()

      openContextMenu({
        x: 0,
        y: 0,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(isOpen.value).toBe(true)

      close()

      expect(isOpen.value).toBe(false)
    })
  })

  describe('state transitions', () => {
    it('can transition from context menu to note', () => {
      const { state, openContextMenu, openNote } = usePopupState()

      openContextMenu({
        x: 100,
        y: 200,
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4
      })

      expect(state.mode).toBe('context-menu')

      openNote({
        highlightId: 'h123',
        noteContent: '',
        selectedText: 'test',
        startOffset: 0,
        endOffset: 4,
        isNewNote: true,
        startInEditMode: true
      })

      expect(state.mode).toBe('note')
      expect(state.isNewNote).toBe(true)
    })
  })
})
