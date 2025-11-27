<template>
  <div>
    <!-- User question -->
    <div class="message message-user">
      <div class="message-header">
        <span class="role-badge">You</span>
      </div>
      <div class="message-content">
        <div class="user-message">
          {{ state.currentMessage.question }}
        </div>
      </div>
    </div>
     <!-- Assistant answer with streaming -->
     <div v-if="isStreaming || currentResponse" class="message message-assistant">
       <div class="message-header">
         <span class="role-badge">Study Assistant</span>
       </div>
       <div class="message-content" style="position: relative;">
         <div v-if="state.currentMessage" class="nav-buttons">
           <button
             @click="switchToParent"
             class="nav-btn"
             :disabled="!state.currentMessage.parent"
             title="Go to parent message"
           >&lt;</button>
           <button
             @click="switchToRoot"
             class="nav-btn home-btn"
             title="Go to root message"
           >
             <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
               <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
               <polyline points="9 22 9 12 15 12 15 22"></polyline>
             </svg>
           </button>
           <button
             @click="switchToLastChild"
             class="nav-btn"
             :disabled="!state.currentMessage.hasChildren"
             title="Go to child message"
           >&gt;</button>
         </div>
         <div class="assistant-message" @mouseup="showContextMenu" @click="handleResponseClick">
           <MarkdownRenderer :content="processedResponse" />
           <span v-if="isStreaming" class="cursor">▊</span>
         </div>
         <div v-if="state.error" class="error-message">{{ state.error }}</div>
         <ContextMenu
           :visible="state.contextMenu.visible"
           :x="state.contextMenu.x"
           :y="state.contextMenu.y"
           :highlighted-text="state.contextMenu.selectedText"
           @close="closeContextMenu"
           @highlight="handleHighlight"
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

// Exported for test usage
export function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Exported for test usage
export function createHighlightedLink(text, childIndex) {
  return `<a href="#" data-child-index="${childIndex}" class="highlighted-link">${text}</a>`;
}
</script>

<script setup>
import { reactive, computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import MarkdownRenderer from './MarkdownRenderer.vue'
import ContextMenu from './ContextMenu.vue'
import { sendChatMessage } from '../services/api.js'
import Message from '../stores/Message.js'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isAppStreaming: {
    type: Boolean,
    default: false
  }
})

const chatStore = useChatStore()

const state = reactive({
  isChildStreaming: false,
  error: null,
  // State for current message and current response
  currentMessage: null,
  currentMessageResponse: null,
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    selectedText: ''
  }
})

// Initialize currentMessage and currentMessageResponse with props.message by default
state.currentMessage = props.message
state.currentMessageResponse = props.message.response

// Computed property that directly tracks the response string for reactivity
const currentResponse = computed(() => {
  // Use the state's currentMessageResponse
  return state.currentMessage.response
})

// Computed property that processes the response and adds links for highlighted text
const processedResponse = computed(() => {
  let response = currentResponse.value;

  // For each child message, replace its highlighted text with a clickable link
  if (state.currentMessage && state.currentMessage.children) {
    state.currentMessage.children.forEach((child, index) => {
      if (child.highlightedText) {
        const escapedText = escapeRegex(child.highlightedText);
        const regex = new RegExp(`(${escapedText})`, 'g');
        const replacement = createHighlightedLink('$1', index);
        response = response.replace(regex, replacement);
      }
    });
  }

  return response;
})

// Computed property that combines both streaming states
const isStreaming = computed(() => {
  return props.isAppStreaming || state.isChildStreaming
})

function showContextMenu(e) {
  const { selectedText, x, y, visible } = getSelectedTextAndPosition();
  state.contextMenu.selectedText = selectedText;
  state.contextMenu.x = x;
  state.contextMenu.y = y;
  state.contextMenu.visible = visible;
}

function closeContextMenu() {
  state.contextMenu.visible = false
}

async function handleHighlight(question) {
  if (!question || state.isChildStreaming) return;
  closeContextMenu(); // Close menu immediately to prevent retrigger
  console.log('Highlight question:', question);

  // Use currentMessage as the parent (not props.message)
  const parentMsg = state.currentMessage;

  // Create new child message with highlighted text (using Message static method)
  const childMsg = reactive(Message.createChildMessage(parentMsg, question, state.contextMenu.selectedText));

  // Add child to parent's children array
  parentMsg.children.push(childMsg);

  // Move currentMessage and currentMessageResponse to the new child
  state.currentMessage = childMsg;
  state.currentMessageResponse = childMsg.response;

  state.isChildStreaming = true;
  state.error = null;

  try {
    await sendChatMessage(
      question,
      chatStore.currentModel,
      (chunk) => {
        childMsg.response += chunk;
        // Update currentMessageResponse to reflect the streaming response
        state.currentMessageResponse = childMsg.response;
      }
    );
  } catch (err) {
    state.error = err.message;
  } finally {
    state.isChildStreaming = false;
  }
}

function switchToParent() {
  if (state.currentMessage && state.currentMessage.parent) {
    state.currentMessage = state.currentMessage.parent;
    state.currentMessageResponse = state.currentMessage.response;
  }
}

function switchToRoot() {
  // Navigate to the root message by following parent chain
  let current = state.currentMessage;
  while (current && current.parent) {
    current = current.parent;
  }
  if (current) {
    state.currentMessage = current;
    state.currentMessageResponse = current.response;
  }
}

function switchToLastChild() {
  // Navigate to the last accessed child message
  if (state.currentMessage && state.currentMessage.lastAccessedChild) {
    const lastChild = state.currentMessage.lastAccessedChild;
    state.currentMessage = lastChild;
    state.currentMessageResponse = lastChild.response;
  }
}

function navigateToChild(childIndex) {
  if (state.currentMessage && state.currentMessage.children[childIndex]) {
    state.currentMessage = state.currentMessage.children[childIndex];
    state.currentMessageResponse = state.currentMessage.response;
  }
}

function handleResponseClick(event) {
  // Check if the clicked element is a highlighted link
  const target = event.target;
  if (target.tagName === 'A' && target.classList.contains('highlighted-link')) {
    event.preventDefault();
    const childIndex = parseInt(target.getAttribute('data-child-index'), 10);
    if (!isNaN(childIndex)) {
      navigateToChild(childIndex);
    }
  }
}
</script>
<style scoped>
.message {
  margin-bottom: 0.75rem;
  animation: fadeIn 0.3s ease-in;
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
  margin-bottom: 0.5rem;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.message-user .role-badge {
  background-color: #667eea;
  color: white;
}

.message-assistant .role-badge {
  background-color: #38b2ac;
  color: white;
}

.message-content {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  line-height: 1.6;
}

.message-user .message-content {
  background-color: #f0f4ff;
  border-left: 4px solid #667eea;
}

.message-assistant .message-content {
  background-color: white;
  border-left: 4px solid #38b2ac;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.user-message {
  color: #2d3748;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.assistant-message {
  color: #2d3748;
}

.cursor {
  animation: blink 1s infinite;
  color: #38b2ac;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}

/* Context menu styles */
.context-menu {
  position: absolute;
  min-width: 160px;
  background: #fff;
  border: 1px solid #d1d5db;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border-radius: 6px;
  padding: 0.5em 0.25em;
  font-size: 1rem;
  color: #222;
  z-index: 9999;
  user-select: none;
}
.context-menu-btn {
  background: none;
  border: none;
  width: 100%;
  padding: 0.5em 1em;
  text-align: left;
  cursor: pointer;
  font-size: 1rem;
  color: #222;
}
.context-menu-btn:hover {
  background: #f3f4f6;
}

/* Navigation buttons container */
.nav-buttons {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  z-index: 2;
  display: flex;
  gap: 0.5em;
  align-items: center;
}

/* Navigation button styles */
.nav-btn {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  width: 2em;
  height: 2em;
  font-size: 1.1em;
  font-weight: 600;
  color: #38b2ac;
  cursor: pointer;
  border-radius: 8px;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: all 0.2s ease;
  padding: 0;
}
.nav-btn:hover {
  background: #f7fafc;
  color: #2c7a7b;
  border-color: #38b2ac;
  box-shadow: 0 2px 4px rgba(56, 178, 172, 0.15);
  transform: translateY(-1px);
}
.nav-btn:active {
  transform: translateY(0);
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
}
.nav-btn:disabled {
  background: #f7fafc;
  color: #cbd5e0;
  border-color: #e2e8f0;
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}
.nav-btn:disabled:hover {
  transform: none;
  background: #f7fafc;
  color: #cbd5e0;
  border-color: #e2e8f0;
  box-shadow: none;
}

/* Home button specific styles */
.home-btn svg {
  width: 16px;
  height: 16px;
}

/* Highlighted text link styles */
.assistant-message :deep(.highlighted-link) {
  color: #667eea;
  text-decoration: underline;
  cursor: pointer;
  font-weight: 500;
  transition: color 0.2s ease;
}

.assistant-message :deep(.highlighted-link:hover) {
  color: #5568d3;
  text-decoration: underline;
}

</style>
