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
        <!-- Two-model mode toggle -->
        <label class="two-model-toggle">
          <input type="checkbox" v-model="twoModelMode" />
          <span class="toggle-label">2-Model</span>
        </label>

        <!-- Single model mode -->
        <template v-if="!twoModelMode">
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
        </template>

        <!-- Two-model mode: Router + Executor (all providers) -->
        <template v-else>
          <div class="model-pair">
            <div class="model-selector">
              <span class="model-label">Router</span>
              <select v-model="routerModel" class="model-select small" :disabled="allModels.length === 0">
                <option v-if="allModels.length === 0" value="">Loading...</option>
                <option v-for="m in allModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
            </div>
            <div class="model-selector">
              <span class="model-label">Executor</span>
              <select v-model="executorModel" class="model-select small" :disabled="allModels.length === 0">
                <option v-if="allModels.length === 0" value="">Loading...</option>
                <option v-for="m in allModels" :key="m.id" :value="m.id">
                  {{ m.name }}
                </option>
              </select>
            </div>
          </div>
        </template>
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
            <!-- Web search status indicator (shown while searching) -->
            <div v-if="msg.role === 'assistant' && isSearching && index === messages.length - 1" class="search-status-indicator">
              <span class="spinner"></span>
              <span class="search-status-text">{{ searchStatus }}</span>
              <span v-if="searchQuery" class="search-query-text">"{{ searchQuery }}"</span>
            </div>
            <!-- Analysis indicator for AI messages in two-model mode -->
            <div v-if="msg.role === 'assistant' && msg.analysis" class="analysis-indicator">
              <span v-if="msg.analysis.needsWebSearch" class="analysis-badge search">
                Web Search
              </span>
              <span v-if="msg.analysis.isVisualization" class="analysis-badge visualization">
                {{ msg.analysis.visualizationType === 'chart' ? 'Chart' : (msg.analysis.visualizationType === 'mermaid' ? 'Diagram' : 'Drawing') }}
              </span>
              <span v-else-if="msg.analysis.capability === 'build' || msg.analysis.toolType" class="analysis-badge build">
                Build Tool
              </span>
              <span v-else-if="msg.analysis.canBeCode" class="analysis-badge code">
                Code Task
              </span>
              <span v-else class="analysis-badge text">
                Text Response
              </span>
              <span v-if="msg.analysis.functionName && !msg.analysis.isVisualization" class="analysis-function">
                {{ msg.analysis.functionName }}()
              </span>
              <span v-if="msg.analysis.taskDescription" class="analysis-description">
                {{ msg.analysis.taskDescription }}
              </span>
            </div>
            <!-- Web search results display (shows while fetching and after) -->
            <details v-if="msg.role === 'assistant' && msg.webSearchResults && (msg.webSearchResults.length > 0 || msg.webSearchTotal)"
                     class="search-details"
                     :open="isSearching && index === messages.length - 1">
              <summary class="search-summary">
                <span class="search-icon">🔍</span>
                <span>Web Sources</span>
                <span class="search-count">
                  {{ msg.webSearchResults.filter(r => r).length }}{{ msg.webSearchTotal ? `/${msg.webSearchTotal}` : '' }} pages
                </span>
                <span v-if="isSearching && index === messages.length - 1" class="spinner search-spinner"></span>
              </summary>
              <div class="search-results-container">
                <div v-if="msg.webSearchResults.some(r => r) || (isSearching && index === messages.length - 1 && searchQuery)" class="search-query-header">
                  Query: "{{ msg.webSearchResults.find(r => r)?.query || searchQuery }}"
                </div>
                <!-- Show slots for expected results -->
                <div v-for="rIdx in (msg.webSearchTotal || msg.webSearchResults.length)" :key="rIdx" class="search-result-item">
                  <!-- Fetched result -->
                  <template v-if="msg.webSearchResults[rIdx - 1]">
                    <div class="search-result-header">
                      <span class="result-number">{{ rIdx }}.</span>
                      <a :href="msg.webSearchResults[rIdx - 1].url" target="_blank" rel="noopener noreferrer" class="search-result-title">
                        {{ msg.webSearchResults[rIdx - 1].title }}
                      </a>
                      <span :class="['fetch-status', msg.webSearchResults[rIdx - 1].success ? 'success' : 'fallback']">
                        {{ msg.webSearchResults[rIdx - 1].success ? 'Fetched' : 'Snippet' }}
                      </span>
                    </div>
                    <div class="search-result-url">{{ msg.webSearchResults[rIdx - 1].url }}</div>
                    <details class="search-content-details">
                      <summary class="search-content-summary">View content ({{ formatSize(msg.webSearchResults[rIdx - 1].content?.length || 0) }})</summary>
                      <pre class="search-content">{{ msg.webSearchResults[rIdx - 1].content }}</pre>
                    </details>
                  </template>
                  <!-- Loading with URL/title shown -->
                  <template v-else-if="msg.webSearchPending && msg.webSearchPending[rIdx - 1]">
                    <div class="search-result-header">
                      <span class="result-number">{{ rIdx }}.</span>
                      <a :href="msg.webSearchPending[rIdx - 1].url" target="_blank" rel="noopener noreferrer" class="search-result-title loading">
                        {{ msg.webSearchPending[rIdx - 1].title }}
                      </a>
                      <span class="fetch-status pending">
                        <span class="spinner"></span>
                      </span>
                    </div>
                    <div class="search-result-url">{{ msg.webSearchPending[rIdx - 1].url }}</div>
                  </template>
                  <!-- Fallback loading placeholder -->
                  <div v-else class="search-result-loading">
                    <span class="result-number">{{ rIdx }}.</span>
                    <span class="spinner"></span>
                    <span class="loading-text">Fetching...</span>
                  </div>
                </div>
              </div>
            </details>
            <!-- Generated code display (collapsible) -->
            <details v-if="msg.role === 'assistant' && msg.generatedCode" class="code-details">
              <summary class="code-summary">
                <span class="code-icon">{ }</span>
                <span>Generated Code</span>
                <span v-if="msg.attempts > 1" class="attempts-badge">
                  {{ msg.attempts }} attempts
                </span>
                <span v-if="msg.execution" :class="['execution-status', msg.execution.success ? 'success' : 'error']">
                  {{ msg.execution.success ? 'Executed' : 'Failed' }}
                </span>
              </summary>
              <div class="generated-code-container">
                <button class="copy-code-btn" @click="copyCode(msg.generatedCode)" :title="copiedCode === msg.generatedCode ? 'Copied!' : 'Copy code'">
                  <svg v-if="copiedCode !== msg.generatedCode" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="20 6 9 17 4 12"></polyline>
                  </svg>
                </button>
                <pre class="generated-code"><code>{{ msg.generatedCode }}</code></pre>
              </div>
            </details>
            <div class="message-content">
              <!-- Visualization output -->
              <template v-if="msg.role === 'assistant' && msg.visualization">
                <!-- ECharts -->
                <ChartRenderer v-if="msg.visualization.type === 'chart'" :option="parseChartOption(msg.visualization.content)" height="350px" />
                <!-- Mermaid diagram -->
                <MermaidBlock v-else-if="msg.visualization.type === 'mermaid'" :code="msg.visualization.content" />
                <!-- SVG drawing -->
                <div v-else-if="msg.visualization.type === 'svg'" class="svg-container" v-html="msg.visualization.content"></div>
              </template>
              <!-- Tool output -->
              <template v-else-if="msg.role === 'assistant' && msg.tool">
                <ToolRenderer :tool="msg.tool" />
              </template>
              <!-- Code execution output: display in code block -->
              <CodeBlock v-else-if="msg.role === 'assistant' && msg.execution && msg.execution.success" language="output" :code="msg.content" />
              <!-- Regular assistant response or failed execution: render as markdown -->
              <MarkdownRenderer v-else-if="msg.role === 'assistant'" :content="msg.content" />
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
              :disabled="!inputText.trim() || (!twoModelMode && !selectedModel) || (twoModelMode && (allModels.length === 0 || !routerModel || !executorModel)) || hasLoadingUrls || hasLoadingFiles"
              variant="primary"
              class="send-button"
            >
              {{ (hasLoadingUrls || hasLoadingFiles) ? 'Loading...' : (isSearching ? 'Searching...' : 'Send') }}
            </Button>
            <button
              v-else
              @click="handleStop"
              class="stop-button"
            >
              {{ isSearching ? searchStatus : (isRouting ? 'Routing...' : (currentVerifyAttempt > 0 ? `Retrying (${currentVerifyAttempt})...` : 'Stop generating')) }}
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
import CodeBlock from '../components/markdown/CodeBlock.vue'
import ChartRenderer from '../components/ChartRenderer.vue'
import MermaidBlock from '../components/markdown/MermaidBlock.vue'
import ToolRenderer from '../components/ToolRenderer.vue'
import {
  listProviders,
  getCurrentProviderId,
  getProviderConfig,
  setProvider,
  fetchModels,
  fetchAllModels,
  sendChatMessage
} from '../services/llm/index.js'
import {
  analyzeGenerateAndExecute,
  findRouterAndExecutorModels
} from '../services/llm/taskRouter.js'
import { detectUrls } from '../services/urlFetcher.js'
import {
  AttachmentType,
  readAttachment,
  formatAttachmentForPrompt
} from '../services/attachmentReader.js'

// Build raw attachments for taskRouter (2-model mode)
function buildRawAttachments(uploadedFiles, detectedUrls, fetchedContents = {}) {
  const attachments = []

  // Add file attachments (with File objects for reading)
  for (const f of uploadedFiles) {
    if (f.file) {
      attachments.push({
        type: AttachmentType.FILE,
        file: f.file
      })
    }
  }

  // Add URL attachments (with pre-fetched content if available)
  for (const u of detectedUrls) {
    attachments.push({
      type: AttachmentType.URL,
      url: u.url,
      prefetchedContent: fetchedContents[u.url] || null
    })
  }

  return attachments
}

// State
const providers = ref([])
const selectedProvider = ref('')
const models = ref([])
const allModels = ref([])  // All models from all providers (for 2-model mode)
const selectedModel = ref('')
const messages = ref([])
const inputText = ref('')
const isStreaming = ref(false)
const inputRef = ref(null)
const messagesContainer = ref(null)
const fileInputRef = ref(null)

// Two-model mode state
const twoModelMode = ref(true)
const routerModel = ref('')
const executorModel = ref('')
const isRouting = ref(false)
const currentVerifyAttempt = ref(0)  // Track current retry attempt
const copiedCode = ref(null)  // Track which code was copied

// Web search state (auto-triggered by router analysis)
const isSearching = ref(false)
const searchQuery = ref('')  // Current search query
const searchStatus = ref('')  // Status text: "Searching...", "Fetching 1/3...", etc.

// Copy code to clipboard
async function copyCode(code) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    setTimeout(() => {
      copiedCode.value = null
    }, 2000)
  } catch (err) {
    console.error('Failed to copy:', err)
  }
}

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

// Helper: parse chart option JSON safely
function parseChartOption(content) {
  try {
    return JSON.parse(content)
  } catch (e) {
    console.warn('Failed to parse chart option:', e)
    return { title: { text: 'Chart parsing error' } }
  }
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
  await loadAllModels()
})

// Load models from all providers (for 2-model mode)
async function loadAllModels() {
  try {
    const modelList = await fetchAllModels()
    allModels.value = modelList

    // Auto-select router and executor models
    if (modelList.length > 0) {
      const { router, executor } = findRouterAndExecutorModels(modelList)
      if (router) {
        routerModel.value = router.id
      } else {
        routerModel.value = modelList[0].id
      }
      if (executor) {
        executorModel.value = executor.id
      } else {
        executorModel.value = modelList.length > 1 ? modelList[1].id : modelList[0].id
      }
    }
  } catch (error) {
    console.error('Failed to load all models:', error)
  }
}

// Load models for current provider (single-model mode)
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
  const modelReady = twoModelMode.value
    ? (routerModel.value && executorModel.value)
    : selectedModel.value

  if (!inputText.value.trim() || !modelReady || isStreaming.value) return

  const userMessage = inputText.value.trim()

  // Build the full message with fetched URL content and uploaded files (for single-model mode)
  const urlContent = formatFetchedContentForPrompt(fetchedContents.value)
  const fileContent = formatUploadedFilesForPrompt(uploadedFiles.value)

  let fullMessage = userMessage
  if (urlContent) fullMessage += `\n\n${urlContent}`
  if (fileContent) fullMessage += `\n\n${fileContent}`

  // Build attachments list for display (only include successful ones)
  const attachmentsForDisplay = [
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

  // For 2-model mode, build raw attachments for taskRouter to parse
  const rawAttachments = twoModelMode.value
    ? buildRawAttachments(uploadedFiles.value, detectedUrls.value, fetchedContents.value)
    : []

  // Reset state
  const currentUploadedFiles = [...uploadedFiles.value]  // Keep for 2-model mode
  const currentDetectedUrls = [...detectedUrls.value]  // Keep for 2-model mode
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
    attachments: attachmentsForDisplay
  })
  scrollToBottom()

  // Prepare messages for API
  let apiMessages
  if (twoModelMode.value) {
    // In 2-model mode, only send plain user message (attachments parsed by taskRouter)
    apiMessages = [{ role: 'user', content: userMessage }]
  } else {
    // In single model mode, send full conversation history
    apiMessages = messages.value.filter(m => m.role !== 'assistant' || m.content).map(m => ({
      role: m.role,
      content: m.fullContent || m.content
    }))
  }

  // Add empty assistant message for streaming
  messages.value.push({ role: 'assistant', content: '', analysis: null, generatedCode: null, execution: null, visualization: null, tool: null, attempts: 0, webSearchResults: null })
  isStreaming.value = true
  currentVerifyAttempt.value = 0
  abortController = new AbortController()

  try {
    if (twoModelMode.value) {
      // Two-model mode: Analyze with router, optionally search web, generate with executor
      isRouting.value = true

      // Get provider IDs for selected models
      const routerModelData = allModels.value.find(m => m.id === routerModel.value)
      const executorModelData = allModels.value.find(m => m.id === executorModel.value)

      const result = await analyzeGenerateAndExecute(
        apiMessages,
        {
          routerId: routerModel.value,
          routerProviderId: routerModelData?.providerId || 'lmstudio',
          executorId: executorModel.value,
          executorProviderId: executorModelData?.providerId || 'lmstudio'
        },
        (chunk) => {
          // Update the last message with result content
          messages.value[messages.value.length - 1].content += chunk
          scrollToBottom()
        },
        abortController.signal,
        {
          // Pass raw attachments - taskRouter will parse them before routing
          attachments: rawAttachments,
          verifyMode: true,  // Always verify in 2-model mode
          maxRetries: 3,
          onAttachmentsParsed: (parsed) => {
            // Update attachment display with parsed info if needed
            console.log('Attachments parsed by taskRouter:', parsed.length)
          },
          onAnalysis: (analysis) => {
            // Update message with analysis info
            messages.value[messages.value.length - 1].analysis = analysis
            isRouting.value = false
            // Start searching if needed
            if (analysis.needsWebSearch && analysis.searchQuery) {
              isSearching.value = true
              searchQuery.value = analysis.searchQuery
              searchStatus.value = 'Searching...'
            }
            scrollToBottom()
          },
          onWebSearchStart: (query) => {
            // Web search is starting
            isSearching.value = true
            searchQuery.value = query
            searchStatus.value = 'Searching...'
            scrollToBottom()
          },
          onWebSearchProgress: (progress) => {
            // Update status based on phase
            if (progress.phase === 'search_complete') {
              searchStatus.value = `Found ${progress.resultsCount} results`
              // Initialize with placeholders showing URL/title
              const msg = messages.value[messages.value.length - 1]
              msg.webSearchTotal = progress.resultsCount
              msg.webSearchPending = progress.results // Store pending results with URLs/titles
              msg.webSearchResults = []
            } else if (progress.phase === 'fetching') {
              searchStatus.value = `Fetching ${progress.total} pages...`
            } else if (progress.phase === 'error') {
              searchStatus.value = `Search failed: ${progress.error}`
            }
            scrollToBottom()
          },
          onWebSearchResult: (result, index) => {
            // Add result to message as it comes in
            const msg = messages.value[messages.value.length - 1]
            if (!msg.webSearchResults) {
              msg.webSearchResults = []
            }
            // Insert at correct index to maintain order
            msg.webSearchResults[index] = result
            // Update status
            const fetchedCount = msg.webSearchResults.filter(r => r).length
            const total = msg.webSearchTotal || 3
            searchStatus.value = `Fetched ${fetchedCount}/${total} pages...`
            scrollToBottom()
          },
          onWebSearchComplete: (results) => {
            // All web searches complete
            isSearching.value = false
            searchQuery.value = ''
            searchStatus.value = ''
            // Ensure final results are set (filter out any undefined slots)
            messages.value[messages.value.length - 1].webSearchResults = results.filter(r => r)
            scrollToBottom()
          },
          onVerifyAttempt: (attempt, error) => {
            // Update UI to show retry in progress
            currentVerifyAttempt.value = attempt
            console.log(`Verify attempt ${attempt}: fixing error "${error}"`)
          },
          onCodeGenerated: (code) => {
            // Store the generated code (shown in collapsible section)
            messages.value[messages.value.length - 1].generatedCode = code
            scrollToBottom()
          },
          onExecutionComplete: (execution) => {
            // Store execution result
            messages.value[messages.value.length - 1].execution = execution
            scrollToBottom()
          },
          onVisualizationGenerated: (visualization) => {
            // Store the visualization result
            messages.value[messages.value.length - 1].visualization = visualization
            scrollToBottom()
          },
          onToolGenerated: (tool) => {
            // Store the tool result
            messages.value[messages.value.length - 1].tool = tool
            scrollToBottom()
          }
        }
      )

      // Store the number of attempts, web search results, visualization, and tool
      messages.value[messages.value.length - 1].attempts = result.attempts
      if (result.webSearchResults && result.webSearchResults.length > 0) {
        messages.value[messages.value.length - 1].webSearchResults = result.webSearchResults
      }
      if (result.visualization) {
        messages.value[messages.value.length - 1].visualization = result.visualization
      }
      if (result.tool) {
        messages.value[messages.value.length - 1].tool = result.tool
      }
    } else {
      // Single model mode
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
    }
  } catch (error) {
    if (error.name !== 'AbortError') {
      messages.value[messages.value.length - 1].content = `Error: ${error.message}`
    }
  } finally {
    isStreaming.value = false
    isRouting.value = false
    isSearching.value = false
    searchQuery.value = ''
    searchStatus.value = ''
    currentVerifyAttempt.value = 0
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
  max-height: 200px;
  overflow-y: auto;
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

/* Two-model mode styles */
.two-model-toggle {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  cursor: pointer;
  padding: 0.4rem 0.6rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.8rem;
  transition: all 0.2s;
}

.two-model-toggle:hover {
  border-color: var(--color-border-strong);
}

.two-model-toggle input {
  cursor: pointer;
}

.toggle-label {
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.75rem;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.model-pair {
  display: flex;
  gap: 0.75rem;
}

.model-selector {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.model-label {
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-family: system-ui, sans-serif;
}

.model-select.small {
  min-width: 120px;
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}

/* Analysis indicator styles */
.analysis-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
  padding: 0.4rem 0.6rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  flex-wrap: wrap;
}

.analysis-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.analysis-badge.code {
  background-color: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}

.analysis-badge.text {
  background-color: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.analysis-badge.search {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.analysis-badge.visualization {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.analysis-badge.build {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

/* Search status indicator */
.search-status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.5rem;
  background-color: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
  color: #3b82f6;
}

.search-status-text {
  font-weight: 500;
}

.search-query-text {
  color: var(--color-text-muted);
  font-style: italic;
  max-width: 300px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.analysis-function {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #22c55e;
  background-color: rgba(34, 197, 94, 0.1);
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
}

.analysis-description {
  color: var(--color-text-muted);
  font-style: italic;
  max-width: 400px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Generated code display styles */
.code-details {
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  overflow: hidden;
}

.code-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-hover);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
  color: var(--color-text-muted);
  user-select: none;
}

.code-summary:hover {
  background-color: var(--color-bg-surface);
}

.code-icon {
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.75rem;
  color: #6366f1;
  font-weight: 600;
}

.execution-status {
  margin-left: auto;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.execution-status.success {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.execution-status.error {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.attempts-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  background-color: rgba(251, 191, 36, 0.15);
  color: #f59e0b;
}

.generated-code-container {
  position: relative;
}

.copy-code-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.35rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
  z-index: 1;
}

.copy-code-btn:hover {
  background-color: var(--color-bg-page);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

.generated-code {
  margin: 0;
  padding: 0.75rem 1rem;
  padding-right: 2.5rem;
  background-color: var(--color-bg-page);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  overflow-x: auto;
  white-space: pre;
  color: var(--color-text-base);
  border-top: 1px solid var(--color-border-base);
}

.generated-code code {
  font-family: inherit;
}

/* SVG visualization container */
.svg-container {
  max-width: 400px;
  margin: 0.5rem 0;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.svg-container :deep(svg) {
  max-width: 100%;
  height: auto;
}

/* Search results display styles */
.search-details {
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  overflow: hidden;
}

.search-summary {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-hover);
  cursor: pointer;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
  color: var(--color-text-muted);
  user-select: none;
}

.search-summary:hover {
  background-color: var(--color-bg-surface);
}

.search-icon {
  font-size: 0.85rem;
}

.search-count {
  margin-left: auto;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.search-results-container {
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-page);
  border-top: 1px solid var(--color-border-base);
}

.search-query-header {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-style: italic;
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-base);
}

.result-number {
  font-weight: 600;
  color: var(--color-text-muted);
  min-width: 1.5rem;
}

.search-spinner {
  margin-left: auto;
}

.search-result-loading {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.25rem 0;
  color: var(--color-text-muted);
}

.search-result-loading .spinner {
  width: 14px;
  height: 14px;
}

.loading-text {
  font-size: 0.85rem;
  font-style: italic;
}

.search-result-title.loading {
  opacity: 0.7;
}

.fetch-status.pending {
  background-color: rgba(59, 130, 246, 0.15);
  padding: 0.2rem;
  display: flex;
  align-items: center;
}

.fetch-status.pending .spinner {
  width: 10px;
  height: 10px;
  border-width: 1.5px;
}

.search-result-item {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--color-border-base);
}

.search-result-item:last-child {
  border-bottom: none;
}

.search-result-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 500;
  color: #3b82f6;
  text-decoration: none;
  margin-bottom: 0.25rem;
}

.search-result-title:hover {
  text-decoration: underline;
}

.search-result-url {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
}

.search-result-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.fetch-status {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  text-transform: uppercase;
}

.fetch-status.success {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.fetch-status.fallback {
  background-color: rgba(251, 191, 36, 0.15);
  color: #f59e0b;
}

.search-content-details {
  margin-top: 0.5rem;
}

.search-content-summary {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0.25rem 0;
}

.search-content-summary:hover {
  color: var(--color-text-base);
}

.search-content {
  margin: 0.5rem 0 0;
  padding: 0.5rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 200px;
  overflow-y: auto;
  line-height: 1.4;
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
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .provider-select,
  .model-select {
    min-width: 100px;
    font-size: 0.85rem;
  }

  .two-model-toggle {
    padding: 0.3rem 0.5rem;
  }

  .model-pair {
    flex-direction: column;
    gap: 0.4rem;
  }

  .model-selector {
    flex-direction: row;
    align-items: center;
    gap: 0.5rem;
  }

  .model-select.small {
    min-width: 100px;
    flex: 1;
  }

  .analysis-indicator {
    flex-wrap: wrap;
  }

  .analysis-description {
    max-width: 100%;
    width: 100%;
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
