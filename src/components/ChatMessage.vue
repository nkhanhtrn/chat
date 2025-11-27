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
       <div class="message-content">
         <div class="assistant-message" @mouseup="showContextMenu">
           <MarkdownRenderer :content="currentResponse" />
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

  // Create new child message (using Message static method)
  const childMsg = reactive(Message.createChildMessage(parentMsg, question));

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

// Pure function for extracting selected text and position (for context menu)
// Moved to separate <script> block for export
function getSelectedTextAndPosition(selection = window.getSelection()) {
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
</style>

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
