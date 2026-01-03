<template>
  <div>
    <SlideTransition>
      <div :key="currentMessage.id">
        <!-- Response Summary (collapsible) -->
        <div v-if="currentMessage.responseSummary && !isStreaming" class="response-summary-container">
          <details class="response-summary">
            <summary class="response-summary-toggle">
              {{ currentMessage.questionSummarized }}
            </summary>
            <div class="response-summary-content">
              <MarkdownRenderer :content="currentMessage.responseSummary" />
            </div>
          </details>
        </div>

        <!-- Assistant answer with streaming -->
        <div v-if="isStreaming || currentResponse" class="message message-assistant">
          <div class="message-content" style="position: relative;">
            <div ref="assistantMessageRef" class="assistant-message" @mouseup="showContextMenu" @dblclick="handleDoubleClick" @contextmenu="handleContextMenu">
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
      @dictionary="handleDictionary"
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
    <DictionaryModal
      :visible="showDictionaryModal"
      :word="dictionaryWord"
      :definition="dictionaryDefinition"
      :is-streaming="isDictionaryStreaming"
      @close="closeDictionaryModal"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import SlideTransition from './SlideTransition.vue'
import Note from './Note.vue'
import QuestionSearchModal from './Modal/QuestionSearchModal.vue'
import DictionaryModal from './Modal/DictionaryModal.vue'
import lmService, { Category } from '../services/llm/LMService.js'
import Message from '../stores/Message.js'
import { getSelectedTextAndPosition as getSelectionWithOffsets } from '../services/DOMSelectionHelper.js'
import { usePopupState } from '../composables/usePopupState.js'
import { useHighlights } from '../composables/useHighlights.js'
import { useVocabulary } from '../composables/useVocabulary.js'
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
const chatServiceImpl = props.chatService || {
  sendMessage: async (providerId, model, messages, onChunk) => {
    const provider = lmService.getProvider(providerId)
    if (onChunk && provider.supportsStreaming) {
      return await lmService.sendStream(providerId, messages, onChunk)
    }
    const result = await lmService.send(providerId, messages)
    return result?.content || null
  },
  sendMessageForFeature: async (messages, onChunk) => lmService.sendByCategory(Category.DETAILS, messages, onChunk),
  sendMessageForQuick: async (messages, onChunk) => lmService.sendByCategory(Category.QUICK, messages, onChunk)
}

// Local state
const isChildStreaming = ref(false)
const error = ref(null)
const tempHighlight = ref(null)
const showQuestionSearch = ref(false)
const questionSearchContext = ref(null)
const assistantMessageRef = ref(null)

// Mobile selection handling
const isMobile = ref(false)
const selectionCheckTimeout = ref(null)

// Dictionary modal state
const showDictionaryModal = ref(false)
const dictionaryWord = ref('')
const dictionaryDefinition = ref('')
const isDictionaryStreaming = ref(false)

// Use composables
const popup = usePopupState()
const highlights = useHighlights(chatStore, () => currentMessage.value)
const { addVocabCard, appendToDefinition, findByWord } = useVocabulary()

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
    await chatServiceImpl.sendMessageForFeature(
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
    await chatServiceImpl.sendMessageForQuick(
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

async function handleDictionary() {
  const { selectedText, startOffset, endOffset } = popup.state

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data for dictionary')
    return
  }

  // Close context menu
  closePopup()

  // Check if word already exists in vocabulary database
  const existingVocabCard = findByWord(selectedText)

  // Set up dictionary modal
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = existingVocabCard?.definition || ''
  showDictionaryModal.value = true

  // If word exists and has a definition, just show it (no API call needed)
  if (existingVocabCard && existingVocabCard.definition) {
    isDictionaryStreaming.value = false
    return
  }

  // Word doesn't exist or has no definition - fetch from API
  isDictionaryStreaming.value = true
  error.value = null

  const previousMessages = buildConversationChain(chatStore.messagesById, currentMessage.value?.id)

  // Create vocab card to store the dictionary result
  const vocabId = addVocabCard({
    word: selectedText,
    definition: '',
    context: currentMessage.value?.response?.substring(
      Math.max(0, startOffset - 50),
      Math.min(currentMessage.value.response.length, endOffset + 50)
    ) || '',
    messageId: currentMessage.value?.id
  })

  try {
    const messages = getDictionaryPrompts(selectedText, previousMessages)
    await chatServiceImpl.sendMessageForQuick(
      messages,
      (chunk) => {
        dictionaryDefinition.value += chunk
        // Also append to vocab card definition
        appendToDefinition(vocabId, chunk)
      }
    )
  } catch (err) {
    error.value = err.message
  } finally {
    isDictionaryStreaming.value = false
  }
}

function closeDictionaryModal() {
  showDictionaryModal.value = false
  dictionaryWord.value = ''
  dictionaryDefinition.value = ''
  isDictionaryStreaming.value = false
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

// Mobile text selection handling
function checkMobileSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString().trim()) {
    return
  }

  // Check if selection is within our assistant message
  if (!assistantMessageRef.value) return

  const range = selection.getRangeAt(0)
  if (!assistantMessageRef.value.contains(range.commonAncestorContainer)) {
    return
  }

  // Show context menu for the selection
  showContextMenu()
}

function handleSelectionChange() {
  if (!isMobile.value) return

  // Don't interfere if popup is already open
  if (popup.state.mode) return

  // Debounce the selection check to wait for user to finish selecting
  if (selectionCheckTimeout.value) {
    clearTimeout(selectionCheckTimeout.value)
  }

  selectionCheckTimeout.value = setTimeout(() => {
    checkMobileSelection()
  }, 500) // Wait longer to let user finish selecting
}

// Handle double-click to select word and open context menu
function handleDoubleClick(event) {
  // Browser naturally selects the word on double-click
  // We just need to wait a tick for the selection to be ready, then show context menu
  setTimeout(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      showContextMenu()
    }
  }, 0)
}

// Prevent default context menu on mobile to show ours instead
function handleContextMenu(event) {
  if (!isMobile.value) return

  const selection = window.getSelection()
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
    // Check if selection is within our assistant message
    if (assistantMessageRef.value) {
      const range = selection.getRangeAt(0)
      if (assistantMessageRef.value.contains(range.commonAncestorContainer)) {
        event.preventDefault()
        showContextMenu()
      }
    }
  }
}

onMounted(() => {
  // Detect mobile
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  if (isMobile.value) {
    document.addEventListener('selectionchange', handleSelectionChange)
  }
})

onUnmounted(() => {
  if (selectionCheckTimeout.value) {
    clearTimeout(selectionCheckTimeout.value)
  }
  document.removeEventListener('selectionchange', handleSelectionChange)
})

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

@media (max-width: 768px) {
  .message-content {
    text-align: left;
    hyphens: none;
  }
}

/* Response Summary Styles */
.response-summary-container {
  margin-bottom: 1.5rem;
}

.response-summary {
  border: 1px solid var(--color-border);
  border-radius: 6px;
  background-color: var(--color-bg-primary-subtle, rgba(0, 0, 0, 0.02));
}

.response-summary-toggle {
  padding: 0.6rem 1rem;
  cursor: pointer;
  user-select: none;
  font-family: var(--message-font-family, Georgia, serif);
  font-size: 0.95rem;
  color: var(--color-text-secondary, #666);
  font-weight: 500;
}

.response-summary-toggle:hover {
  background-color: var(--color-bg-hover, rgba(0, 0, 0, 0.04));
}

.response-summary-content {
  padding: 0.8rem 1rem 1rem;
  border-top: 1px solid var(--color-border);
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  line-height: var(--message-line-height, 1.7);
  color: var(--color-text-message);
}

</style>
