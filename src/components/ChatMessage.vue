<template>
  <div>
    <!-- Root question -->
    <div class="message message-user">
      <div class="message-content">
        <div class="user-message">
          {{ rootMessage.question }}
        </div>
      </div>
    </div>

     <!-- Breadcrumb navigation (shown when message has children) -->
     <MessageNavigation v-if="hasChildren" :current-message="currentMessage" />

     <!-- Assistant answer with streaming -->
     <div v-if="isStreaming || currentResponse" class="message message-assistant">
       <div class="message-content" style="position: relative;">
         <div class="assistant-message" @mouseup="showContextMenu">
           <MarkdownRenderer
             :content="currentResponse"
             :custom-content="effectiveCustomContent"
             @question-link-click="navigateToChild"
             @highlight-click="handleHighlightClick"
             @note-click="handleNoteClick"
           />
           <span v-if="isStreaming" class="cursor">▊</span>
         </div>
         <div v-if="state.error" class="error-message">{{ state.error }}</div>
         <ContextMenu
           :visible="state.popup.mode === 'context-menu'"
           :x="state.popup.x"
           :y="state.popup.y"
           :highlighted-text="state.popup.selectedText"
           :is-streaming="isStreaming"
           :color-index="state.popup.colorIndex"
           :has-existing-highlight="!!state.popup.highlightId"
           :has-existing-note="!!state.popup.noteContent"
           @close="closePopup"
           @keep-highlight="keepHighlight"
           @ask-question="handleAskQuestion"
           @change-color="handleChangeColor"
           @remove-highlight="handleRemoveHighlight"
           @add-chapter="handleAddChapter"
           @add-note="handleAddNote"
           @quick-explain="handleQuickExplain"
           @custom-prompt="handleCustomPrompt"
         />
         <Note
           :visible="state.popup.mode === 'note'"
           :note-id="state.popup.highlightId"
           :initial-content="state.popup.noteContent"
           :highlighted-text="state.popup.selectedText"
           :is-temp="state.popup.isNewNote"
           :start-in-edit-mode="state.popup.startInEditMode"
           :is-streaming="state.popup.isStreaming"
           :is-custom-prompt="state.popup.isCustomPrompt"
           :custom-prompt-text="state.popup.customPromptText"
           @save="handleNoteSave"
           @cancel="handleNoteCancel"
           @delete="handleNoteDelete"
           @detail-explain="handleNoteDetailExplain"
           @explore="handleNoteExplore"
         />
       </div>
     </div>
  </div>
</template>

<script setup>
import { reactive, computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import Note from './Note.vue'
import MessageNavigation from './MessageNavigation.vue'
import { sendChatMessage } from '../services/api.js'
import { getMainPrompts, getQuickExplainPrompts } from '../services/extraPrompt.js'
import Message from '../stores/Message.js'
import { getSelectedTextAndPosition as getSelectionWithOffsets } from '../services/DOMSelectionHelper.js'


const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isAppStreaming: {
    type: Boolean,
    default: false
  },
  getSelectedTextAndPosition: {
    type: Function,
    default: undefined
  }
})

const router = useRouter()
const chatStore = useChatStore()
const getScrollPosition = inject('getScrollPosition', () => 0)

const state = reactive({
  isChildStreaming: false,
  error: null,
  popup: {
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
  },
  tempHighlight: null
})

// Computed property to always get the root/original message (from props)
const rootMessage = computed(() => props.message)

// Get the currently viewed message from the store, or fall back to root message
const currentMessage = computed(() => {
  // If we have a current message in store and it's part of this tree, use it
  if (chatStore.currentMessage) {
    // Check if current message is this root or a descendant
    let msg = chatStore.currentMessage
    while (msg) {
      if (msg.id === rootMessage.value.id) {
        return chatStore.currentMessage
      }
      msg = msg.parentId ? chatStore.messagesById[msg.parentId] : null
    }
  }
  // Default to root message
  return rootMessage.value
})

// Computed property that directly tracks the response string for reactivity
const currentResponse = computed(() => {
  return currentMessage.value?.response || ''
})

// Computed property that merges customContent with temporary highlight
const effectiveCustomContent = computed(() => {
  const base = currentMessage.value?.customContent || []

  if (!state.tempHighlight) {
    return base
  }

  // Check for overlapping highlights with temp highlight
  const tempStart = state.tempHighlight.startOffset
  const tempEnd = state.tempHighlight.endOffset

  const overlapping = base.filter(
    item => item.type === 'highlight' &&
      item.startOffset < tempEnd &&
      item.endOffset > tempStart
  )

  if (overlapping.length === 0) {
    return [...base, state.tempHighlight]
  }

  // Calculate merged range
  let mergedStart = tempStart
  let mergedEnd = tempEnd
  overlapping.forEach(item => {
    mergedStart = Math.min(mergedStart, item.startOffset)
    mergedEnd = Math.max(mergedEnd, item.endOffset)
  })

  // Extract merged text from the response
  const mergedText = currentMessage.value?.response?.substring(mergedStart, mergedEnd) || state.tempHighlight.text

  // Create merged temp highlight
  const mergedTempHighlight = {
    ...state.tempHighlight,
    startOffset: mergedStart,
    endOffset: mergedEnd,
    text: mergedText
  }

  // Filter out overlapping highlights and add merged temp
  const result = base.filter(item => !overlapping.includes(item))
  result.push(mergedTempHighlight)
  return result
})

// Computed property that combines both streaming states
const isStreaming = computed(() => {
  return props.isAppStreaming || state.isChildStreaming
})

// Show breadcrumb when there are children or we're viewing a child message
const hasChildren = computed(() => {
  // Show if current message has children
  const children = chatStore.getChildren(currentMessage.value?.id)
  if (children && children.length > 0) return true
  // Show if we're not at the root (navigated deeper)
  return currentMessage.value?.id !== rootMessage.value.id
})

function showContextMenu(e) {
  const getSel = props.getSelectedTextAndPosition || getSelectionWithOffsets;
  const selectionData = getSel();
  const { selectedText, x, y, visible, startOffset, endOffset } = selectionData;

  if (visible && selectedText && startOffset !== undefined && endOffset !== undefined) {
    state.popup.mode = 'context-menu'
    state.popup.selectedText = selectedText
    state.popup.startOffset = startOffset
    state.popup.endOffset = endOffset
    state.popup.x = x
    state.popup.y = y
    state.popup.highlightId = null
    state.popup.colorIndex = 0
    state.popup.noteContent = ''

    state.tempHighlight = {
      id: '__temp_highlight__',
      type: 'highlight',
      text: selectedText,
      colorIndex: 0,
      startOffset,
      endOffset
    }

    window.getSelection()?.removeAllRanges()
  }
}

function closePopup() {
  state.popup.mode = null
  state.popup.highlightId = null
  state.popup.noteContent = ''
  state.popup.isNewNote = false
  state.popup.startInEditMode = false
  state.popup.isStreaming = false
  state.popup.isCustomPrompt = false
  state.popup.customPromptText = ''
  state.tempHighlight = null
}

function addHighlight(selectedText, startOffset, endOffset, colorIndex = 0) {
  if (!selectedText || !currentMessage.value) return null

  // Validate offsets (provided by DOM selection helper)
  if (startOffset === undefined || endOffset === undefined) {
    console.error('Invalid offsets for highlight - DOM selection helper may have failed')
    return null
  }

  // Create highlight metadata
  const highlightId = crypto.randomUUID()
  const highlight = {
    id: highlightId,
    type: 'highlight',
    text: selectedText,
    colorIndex,
    startOffset,
    endOffset
  }

  // Use store action to add highlight
  chatStore.addCustomContent(currentMessage.value.id, highlight)

  return highlightId
}

function removeHighlight(highlightId) {
  if (!highlightId || !currentMessage.value) return

  // Use store action to remove highlight
  chatStore.removeCustomContent(currentMessage.value.id, highlightId)
}

function keepHighlight(colorIndex) {
  if (state.popup.highlightId) {
    handleChangeColor(colorIndex)
    closePopup()
    return
  }

  const { selectedText, startOffset, endOffset } = state.popup
  if (selectedText && startOffset !== undefined && endOffset !== undefined) {
    addHighlight(selectedText, startOffset, endOffset, colorIndex)
  }

  closePopup()
}

// Build conversation history from root to current message (questions only)
function buildConversationChain(messageId) {
  const chain = []
  let msg = chatStore.messagesById[messageId]
  while (msg) {
    chain.unshift({ question: msg.question })
    msg = msg.parentId ? chatStore.messagesById[msg.parentId] : null
  }
  return chain
}

async function handleAskQuestion(question) {
  if (!question || state.isChildStreaming) return

  const { selectedText, startOffset, endOffset, highlightId, noteContent } = state.popup
  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data')
    return
  }

  const parentMessage = currentMessage.value
  const parentId = parentMessage.id

  // Capture note content from existing highlight before removing it
  const existingNoteContent = noteContent || ''

  // Remove existing highlight if present (before closePopup clears highlightId)
  if (highlightId) {
    removeHighlight(highlightId)
  }

  closePopup()

  // Create new child message with highlighted text
  const childMsg = Message.createChildMessage(parentId, question, selectedText)

  // Add child to store
  chatStore.addChildMessage(parentId, childMsg)

  // Add clickable question link to the PARENT message, preserving any note from the highlight
  addQuestionLinkToMessage(parentMessage, selectedText, childMsg.id, startOffset, endOffset, existingNoteContent)

  state.isChildStreaming = true
  state.error = null

  // Build conversation history from root to parent for context
  const previousMessages = buildConversationChain(parentId)

  try {
    // Get the explanation response (streaming)
    const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages);
    await sendChatMessage(
      chatStore.currentModel,
      messages,
      (chunk) => {
        chatStore.appendToResponse(childMsg.id, chunk)
      }
    )
  } catch (err) {
    state.error = err.message
  } finally {
    state.isChildStreaming = false
  }
}

function navigateToChild(targetMessageId) {
  // Save current scroll position before navigating
  if (chatStore.currentMessageId) {
    chatStore.saveScrollPosition(chatStore.currentMessageId, getScrollPosition())
  }

  // Update the router - the router watcher in ChatView will handle updating the store
  router.push({
    name: 'question',
    params: { id: chatStore.currentChatId, questionId: targetMessageId }
  })
}

function handleHighlightClick(highlightData) {
  const customContent = currentMessage.value?.customContent || []
  const highlight = customContent.find(item => item.id === highlightData.highlightId)

  state.popup.mode = 'context-menu'
  state.popup.selectedText = highlightData.text
  state.popup.startOffset = highlightData.startOffset
  state.popup.endOffset = highlightData.endOffset
  state.popup.x = highlightData.x
  state.popup.y = highlightData.y
  state.popup.highlightId = highlightData.highlightId
  state.popup.colorIndex = highlightData.colorIndex ?? 0
  state.popup.noteContent = highlight?.noteContent ?? ''
}

function handleChangeColor(colorIndex) {
  state.popup.colorIndex = colorIndex
  if (!state.popup.highlightId || !currentMessage.value) return
  chatStore.updateCustomContent(currentMessage.value.id, state.popup.highlightId, { colorIndex })
}

function handleRemoveHighlight() {
  if (state.popup.highlightId) {
    removeHighlight(state.popup.highlightId)
  }
  closePopup()
}

function addQuestionLinkToMessage(message, selectedText, targetMessageId, startOffset, endOffset, noteContent = '') {
  if (!selectedText || !message) return

  // Create question link metadata
  const linkId = crypto.randomUUID()
  const questionLink = {
    id: linkId,
    type: 'question-link',
    text: selectedText,
    targetMessageId,
    startOffset,
    endOffset
  }

  // Add note if provided
  if (noteContent) {
    questionLink.hasNote = true
    questionLink.noteContent = noteContent
  }

  // Use store action to add question link
  chatStore.addCustomContent(message.id, questionLink)
}

async function handleAddChapter(selectedText) {
  if (!selectedText || state.isChildStreaming) return

  const { startOffset, endOffset } = state.popup
  if (startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data')
    return
  }

  const parentMessage = currentMessage.value
  closePopup()

  // Create a new root message (new chat thread) with the selected text as question
  const newRootMsg = chatStore.addRootMessage({
    id: crypto.randomUUID(),
    question: selectedText,
    response: ''
  })

  // Add clickable question link to the PARENT message
  addQuestionLinkToMessage(parentMessage, selectedText, newRootMsg.id, startOffset, endOffset)

  state.isChildStreaming = true
  state.error = null

  try {
    const messages = getMainPrompts(`[NEWTOPIC] ${selectedText}`)
    await sendChatMessage(
      chatStore.currentModel,
      messages,
      (chunk) => {
        chatStore.appendToResponse(newRootMsg.id, chunk)
      }
    )
  } catch (err) {
    state.error = err.message
  } finally {
    state.isChildStreaming = false
  }
}

function handleAddNote() {
  const { selectedText, startOffset, endOffset, highlightId, noteContent, colorIndex } = state.popup

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for note')
    return
  }

  if (highlightId) {
    // Adding/editing note on existing highlight
    state.popup.mode = 'note'
    state.popup.isNewNote = !noteContent
    state.popup.startInEditMode = true
  } else {
    // Create temp highlight with note
    state.tempHighlight = {
      id: '__temp_highlight_with_note__',
      type: 'highlight',
      text: selectedText,
      colorIndex: colorIndex || 0,
      startOffset,
      endOffset,
      hasNote: true,
      noteContent: ''
    }
    state.popup.mode = 'note'
    state.popup.highlightId = '__temp_highlight_with_note__'
    state.popup.isNewNote = true
    state.popup.startInEditMode = true
  }
}

async function handleQuickExplain(customPrompt = null) {
  const { selectedText, startOffset, endOffset, colorIndex, highlightId } = state.popup
  const isCustomPrompt = !!customPrompt

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for quick explain')
    return
  }

  // For custom prompt, build the full prompt with context
  const promptText = isCustomPrompt
    ? `${customPrompt}\nfor more context: ${selectedText}`
    : selectedText

  // Check if we're updating an existing highlight or creating a new one
  const existingHighlightId = highlightId
  const targetHighlightId = existingHighlightId || crypto.randomUUID()

  // Switch to note mode immediately with streaming state
  state.popup.mode = 'note'
  state.popup.highlightId = targetHighlightId
  state.popup.noteContent = ''
  state.popup.isNewNote = false
  state.popup.startInEditMode = false
  state.popup.isStreaming = true
  state.popup.isCustomPrompt = isCustomPrompt
  state.popup.customPromptText = promptText

  // Only create temp highlight if there's no existing one
  if (!existingHighlightId) {
    state.tempHighlight = {
      id: targetHighlightId,
      type: 'highlight',
      text: selectedText,
      colorIndex: colorIndex || 0,
      startOffset,
      endOffset,
      hasNote: true,
      noteContent: ''
    }
  }

  state.isChildStreaming = true
  state.error = null

  // Build conversation history for context
  const previousMessages = buildConversationChain(currentMessage.value?.id)

  try {
    // Get the quick explanation from API with streaming
    const messages = getQuickExplainPrompts(promptText, previousMessages)
    await sendChatMessage(
      chatStore.currentModel,
      messages,
      (chunk) => {
        // Append chunk to note content for live streaming
        state.popup.noteContent += chunk
      }
    )

    // Don't save automatically - let user decide via Save/Explore buttons
  } catch (err) {
    state.error = err.message
    closePopup()
  } finally {
    state.isChildStreaming = false
    state.popup.isStreaming = false
  }
}

function handleCustomPrompt(customPrompt) {
  handleQuickExplain(customPrompt)
}

function handleNoteClick(noteData) {
  state.popup.mode = 'note'
  state.popup.x = noteData.x
  state.popup.y = noteData.y
  state.popup.highlightId = noteData.noteId
  state.popup.noteContent = noteData.noteContent || ''
  state.popup.selectedText = noteData.text
  state.popup.startOffset = noteData.startOffset
  state.popup.endOffset = noteData.endOffset
  state.popup.isNewNote = false
  state.popup.startInEditMode = false
}

function handleNoteSave({ noteId, content }) {
  // Streamed content mode (quick explain or custom prompt): save temp highlight with streamed content
  if (state.popup.customPromptText && state.tempHighlight) {
    const highlight = {
      id: crypto.randomUUID(),
      type: 'highlight',
      text: state.tempHighlight.text,
      colorIndex: state.tempHighlight.colorIndex || 0,
      startOffset: state.tempHighlight.startOffset,
      endOffset: state.tempHighlight.endOffset,
      hasNote: true,
      noteContent: content
    }
    chatStore.addCustomContent(currentMessage.value.id, highlight)
    state.tempHighlight = null
    closePopup()
  } else if (state.popup.customPromptText && state.popup.highlightId) {
    // Streamed content on existing highlight: update the highlight's note
    chatStore.updateCustomContent(currentMessage.value.id, state.popup.highlightId, {
      hasNote: true,
      noteContent: content
    })
    closePopup()
  } else if (state.popup.isNewNote) {
    if (state.tempHighlight) {
      // Convert temp highlight with note to permanent
      const highlight = {
        id: crypto.randomUUID(),
        type: 'highlight',
        text: state.tempHighlight.text,
        colorIndex: state.tempHighlight.colorIndex || 0,
        startOffset: state.tempHighlight.startOffset,
        endOffset: state.tempHighlight.endOffset,
        hasNote: true,
        noteContent: content
      }
      chatStore.addCustomContent(currentMessage.value.id, highlight)
      state.tempHighlight = null
      closePopup()
    } else {
      // Adding note to existing highlight
      chatStore.updateCustomContent(currentMessage.value.id, noteId, {
        hasNote: true,
        noteContent: content
      })
      closePopup()
    }
  } else {
    // Update existing note - keep modal open
    chatStore.updateCustomContent(currentMessage.value.id, noteId, { noteContent: content })
    // Update the popup's noteContent to reflect the saved content
    state.popup.noteContent = content
  }
}

function handleNoteCancel() {
  if ((state.popup.isNewNote || state.popup.customPromptText) && state.tempHighlight) {
    state.tempHighlight = null
  }
  closePopup()
}

function handleNoteDelete({ noteId }) {
  chatStore.updateCustomContent(currentMessage.value.id, noteId, {
    hasNote: false,
    noteContent: ''
  })
  closePopup()
}

function handleNoteDetailExplain({ text }) {
  // Trigger the detail explanation flow using the highlighted text
  handleAskQuestion(text)
}

function handleNoteExplore({ text }) {
  // Trigger the question flow using the custom prompt text (already includes context)
  handleAskQuestion(text)
}

</script>
<style scoped>
.message {
  margin-bottom: 2.5rem;
  animation: fadeIn 0.5s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}


.message-content {
  padding: 0;
  border-radius: 0;
  line-height: var(--message-line-height, 1.7);
  text-align: justify;
  hyphens: auto;
}

.message-user .message-content {
  background-color: transparent;
  margin-bottom: 1.5rem;
  border: 2px solid var(--color-border);
  padding: 1rem 1.2rem;
}

.message-assistant .message-content {
  background-color: transparent;
  border-left: none;
  box-shadow: none;
}

.user-message {
  color: var(--color-text-message);
  white-space: pre-wrap;
  word-wrap: break-word;
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  letter-spacing: 0.01em;
  font-weight: bold;
}

.user-message::first-letter {
  text-transform: uppercase;
}

.assistant-message {
  color: var(--color-text-message);
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  letter-spacing: 0.01em;
}

.cursor {
  animation: blink 1s infinite;
  color: var(--color-text-cursor);
  font-weight: normal;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

.message-separator {
  border: none;
  border-top: 1px solid var(--color-border, #e0e0e0);
  margin: 1rem 0;
}
</style>
