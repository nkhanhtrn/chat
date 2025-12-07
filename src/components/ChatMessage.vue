<template>
  <div>
    <SlideTransition>
      <div :key="currentMessage.id">
        <!-- Current question -->
        <div class="message message-user">
          <div class="message-content">
            <div class="user-message">
              {{ currentMessage.question }}
            </div>
          </div>
        </div>

        <!-- Assistant answer with streaming -->
        <div v-if="isStreaming || currentResponse" class="message message-assistant">
          <div class="message-content" style="position: relative;">
            <div class="assistant-message" @mouseup="showContextMenu">
              <MarkdownRenderer
                :content="currentResponse"
                :custom-content="effectiveCustomContent"
                @highlight-click="handleHighlightClick"
                @note-click="handleNoteClick"
              />
              <span v-if="isStreaming" class="cursor">▊</span>
            </div>
            <div v-if="error" class="error-message">{{ error }}</div>
          </div>
        </div>
      </div>
    </SlideTransition>

    <!-- Popups outside transition to prevent them from animating -->
    <ContextMenu
      :visible="popup.state.mode === 'context-menu'"
      :x="popup.state.x"
      :y="popup.state.y"
      :highlighted-text="popup.state.selectedText"
      :is-streaming="isStreaming"
      :color-index="popup.state.colorIndex"
      :has-existing-highlight="!!popup.state.highlightId"
      :has-existing-note="!!popup.state.noteContent"
      @close="closePopup"
      @keep-highlight="keepHighlight"
      @ask-question="handleAskQuestion"
      @change-color="handleChangeColor"
      @remove-highlight="handleRemoveHighlight"
      @add-note="handleAddNote"
      @quick-explain="handleQuickExplain"
      @custom-prompt="handleCustomPrompt"
      @customPromptDeepDive="handleCustomPromptDeepDive"
      @link-to-question="handleLinkToQuestion"
    />
    <Note
      :visible="popup.state.mode === 'note'"
      :note-id="popup.state.highlightId"
      :initial-content="popup.state.noteContent"
      :highlighted-text="popup.state.selectedText"
      :is-temp="popup.state.isNewNote"
      :start-in-edit-mode="popup.state.startInEditMode"
      :is-streaming="popup.state.isStreaming"
      :is-custom-prompt="popup.state.isCustomPrompt"
      :custom-prompt-text="popup.state.customPromptText"
      @save="handleNoteSave"
      @cancel="handleNoteCancel"
      @delete="handleNoteDelete"
      @detail-explain="handleNoteDetailExplain"
      @explore="handleNoteExplore"
    />
    <QuestionSearchModal
      :visible="showQuestionSearch"
      @select="handleQuestionSearchSelect"
      @cancel="handleQuestionSearchCancel"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import SlideTransition from './SlideTransition.vue'
import Note from './Note.vue'
import QuestionSearchModal from './Modal/QuestionSearchModal.vue'
import { sendChatMessage } from '../services/api.js'
import { getMainPrompts, getQuickExplainPrompts } from '../services/extraPrompt.js'
import Message from '../stores/Message.js'
import { getSelectedTextAndPosition as getSelectionWithOffsets } from '../services/DOMSelectionHelper.js'
import { usePopupState } from '../composables/usePopupState.js'
import { useHighlights } from '../composables/useHighlights.js'
import { buildConversationChain, createTempHighlight, isMessageInTree } from '../utils/highlightUtils.js'

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
  },
  // Injectable store for testing
  store: {
    type: Object,
    default: undefined
  },
  // Injectable chat service for testing
  chatService: {
    type: Object,
    default: undefined
  }
})

// Use injected store or default to global store
const chatStore = props.store || useChatStore()

// Use injected chat service or default to real API
const chatServiceImpl = props.chatService || { sendMessage: sendChatMessage }

// Local state
const isChildStreaming = ref(false)
const error = ref(null)
const tempHighlight = ref(null)
const showQuestionSearch = ref(false)
const questionSearchContext = ref(null)

// Use composables
const popup = usePopupState()
const highlights = useHighlights(chatStore, () => currentMessage.value)

// Computed property to always get the root/original message (from props)
const rootMessage = computed(() => props.message)

// Get the currently viewed message from the store, or fall back to root message
const currentMessage = computed(() => {
  if (chatStore.currentMessage) {
    if (isMessageInTree(chatStore.messagesById, chatStore.currentMessage.id, rootMessage.value.id)) {
      return chatStore.currentMessage
    }
  }
  return rootMessage.value
})

// Computed property that directly tracks the response string for reactivity
const currentResponse = computed(() => {
  return currentMessage.value?.response || ''
})

// Computed property that merges customContent with temporary highlight
const effectiveCustomContent = highlights.createEffectiveCustomContent(() => tempHighlight.value)

// Computed property that combines both streaming states
const isStreaming = computed(() => {
  return props.isAppStreaming || isChildStreaming.value
})

function showContextMenu() {
  const getSel = props.getSelectedTextAndPosition || getSelectionWithOffsets
  const selectionData = getSel()
  const { selectedText, x, y, visible, startOffset, endOffset } = selectionData

  if (visible && selectedText && startOffset !== undefined && endOffset !== undefined) {
    popup.openContextMenu({
      x,
      y,
      selectedText,
      startOffset,
      endOffset
    })

    tempHighlight.value = createTempHighlight({
      text: selectedText,
      startOffset,
      endOffset,
      colorIndex: 0
    })

    window.getSelection()?.removeAllRanges()
  }
}

function closePopup() {
  popup.close()
  tempHighlight.value = null
}

function keepHighlight(colorIndex) {
  if (popup.state.highlightId) {
    handleChangeColor(colorIndex)
    closePopup()
    return
  }

  const { selectedText, startOffset, endOffset } = popup.state
  if (selectedText && startOffset !== undefined && endOffset !== undefined) {
    highlights.addHighlight(selectedText, startOffset, endOffset, colorIndex)
  }

  closePopup()
}

async function handleAskQuestion(question) {
  if (!question || isChildStreaming.value) return

  const { selectedText, startOffset, endOffset, highlightId, noteContent } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data')
    return
  }

  const parentMessage = currentMessage.value
  const parentId = parentMessage.id
  const existingNoteContent = noteContent || ''

  if (highlightId) {
    highlights.removeHighlight(highlightId)
  }

  closePopup()

  const childMsg = Message.createChildMessage(parentId, question, selectedText)

  // Add question link BEFORE addChildMessage, since addChildMessage changes currentMessage
  highlights.addQuestionLink({
    text: selectedText,
    targetMessageId: childMsg.id,
    startOffset,
    endOffset,
    noteContent: existingNoteContent
  })

  chatStore.addChildMessage(parentId, childMsg)

  isChildStreaming.value = true
  chatStore.startStreaming(childMsg.id)
  error.value = null

  const previousMessages = buildConversationChain(chatStore.messagesById, parentId)

  try {
    const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages)
    await chatServiceImpl.sendMessage(
      chatStore.currentModel,
      messages,
      (chunk) => {
        chatStore.appendToResponse(childMsg.id, chunk)
      }
    )
  } catch (err) {
    error.value = err.message
  } finally {
    isChildStreaming.value = false
    chatStore.stopStreaming()
  }
}

function handleHighlightClick(highlightData) {
  const customContent = currentMessage.value?.customContent || []
  const highlight = customContent.find(item => item.id === highlightData.highlightId)

  popup.openContextMenu({
    x: highlightData.x,
    y: highlightData.y,
    selectedText: highlightData.text,
    startOffset: highlightData.startOffset,
    endOffset: highlightData.endOffset,
    highlightId: highlightData.highlightId,
    colorIndex: highlightData.colorIndex ?? 0,
    noteContent: highlight?.noteContent ?? ''
  })
}

function handleChangeColor(colorIndex) {
  popup.updateColorIndex(colorIndex)
  if (!popup.state.highlightId || !currentMessage.value) return
  highlights.updateHighlight(popup.state.highlightId, { colorIndex })
}

function handleRemoveHighlight() {
  if (popup.state.highlightId) {
    highlights.removeHighlight(popup.state.highlightId)
  }
  closePopup()
}

function handleAddNote() {
  const { selectedText, startOffset, endOffset, highlightId, noteContent, colorIndex } = popup.state

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for note')
    return
  }

  if (highlightId) {
    popup.openNote({
      highlightId,
      noteContent,
      selectedText,
      startOffset,
      endOffset,
      isNewNote: !noteContent,
      startInEditMode: true
    })
  } else {
    tempHighlight.value = createTempHighlight({
      text: selectedText,
      startOffset,
      endOffset,
      colorIndex: colorIndex || 0,
      hasNote: true,
      noteContent: ''
    })
    popup.openNote({
      highlightId: '__temp_highlight_with_note__',
      noteContent: '',
      selectedText,
      startOffset,
      endOffset,
      isNewNote: true,
      startInEditMode: true
    })
  }
}

async function handleQuickExplain(customPrompt = null) {
  const { selectedText, startOffset, endOffset, colorIndex, highlightId } = popup.state
  const isCustomPrompt = !!customPrompt

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for quick explain')
    return
  }

  const promptText = isCustomPrompt
    ? `${customPrompt}\nfor more context: ${selectedText}`
    : selectedText

  const existingHighlightId = highlightId
  const targetHighlightId = existingHighlightId || crypto.randomUUID()

  popup.openNoteForStreaming({
    highlightId: targetHighlightId,
    selectedText,
    startOffset,
    endOffset,
    isCustomPrompt,
    customPromptText: promptText
  })

  if (!existingHighlightId) {
    tempHighlight.value = createTempHighlight({
      text: selectedText,
      startOffset,
      endOffset,
      colorIndex: colorIndex || 0,
      hasNote: true,
      noteContent: ''
    })
    tempHighlight.value.id = targetHighlightId
  }

  isChildStreaming.value = true
  error.value = null

  const previousMessages = buildConversationChain(chatStore.messagesById, currentMessage.value?.id)

  try {
    const messages = getQuickExplainPrompts(promptText, previousMessages)
    await chatServiceImpl.sendMessage(
      chatStore.currentModel,
      messages,
      (chunk) => {
        popup.appendToNoteContent(chunk)
      }
    )
  } catch (err) {
    error.value = err.message
    closePopup()
  } finally {
    isChildStreaming.value = false
    popup.stopStreaming()
  }
}

function handleCustomPrompt(customPrompt) {
  handleQuickExplain(customPrompt)
}

function handleCustomPromptDeepDive(customPrompt) {
  const fullPrompt = `${customPrompt}\n\nContext: ${popup.state.selectedText}`
  handleAskQuestion(fullPrompt)
}

function handleNoteClick(noteData) {
  popup.openNote({
    highlightId: noteData.noteId,
    noteContent: noteData.noteContent || '',
    selectedText: noteData.text,
    startOffset: noteData.startOffset,
    endOffset: noteData.endOffset,
    isNewNote: false,
    startInEditMode: false
  })
}

function handleNoteSave({ noteId, content }) {
  if (popup.state.customPromptText && tempHighlight.value) {
    highlights.addHighlightWithNote({
      text: tempHighlight.value.text,
      startOffset: tempHighlight.value.startOffset,
      endOffset: tempHighlight.value.endOffset,
      colorIndex: tempHighlight.value.colorIndex || 0,
      noteContent: content
    })
    tempHighlight.value = null
    closePopup()
  } else if (popup.state.customPromptText && popup.state.highlightId) {
    highlights.updateHighlight(popup.state.highlightId, {
      hasNote: true,
      noteContent: content
    })
    closePopup()
  } else if (popup.state.isNewNote) {
    if (tempHighlight.value) {
      highlights.addHighlightWithNote({
        text: tempHighlight.value.text,
        startOffset: tempHighlight.value.startOffset,
        endOffset: tempHighlight.value.endOffset,
        colorIndex: tempHighlight.value.colorIndex || 0,
        noteContent: content
      })
      tempHighlight.value = null
      closePopup()
    } else {
      highlights.updateHighlight(noteId, {
        hasNote: true,
        noteContent: content
      })
      closePopup()
    }
  } else {
    highlights.updateHighlight(noteId, { noteContent: content })
    popup.state.noteContent = content
  }
}

function handleNoteCancel() {
  if ((popup.state.isNewNote || popup.state.customPromptText) && tempHighlight.value) {
    tempHighlight.value = null
  }
  closePopup()
}

function handleNoteDelete({ noteId }) {
  highlights.updateHighlight(noteId, {
    hasNote: false,
    noteContent: ''
  })
  closePopup()
}

function handleNoteDetailExplain({ text }) {
  handleAskQuestion(text)
}

function handleNoteExplore({ text }) {
  handleAskQuestion(text)
}

function handleLinkToQuestion() {
  const { selectedText, startOffset, endOffset, highlightId, noteContent } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for link to question')
    return
  }

  // Store context for when user selects a question
  questionSearchContext.value = {
    selectedText,
    startOffset,
    endOffset,
    highlightId,
    noteContent
  }

  popup.close()
  showQuestionSearch.value = true
}

function handleQuestionSearchSelect({ targetMessageId }) {
  if (!questionSearchContext.value) return

  const { selectedText, startOffset, endOffset, highlightId, noteContent } = questionSearchContext.value

  // Remove existing highlight if converting it to a question link
  if (highlightId) {
    highlights.removeHighlight(highlightId)
  }

  // Create the question link
  highlights.addQuestionLink({
    text: selectedText,
    targetMessageId,
    startOffset,
    endOffset,
    noteContent: noteContent || ''
  })

  showQuestionSearch.value = false
  questionSearchContext.value = null
  tempHighlight.value = null
}

function handleQuestionSearchCancel() {
  showQuestionSearch.value = false
  questionSearchContext.value = null
  tempHighlight.value = null
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
