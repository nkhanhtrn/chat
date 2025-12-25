<template>
  <div class="playground-page">
    <!-- Header -->
    <header class="playground-header">
      <router-link to="/" class="back-link">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"></line>
          <polyline points="12 19 5 12 12 5"></polyline>
        </svg>
        Home
      </router-link>
      <h1>AI Playground</h1>
      <div class="header-controls">
        <select v-model="selectedProvider" @change="onProviderChange" class="provider-select">
          <option v-for="p in providers" :key="p.id" :value="p.id">
            {{ p.name }}
          </option>
        </select>
        <select v-model="selectedModel" class="model-select" :disabled="models.length === 0">
          <option v-if="models.length === 0" value="">Loading models...</option>
          <option v-for="m in models" :key="m.id" :value="m.id">
            {{ m.name }}
          </option>
        </select>
      </div>
    </header>

    <SlideTransition appear direction="vertical">
      <div class="playground-content">
        <!-- Messages -->
        <div class="messages-container" ref="messagesContainer">
          <div v-if="messages.length === 0" class="empty-state">
            <p>Start a conversation with the AI.</p>
            <p class="hint">Messages are not saved.</p>
          </div>
          <div v-for="(msg, index) in messages" :key="index" :class="['message', msg.role]">
            <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI' }}</div>
            <div class="message-content">
              <MarkdownRenderer v-if="msg.role === 'assistant'" :content="msg.content" />
              <template v-else>{{ msg.content }}</template>
              <span v-if="isStreaming && index === messages.length - 1 && msg.role === 'assistant'" class="cursor">|</span>
            </div>
          </div>
        </div>

        <!-- Input -->
        <div class="input-container">
          <!-- URL Detection Status -->
          <div v-if="detectedUrls.length > 0" class="url-status-container">
            <div v-for="urlEntry in detectedUrls" :key="urlEntry.url" class="url-status-item">
              <span class="url-status-icon">
                <span v-if="urlEntry.status === 'loading'" class="spinner"></span>
                <span v-else-if="urlEntry.status === 'success'" class="check-icon">&#10003;</span>
                <span v-else class="error-icon">&#10007;</span>
              </span>
              <span class="url-text" :title="urlEntry.url">{{ truncateUrl(urlEntry.url) }}</span>
              <span v-if="urlEntry.status === 'success'" class="url-content-size">
                ({{ formatSize(urlEntry.content.length) }})
              </span>
              <span v-if="urlEntry.status === 'error'" class="url-error">
                {{ urlEntry.content }}
              </span>
            </div>
          </div>

          <div class="input-wrapper">
            <textarea
              ref="inputRef"
              v-model="inputText"
              @keydown.enter.exact.prevent="handleSend"
              @input="adjustHeight"
              placeholder="Type your message..."
              :disabled="isStreaming"
              rows="1"
            ></textarea>
            <Button
              v-if="!isStreaming"
              @click="handleSend"
              :disabled="!inputText.trim() || !selectedModel || hasLoadingUrls"
              variant="primary"
              class="send-button"
            >
              {{ hasLoadingUrls ? 'Fetching...' : 'Send' }}
            </Button>
            <button
              v-else
              @click="handleStop"
              class="stop-button"
            >
              Stop generating
            </button>
          </div>
          <button @click="clearChat" class="clear-button" :disabled="messages.length === 0">
            Clear chat
          </button>
        </div>
      </div>
    </SlideTransition>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick, watch, computed } from 'vue'
import Button from '../components/Button.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import SlideTransition from '../components/SlideTransition.vue'
import {
  listProviders,
  getCurrentProviderId,
  getProviderConfig,
  setProvider,
  fetchModels,
  sendChatMessage
} from '../services/llm/index.js'
import {
  detectUrls,
  fetchUrlContent,
  formatFetchedContentForPrompt
} from '../services/urlFetcher.js'

// State
const providers = ref([])
const selectedProvider = ref('')
const models = ref([])
const selectedModel = ref('')
const messages = ref([])
const inputText = ref('')
const isStreaming = ref(false)
const inputRef = ref(null)
const messagesContainer = ref(null)

// URL fetching state
const detectedUrls = ref([]) // Array of { url, status: 'loading'|'success'|'error', content: string }
const fetchedContents = ref({}) // Map of url -> content

let abortController = null

// Watch for URL changes in input
watch(inputText, async (newText) => {
  const urls = detectUrls(newText)

  // Find new URLs that we haven't seen before
  const existingUrls = detectedUrls.value.map(d => d.url)
  const newUrls = urls.filter(url => !existingUrls.includes(url))

  // Remove URLs that are no longer in the text
  detectedUrls.value = detectedUrls.value.filter(d => urls.includes(d.url))

  // Clean up fetchedContents for removed URLs
  for (const url of Object.keys(fetchedContents.value)) {
    if (!urls.includes(url)) {
      delete fetchedContents.value[url]
    }
  }

  // Add new URLs and start fetching
  for (const url of newUrls) {
    const urlEntry = { url, status: 'loading', content: '' }
    detectedUrls.value.push(urlEntry)

    try {
      const content = await fetchUrlContent(url)
      // Find and update the entry (it might have been removed)
      const entry = detectedUrls.value.find(d => d.url === url)
      if (entry) {
        entry.status = 'success'
        entry.content = content
        fetchedContents.value[url] = content
      }
    } catch (error) {
      const entry = detectedUrls.value.find(d => d.url === url)
      if (entry) {
        entry.status = 'error'
        entry.content = error.message
      }
    }
  }
}, { immediate: false })

// Computed: check if any URLs are still loading
const hasLoadingUrls = computed(() =>
  detectedUrls.value.some(u => u.status === 'loading')
)

// Helper: truncate URL for display
function truncateUrl(url) {
  if (url.length <= 50) return url
  try {
    const urlObj = new URL(url)
    const path = urlObj.pathname.length > 20
      ? urlObj.pathname.substring(0, 17) + '...'
      : urlObj.pathname
    return urlObj.hostname + path
  } catch {
    return url.substring(0, 47) + '...'
  }
}

// Helper: format content size
function formatSize(charCount) {
  if (charCount < 1000) return `${charCount} chars`
  return `${(charCount / 1000).toFixed(1)}k chars`
}

// Load providers and current config
onMounted(async () => {
  providers.value = listProviders()
  selectedProvider.value = getCurrentProviderId()
  await loadModels()
})

// Load models for current provider
async function loadModels() {
  try {
    models.value = []
    const modelList = await fetchModels()
    models.value = modelList
    if (modelList.length > 0) {
      selectedModel.value = modelList[0].id
    }
  } catch (error) {
    console.error('Failed to load models:', error)
    models.value = []
  }
}

// Provider change handler
async function onProviderChange() {
  const provider = providers.value.find(p => p.id === selectedProvider.value)
  if (provider) {
    // Get the saved config for the new provider (includes API keys if saved)
    const config = getProviderConfig(selectedProvider.value)
    setProvider(selectedProvider.value, config)
    await loadModels()
  }
}


// Adjust textarea height
function adjustHeight() {
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
      inputRef.value.style.height = Math.min(inputRef.value.scrollHeight, 200) + 'px'
    }
  })
}

// Scroll to bottom
function scrollToBottom() {
  nextTick(() => {
    if (messagesContainer.value) {
      messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
    }
  })
}

// Send message
async function handleSend() {
  if (!inputText.value.trim() || !selectedModel.value || isStreaming.value) return

  const userMessage = inputText.value.trim()

  // Build the full message with fetched content
  const urlContent = formatFetchedContentForPrompt(fetchedContents.value)
  const fullMessage = urlContent
    ? `${userMessage}\n\n${urlContent}`
    : userMessage

  // Reset state
  inputText.value = ''
  detectedUrls.value = []
  fetchedContents.value = {}
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })

  // Add user message (show original message in UI, not the full one with content)
  messages.value.push({ role: 'user', content: userMessage })
  scrollToBottom()

  // Prepare messages for API (include conversation history, but use fullMessage for the latest)
  const apiMessages = messages.value.slice(0, -1).map(m => ({
    role: m.role,
    content: m.content
  }))
  // Add the current message with fetched content
  apiMessages.push({ role: 'user', content: fullMessage })

  // Add empty assistant message for streaming
  messages.value.push({ role: 'assistant', content: '' })
  isStreaming.value = true
  abortController = new AbortController()

  try {
    await sendChatMessage(
      selectedModel.value,
      apiMessages,
      (chunk) => {
        // Update the last message with streamed content
        messages.value[messages.value.length - 1].content += chunk
        scrollToBottom()
      },
      abortController.signal
    )
  } catch (error) {
    if (error.name !== 'AbortError') {
      messages.value[messages.value.length - 1].content = `Error: ${error.message}`
    }
  } finally {
    isStreaming.value = false
    abortController = null
    scrollToBottom()
  }
}

// Stop streaming
function handleStop() {
  if (abortController) {
    abortController.abort()
  }
}

// Clear chat
function clearChat() {
  messages.value = []
}
</script>

<style scoped>
.playground-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-bg-page);
}

.playground-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.playground-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-surface);
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-text-base);
}

.playground-header h1 {
  font-family: 'Georgia', serif;
  font-size: 1.25rem;
  font-weight: normal;
  color: var(--color-text-base);
  margin: 0;
  flex: 1;
}

.header-controls {
  display: flex;
  gap: 0.75rem;
}

.provider-select,
.model-select {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  min-width: 140px;
}

.provider-select:focus,
.model-select:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.model-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 4rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-style: italic;
}

.empty-state .hint {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

.message {
  margin-bottom: 1.5rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.message-role {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message-content {
  font-family: 'Georgia', serif;
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--color-text-base);
}

.message.user .message-content {
  background-color: var(--color-bg-hover);
  padding: 1rem 1.25rem;
  border-radius: 4px;
  white-space: pre-wrap;
}

.message.assistant .message-content {
  padding: 0.5rem 0;
}

.cursor {
  animation: blink 0.7s infinite;
  color: var(--color-primary);
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.input-container {
  padding: 1.5rem 4rem;
  border-top: 1px solid var(--color-border-base);
  background-color: var(--color-bg-surface);
}

.url-status-container {
  max-width: 800px;
  margin: 0 auto 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.url-status-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
}

.url-status-icon {
  display: flex;
  align-items: center;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-border-base);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.check-icon {
  color: #22c55e;
  font-weight: bold;
}

.error-icon {
  color: #ef4444;
  font-weight: bold;
}

.url-text {
  color: var(--color-text-base);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-content-size {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.url-error {
  color: #ef4444;
  font-size: 0.75rem;
}

.input-wrapper {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  max-width: 800px;
  margin: 0 auto;
}

textarea {
  flex: 1;
  padding: 0.875rem 1.125rem;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  font-size: 1.05rem;
  font-family: 'Georgia', serif;
  resize: none;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  line-height: 1.6;
}

textarea:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
  font-style: italic;
}

.send-button {
  padding: 0.875rem 1.5rem;
  height: 50px;
  font-family: 'Georgia', serif;
}

.stop-button {
  padding: 0.5rem 1.25rem;
  background-color: var(--color-bg-page);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-base);
  border-radius: 2px;
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.stop-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

.clear-button {
  display: block;
  margin: 0.75rem auto 0;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.2s;
}

.clear-button:hover:not(:disabled) {
  color: var(--color-text-base);
  text-decoration: underline;
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Mobile styles */
@media (max-width: 768px) {
  .playground-header {
    flex-wrap: wrap;
    padding: 1rem;
  }

  .playground-header h1 {
    order: -1;
    width: 100%;
    margin-bottom: 0.75rem;
  }

  .header-controls {
    flex: 1;
    justify-content: flex-end;
  }

  .provider-select,
  .model-select {
    min-width: 100px;
    font-size: 0.85rem;
  }

  .messages-container {
    padding: 1rem;
  }

  .input-container {
    padding: 1rem;
  }

  .input-wrapper {
    position: relative;
    gap: 0;
  }

  textarea {
    padding-right: 5rem;
  }

  .send-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    height: auto;
    padding: 0.5rem 1rem;
  }

  .stop-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }
}
</style>
