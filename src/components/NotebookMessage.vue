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
          <div class="message-content">
            <div ref="assistantMessageRef" class="assistant-message" @mouseup="showContextMenu" @dblclick="handleDoubleClick" @contextmenu="handleContextMenu">
              <MarkdownRenderer
                :content="currentResponse"
                :custom-content="customContent"
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

    <!-- Context Menu -->
    <ContextMenu
      :visible="popup.state.mode === 'context-menu'"
      :x="popup.state.x"
      :y="popup.state.y"
      :highlighted-text="popup.state.selectedText"
      :is-streaming="isStreaming"
      :color-index="selectionColorIndex"
      :highlight-id="popup.state.highlightId"
      :has-note="popupHighlightHasNote"
      @close="closePopup"
      @set-selection-color="handleSetSelectionColor"
      @ask-question="handleAskQuestion"
      @link-to-question="handleLinkToQuestion"
      @dictionary="handleDictionary"
      @custom-prompt="handleCustomPrompt"
      @custom-prompt-deep-dive="handleCustomPromptDeepDive"
      @remove="handleRemoveContent"
      @note="handleNote"
      @highlight="handleHighlight"
      @summary="handleSummary"
    />

    <QuestionSearchModal
      :visible="showQuestionSearch"
      @select="handleQuestionSearchSelect"
      @cancel="handleQuestionSearchCancel"
    />
    <DictionaryModal
      :visible="showDictionaryModal"
      :title="dictionaryTitle"
      :word="dictionaryWord"
      :definition="dictionaryDefinition"
      :is-streaming="isDictionaryStreaming"
      :show-save="!!dictionarySaveContext"
      :edit-mode="dictionaryEditMode"
      :show-edit="!!dictionarySaveContext?.existingContentId"
      save-label="Save as Note"
      @close="closeDictionaryModal"
      @save="handleDictionarySave"
      @save-text="handleDictionarySaveText"
      @edit="handleDictionaryEdit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useMessageTreeStore } from '@/stores/messageTree'
import { useStreamingStore } from '@/stores/streaming'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import SlideTransition from './SlideTransition.vue'
import QuestionSearchModal from './modal/QuestionSearchModal.vue'
import DictionaryModal from './modal/DictionaryModal.vue'
import lmService, { Category } from '@/services/llm/LMService'
import { Message } from '@/models/Message'
import { getMainPrompts, getDictionaryPrompts, getQuickExplainPrompts, getSummaryPrompts } from '@/services/extraPrompt'
import { getSelectedTextAndPosition } from '@/services/DOMSelectionHelper'
import { usePopupState } from '@/composables/usePopupState'
import { useHighlights } from '@/composables/useHighlights'
import { useVocabulary } from '@/composables/useVocabulary'
import { buildConversationChain, isMessageInTree } from '@/utils/highlightUtils'
import type { CustomContent } from '@/types/message'

const props = defineProps<{
  message: Message
  isAppStreaming?: boolean
}>()

const treeStore = useMessageTreeStore()
const streamingStore = useStreamingStore()

// Local state
const isChildStreaming = ref(false)
const error = ref<string | null>(null)
const showQuestionSearch = ref(false)
const questionSearchContext = ref<{
  selectedText: string; startOffset: number; endOffset: number
} | null>(null)
const assistantMessageRef = ref<HTMLElement | null>(null)

// Mobile selection handling
const isMobile = ref(false)
let selectionCheckTimeout: ReturnType<typeof setTimeout> | null = null

// Dictionary modal state
const showDictionaryModal = ref(false)
const dictionaryTitle = ref('Dictionary')
const dictionaryWord = ref('')
const dictionaryDefinition = ref('')
const isDictionaryStreaming = ref(false)
const dictionaryEditMode = ref(false)
const dictionarySaveContext = ref<{
  selectedText: string; startOffset: number; endOffset: number; parentId: string
  existingContentId?: string | null
} | null>(null)

// Selection color state
const selectionColorIndex = ref(0)

// Use composables
const popup = usePopupState()
const highlights = useHighlights(treeStore, () => currentMessage.value)
const { addVocabCard, appendToDefinition, findByWord } = useVocabulary()

// Get the root message from props
const rootMessage = computed(() => props.message)

// Get the currently viewed message - either the one from the store if it's in this tree, or the root
const currentMessage = computed(() => {
  if (treeStore.currentMessage) {
    if (isMessageInTree(treeStore.messagesById, treeStore.currentMessage.id, rootMessage.value.id)) {
      return treeStore.currentMessage
    }
  }
  return rootMessage.value
})

const currentResponse = computed(() => currentMessage.value?.response || '')

const customContent = computed<CustomContent[]>(() => currentMessage.value?.customContent ?? [])

const isStreaming = computed(() => props.isAppStreaming || isChildStreaming.value)

const popupHighlightHasNote = computed(() => {
  const id = popup.state.highlightId
  if (!id) return false
  const item = currentMessage.value?.customContent?.find(c => c.id === id)
  return !!(item as any)?.noteContent
})

function showContextMenu() {
  const selectionData = getSelectedTextAndPosition()
  const { selectedText, x, y, visible, startOffset, endOffset } = selectionData

  if (visible && selectedText && startOffset !== undefined && endOffset !== undefined) {
    popup.openContextMenu({
      x,
      y,
      selectedText,
      startOffset,
      endOffset
    })
  }
}

function closePopup() {
  popup.close()
}

function handleHighlightClick(highlightData: { x: number; y: number; text: string; startOffset: number; endOffset: number; highlightId?: string; contentType?: string }) {
  popup.openContextMenu({
    x: highlightData.x,
    y: highlightData.y,
    selectedText: highlightData.text,
    startOffset: highlightData.startOffset,
    endOffset: highlightData.endOffset,
    highlightId: highlightData.highlightId ?? null,
  })
  // Set color picker to match the item's current color
  if (highlightData.highlightId) {
    const item = currentMessage.value?.customContent?.find(c => c.id === highlightData.highlightId)
    selectionColorIndex.value = (item as any)?.colorIndex ?? 0
  }
}

function handleNoteClick(noteData: Record<string, unknown>) {
  const text = noteData.text as string
  const noteContent = noteData.noteContent as string
  const noteId = noteData.noteId as string
  const startOffset = noteData.startOffset as number
  const endOffset = noteData.endOffset as number
  if (!noteContent) return

  dictionaryTitle.value = 'Note'
  dictionaryWord.value = text
  dictionaryDefinition.value = noteContent
  dictionarySaveContext.value = {
    selectedText: text,
    startOffset,
    endOffset,
    parentId: currentMessage.value.id,
    existingContentId: noteId,
  }
  isDictionaryStreaming.value = false
  dictionaryEditMode.value = false
  showDictionaryModal.value = true
}

async function handleAskQuestion(question: string) {
  if (!question || isChildStreaming.value) return

  const { selectedText, startOffset, endOffset } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  const parentMessage = currentMessage.value
  const parentId = parentMessage.id

  closePopup()

  const childMsg = Message.createChildMessage(parentId, question, selectedText)

  // Add question link BEFORE addChildMessage, since addChildMessage changes currentMessage
  highlights.addQuestionLink({
    text: selectedText,
    targetMessageId: childMsg.id,
    startOffset,
    endOffset,
    colorIndex: selectionColorIndex.value,
  })

  treeStore.addChildMessage(parentId, childMsg)

  isChildStreaming.value = true
  streamingStore.startStreaming(childMsg.id)
  error.value = null

  const previousMessages = buildConversationChain(treeStore.messagesById, parentId)

  try {
    const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages)
    await lmService.sendByCategory(
      Category.DETAILS,
      messages,
      (chunk: string) => {
        treeStore.appendToResponse(childMsg.id, chunk)
      }
    )
  } catch (err: any) {
    error.value = err.message
  } finally {
    isChildStreaming.value = false
    streamingStore.stopStreaming()
  }
}

function handleSetSelectionColor(index: number) {
  selectionColorIndex.value = index
  const { highlightId, selectedText, startOffset, endOffset } = popup.state
  if (highlightId) {
    highlights.updateContent(highlightId, { colorIndex: index } as any)
  } else if (selectedText && startOffset !== undefined && endOffset !== undefined) {
    highlights.addNote({
      text: selectedText,
      startOffset,
      endOffset,
      noteContent: '',
      colorIndex: index,
    })
    // Update popup state so menu now shows Remove instead of Highlight
    const noteId = currentMessage.value?.customContent?.find(c =>
      c.text === selectedText && c.startOffset === startOffset && c.endOffset === endOffset
    )?.id
    if (noteId) popup.state.highlightId = noteId
  }
}

async function handleCustomPrompt(prompt: string) {
  if (!prompt || isChildStreaming.value) return

  const { selectedText, startOffset, endOffset, highlightId } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  closePopup()

  isDictionaryStreaming.value = true
  error.value = null

  const previousMessages = buildConversationChain(treeStore.messagesById, currentMessage.value?.id)

  dictionaryTitle.value = prompt
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = ''
  dictionarySaveContext.value = null
  dictionaryEditMode.value = false
  showDictionaryModal.value = true

  let fullResponse = ''
  try {
    const messages = getQuickExplainPrompts(
      `Regarding this text: "${selectedText}"\n\n${prompt}`,
      previousMessages
    )
    await lmService.sendByCategory(
      Category.QUICK,
      messages,
      (chunk: string) => {
        fullResponse += chunk
        dictionaryDefinition.value = fullResponse
      }
    )
    // Save as note after streaming completes
    if (fullResponse) {
      if (highlightId) {
        // Update existing item's note
        highlights.updateContent(highlightId, {
          hasNote: true,
          noteContent: fullResponse,
        } as any)
      } else {
        // Create new note
        highlights.addNote({
          text: selectedText,
          startOffset,
          endOffset,
          noteContent: fullResponse,
          colorIndex: selectionColorIndex.value,
        })
      }
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    isDictionaryStreaming.value = false
  }
}

async function handleCustomPromptDeepDive(prompt: string) {
  if (!prompt || isChildStreaming.value) return

  const { selectedText, startOffset, endOffset } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  const parentMessage = currentMessage.value
  const parentId = parentMessage.id

  closePopup()

  const question = `${prompt} (context: "${selectedText}")`
  const childMsg = Message.createChildMessage(parentId, question, selectedText)

  highlights.addQuestionLink({
    text: selectedText,
    targetMessageId: childMsg.id,
    startOffset,
    endOffset,
    colorIndex: selectionColorIndex.value,
  })

  treeStore.addChildMessage(parentId, childMsg)

  isChildStreaming.value = true
  streamingStore.startStreaming(childMsg.id)
  error.value = null

  const previousMessages = buildConversationChain(treeStore.messagesById, parentId)

  try {
    const messages = getMainPrompts(`[DEEPDIVE] ${question}`, previousMessages)
    await lmService.sendByCategory(
      Category.DETAILS,
      messages,
      (chunk: string) => {
        treeStore.appendToResponse(childMsg.id, chunk)
      }
    )
  } catch (err: any) {
    error.value = err.message
  } finally {
    isChildStreaming.value = false
    streamingStore.stopStreaming()
  }
}

async function handleDictionary() {
  const { selectedText, startOffset, endOffset } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  closePopup()

  const existingVocabCard = findByWord(selectedText)

  dictionaryTitle.value = 'Dictionary'
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = existingVocabCard?.definition || ''
  dictionarySaveContext.value = {
    selectedText, startOffset, endOffset,
    parentId: currentMessage.value.id,
  }
  dictionaryEditMode.value = false
  showDictionaryModal.value = true

  if (existingVocabCard && existingVocabCard.definition) {
    isDictionaryStreaming.value = false
    return
  }

  isDictionaryStreaming.value = true
  error.value = null

  const previousMessages = buildConversationChain(treeStore.messagesById, currentMessage.value?.id)

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
    await lmService.sendByCategory(
      Category.QUICK,
      messages,
      (chunk: string) => {
        dictionaryDefinition.value += chunk
        appendToDefinition(vocabId, chunk)
      }
    )
  } catch (err: any) {
    error.value = err.message
  } finally {
    isDictionaryStreaming.value = false
  }
}

async function handleSummary() {
  const { selectedText, startOffset, endOffset, highlightId } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  closePopup()

  isDictionaryStreaming.value = true
  error.value = null

  const previousMessages = buildConversationChain(treeStore.messagesById, currentMessage.value?.id)

  dictionaryTitle.value = 'Summary'
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = ''
  dictionarySaveContext.value = {
    selectedText,
    startOffset,
    endOffset,
    parentId: currentMessage.value.id,
    existingContentId: highlightId ?? undefined,
  }
  dictionaryEditMode.value = false
  showDictionaryModal.value = true

  let fullResponse = ''
  try {
    const messages = getSummaryPrompts(selectedText, previousMessages)
    await lmService.sendByCategory(
      Category.QUICK,
      messages,
      (chunk: string) => {
        fullResponse += chunk
        dictionaryDefinition.value = fullResponse
      }
    )
    if (fullResponse) {
      if (highlightId) {
        highlights.updateContent(highlightId, {
          hasNote: true,
          noteContent: fullResponse,
        } as any)
      } else {
        highlights.addNote({
          text: selectedText,
          startOffset,
          endOffset,
          noteContent: fullResponse,
          colorIndex: selectionColorIndex.value,
        })
      }
    }
  } catch (err: any) {
    error.value = err.message
  } finally {
    isDictionaryStreaming.value = false
  }
}

function closeDictionaryModal() {
  showDictionaryModal.value = false
  dictionaryTitle.value = 'Dictionary'
  dictionaryWord.value = ''
  dictionaryDefinition.value = ''
  isDictionaryStreaming.value = false
  dictionaryEditMode.value = false
  dictionarySaveContext.value = null
}

function handleDictionarySaveText(text: string) {
  if (!dictionarySaveContext.value?.existingContentId || !text) return

  highlights.updateContent(dictionarySaveContext.value.existingContentId, {
    hasNote: true,
    noteContent: text,
  } as any)

  closeDictionaryModal()
}

function handleDictionaryEdit() {
  dictionaryEditMode.value = true
}

function handleDictionarySave() {
  if (!dictionarySaveContext.value || !dictionaryDefinition.value) return

  const { selectedText, startOffset, endOffset, existingContentId } = dictionarySaveContext.value

  if (existingContentId) {
    // Update note on existing content (note or question-link)
    highlights.updateContent(existingContentId, {
      hasNote: true,
      noteContent: dictionaryDefinition.value,
    } as any)
  } else {
    highlights.addNote({
      text: selectedText,
      startOffset,
      endOffset,
      noteContent: dictionaryDefinition.value,
      colorIndex: selectionColorIndex.value,
    })
  }

  closeDictionaryModal()
}

function handleRemoveContent() {
  const highlightId = popup.state.highlightId
  if (!highlightId) return
  highlights.removeContent(highlightId)
  closePopup()
}

function handleNote() {
  const { selectedText, startOffset, endOffset, highlightId } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  let existingNote = ''
  let contentId: string | null = highlightId

  if (highlightId) {
    const cc = currentMessage.value?.customContent
    const item = cc?.find(c => c.id === highlightId)
    existingNote = (item as any)?.noteContent || ''
  } else {
    // New selection - create the highlight first so the note can be attached
    const id = highlights.addNote({
      text: selectedText,
      startOffset,
      endOffset,
      noteContent: '',
      colorIndex: selectionColorIndex.value,
    })
    contentId = id
  }

  closePopup()

  dictionaryTitle.value = existingNote ? 'Edit Note' : 'Add Note'
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = existingNote
  dictionaryEditMode.value = true
  dictionarySaveContext.value = {
    selectedText,
    startOffset,
    endOffset,
    parentId: currentMessage.value.id,
    existingContentId: contentId,
  }
  isDictionaryStreaming.value = false
  showDictionaryModal.value = true
}

function handleHighlight() {
  const { selectedText, startOffset, endOffset } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  highlights.addNote({
    text: selectedText,
    startOffset,
    endOffset,
    noteContent: '',
    colorIndex: selectionColorIndex.value,
  })

  closePopup()
}

function handleLinkToQuestion() {
  const { selectedText, startOffset, endOffset } = popup.state
  if (!selectedText || startOffset === undefined || endOffset === undefined) return

  questionSearchContext.value = {
    selectedText,
    startOffset,
    endOffset,
  }

  popup.close()
  showQuestionSearch.value = true
}

function handleQuestionSearchSelect({ targetMessageId }: { targetMessageId: string }) {
  if (!questionSearchContext.value) return

  const { selectedText, startOffset, endOffset } = questionSearchContext.value

  highlights.addQuestionLink({
    text: selectedText,
    targetMessageId,
    startOffset,
    endOffset,
    colorIndex: selectionColorIndex.value,
  })

  showQuestionSearch.value = false
  questionSearchContext.value = null
}

function handleQuestionSearchCancel() {
  showQuestionSearch.value = false
  questionSearchContext.value = null
}

// Mobile text selection handling
function checkMobileSelection() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || !selection.toString().trim()) return
  if (!assistantMessageRef.value) return

  const range = selection.getRangeAt(0)
  if (!assistantMessageRef.value.contains(range.commonAncestorContainer)) return

  showContextMenu()
}

function handleSelectionChange() {
  if (!isMobile.value) return
  if (popup.state.mode) return

  if (selectionCheckTimeout) {
    clearTimeout(selectionCheckTimeout)
  }

  selectionCheckTimeout = setTimeout(() => {
    checkMobileSelection()
  }, 500)
}

function handleDoubleClick() {
  setTimeout(() => {
    const selection = window.getSelection()
    if (selection && !selection.isCollapsed && selection.toString().trim()) {
      showContextMenu()
    }
  }, 0)
}

function handleContextMenu(event: MouseEvent) {
  if (!isMobile.value) return

  const selection = window.getSelection()
  if (selection && !selection.isCollapsed && selection.toString().trim()) {
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
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0

  if (isMobile.value) {
    document.addEventListener('selectionchange', handleSelectionChange)
  }
})

onUnmounted(() => {
  if (selectionCheckTimeout) {
    clearTimeout(selectionCheckTimeout)
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
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.message-content {
  padding: 0;
  border-radius: 0;
  line-height: var(--message-line-height, 1.7);
  text-align: justify;
  hyphens: auto;
}

.message-assistant .message-content {
  background-color: transparent;
}

.assistant-message {
  color: var(--color-text-message);
  font-family: var(--message-font-family, Georgia, serif);
  font-size: var(--message-font-size, 18px);
  letter-spacing: 0.01em;
}

.error-message {
  background: var(--color-error-bg);
  color: var(--color-error-text);
  padding: 0.5rem;
  border-radius: 4px;
  margin-top: 0.5rem;
}

.cursor {
  animation: blink 1s infinite;
  color: var(--color-text-cursor);
  font-weight: normal;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
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
