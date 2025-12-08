<template>
  <div
    ref="containerRef"
    class="chat-input-container"
    :class="{ 'drag-over': isDragOver }"
    @dragover.prevent="handleDragOver"
    @dragleave="handleDragLeave"
    @drop.prevent="handleDrop"
  >
    <!-- Context questions display -->
    <div v-if="contextQuestions.length > 0" class="context-questions">
      <div class="context-label">Context from:</div>
      <div class="context-items">
        <div
          v-for="ctx in contextQuestions"
          :key="ctx.id"
          class="context-item"
        >
          <span class="context-text">{{ ctx.questionSummarized || ctx.question }}</span>
          <button
            class="context-remove"
            @click="removeContext(ctx.id)"
            title="Remove from context"
          >×</button>
        </div>
      </div>
    </div>

    <div class="input-wrapper">
      <textarea
        ref="inputRef"
        v-model="inputText"
        @keydown.enter.exact.prevent="handleSend"
        @input="adjustHeight"
        placeholder="Ask anything you want to learn..."
        :disabled="disabled"
        rows="1"
      ></textarea>
      <Button
        @click="handleSend"
        :disabled="!inputText.trim() || disabled"
        :loading="isLoading"
        class="send-button"
        variant="primary"
      >
        <span class="send-text">Send</span>
        <svg class="send-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </Button>
    </div>
    <div class="input-hint desktop-hint">
      Press Enter to send • Shift + Enter for new line • Drag questions here to add context
    </div>
    <div class="input-hint mobile-hint">
      Long-press and drag questions here to add context
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted, watch } from 'vue'
import Button from './Button.vue'
import { useChatStore } from '../stores/chat.js'
import { touchDragState, endTouchDrag, isPointInElement } from '../utils/touchDrag.js'

const props = defineProps({
  disabled: {
    type: Boolean,
    default: false
  },
  isLoading: {
    type: Boolean,
    default: false
  },
  autofocus: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['send'])

const chatStore = useChatStore()
const inputText = ref('')
const inputRef = ref(null)
const contextQuestions = ref([])
const isDragOver = ref(false)

const focus = () => {
  nextTick(() => {
    inputRef.value?.focus()
  })
}

// Auto-focus handled in main onMounted below

// Watch for autofocus changes
watch(() => props.autofocus, (newVal) => {
  if (newVal) {
    focus()
  }
})

defineExpose({ focus, clearContext })

const adjustHeight = () => {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 200) + 'px'
    }
  })
}

// Drag and drop handlers
const handleDragOver = (event) => {
  // Check if the drag contains question context data
  if (event.dataTransfer.types.includes('application/x-question-context')) {
    isDragOver.value = true
    event.dataTransfer.dropEffect = 'copy'
  }
}

const handleDragLeave = (event) => {
  // Only set to false if we're actually leaving the container
  const rect = event.currentTarget.getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    isDragOver.value = false
  }
}

const handleDrop = (event) => {
  isDragOver.value = false

  const contextData = event.dataTransfer.getData('application/x-question-context')
  if (!contextData) return

  try {
    const { messageId } = JSON.parse(contextData)
    const message = chatStore.messagesById[messageId]

    if (message && !contextQuestions.value.some(ctx => ctx.id === messageId)) {
      contextQuestions.value.push({
        id: message.id,
        question: message.question,
        questionSummarized: message.questionSummarized,
        response: message.response
      })
    }
  } catch (e) {
    console.error('Failed to parse drop data:', e)
  }
}

const removeContext = (id) => {
  const index = contextQuestions.value.findIndex(ctx => ctx.id === id)
  if (index !== -1) {
    contextQuestions.value.splice(index, 1)
  }
}

// Touch drag drop detection (for mobile)
const containerRef = ref(null)

const handleGlobalTouchMove = () => {
  if (!touchDragState.isDragging) return

  // Check if touch is over this input container
  const isOver = isPointInElement(
    touchDragState.currentX,
    touchDragState.currentY,
    containerRef.value
  )

  isDragOver.value = isOver
}

const handleGlobalTouchEnd = () => {
  if (!touchDragState.isDragging) return

  // Check if dropped on this input container
  const isOver = isPointInElement(
    touchDragState.currentX,
    touchDragState.currentY,
    containerRef.value
  )

  if (isOver && touchDragState.messageData) {
    const message = touchDragState.messageData
    if (!contextQuestions.value.some(ctx => ctx.id === message.id)) {
      contextQuestions.value.push({
        id: message.id,
        question: message.question,
        questionSummarized: message.questionSummarized,
        response: message.response
      })
    }
  }

  isDragOver.value = false
}

onMounted(() => {
  if (props.autofocus) {
    focus()
  }
  // Add global touch listeners for drop detection
  document.addEventListener('touchmove', handleGlobalTouchMove)
  document.addEventListener('touchend', handleGlobalTouchEnd)
})

onUnmounted(() => {
  document.removeEventListener('touchmove', handleGlobalTouchMove)
  document.removeEventListener('touchend', handleGlobalTouchEnd)
})

function clearContext() {
  contextQuestions.value = []
}

const handleSend = () => {
  if (inputText.value.trim() && !props.disabled) {
    emit('send', inputText.value, [...contextQuestions.value])
    inputText.value = ''
    contextQuestions.value = []
    nextTick(() => {
      if (inputRef.value) {
        inputRef.value.style.height = 'auto'
      }
    })
  }
}
</script>

<style scoped>
.chat-input-container {
  padding: 1.5rem 4rem;
  background-color: var(--color-bg-page);
  border-top: 2px solid var(--color-border-base);
  box-shadow: 0 -4px 20px var(--shadow-primary);
  margin: 0;
  border-radius: 0;
  transition: border-color 0.2s, background-color 0.2s;
}

.chat-input-container.drag-over {
  border-top-color: var(--color-primary, #6366f1);
  background-color: var(--color-bg-primary-subtle, rgba(99, 102, 241, 0.05));
}

/* Context questions section */
.context-questions {
  margin-bottom: 1rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-hover);
  border-radius: 4px;
  border: 1px solid var(--color-border-base);
}

.context-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 0.5rem;
  font-family: 'Georgia', serif;
}

.context-items {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.context-item {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.35rem 0.5rem 0.35rem 0.75rem;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.85rem;
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
  max-width: 250px;
}

.context-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.context-remove {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1rem;
  line-height: 1;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  transition: all 0.15s;
  padding: 0;
}

.context-remove:hover {
  color: var(--color-text-strong);
  background-color: var(--color-bg-hover);
}

.input-wrapper {
  display: flex;
  gap: 1rem;
  align-items: center;
}

textarea {
  flex: 1;
  padding: 0.875rem 1.125rem;
  border: 1px solid var(--color-border-input);
  border-radius: 2px;
  font-size: 1.05rem;
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', serif;
  resize: none;
  transition: all 0.2s;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  letter-spacing: 0.01em;
  line-height: 1.6;
}

textarea:focus {
  outline: none;
  border-color: var(--color-border-strong);
  box-shadow: 0 0 0 2px rgba(112, 112, 112, 0.2);
}

textarea:disabled {
  background-color: var(--color-bg-disabled);
  cursor: not-allowed;
  opacity: 0.5;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
  font-style: italic;
}

.send-button {
  padding: 0.875rem 1.75rem;
  border-radius: 2px;
  font-size: 1rem;
  min-width: 80px;
  height: 50px;
  font-family: 'Georgia', serif;
}

.send-icon {
  display: none;
}

.input-hint {
  margin-top: 0.5rem;
  font-size: 0.75rem;
  color: var(--color-text-subtle);
  text-align: center;
  font-style: italic;
  font-family: 'Georgia', serif;
}

.mobile-hint {
  display: none;
}

/* Mobile styles */
@media (max-width: 768px) {
  .chat-input-container {
    padding: 1rem 1rem;
  }

  .input-wrapper {
    position: relative;
    gap: 0;
  }

  textarea {
    padding-right: 4rem;
  }

  .send-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    min-width: auto;
    width: 2.75rem;
    height: 2.5rem;
    padding: 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .send-text {
    display: none;
  }

  .send-icon {
    display: block;
  }

  .input-hint {
    font-size: 0.65rem;
  }

  .desktop-hint {
    display: none;
  }

  .mobile-hint {
    display: block;
  }
}
</style>
