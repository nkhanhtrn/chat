<template>
  <div>
    <!-- Root question -->
    <div class="message message-user">
      <div class="message-header">
        <span class="role-badge">You</span>
      </div>
      <div class="message-content">
        <div class="user-message">
          {{ rootMessage.question }}
        </div>
      </div>
    </div>

     <!-- Assistant answer with streaming -->
     <div v-if="isStreaming || currentResponse" class="message message-assistant">
       <div class="message-header">
         <span class="role-badge">Study Assistant</span>
       </div>
       <div class="message-content" style="position: relative;">
         <MessageNavigation v-if="currentMessage" :current-message="currentMessage" />
         <div class="assistant-message" @mouseup="showContextMenu">
           <MarkdownRenderer
             :content="currentResponse"
             :custom-content="effectiveCustomContent"
             @question-link-click="navigateToChild"
             @highlight-click="handleHighlightClick"
           />
           <span v-if="isStreaming" class="cursor">▊</span>
         </div>
         <div v-if="state.error" class="error-message">{{ state.error }}</div>
         <ContextMenu
           :visible="state.contextMenu.visible"
           :x="state.contextMenu.x"
           :y="state.contextMenu.y"
           :highlighted-text="state.contextMenu.selectedText"
           :is-streaming="isStreaming"
           :color-index="state.contextMenu.colorIndex"
           :has-existing-highlight="!!state.contextMenu.highlightId"
           @close="closeContextMenu"
           @keep-highlight="keepHighlight"
           @ask-question="handleAskQuestion"
           @change-color="handleChangeColor"
           @remove-highlight="handleRemoveHighlight"
         />
       </div>
     </div>
  </div>
</template>

<script setup>
import { reactive, computed, inject } from 'vue'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import MessageNavigation from './MessageNavigation.vue'
import { sendChatMessage } from '../services/api.js'
import { getShortenContentPrompts } from '../services/extraPrompt.js'
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

const chatStore = useChatStore()
const getScrollPosition = inject('getScrollPosition', () => 0)
const setScrollPosition = inject('setScrollPosition', () => {})

const state = reactive({
  isChildStreaming: false,
  error: null,
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    highlightId: null, // Stores the current highlight ID
    startOffset: undefined,
    endOffset: undefined,
    colorIndex: 0 // Default to first color (yellow)
  },
  tempHighlight: null // Temporary highlight shown when context menu is open
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
  if (state.tempHighlight) {
    return [...base, state.tempHighlight]
  }
  return base
})

// Computed property that combines both streaming states
const isStreaming = computed(() => {
  return props.isAppStreaming || state.isChildStreaming
})

function showContextMenu(e) {
  // Use the new DOM selection helper that includes markdown offsets
  const getSel = props.getSelectedTextAndPosition || getSelectionWithOffsets;
  const selectionData = getSel();
  const { selectedText, x, y, visible, startOffset, endOffset } = selectionData;

  if (visible && selectedText && startOffset !== undefined && endOffset !== undefined) {
    // Store selection data for later use (when user keeps highlight or asks question)
    state.contextMenu.selectedText = selectedText;
    state.contextMenu.startOffset = startOffset;
    state.contextMenu.endOffset = endOffset;
    state.contextMenu.x = x;
    state.contextMenu.y = y;
    state.contextMenu.visible = visible;
    state.contextMenu.highlightId = null; // No highlight yet

    // Create temporary highlight (always use first color for temp highlight)
    state.tempHighlight = {
      id: '__temp_highlight__',
      type: 'highlight',
      text: selectedText,
      colorIndex: 0,
      startOffset,
      endOffset
    }

    // Clear the browser's text selection
    window.getSelection()?.removeAllRanges()
  }
}

function closeContextMenu() {
  state.contextMenu.visible = false
  state.contextMenu.highlightId = null
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
  // Don't create duplicate highlight if one already exists
  if (state.contextMenu.highlightId) {
    // Just update the color of existing highlight
    handleChangeColor(colorIndex)
    state.contextMenu.visible = false
    state.tempHighlight = null
    return
  }

  // Create the permanent highlight when user clicks "Keep Highlight"
  const { selectedText, startOffset, endOffset } = state.contextMenu;

  if (selectedText && startOffset !== undefined && endOffset !== undefined) {
    addHighlight(selectedText, startOffset, endOffset, colorIndex);
  }

  // Close the menu (highlight is now permanent)
  state.contextMenu.visible = false
  state.contextMenu.highlightId = null
  state.tempHighlight = null
}

async function handleAskQuestion(question) {
  if (!question || state.isChildStreaming) return

  // Store the selected text and offsets before closing the context menu
  const selectedText = state.contextMenu.selectedText
  const startOffset = state.contextMenu.startOffset
  const endOffset = state.contextMenu.endOffset

  if (!selectedText || startOffset === undefined || endOffset === undefined) {
    console.error('Invalid selection data')
    return
  }

  // Store reference to parent message (currentMessage) before it changes
  const parentMessage = currentMessage.value
  const parentId = parentMessage.id

  // Close menu and clear temporary highlight
  state.contextMenu.visible = false
  state.contextMenu.highlightId = null
  state.tempHighlight = null

  // Create new child message with highlighted text
  const childMsg = Message.createChildMessage(parentId, question, selectedText)

  // Add child to store
  chatStore.addChildMessage(parentId, childMsg)

  // Get the child index for the new message
  const children = chatStore.getChildren(parentId)
  const childIndex = children.length - 1

  // Add clickable question link to the PARENT message (before currentMessage changes)
  addQuestionLinkToMessage(parentMessage, selectedText, childIndex, startOffset, endOffset)

  state.isChildStreaming = true
  state.error = null

  try {
    messages = getShortenContentPrompts(question);
    const summary = await sendChatMessage(chatStore.currentModel, messages)
    chatStore.setQuestionSummarized(childMsg.id, summary)
  } catch (err) {
    state.error = err.message
  } finally {
    state.isChildStreaming = false
  }
}

function navigateToChild(childIndex) {
  const scrollPos = chatStore.navigateToChild(currentMessage.value?.id, childIndex, getScrollPosition())
  setScrollPosition(scrollPos)
}

function handleHighlightClick(highlightData) {
  // Show context menu at the click position with the highlight's data
  state.contextMenu.selectedText = highlightData.text
  state.contextMenu.startOffset = highlightData.startOffset
  state.contextMenu.endOffset = highlightData.endOffset
  state.contextMenu.x = highlightData.x
  state.contextMenu.y = highlightData.y
  state.contextMenu.visible = true
  state.contextMenu.highlightId = highlightData.highlightId
  state.contextMenu.colorIndex = highlightData.colorIndex ?? 0
}

function handleChangeColor(colorIndex) {
  // Always update the selected color index for new highlights
  state.contextMenu.colorIndex = colorIndex

  // Update color of existing highlight if one is selected
  if (!state.contextMenu.highlightId || !currentMessage.value) return

  // Use store action to update highlight color
  chatStore.updateCustomContent(currentMessage.value.id, state.contextMenu.highlightId, { colorIndex })
}

function handleRemoveHighlight() {
  if (state.contextMenu.highlightId) {
    removeHighlight(state.contextMenu.highlightId)
  }
  closeContextMenu()
}

function addQuestionLinkToMessage(message, selectedText, childIndex, startOffset, endOffset) {
  if (!selectedText || !message) return

  // Create question link metadata
  const linkId = crypto.randomUUID()
  const questionLink = {
    id: linkId,
    type: 'question-link',
    text: selectedText,
    childIndex,
    startOffset,
    endOffset
  }

  // Use store action to add question link
  chatStore.addCustomContent(message.id, questionLink)
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

.message-header {
  margin-bottom: 0.75rem;
  text-align: left;
}

.role-badge {
  display: inline-block;
  padding: 0.1rem 0;
  font-size: 0.9rem;
  font-weight: 400;
  font-style: italic;
  color: var(--color-text-badge);
  border-bottom: 1px solid var(--color-border-strong);
  font-family: 'Georgia', serif;
}

.message-user .role-badge {
  color: var(--color-text-badge);
}

.message-assistant .role-badge {
  color: var(--color-text-badge);
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
  border-left: none;
  padding-left: 1.5rem;
  border-left: 3px solid var(--color-border-message-user);
  margin-bottom: 1.5rem;
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
</style>
