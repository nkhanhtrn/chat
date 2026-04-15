import { reactive, computed } from 'vue'

export interface PopupState {
  mode: 'context-menu' | 'note' | null
  x: number
  y: number
  selectedText: string
  highlightId: string | null
  startOffset: number | undefined
  endOffset: number | undefined
  colorIndex: number
  noteContent: string
  isNewNote: boolean
  startInEditMode: boolean
  isStreaming: boolean
  isCustomPrompt: boolean
  customPromptText: string
}

export function usePopupState() {
  const state = reactive<PopupState>({
    mode: null,
    x: 0,
    y: 0,
    selectedText: '',
    highlightId: null,
    startOffset: undefined,
    endOffset: undefined,
    colorIndex: 0,
    noteContent: '',
    isNewNote: false,
    startInEditMode: false,
    isStreaming: false,
    isCustomPrompt: false,
    customPromptText: '',
  })

  const isContextMenuOpen = computed(() => state.mode === 'context-menu')
  const isNoteOpen = computed(() => state.mode === 'note')
  const isOpen = computed(() => state.mode !== null)

  function openContextMenu(params: {
    x: number; y: number; selectedText: string
    startOffset: number; endOffset: number
    highlightId?: string | null; colorIndex?: number; noteContent?: string
  }) {
    state.mode = 'context-menu'
    state.x = params.x
    state.y = params.y
    state.selectedText = params.selectedText
    state.startOffset = params.startOffset
    state.endOffset = params.endOffset
    state.highlightId = params.highlightId ?? null
    state.colorIndex = params.colorIndex ?? 0
    state.noteContent = params.noteContent ?? ''
    state.isNewNote = false
    state.startInEditMode = false
    state.isStreaming = false
    state.isCustomPrompt = false
    state.customPromptText = ''
  }

  function openNote(params: {
    highlightId: string; noteContent?: string; selectedText?: string
    startOffset?: number; endOffset?: number
    isNewNote?: boolean; startInEditMode?: boolean
    isCustomPrompt?: boolean; customPromptText?: string
  }) {
    state.mode = 'note'
    state.highlightId = params.highlightId
    state.noteContent = params.noteContent ?? ''
    state.selectedText = params.selectedText ?? ''
    state.startOffset = params.startOffset
    state.endOffset = params.endOffset
    state.isNewNote = params.isNewNote ?? false
    state.startInEditMode = params.startInEditMode ?? false
    state.isCustomPrompt = params.isCustomPrompt ?? false
    state.customPromptText = params.customPromptText ?? ''
  }

  function openNoteForStreaming(params: {
    highlightId: string; selectedText: string
    startOffset: number; endOffset: number
    isCustomPrompt?: boolean; customPromptText?: string
  }) {
    state.mode = 'note'
    state.highlightId = params.highlightId
    state.selectedText = params.selectedText
    state.startOffset = params.startOffset
    state.endOffset = params.endOffset
    state.noteContent = ''
    state.isNewNote = false
    state.startInEditMode = false
    state.isStreaming = true
    state.isCustomPrompt = params.isCustomPrompt ?? false
    state.customPromptText = params.customPromptText ?? ''
  }

  function appendToNoteContent(chunk: string) {
    state.noteContent += chunk
  }

  function stopStreaming() {
    state.isStreaming = false
  }

  function updateColorIndex(colorIndex: number) {
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
    close,
  }
}
