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
            <!-- Attachments indicator for user messages -->
            <div v-if="msg.role === 'user' && msg.attachments && msg.attachments.length > 0" class="attachments-indicator">
              <div v-for="(att, attIndex) in msg.attachments" :key="attIndex" class="attachment-badge">
                <span class="attachment-icon">{{ att.type === 'url' ? '🔗' : (att.readerName === 'pdf' ? '📕' : '📄') }}</span>
                <span class="attachment-name">{{ att.name }}</span>
              </div>
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

          <!-- Uploaded Files Status -->
          <div v-if="uploadedFiles.length > 0" class="file-status-container">
            <div v-for="(file, index) in uploadedFiles" :key="file.name + index" class="file-status-item">
              <span class="file-status-icon">
                <span v-if="file.status === 'loading'" class="spinner"></span>
                <span v-else-if="file.status === 'success'" class="file-icon">{{ file.name.endsWith('.pdf') ? '📕' : '📄' }}</span>
                <span v-else class="error-icon">&#10007;</span>
              </span>
              <span class="file-name" :title="file.name">{{ truncateFileName(file.name) }}</span>
              <span v-if="file.status === 'success'" class="file-size">({{ formatSize(file.content.length) }})</span>
              <span v-if="file.status === 'error'" class="file-error">{{ file.error }}</span>
              <span v-if="file.readerName" class="file-reader-badge">{{ file.readerName }}</span>
              <button class="file-remove" @click="removeFile(index)" title="Remove file">&times;</button>
            </div>
          </div>

          <div class="input-wrapper">
            <input
              type="file"
              ref="fileInputRef"
              @change="handleFileUpload"
              multiple
              style="display: none"
            />
            <button
              @click="triggerFileUpload"
              class="upload-button"
              :disabled="isStreaming"
              title="Upload file"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
              </svg>
            </button>
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
              :disabled="!inputText.trim() || !selectedModel || hasLoadingUrls || hasLoadingFiles"
              variant="primary"
              class="send-button"
            >
              {{ (hasLoadingUrls || hasLoadingFiles) ? 'Loading...' : 'Send' }}
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
import { detectUrls } from '../services/urlFetcher.js'
import {
  AttachmentType,
  readAttachment,
  formatAttachmentForPrompt
} from '../services/attachmentReader.js'

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
const fileInputRef = ref(null)

// Uploaded files state
// Array of { file: File, name: string, status: 'loading'|'success'|'error', content: string, error?: string, readerName?: string }
const uploadedFiles = ref([])

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

  // Add new URLs and start fetching using attachment reader
  for (const url of newUrls) {
    const urlEntry = { url, status: 'loading', content: '' }
    detectedUrls.value.push(urlEntry)

    try {
      const result = await readAttachment({
        type: AttachmentType.URL,
        url
      })
      // Find and update the entry (it might have been removed)
      const entry = detectedUrls.value.find(d => d.url === url)
      if (entry) {
        entry.status = 'success'
        entry.content = result.content
        fetchedContents.value[url] = result.content
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

// Helper: truncate file name for display
function truncateFileName(name) {
  if (name.length <= 30) return name
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : ''
  const baseName = name.slice(0, name.length - ext.length)
  return baseName.slice(0, 25 - ext.length) + '...' + ext
}

// Computed: check if any files are still loading
const hasLoadingFiles = computed(() =>
  uploadedFiles.value.some(f => f.status === 'loading')
)

// File upload handlers
function triggerFileUpload() {
  fileInputRef.value?.click()
}

async function handleFileUpload(event) {
  const files = event.target.files
  if (!files || files.length === 0) return

  for (const file of files) {
    // Add file entry with loading status
    const fileEntry = {
      file,
      name: file.name,
      status: 'loading',
      content: '',
      error: null,
      readerName: null
    }
    uploadedFiles.value.push(fileEntry)

    // Read file using attachment reader
    try {
      const result = await readAttachment({
        type: AttachmentType.FILE,
        file
      })

      // Find and update the entry
      const entry = uploadedFiles.value.find(f => f.file === file)
      if (entry) {
        entry.status = 'success'
        entry.content = result.content
        entry.readerName = result.readerName
      }
    } catch (error) {
      const entry = uploadedFiles.value.find(f => f.file === file)
      if (entry) {
        entry.status = 'error'
        entry.error = error.message
      }
      console.error(`Failed to read file ${file.name}:`, error)
    }
  }

  // Reset the input so the same file can be selected again
  event.target.value = ''
}

function removeFile(index) {
  uploadedFiles.value.splice(index, 1)
}

// Format uploaded files for prompt (using new attachment reader format)
function formatUploadedFilesForPrompt(files) {
  const successfulFiles = files.filter(f => f.status === 'success')
  if (successfulFiles.length === 0) return ''

  return successfulFiles.map(f =>
    formatAttachmentForPrompt(
      { content: f.content },
      { type: AttachmentType.FILE, file: f.file }
    )
  ).join('\n\n')
}

// Format URL contents for prompt (using new attachment reader format)
function formatFetchedContentForPrompt(fetchedContents) {
  const entries = Object.entries(fetchedContents).filter(
    ([, content]) => content && content.trim()
  )
  if (entries.length === 0) return ''

  return entries.map(([url, content]) =>
    formatAttachmentForPrompt(
      { content },
      { type: AttachmentType.URL, url }
    )
  ).join('\n\n')
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

  // Build the full message with fetched URL content and uploaded files
  const urlContent = formatFetchedContentForPrompt(fetchedContents.value)
  const fileContent = formatUploadedFilesForPrompt(uploadedFiles.value)

  let fullMessage = userMessage
  if (urlContent) fullMessage += `\n\n${urlContent}`
  if (fileContent) fullMessage += `\n\n${fileContent}`

  // Build attachments list for display (only include successful ones)
  const attachments = [
    ...uploadedFiles.value
      .filter(f => f.status === 'success')
      .map(f => ({
        type: 'file',
        name: truncateFileName(f.name),
        readerName: f.readerName
      })),
    ...detectedUrls.value
      .filter(u => u.status === 'success')
      .map(u => ({ type: 'url', name: truncateUrl(u.url) }))
  ]

  // Reset state
  inputText.value = ''
  detectedUrls.value = []
  fetchedContents.value = {}
  uploadedFiles.value = []
  nextTick(() => {
    if (inputRef.value) {
      inputRef.value.style.height = 'auto'
    }
  })

  // Add user message (store both display content and full content with attachments)
  messages.value.push({
    role: 'user',
    content: userMessage,  // For display in UI
    fullContent: fullMessage,  // For API (includes attachment content)
    attachments
  })
  scrollToBottom()

  // Prepare messages for API (use fullContent for user messages to include attachments)
  const apiMessages = messages.value.filter(m => m.role !== 'assistant' || m.content).map(m => ({
    role: m.role,
    content: m.fullContent || m.content  // Use fullContent if available (user messages with attachments)
  }))

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

.attachments-indicator {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.5rem;
  max-width: 800px;
}

.attachment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  color: var(--color-text-muted);
}

.attachment-icon {
  font-size: 0.85rem;
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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

.file-status-container {
  max-width: 800px;
  margin: 0 auto 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-status-item {
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

.file-status-icon {
  display: flex;
  align-items: center;
}

.file-icon {
  font-size: 0.9rem;
}

.file-error {
  color: #ef4444;
  font-size: 0.75rem;
}

.file-reader-badge {
  padding: 0.1rem 0.3rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 3px;
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.file-name {
  color: var(--color-text-base);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.file-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0 0.25rem;
  font-size: 1rem;
  line-height: 1;
  transition: color 0.2s;
}

.file-remove:hover {
  color: #ef4444;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem;
  background-color: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 50px;
  align-self: flex-end;
}

.upload-button:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
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
  min-height: 50px;
  font-family: 'Georgia', serif;
  align-self: flex-end;
}

.stop-button {
  padding: 0.875rem 1.25rem;
  min-height: 50px;
  background-color: var(--color-bg-page);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-base);
  border-radius: 2px;
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: flex-end;
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

  .upload-button {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    height: auto;
    padding: 0.5rem;
    z-index: 1;
  }

  textarea {
    padding-left: 3rem;
  }
}
</style>
