<template>
  <AppLayout ref="appLayoutRef" storage-key="book-viewer-layout">
    <template #side>
      <div class="toc-sidebar">
        <div class="toc-sidebar-header">
          <!-- Tab Navigation -->
          <div class="tab-navigation">
            <button
              class="tab-button"
              :class="{ active: activeTab === 'contents' }"
              @click="activeTab = 'contents'"
            >
              Contents
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'notebook' }"
              @click="activeTab = 'notebook'"
            >
              Notebook
            </button>
            <button
              class="tab-button"
              :class="{ active: activeTab === 'playground' }"
              @click="activeTab = 'playground'"
            >
              Chat
            </button>
          </div>

          <!-- Contents Tab -->
          <div v-show="activeTab === 'contents'" class="tab-content">
            <input
              ref="contentsSearchInput"
              v-model="searchQuery"
              type="text"
              class="toc-search-input"
              placeholder="Search chapters..."
            />
            <div v-if="currentBook" class="overview-header-item" @click="showingOverview = true">
              <svg class="overview-icon" viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
                <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
              </svg>
              <span class="overview-text">{{ currentBook.title }}</span>
            </div>
          </div>

          <!-- Notebook Tab -->
          <div v-show="activeTab === 'notebook'" class="tab-content">
            <input
              ref="notebookSearchInput"
              v-model="notebookSearchQuery"
              type="text"
              class="toc-search-input"
              placeholder="Search notebooks..."
              @input="selectedMessage = null"
            />
          </div>
        </div>

        <!-- Contents List -->
        <div v-show="activeTab === 'contents'" class="toc-list">
          <div
            v-for="(chapter, index) in filteredChapters"
            :key="index"
            class="toc-item"
            :class="{ active: currentChapterIndex === chapters.indexOf(chapter) }"
            @click="gotoChapter(chapter.href)"
          >
            {{ chapter.label }}
          </div>
        </div>

        <!-- Notebook List -->
        <div v-show="activeTab === 'notebook'" class="toc-list">
          <!-- Show message content when selected -->
          <template v-if="selectedMessage">
            <div class="message-content">
              <div class="message-question">{{ selectedMessage.question }}</div>
              <MarkdownRenderer :content="selectedMessage.response || ''" class="message-response" />
            </div>
          </template>

          <!-- Show current notebook's messages (if no search and no selection) -->
          <template v-else-if="showCurrentNotebook">
            <div class="notebook-header">
              <span class="notebook-header-title">{{ currentNotebookChat?.name || 'Notebook' }}</span>
            </div>
            <div class="notebook-messages">
              <div
                v-for="msg in currentNotebookMessages"
                :key="msg.id"
                class="notebook-message"
              >
                <div class="notebook-message-response">
                  <MarkdownRenderer :content="msg.response || ''" />
                </div>
              </div>
            </div>
          </template>

          <!-- Show search results -->
          <template v-else>
            <div v-if="filteredMessages.length === 0 && notebookSearchQuery" class="empty-notebook">
              <p>No matching questions</p>
            </div>
            <div v-else-if="!notebookSearchQuery" class="empty-notebook">
              <p>Search for questions</p>
            </div>
            <div
              v-for="msg in filteredMessages"
              :key="msg.id"
              class="toc-item"
              @click="selectMessage(msg)"
            >
              {{ msg.questionSummarized || msg.question }}
            </div>
          </template>
        </div>

        <!-- Playground Tab -->
        <div v-show="activeTab === 'playground'" class="toc-list playground-list">
          <SideChatPlayground />
        </div>
      </div>
    </template>

    <div class="book-viewer">
      <!-- Reading progress bar -->
      <div class="reading-progress-bar">
        <div class="reading-progress-fill" :style="{ width: progressPercent + '%' }"></div>
      </div>

      <div ref="viewerContainer" class="viewer-container">
        <!-- Left navigation button -->
        <button class="side-nav-btn side-nav-left" @click="prevPage" title="Previous page">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
          </svg>
        </button>

        <!-- Right navigation button -->
        <button class="side-nav-btn side-nav-right" @click="nextPage" title="Next page">
          <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
            <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
          </svg>
        </button>
        <div v-if="isLoading || error" class="loading-overlay">
          <div v-if="isLoading" class="loading">
            <ProgressBar v-if="downloadProgress > 0" :progress="downloadProgress" />
            <span v-else>Loading book...</span>
          </div>
          <div v-else-if="error" class="error">{{ error }}</div>
        </div>
      </div>

      <!-- Notebook Overview Overlay -->
      <NotebookOverview
        v-if="showingOverview"
        :notebook-id="currentBook?.id || ''"
        :title="currentBook?.title || 'Book Contents'"
        :question-count="chapters.length"
        :root-messages="chapterMessages"
        :read-only="true"
        :cover-url="currentBook?.coverUrl || ''"
        :subtitle="currentBook?.author || ''"
        @select-question="handleSelectChapter"
      />
    </div>

    <!-- Context Menu for text selection (Dictionary, Explain, DeepDive) - Read-only mode -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :highlighted-text="contextMenu.selectedText"
      :read-only="true"
      @close="closeContextMenu"
      @dictionary="handleDictionary"
      @quick-explain="handleQuickExplain"
      @custom-prompt="handleCustomPrompt"
      @custom-prompt-deep-dive="handleDeepDive"
    />

    <!-- Dictionary Modal -->
    <DictionaryModal
      :visible="showDictionaryModal"
      :word="dictionaryWord"
      :definition="dictionaryDefinition"
      :is-streaming="isDictionaryStreaming"
      @close="closeDictionaryModal"
    />

    <!-- Note Modal (used for Explain and Deep-dive results) -->
    <Note
      :visible="showExplainModal"
      :note-id="explainId"
      :initial-content="explainContent"
      :highlighted-text="explainHighlightedText"
      :is-temp="isExplainTemp"
      :is-streaming="isExplainStreaming"
      :is-custom-prompt="true"
      :read-only="true"
      @cancel="closeExplainModal"
    />
  </AppLayout>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick, defineAsyncComponent } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useBooksStore } from '../stores/books.js'
import { useChatStore } from '../stores/chat.js'
import AppLayout from '../components/AppLayout.vue'
const NotebookOverview = defineAsyncComponent(() => import('../components/NotebookOverview.vue'))
import ProgressBar from '../components/ProgressBar.vue'
import ContextMenu from '../components/ContextMenu.vue'
import DictionaryModal from '../components/Modal/DictionaryModal.vue'
import Note from '../components/Note.vue'
import SideChatPlayground from '../components/SideChatPlayground.vue'
import MarkdownRenderer from '../components/MarkdownRenderer.vue'
import { EpubRenderer } from '../services/epubRenderer.js'
import { getOrDownloadBookFile } from '../services/bookStorage.js'
import { sendChatMessageForFeature, FeatureType } from '../services/api.js'
import { getDictionaryPrompts, getQuickExplainPrompts } from '../services/extraPrompt.js'

const router = useRouter()
const route = useRoute()
const booksStore = useBooksStore()
const chatStore = useChatStore()

const props = defineProps({
  bookId: {
    type: String,
    default: null
  }
})

const appLayoutRef = ref(null)
const viewerContainer = ref(null)
const contentsSearchInput = ref(null)
const notebookSearchInput = ref(null)
const chapters = ref([])
const currentChapterIndex = ref(0)
const renderer = ref(null)
const isLoading = ref(true)
const downloadProgress = ref(0)
const error = ref(null)
const searchQuery = ref('')
const showingOverview = ref(false)
const progressPercent = ref(0) // Local progress state for immediate updates

// Sidebar tab state
const activeTab = ref('contents') // 'contents' or 'notebook'
const notebookSearchQuery = ref('')
const selectedMessage = ref(null) // Selected message to display content

// Context menu state for text selection (Dictionary, Explain, DeepDive)
const contextMenu = ref({
  visible: false,
  x: 0,
  y: 0,
  selectedText: ''
})

// Selection handling state
const isMobile = ref(false)
const selectionCheckTimeout = ref(null)

// Dictionary modal state
const showDictionaryModal = ref(false)
const dictionaryWord = ref('')
const dictionaryDefinition = ref('')
const isDictionaryStreaming = ref(false)

// Explain/Deep-dive modal state (using Note component for markdown rendering)
const showExplainModal = ref(false)
const explainId = ref('')
const explainContent = ref('')
const explainHighlightedText = ref('')
const isExplainStreaming = ref(false)
const isExplainTemp = ref(true)

// Use prop bookId if provided, otherwise fall back to route param
const effectiveBookId = computed(() => props.bookId || route.params.id)

const currentBook = computed(() => booksStore.currentBook)

// All notebooks (chats) for searching
const allNotebooks = computed(() => chatStore.chatList)

// Get the notebook associated with the current book
const currentNotebookId = computed(() => {
  if (!currentBook.value) return null
  return booksStore.getBookNotebook(currentBook.value.id)
})

// Get the current notebook's chat
const currentNotebookChat = computed(() => {
  if (!currentNotebookId.value) return null
  return chatStore.chats.find(c => c.id === currentNotebookId.value)
})

// Get the current notebook's root messages
const currentNotebookMessages = computed(() => {
  if (!currentNotebookChat.value) return []
  return currentNotebookChat.value.rootMessageIds
    .map(id => chatStore.messagesById[id])
    .filter(Boolean)
})

// Search all messages across all notebooks (when searching)
const filteredMessages = computed(() => {
  if (!notebookSearchQuery.value.trim()) {
    return []
  }
  const query = notebookSearchQuery.value.toLowerCase()
  const results = []

  // Search through all notebooks
  for (const notebook of allNotebooks.value) {
    const chat = chatStore.chats.find(c => c.id === notebook.id)
    if (!chat) continue

    for (const messageId of chat.rootMessageIds) {
      const msg = chatStore.messagesById[messageId]
      if (!msg) continue

      const questionMatches = msg.question?.toLowerCase().includes(query) ||
                             msg.questionSummarized?.toLowerCase().includes(query)

      if (questionMatches) {
        results.push({
          ...msg,
          notebookId: notebook.id
        })
      }
    }
  }

  return results
})

// Computed: whether to show the current notebook's messages
const showCurrentNotebook = computed(() => {
  return currentNotebookMessages.value.length > 0 && !selectedMessage.value && !notebookSearchQuery.value.trim()
})

// Notebook message count for tab badge
const notebookMessageCount = computed(() => {
  return currentNotebookMessages.value.length
})

// Transform chapters into the format expected by NotebookOverview (like messages)
const chapterMessages = computed(() => {
  return chapters.value.map(chapter => ({
    id: chapter.href || chapter.id || crypto.randomUUID(),
    question: chapter.label,
    questionSummarized: chapter.label,
    // Store the href for navigation
    href: chapter.href,
    subitems: chapter.subitems?.map(sub => ({
      id: sub.href || sub.id || crypto.randomUUID(),
      question: sub.label,
      questionSummarized: sub.label,
      href: sub.href,
      parentId: chapter.href || chapter.id
    })) || []
  }))
})

const filteredChapters = computed(() => {
  if (!searchQuery.value.trim()) {
    return chapters.value
  }
  const query = searchQuery.value.toLowerCase()
  return chapters.value.filter(chapter =>
    chapter.label.toLowerCase().includes(query)
  )
})

// Handle chapter selection from NotebookOverview
function handleSelectChapter(selection) {
  // Find the chapter with matching id (href)
  const allChapters = [...chapters.value]
  for (const chapter of chapters.value) {
    if (chapter.subitems) {
      allChapters.push(...chapter.subitems)
    }
  }

  const selectedChapter = allChapters.find(ch =>
    (ch.href || ch.id) === selection.id
  )

  if (selectedChapter?.href) {
    showingOverview.value = false
    gotoChapter(selectedChapter.href)
  }
}

// Select a message to display its content
function selectMessage(msg) {
  selectedMessage.value = msg
  // Save the notebook association for this book
  if (currentBook.value) {
    const notebookId = msg.notebookId || currentNotebookId.value
    if (notebookId) {
      booksStore.setBookNotebook(currentBook.value.id, notebookId)
    }
  }
}

// Watch for tab changes to focus the appropriate search input
watch(activeTab, (newTab) => {
  nextTick(() => {
    if (newTab === 'contents') {
      contentsSearchInput.value?.focus()
    } else if (newTab === 'notebook') {
      notebookSearchInput.value?.focus()
    }
  })
})

let saveInterval = null
let settingsObserver = null
let resizeObserver = null

onMounted(async () => {
  await booksStore.initializeStore()
  await chatStore.initializeStore()

  const bookId = effectiveBookId.value

  if (!bookId) {
    error.value = 'No book ID provided'
    isLoading.value = false
    return
  }

  // Set current book in store
  booksStore.setCurrentBook(bookId)

  // Load the book
  await loadBook(bookId)

  // Set up auto-save interval
  saveInterval = setInterval(saveReadingPosition, 5000)

  // Watch for CSS variable changes (settings) and refresh EPUB theme
  setupSettingsWatcher()

  // Detect mobile and set up selection handling
  isMobile.value = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  if (isMobile.value) {
    document.addEventListener('selectionchange', handleSelectionChange)
  }
})

onUnmounted(() => {
  if (renderer.value) {
    renderer.value.destroy()
  }
  if (saveInterval) {
    clearInterval(saveInterval)
  }
  if (settingsObserver) {
    settingsObserver.disconnect()
  }
  if (resizeObserver) {
    resizeObserver.disconnect()
  }
  if (resizeObserver?._debounceTimer) {
    clearTimeout(resizeObserver._debounceTimer)
  }
  if (selectionCheckTimeout.value) {
    clearTimeout(selectionCheckTimeout.value)
  }
  document.removeEventListener('selectionchange', handleSelectionChange)
})

function setupSettingsWatcher() {
  // Watch for changes to CSS variables on documentElement
  settingsObserver = new MutationObserver(() => {
    if (renderer.value?.refreshTheme) {
      renderer.value.refreshTheme()
    }
  })

  settingsObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['style', 'data-theme']
  })
}

function setupResizeObserver() {
  // Clean up existing observer if any
  if (resizeObserver) {
    resizeObserver.disconnect()
  }

  // Create new resize observer
  resizeObserver = new ResizeObserver((entries) => {
    for (const entry of entries) {
      if (entry.target === viewerContainer.value && renderer.value?.refreshTheme) {
        // Debounce the refresh to avoid excessive calls during drag
        if (resizeObserver._debounceTimer) {
          clearTimeout(resizeObserver._debounceTimer)
        }
        resizeObserver._debounceTimer = setTimeout(() => {
          renderer.value.refreshTheme()
        }, 100)
        break
      }
    }
  })

  resizeObserver.observe(viewerContainer.value)
}

async function loadBook(bookId) {
  isLoading.value = true
  downloadProgress.value = 0
  error.value = null

  // Check if book is already preloaded
  const preloaded = booksStore.getPreloadedBook(bookId)

  if (preloaded) {
    // Use preloaded data - instant loading!
    const { fileData, toc } = preloaded

    // Initialize the renderer with preloaded data
    renderer.value = new EpubRenderer(viewerContainer.value, fileData)
    await renderer.value.initialize()

    // Set up selection callback for context menu (Dictionary, Explain, DeepDive)
    renderer.value.setupSelectionHandler((selectionData) => {
      handleEpubSelection(selectionData)
    })

    // Set up relocated callback for progress tracking
    renderer.value.setupRelocatedHandler(() => {
      updateProgress()
    })

    // Set up resize observer to reflow epub when container size changes
    setupResizeObserver()

    chapters.value = toc

    // Restore last position if available
    const book = currentBook.value
    if (book?.lastReadCfi) {
      await renderer.value.gotoCfi(book.lastReadCfi)
    }

    // Initialize progress from saved value (temporary, until we get actual progress)
    if (book?.totalProgress !== undefined) {
      progressPercent.value = Math.round(book.totalProgress * 100)
    }

    // Update current chapter index
    updateCurrentChapter()

    // Update progress after a short delay to ensure epub.js has processed navigation
    setTimeout(() => updateProgress(), 100)

    // Clear preloaded data since we're now using it
    booksStore.clearPreloadedBook(bookId)

    isLoading.value = false
    return
  }

  // Normal loading flow (not preloaded)
  // Simulate progress while loading
  const progressInterval = setInterval(() => {
    if (downloadProgress.value < 70) {
      downloadProgress.value += 5
    }
  }, 100)

  try {
    const book = currentBook.value
    if (!book) {
      throw new Error('Book not found')
    }

    downloadProgress.value = 70

    // Get or download book file (IndexedDB cache → Firebase Storage → IndexedDB cache)
    const fileData = await getOrDownloadBookFile(bookId, book.storagePath)

    downloadProgress.value = 90

    if (!fileData) {
      throw new Error('Failed to load book file')
    }

    // Initialize the renderer
    renderer.value = new EpubRenderer(viewerContainer.value, fileData)
    await renderer.value.initialize()

    // Set up selection callback for context menu (Dictionary, Explain, DeepDive)
    renderer.value.setupSelectionHandler((selectionData) => {
      handleEpubSelection(selectionData)
    })

    // Set up relocated callback for progress tracking
    renderer.value.setupRelocatedHandler(() => {
      updateProgress()
    })

    // Set up resize observer to reflow epub when container size changes
    setupResizeObserver()

    downloadProgress.value = 100

    // Get table of contents
    const toc = renderer.value.getTableOfContents()
    chapters.value = toc

    // Restore last position if available
    if (book.lastReadCfi) {
      await renderer.value.gotoCfi(book.lastReadCfi)
    }

    // Initialize progress from saved value (temporary, until we get actual progress)
    if (book.totalProgress !== undefined) {
      progressPercent.value = Math.round(book.totalProgress * 100)
    }

    // Update current chapter index
    updateCurrentChapter()

    // Update progress after a short delay to ensure epub.js has processed navigation
    setTimeout(() => updateProgress(), 100)

    // Clear progress after a short delay
    setTimeout(() => {
      clearInterval(progressInterval)
      downloadProgress.value = 0
      isLoading.value = false
    }, 500)
  } catch (err) {
    clearInterval(progressInterval)
    console.error('Failed to load book:', err)
    error.value = err.message || 'Failed to load book'
    downloadProgress.value = 0
    isLoading.value = false
  }
}

async function gotoChapter(href) {
  if (!renderer.value) return

  // Hide overview when navigating from sidebar
  showingOverview.value = false

  try {
    await renderer.value.goto(href)

    // Force a display refresh to ensure content renders
    const currentCfi = renderer.value.getCurrentCfi()
    if (currentCfi) {
      await renderer.value.goto(currentCfi)
    }

    updateCurrentChapter()
    updateProgress()
  } catch (err) {
    console.error('Failed to navigate to chapter:', err)
  }
}

async function prevPage() {
  if (!renderer.value) return

  showingOverview.value = false

  try {
    await renderer.value.prev()
    updateCurrentChapter()
    // Small delay to let epub.js update the location
    setTimeout(updateProgress, 100)
  } catch (err) {
    console.error('Failed to go to previous page:', err)
  }
}

async function nextPage() {
  if (!renderer.value) return
  if (showingOverview.value) {
    // Go to first page if overview is showing
    showingOverview.value = false
    if (chapters.value.length > 0 && chapters.value[0].href) {
      await gotoChapter(chapters.value[0].href)
    }
    return
  }
  try {
    await renderer.value.next()
    updateCurrentChapter()
    // Small delay to let epub.js update the location
    setTimeout(updateProgress, 100)
  } catch (err) {
    console.error('Failed to go to next page:', err)
  }
}

function updateCurrentChapter() {
  if (!renderer.value || chapters.value.length === 0) return

  const currentCfi = renderer.value.getCurrentCfi()
  if (!currentCfi) return

  // Find current chapter by matching CFI
  for (let i = 0; i < chapters.value.length; i++) {
    const chapter = chapters.value[i]
    if (currentCfi.includes(chapter.href)) {
      currentChapterIndex.value = i
      break
    }
  }
}

function updateProgress() {
  if (!renderer.value || !currentBook.value) return

  const progress = renderer.value.getProgress()
  const cfi = renderer.value.getCurrentCfi()

  // Update progress bar - getProgress() now returns estimate if locations aren't ready
  progressPercent.value = Math.round(progress * 100)

  if (cfi && currentBook.value.id) {
    // Always save the current progress (estimated or accurate) to store
    booksStore.updateReadingPosition(currentBook.value.id, cfi, progress)
  }
}

function saveReadingPosition() {
  if (!renderer.value || !currentBook.value) return

  const cfi = renderer.value.getCurrentCfi()
  const progress = renderer.value.getProgress()

  if (cfi && currentBook.value.id) {
    // Always save the current progress (estimated or accurate) to store
    booksStore.updateReadingPosition(currentBook.value.id, cfi, progress)
  }
}

function goBack() {
  router.push({ name: 'books' }).catch(() => {
    // Fallback: go back in history
    router.back()
  })
}

function toggleTOC() {
  // Toggle the side panel (TOC) visibility
  appLayoutRef.value?.toggleSide()
}

// Context menu handling for text selection (Dictionary, Explain, DeepDive)
function handleEpubSelection(selectionData) {
  const { text, rect } = selectionData

  // Get the iframe for positioning
  const iframe = viewerContainer.value?.querySelector('iframe')
  if (!iframe) return

  // Calculate position relative to viewport
  const iframeRect = iframe.getBoundingClientRect()
  const absoluteRect = {
    left: iframeRect.left + rect.left,
    top: iframeRect.top + rect.top,
    right: iframeRect.left + rect.right,
    bottom: iframeRect.top + rect.bottom
  }

  // Context menu dimensions
  const CONTEXT_MENU_HEIGHT = 300
  const CONTEXT_MENU_WIDTH = 250

  // Vertical positioning
  const spaceBelow = window.innerHeight - absoluteRect.bottom
  const showAbove = spaceBelow < CONTEXT_MENU_HEIGHT
  const y = showAbove
    ? absoluteRect.top + window.scrollY - CONTEXT_MENU_HEIGHT
    : absoluteRect.bottom + window.scrollY

  // Horizontal positioning
  let x = absoluteRect.left + window.scrollX
  const spaceRight = window.innerWidth - absoluteRect.left
  if (spaceRight < CONTEXT_MENU_WIDTH) {
    x = window.innerWidth - CONTEXT_MENU_WIDTH + window.scrollX
  }
  if (x < window.scrollX) {
    x = window.scrollX
  }

  contextMenu.value = {
    visible: true,
    x,
    y,
    selectedText: text
  }
}

function closeContextMenu() {
  contextMenu.value.visible = false
}

// Context menu action handlers
async function handleDictionary() {
  const selectedText = contextMenu.value.selectedText.trim()
  if (!selectedText) return

  closeContextMenu()

  // Set up dictionary modal
  dictionaryWord.value = selectedText
  dictionaryDefinition.value = ''
  showDictionaryModal.value = true
  isDictionaryStreaming.value = true

  try {
    const prompts = getDictionaryPrompts(selectedText)
    const result = await sendChatMessageForFeature(FeatureType.DICTIONARY, prompts)
    dictionaryDefinition.value = result
  } catch (err) {
    console.error('Dictionary lookup failed:', err)
    dictionaryDefinition.value = 'Sorry, couldn\'t fetch definition.'
  } finally {
    isDictionaryStreaming.value = false
  }
}

function closeDictionaryModal() {
  showDictionaryModal.value = false
  dictionaryWord.value = ''
  dictionaryDefinition.value = ''
  isDictionaryStreaming.value = false
}

async function handleQuickExplain() {
  const selectedText = contextMenu.value.selectedText.trim()
  if (!selectedText) return

  closeContextMenu()

  // Set up explain modal
  explainId.value = crypto.randomUUID()
  explainContent.value = ''
  explainHighlightedText.value = selectedText
  isExplainStreaming.value = true
  showExplainModal.value = true

  try {
    const prompts = getQuickExplainPrompts(selectedText)
    const result = await sendChatMessageForFeature(FeatureType.EXPLAIN, prompts)
    explainContent.value = result
  } catch (err) {
    console.error('Quick explain failed:', err)
    explainContent.value = 'Sorry, couldn\'t generate explanation.'
  } finally {
    isExplainStreaming.value = false
  }
}

async function handleCustomPrompt(prompt) {
  const selectedText = contextMenu.value.selectedText.trim()
  if (!prompt) return

  closeContextMenu()

  // Set up explain modal for custom prompt result
  explainId.value = crypto.randomUUID()
  explainContent.value = ''
  explainHighlightedText.value = selectedText
  isExplainStreaming.value = true
  showExplainModal.value = true

  try {
    const prompts = [{ role: 'user', content: prompt }]
    const result = await sendChatMessageForFeature(FeatureType.DEEP_DIVE, prompts)
    explainContent.value = result
  } catch (err) {
    console.error('Custom prompt failed:', err)
    explainContent.value = 'Sorry, couldn\'t process your request.'
  } finally {
    isExplainStreaming.value = false
  }
}

async function handleDeepDive(prompt) {
  // Same as custom prompt - Ctrl+Enter deep dive
  await handleCustomPrompt(prompt)
}

function closeExplainModal() {
  showExplainModal.value = false
  explainId.value = ''
  explainContent.value = ''
  explainHighlightedText.value = ''
  isExplainStreaming.value = false
}

// Handle double-click on EPUB content to select word
function handleEpubDoubleClick(event) {
  // Check if click is within an EPUB iframe
  const iframe = viewerContainer.value?.querySelector('iframe')
  if (!iframe) return

  setTimeout(() => {
    handleSelection()
  }, 10)
}

// Mobile selection handling
function checkMobileSelection() {
  const selectionInfo = renderer.value?.getSelectionInfo()
  if (!selectionInfo) return

  handleSelection()
}

function handleSelectionChange() {
  if (!isMobile.value) return

  if (contextMenu.value.visible) return

  if (selectionCheckTimeout.value) {
    clearTimeout(selectionCheckTimeout.value)
  }

  selectionCheckTimeout.value = setTimeout(() => {
    checkMobileSelection()
  }, 500)
}

// Watch for route changes (e.g., navigating to a different book)
watch(() => effectiveBookId.value, async (newId, oldId) => {
  if (newId && newId !== oldId) {
    // Clean up old renderer
    if (renderer.value) {
      renderer.value.destroy()
      renderer.value = null
    }
    // Load new book
    await loadBook(newId)
  }
})

// Initialize progress from currentBook when it becomes available
watch(() => currentBook.value, (book) => {
  if (book) {
    progressPercent.value = Math.round((book.totalProgress || 0) * 100)
  }
}, { immediate: true })
</script>

<style scoped>
.book-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
  position: relative;
}

/* Reading progress bar - subtle top indicator */
.reading-progress-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  background: var(--color-border-subtle);
  z-index: 50;
  pointer-events: none;
  opacity: 0.5;
}

.reading-progress-fill {
  height: 100%;
  background: var(--color-primary);
  opacity: 0.8;
  transition: width 0.3s ease-out;
}

/* NotebookOverview overlay */
.book-viewer :deep(.notebook-overview) {
  left: 0;
  right: 0;
  bottom: 0;
  background: var(--color-bg-base);
  max-width: 100% !important;
  z-index: 100;
  margin: 0;
  padding: 2rem 15%;
}

.viewer-container {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 0 1rem;
}

/* Center the EPUB iframe */
.viewer-container :deep(iframe) {
  margin: 0 auto;
}

/* Side navigation buttons - only visible on mouse hover (desktop), not on touch devices */
.side-nav-btn {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 80px;
  padding: 0;
  background: transparent;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.2s, background-color 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 5;
}

/* Only show on hover for devices with mouse (desktop) */
@media (hover: hover) {
  .side-nav-btn:hover {
    opacity: 1;
    background-color: rgba(128, 128, 128, 0.15);
    color: var(--color-text-base);
  }
}

/* On touch devices, keep buttons hidden */
@media (hover: none) {
  .side-nav-btn {
    display: none;
  }
}

.side-nav-left {
  left: 0;
}

.side-nav-right {
  right: 0;
}

.side-nav-btn svg {
  width: 40px;
  height: 40px;
}

.loading-overlay {
  position: absolute;
  inset: 0;
  background: var(--color-bg-base);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

.loading,
.error {
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted);
}

.error {
  color: var(--color-error-text);
}

/* Table of Contents Sidebar */
.toc-sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.toc-sidebar-header {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  flex-shrink: 0;
}

/* Tab Navigation */
.tab-navigation {
  display: flex;
  gap: 0.25rem;
  background: var(--color-bg-page);
  padding: 0.25rem;
  border-radius: 8px;
}

.tab-button {
  flex: 1;
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: 6px;
  color: var(--color-text-secondary);
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.25rem;
}

.tab-button:hover {
  background: var(--color-bg-hover);
}

.tab-button.active {
  background: var(--color-bg-base);
  color: var(--color-primary);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.tab-count {
  font-size: 0.75rem;
  background: var(--color-bg-hover);
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  color: var(--color-text-muted);
}

.tab-button.active .tab-count {
  background: var(--color-bg-page);
  color: var(--color-primary);
}

.tab-content {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

/* Notebook items */
.notebook-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.notebook-question {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notebook-children-count {
  font-size: 0.75rem;
  background: var(--color-bg-page);
  padding: 0.125rem 0.375rem;
  border-radius: 10px;
  color: var(--color-text-muted);
  flex-shrink: 0;
}

.empty-notebook {
  padding: 2rem 1rem;
  text-align: center;
  color: var(--color-text-muted);
  font-size: 0.875rem;
}

.message-content {
  padding: 0 0.5rem 1rem;
  overflow-y: auto;
}

.message-question {
  font-weight: 600;
  color: var(--color-text-strong);
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.message-response {
  color: var(--color-text-secondary);
  font-size: 0.875rem;
  line-height: 1.6;
}

.message-response :deep(.markdown-renderer) {
  font-size: 0.875rem;
}

.message-response :deep(.markdown-renderer *) {
  font-size: inherit;
}

.notebook-header {
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
}

.notebook-header-title {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.notebook-messages {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 0 0.5rem 1rem;
}

.notebook-message {
  border-radius: 8px;
  overflow: hidden;
}

.notebook-message-response {
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
  color: var(--color-text-secondary);
  line-height: 1.5;
}

.notebook-message-response :deep(.markdown-renderer) {
  font-size: 0.875rem;
}

.notebook-message-response :deep(.markdown-renderer *) {
  font-size: inherit;
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  overflow-y: auto;
  flex: 1;
  padding: 0 1rem 1rem;
}

/* Overview header item */
.overview-header-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  margin-bottom: 0.25rem;
  cursor: pointer;
  border-radius: 4px;
  transition: background-color 0.15s;
}

.overview-header-item:hover {
  background-color: var(--color-bg-hover);
}

.overview-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}

.overview-text {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--color-text-secondary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-header-item:hover .overview-text {
  color: var(--color-primary);
}

.toc-search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 1rem;
  font-family: inherit;
  background-color: var(--color-bg-page);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  color: var(--color-text-message);
  transition: border-color 0.2s, box-shadow 0.2s;
}

.toc-search-input:focus {
  outline: none;
  border-color: var(--color-border-accent);
  box-shadow: 0 0 0 3px var(--shadow-primary);
}

.toc-search-input::placeholder {
  color: var(--color-text-muted);
}

.toc-list {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.playground-list {
  flex: 1;
  overflow: hidden;
}

.toc-item {
  padding: 0.5rem 0.75rem;
  cursor: pointer;
  border-radius: 6px;
  font-size: 0.85rem;
  color: var(--color-text-secondary);
  transition: background 0.15s;
}

.toc-item:hover {
  background: var(--color-bg-hover);
}

.toc-item.active {
  background: var(--color-bg-hover);
  color: var(--color-primary);
  font-weight: 500;
}

@media (max-width: 768px) {
  .viewer-toolbar {
    padding: 0.5rem;
    font-size: 0.875rem;
  }

  .nav-btn {
    padding: 0.4rem 0.6rem;
  }
}
</style>
