<template>
  <div class="side-chat-playground">
    <!-- Model Selection Header -->
    <div class="playground-header">
      <div class="header-left">
        <span class="title">Chat</span>
      </div>
      <div class="header-center">
        <!-- Provider Selection -->
        <div class="model-select">
          <select
            v-model="modelSelection.selectedProvider.value"
            @change="modelSelection.onProviderChange()"
            class="select-control provider"
            :disabled="modelSelection.providers.value.length === 0"
          >
            <option v-for="p in modelSelection.providers.value" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <!-- Model Selection -->
        <div class="model-select">
          <select
            v-model="modelSelection.selectedModel.value"
            class="select-control model"
            :disabled="modelSelection.models.value.length === 0"
          >
            <option v-if="modelSelection.models.value.length === 0" value="">...</option>
            <option v-for="m in modelSelection.models.value" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>
      <div class="header-right">
        <button @click="chat.clearChat" class="clear-btn" title="Clear Chat">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages Area -->
    <div class="messages-container" ref="messagesContainerRef">
      <div v-if="messages.length === 0" class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
        </svg>
        <p>Quick chat</p>
      </div>

      <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
        <div v-if="msg.role === 'user'" class="user-message">{{ msg.content }}</div>
        <div v-else class="ai-message">
          <MarkdownRenderer :content="msg.content" />
        </div>
      </div>

      <div v-if="isStreaming" class="message assistant streaming">
        <div class="ai-message">
          <span class="cursor"></span>
        </div>
      </div>

      <!-- URL attachments preview -->
      <UrlAttachmentsPreview :urls="attachments.detectedUrls.value" size="small" />
    </div>

    <!-- Input Area -->
    <div class="input-area">
      <textarea
        ref="inputRef"
        v-model="inputText"
        @keydown.enter.exact.prevent="handleSend"
        placeholder="Ask anything..."
        :disabled="isStreaming"
        rows="1"
      ></textarea>
      <button
        v-if="!isStreaming"
        @click="handleSend"
        :disabled="!inputText.trim() || !modelSelection.isModelReady.value"
        class="send-btn"
        title="Send"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
      <button
        v-else
        @click="chat.stopStreaming"
        class="stop-btn"
        title="Stop"
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"/>
        </svg>
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, nextTick } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'
import UrlAttachmentsPreview from './UrlAttachmentsPreview.vue'
import { useStudioChat } from '../composables/studio/useStudioChat.js'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'

const STORAGE_KEY = 'side-playground-model-selection'

const chat = useStudioChat({ storageKey: 'side-playground-chat-history' })
const modelSelection = useModelSelection()
const attachments = useAttachments()

const inputText = ref('')
const messagesContainerRef = ref(null)
const inputRef = ref(null)

// Use computed to access reactive values
const messages = computed(() => chat.messages.value)
const isStreaming = computed(() => chat.isStreaming.value)

// Load saved selection from localStorage
function loadSavedSelection() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    console.log('Loading from localStorage:', STORAGE_KEY, saved)
    if (saved) {
      const { provider, model } = JSON.parse(saved)
      console.log('Parsed saved selection:', { provider, model })
      return { provider, model }
    }
  } catch (e) {
    console.warn('Failed to load saved model selection:', e)
  }
  return null
}

// Save selection to localStorage
function saveSelection(provider, model) {
  try {
    const data = JSON.stringify({ provider, model })
    console.log('Saving to localStorage:', STORAGE_KEY, data)
    localStorage.setItem(STORAGE_KEY, data)
  } catch (e) {
    console.warn('Failed to save model selection:', e)
  }
}

// Scroll to bottom when messages change
watch(messages, () => {
  nextTick(() => {
    if (messagesContainerRef.value) {
      messagesContainerRef.value.scrollTop = messagesContainerRef.value.scrollHeight
    }
  })
}, { deep: true })

// Watch input text for URL detection
watch(inputText, (newText) => {
  attachments.watchInputForUrls(inputText)
})

// Watch model selection changes and save to localStorage
watch(
  () => [modelSelection.selectedProvider.value, modelSelection.selectedModel.value],
  ([provider, model]) => {
    if (provider && model) {
      saveSelection(provider, model)
    }
  }
)

// Initialize model selection on mount
onMounted(async () => {
  // Load saved selection first
  const saved = loadSavedSelection()
  console.log('onMounted - saved selection:', saved)

  // Initialize models
  await modelSelection.initialize()
  console.log('After initialize - providers:', modelSelection.providers.value.length)
  console.log('After initialize - models:', modelSelection.models.value.length)

  // Wait a bit for models to be fully loaded
  await nextTick()
  await new Promise(resolve => setTimeout(resolve, 100))

  // Restore saved selection if available
  if (saved) {
    console.log('Restoring selection...')

    // Check if saved provider still exists
    const providerExists = modelSelection.providers.value.some(p => p.id === saved.provider)
    console.log('Provider exists?', providerExists, 'looking for:', saved.provider)

    if (providerExists) {
      modelSelection.selectedProvider.value = saved.provider
      console.log('Set provider to:', saved.provider)

      await modelSelection.onProviderChange()
      console.log('After onProviderChange - models:', modelSelection.models.value.length)
      console.log('Models:', modelSelection.models.value.map(m => m.id))

      // Wait for models to load
      await nextTick()
      await new Promise(resolve => setTimeout(resolve, 100))

      // Check if saved model exists in the provider's models
      const modelExists = modelSelection.models.value.some(m => m.id === saved.model)
      console.log('Model exists?', modelExists, 'looking for:', saved.model)

      if (modelExists) {
        modelSelection.selectedModel.value = saved.model
        console.log('Set model to:', saved.model)
      } else {
        console.log('Model not found in available models')
      }
    } else {
      console.log('Provider not found')
    }
  } else {
    console.log('No saved selection found')
  }
})

async function handleSend() {
  if (!inputText.value.trim() || isStreaming.value) return
  if (!modelSelection.isModelReady.value) return

  const currentInputText = inputText.value
  inputText.value = ''

  await chat.sendMessage({
    inputText: currentInputText,
    attachmentSnapshot: attachments.getSnapshot(),
    twoModelMode: false,
    modelSelection: {
      selectedModel: modelSelection.selectedModel.value
    },
    searchCallbacks: null,
    planningCallbacks: null
  })
}
</script>

<style scoped>
.side-chat-playground {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--color-bg-base);
}

.playground-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.6rem 0.75rem;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border-base);
  flex-shrink: 0;
}

.header-left {
  flex-shrink: 0;
}

.title {
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
}

.header-center {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  flex: 1;
  justify-content: center;
}

.model-select {
  display: flex;
  align-items: center;
}

.select-control {
  padding: 0.5rem 0.6rem;
  border: 1px solid var(--color-border-input);
  border-radius: 5px;
  background: var(--color-bg-input);
  color: var(--color-text-base);
  font-size: 0.8rem;
  font-family: system-ui, -apple-system, sans-serif;
  cursor: pointer;
}

.select-control:focus {
  outline: none;
  border-color: var(--color-primary);
}

.select-control:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.select-control.provider {
  width: 100px;
}

.select-control.model {
  width: 150px;
}

.header-right {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.clear-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.clear-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.clear-btn svg {
  width: 16px;
  height: 16px;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 0.75rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  gap: 0.5rem;
}

.empty-state svg {
  width: 36px;
  height: 36px;
  opacity: 0.4;
}

.empty-state p {
  font-size: 0.85rem;
  margin: 0;
}

.message {
  display: flex;
  flex-direction: column;
}

.message.user .user-message {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-base);
  padding: 0.5rem 0.65rem;
  background: var(--color-bg-hover);
  border-radius: 6px;
  font-weight: 500;
}

.message.assistant .ai-message {
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-base);
  padding: 0.3rem 0.5rem;
}

.message.assistant.streaming .ai-message {
  padding-left: 0.5rem;
}

.message.user ~ .message.assistant,
.message.assistant ~ .message.user {
  margin-top: 0.3rem;
}

.cursor {
  display: inline-block;
  width: 6px;
  height: 15px;
  background: var(--color-primary);
  margin-left: 2px;
  animation: blink 0.8s infinite;
  vertical-align: middle;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.input-area {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem 0.75rem;
  background: var(--color-bg-base);
  border-top: 1px solid var(--color-border-base);
}

.input-area textarea {
  flex: 1;
  resize: none;
  min-height: 36px;
  max-height: 100px;
  padding: 0.5rem 0.65rem;
  font-size: 0.9rem;
  font-family: system-ui, -apple-system, sans-serif;
  background: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  color: var(--color-text-base);
  outline: none;
}

.input-area textarea:focus {
  border-color: var(--color-primary);
}

.input-area textarea::placeholder {
  color: var(--color-text-muted);
  opacity: 0.7;
}

.input-area textarea:disabled {
  opacity: 0.6;
}

.send-btn, .stop-btn {
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s;
}

.send-btn {
  background: var(--color-primary);
  color: white;
}

.send-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn:not(:disabled):hover {
  opacity: 0.9;
}

.stop-btn {
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
}

.stop-btn:hover {
  background: var(--color-border-base);
}

.send-btn svg, .stop-btn svg {
  width: 14px;
  height: 14px;
}

/* Markdown styles within AI messages */
:deep(.ai-message p) {
  margin: 0 0 0.5rem 0;
}

:deep(.ai-message p:last-child) {
  margin-bottom: 0;
}

:deep(.ai-message code) {
  background: var(--color-bg-hover);
  padding: 0.15rem 0.3rem;
  border-radius: 3px;
  font-size: 0.85rem;
}

:deep(.ai-message pre) {
  background: var(--color-bg-page);
  padding: 0.5rem;
  border-radius: 4px;
  overflow-x: auto;
  margin: 0.5rem 0;
}

:deep(.ai-message pre code) {
  background: none;
  padding: 0;
}
</style>
