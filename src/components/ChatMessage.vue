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
             :custom-content="currentMessage?.customContent || []"
             @question-link-click="navigateToChild"
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
           @close="closeContextMenu"
           @keep-highlight="keepHighlight"
           @ask-question="handleAskQuestion"
         />
       </div>
     </div>
  </div>
</template>

<script>
// Exported for test usage
export function getSelectedTextAndPosition(selection = window.getSelection()) {
  const selectedText = selection && selection.toString().trim();
  if (selectedText) {
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    return {
      selectedText,
      x: rect.left + window.scrollX,
      y: rect.bottom + window.scrollY,
      visible: true
    };
  }
  return { selectedText: '', x: 0, y: 0, visible: false };
}
</script>

<script setup>
import { reactive, computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import MessageNavigation from './MessageNavigation.vue'
import { getQuestionSummary, sendChatMessage } from '../services/api.js'
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

const state = reactive({
  isChildStreaming: false,
  error: null,
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    selectedText: '',
    highlightId: null // Stores the current highlight ID
  }
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
    // Add highlight with markdown offsets
    const highlightId = addHighlight(selectedText, startOffset, endOffset);

    state.contextMenu.selectedText = selectedText;
    state.contextMenu.highlightId = highlightId;
    state.contextMenu.x = x;
    state.contextMenu.y = y;
    state.contextMenu.visible = visible;
  }
}

function closeContextMenu() {
  // Remove highlight when clicking outside
  if (state.contextMenu.highlightId) {
    removeHighlight(state.contextMenu.highlightId)
  }

  state.contextMenu.visible = false
  state.contextMenu.highlightId = null
}

function addHighlight(selectedText, startOffset, endOffset) {
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
    color: 'var(--color-highlight)',
    startOffset,
    endOffset
  }

  // Initialize customContent array if it doesn't exist
  if (!currentMessage.value.customContent) {
    currentMessage.value.customContent = []
  }

  // Add highlight to message
  currentMessage.value.customContent.push(highlight)

  // Update the store to trigger reactivity
  chatStore.updateMessage(currentMessage.value.id, {
    customContent: [...currentMessage.value.customContent]
  })

  return highlightId
}

function removeHighlight(highlightId) {
  if (!highlightId || !currentMessage.value?.customContent) return

  const index = currentMessage.value.customContent.findIndex(
    item => item.id === highlightId
  )

  if (index !== -1) {
    currentMessage.value.customContent.splice(index, 1)

    // Update the store to trigger reactivity
    chatStore.updateMessage(currentMessage.value.id, {
      customContent: [...currentMessage.value.customContent]
    })
  }
}

function keepHighlight() {
  // Just close the menu without removing the highlight
  state.contextMenu.visible = false
  state.contextMenu.highlightId = null
}

async function handleAskQuestion(question) {
  if (!question || state.isChildStreaming) return

  // Store the selected text and highlight ID before closing the context menu
  const selectedText = state.contextMenu.selectedText
  const highlightId = state.contextMenu.highlightId

  // Get highlight info
  const highlight = currentMessage.value?.customContent?.find(
    item => item.id === highlightId
  )

  if (!highlight) {
    console.error('Highlight not found')
    return
  }

  const { startOffset, endOffset } = highlight

  // Store reference to parent message (currentMessage) before it changes
  const parentMessage = currentMessage.value
  const parentId = parentMessage.id

  // Remove the highlight (it will be replaced with question link)
  removeHighlight(highlightId)

  // Close menu
  state.contextMenu.visible = false
  state.contextMenu.highlightId = null

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

  // Call getQuestionSummary and sendChatMessage sequentially
  try {
    const summary = await getQuestionSummary(question, chatStore.currentModel)
    chatStore.setQuestionSummarized(childMsg.id, summary)
  } catch (err) {
    state.error = err.message
  }

  try {
    await sendChatMessage(
      question,
      chatStore.currentModel,
      (chunk) => {
        // Update via store
        chatStore.appendToResponse(childMsg.id, chunk)
      }
    )
  } catch (err) {
    state.error = err.message
  } finally {
    state.isChildStreaming = false
  }
}

function navigateToChild(childIndex) {
  chatStore.navigateToChild(currentMessage.value?.id, childIndex)
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

  // Initialize customContent array if it doesn't exist
  if (!message.customContent) {
    message.customContent = []
  }

  // Add question link to message
  message.customContent.push(questionLink)

  // Update the store to trigger reactivity
  chatStore.updateMessage(message.id, {
    customContent: [...message.customContent]
  })
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
  line-height: 1.8;
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
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: 1.05rem;
  letter-spacing: 0.01em;
}

.assistant-message {
  color: var(--color-text-message);
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', serif;
  font-size: 1.05rem;
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

/* Question link styles */
.assistant-message :deep(.question-link) {
  color: var(--color-link-question);
  text-decoration: none;
  border-bottom: 1px solid red;
  cursor: pointer;
  font-weight: normal;
  transition: all 0.2s ease;
}

.assistant-message :deep(.question-link:hover) {
  color: var(--color-link-question-hover);
  border-bottom: 1px solid var(--color-link-border-hover);
}

/* Highlight styles */
.assistant-message :deep(.custom-highlight) {
  padding: 2px 0;
  background-color: var(--color-highlight);
  transition: background-color 0.2s ease;
}

</style>
