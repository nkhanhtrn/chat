import { reactive, computed } from 'vue'

/**
 * Composable for managing popup/context menu state in ChatMessage
 * Handles context menu and note modal states
 */
export function usePopupState() {
  const state = reactive({
    mode: null, // 'context-menu' | 'note' | null
    x: 0,
    y: 0,
    selectedText: '',
    highlightId: null,
    startOffset: undefined,
    endOffset: undefined,
    colorIndex: 0,
    noteContent: '',
    isNewNote: false, // true when creating a new note (temp)
    startInEditMode: false, // true when opened via context menu (add/edit note)
    isStreaming: false, // true when streaming content into note
    isCustomPrompt: false, // true when showing custom prompt result
    customPromptText: '' // the custom prompt text for explore action
  })

  const isContextMenuOpen = computed(() => state.mode === 'context-menu')
  const isNoteOpen = computed(() => state.mode === 'note')
  const isOpen = computed(() => state.mode !== null)

  function openContextMenu({ x, y, selectedText, startOffset, endOffset, highlightId = null, colorIndex = 0, noteContent = '' }) {
    state.mode = 'context-menu'
    state.x = x
    state.y = y
    state.selectedText = selectedText
    state.startOffset = startOffset
    state.endOffset = endOffset
    state.highlightId = highlightId
    state.colorIndex = colorIndex
    state.noteContent = noteContent
    state.isNewNote = false
    state.startInEditMode = false
    state.isStreaming = false
    state.isCustomPrompt = false
    state.customPromptText = ''
  }

  function openNote({ highlightId, noteContent = '', selectedText = '', startOffset, endOffset, isNewNote = false, startInEditMode = false, isCustomPrompt = false, customPromptText = '' }) {
    state.mode = 'note'
    state.highlightId = highlightId
    state.noteContent = noteContent
    state.selectedText = selectedText
    state.startOffset = startOffset
    state.endOffset = endOffset
    state.isNewNote = isNewNote
    state.startInEditMode = startInEditMode
    state.isCustomPrompt = isCustomPrompt
    state.customPromptText = customPromptText
  }

  function openNoteForStreaming({ highlightId, selectedText, startOffset, endOffset, isCustomPrompt = false, customPromptText = '' }) {
    state.mode = 'note'
    state.highlightId = highlightId
    state.selectedText = selectedText
    state.startOffset = startOffset
    state.endOffset = endOffset
    state.noteContent = ''
    state.isNewNote = false
    state.startInEditMode = false
    state.isStreaming = true
    state.isCustomPrompt = isCustomPrompt
    state.customPromptText = customPromptText
  }

  function appendToNoteContent(chunk) {
    state.noteContent += chunk
  }

  function stopStreaming() {
    state.isStreaming = false
  }

  function updateColorIndex(colorIndex) {
    state.colorIndex = colorIndex
  }

  function close() {
    state.mode = null
    state.highlightId = null
    state.noteContent = ''
    state.isNewNote = false
    state.startInEditMode = false
    state.isStreaming = false
    state.isCustomPrompt = false
    state.customPromptText = ''
  }

  return {
    state,
    isContextMenuOpen,
    isNoteOpen,
    isOpen,
    openContextMenu,
    openNote,
    openNoteForStreaming,
    appendToNoteContent,
    stopStreaming,
    updateColorIndex,
    close
  }
}
