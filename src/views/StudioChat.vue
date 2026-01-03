<template>
  <AppLayout ref="appLayoutRef" storage-key="studio-layout">
    <!-- Side Panel: Chat or Session Browser -->
    <template #side>
      <SessionTabs
        :sessions="sessions.sortedSessions.value"
        :active-session-id="sessions.activeSessionId.value"
        @select="handleSelectSession"
        @close="handleCloseTab"
        @new="handleNewSession"
        @rename="handleRenameSession"
        @browse="isBrowsingSessions = true"
      />

      <!-- Session Browser -->
      <SessionBrowser
        v-if="isBrowsingSessions"
        :sessions="sessions.allSessions.value"
        :active-session-id="sessions.activeSessionId.value"
        @close="isBrowsingSessions = false"
        @select="handleBrowserSelectSession"
        @delete="handleDeleteSession"
        @new="handleBrowserNewSession"
        @rename="handleRenameSession"
      />

      <!-- Chat Panel -->
      <ChatPanel
        v-else
        ref="chatPanelRef"
        v-model="inputText"
        v-model:thinking-mode="thinkingMode"
        :messages="chat.messages.value"
        :is-streaming="chat.isStreaming.value"
        :is-searching="webSearch.isSearching.value"
        :search-query="webSearch.searchQuery.value"
        :current-planning-step="planning.currentPlanningStep.value"
        :is-routing="chat.isRouting.value"
        :current-verify-attempt="chat.currentVerifyAttempt.value"
        :search-status="webSearch.searchStatus.value"
        :has-loading-urls="attachments.hasLoadingUrls.value"
        :has-loading-files="attachments.hasLoadingFiles.value"
        :detected-urls="attachments.detectedUrls.value"
        :uploaded-files="attachments.uploadedFiles.value"
        @send="handleSend"
        @stop="chat.stopStreaming"
        @clear="handleClearChat"
        @trigger-upload="triggerFileUpload"
        @file-upload="attachments.handleFileUpload"
        @remove-file="attachments.removeFile"
        @edit="handleEdit"
      />
    </template>

    <!-- Main Panel: Canvas with Window Browser Overlay -->
    <div class="canvas-wrapper" @click="handleCanvasClick">
      <SlideTransition appear direction="vertical">
        <CanvasPanel
        ref="canvasPanelRef"
        :windows="canvas.windows.value"
        :sessionId="sessions.activeSessionId.value || 'default'"
        :hasHistoryFn="hasHistory"
        @close-window="handleCloseWindow"
        @minimize-window="handleMinimizeWindow"
        @restore-window="handleRestoreWindow"
        @update-position="handleUpdateWindowPosition"
        @update-size="handleUpdateWindowSize"
        @update-title="handleUpdateTitle"
        @bring-to-front="handleBringToFront"
        @edit-window="handleEditWindow"
        @clone-window="handleCloneWindow"
        @go-back="handleGoBack"
        @tool-error="handleToolError"
        @browse-windows="isBrowsingWindows = !isBrowsingWindows"
        />
      </SlideTransition>

      <!-- Window Browser Overlay -->
      <WindowBrowser
        v-if="isBrowsingWindows"
        :windows="canvas.windows.value"
        @close="isBrowsingWindows = false"
        @restore="handleRestoreWindow"
        @delete="handleDeleteWindow"
        @rename="handleUpdateTitle"
        @click.stop
      />
    </div>
  </AppLayout>
</template>

<script setup>
import { debugLog } from '../utils/debug.js'
import { ref, onMounted, watch, nextTick } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ChatPanel from '../components/studio/ChatPanel.vue'
import CanvasPanel from '../components/studio/CanvasPanel.vue'
import SessionTabs from '../components/studio/SessionTabs.vue'
import SessionBrowser from '../components/studio/SessionBrowser.vue'
import WindowBrowser from '../components/studio/WindowBrowser.vue'
import SlideTransition from '../components/SlideTransition.vue'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/studio/useWebSearch.js'
import { usePlanning } from '../composables/studio/usePlanning.js'
import { useStudioChat } from '../composables/studio/useStudioChat.js'
import { useStudioCanvas, hasHistory } from '../composables/studio/useStudioCanvas.js'
import { useStudioSessions } from '../composables/studio/useStudioSessions.js'
import { useContentEditor } from '../composables/studio/useContentEditor.js'

// Initialize sessions
const sessions = useStudioSessions()

// Initialize composables
const attachments = useAttachments()
const webSearch = useWebSearch()
const planning = usePlanning()
const chat = useStudioChat(sessions)
const canvas = useStudioCanvas(sessions.activeSessionId)
const contentEditor = useContentEditor()

// Local state
const inputText = ref('')
const chatPanelRef = ref(null)
const isBrowsingSessions = ref(false)
const isBrowsingWindows = ref(false)
const thinkingMode = ref(false)

// Load thinking mode from localStorage
onMounted(() => {
  const storedThinking = localStorage.getItem('studio-thinking-mode')
  debugLog('[StudioChat.onMounted] Reading studio-thinking-mode from localStorage:', storedThinking)
  if (storedThinking !== null) {
    thinkingMode.value = storedThinking === 'true'
  }
})

watch(thinkingMode, (newValue) => {
  debugLog('[StudioChat.thinkingMode] Writing studio-thinking-mode to localStorage:', String(newValue))
  localStorage.setItem('studio-thinking-mode', String(newValue))
})

// Session handlers
async function handleSelectSession(sessionId) {
  if (sessionId === sessions.activeSessionId.value) {
    // Close browser if clicking the active session
    isBrowsingSessions.value = false
    return
  }

  // Show the session in tabs (in case it was hidden)
  sessions.showSession(sessionId)

  // Switch active session - chat and canvas auto-load via reactive computed
  sessions.activeSessionId.value = sessionId
  isBrowsingSessions.value = false
}

async function handleNewSession() {
  const newSession = sessions.createNewSession()
  // New session's data auto-loads via reactive computed
  isBrowsingSessions.value = false
}

function handleCloseTab(sessionId) {
  // If closing the active session, first switch to another visible session
  if (sessionId === sessions.activeSessionId.value) {
    const visibleSessions = sessions.sortedSessions.value
    if (visibleSessions.length > 0) {
      // Switch to the first visible session (usually the previous one)
      const targetSessionId = visibleSessions[0].id
      sessions.showSession(targetSessionId)
      sessions.activeSessionId.value = targetSessionId
      // Chat and canvas auto-load via watch
    }
  }

  // Then hide the session (remove from tabs)
  sessions.hideSession(sessionId)
}

function handleDeleteSession(sessionId) {
  sessions.deleteSession(sessionId)
}

function handleRenameSession(sessionId, newName) {
  sessions.renameSession(sessionId, newName)
}

// Session Browser handlers
function handleBrowserSelectSession(sessionId) {
  handleSelectSession(sessionId)
}

function handleBrowserNewSession() {
  handleNewSession()
}

// Initialize on mount
onMounted(async () => {
  await sessions.initializeSessions()
})

// Watch input for URL detection
attachments.watchInputForUrls(inputText)

// Connect message container ref
watch(() => chatPanelRef.value?.messageListRef?.containerRef, (newRef) => {
  if (newRef) {
    chat.messagesContainer.value = newRef
  }
})

// Listen for output events and add windows to session
chat.onOutput((output) => {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.addWindow(sessionId, output)
  }
})

// Trigger file upload
function triggerFileUpload() {
  chatPanelRef.value?.messageInputRef?.fileInputRef?.click()
}

// Handle clear chat - keep canvas windows
function handleClearChat() {
  chat.clearChat()
}

// Handle edit/retry message
async function handleEdit(messageIndex, newContent) {
  if (chat.isStreaming.value) return
  chat.deleteMessagePair(messageIndex)
  inputText.value = newContent
  await handleSend()
}

// Handle window edit request
async function handleEditWindow({ windowId, windowType, currentContent, prompt, useThinkingMode, onDone }) {
  if (chat.isStreaming.value) {
    onDone?.()
    return
  }

  // Global thinking OFF forces everything to not use Code API
  // Global thinking ON allows OutputWindow to override locally
  const effectiveThinkingMode = thinkingMode.value ? (useThinkingMode ?? true) : false

  try {
    // Find the window to get current content for merging
    const currentWindow = canvas.windows.value.find(w => w.id === windowId)
    let currentStdout = currentWindow?.content?.stdout || ''

    await contentEditor.editContent({
      windowType,
      currentContent,
      prompt,
      useThinkingMode: effectiveThinkingMode,
      onStdoutChunk: (chunk) => {
        // Stream stdout to window in real-time for codeResult and tool types (no history during streaming)
        if (windowType === 'codeResult' || windowType === 'tool') {
          currentStdout += chunk
          const sessionId = sessions.activeSessionId.value
          if (sessionId) {
            canvas.updateWindow(sessionId, windowId, {
              content: {
                ...currentContent,
                stdout: currentStdout
              }
            })
          }
        }
      },
      onComplete: (updatedContent) => {
        // Ensure stdout is preserved from streaming
        const finalContent = {
          ...updatedContent,
          stdout: updatedContent.stdout || currentStdout
        }
        // Save to history before final update (only for tools)
        if (windowType === 'tool') {
          canvas.pushToHistory(windowId, currentContent)
        }
        const sessionId = sessions.activeSessionId.value
        if (sessionId) {
          canvas.updateWindow(sessionId, windowId, { content: finalContent })
        }
      }
    })
  } catch (error) {
    console.error('Failed to edit window:', error)
  } finally {
    onDone?.()
  }
}

// Handle clone window
function handleCloneWindow(window) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    const newWindow = {
      ...window,
      id: crypto.randomUUID(),
      position: { ...window.position, x: window.position.x + 30, y: window.position.y + 30 },
      zIndex: canvas.getNextZIndex()
    }
    canvas.addWindow(sessionId, newWindow)
  }
}

// Window operation wrappers - delegate to session manager
function handleCloseWindow(windowId) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    // Set displayState to 'closed' - window won't be rendered anywhere
    canvas.updateWindow(sessionId, windowId, { displayState: canvas.DISPLAY_STATES.CLOSED })
  }
}

function handleMinimizeWindow(windowId) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    // Set displayState to 'minimized' - window shows in minimized bar
    canvas.updateWindow(sessionId, windowId, { displayState: canvas.DISPLAY_STATES.MINIMIZED })
  }
}

function handleRestoreWindow(windowId) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    // Set displayState to 'open' - window renders on canvas
    canvas.updateWindow(sessionId, windowId, { displayState: canvas.DISPLAY_STATES.OPEN })
  }
}

function handleDeleteWindow(windowId) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.removeWindow(sessionId, windowId)
  }
}

function handleCanvasClick() {
  // Close the window browser when clicking outside of it
  if (isBrowsingWindows.value) {
    isBrowsingWindows.value = false
  }
}

function handleUpdateWindowPosition(windowId, position) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.updateWindow(sessionId, windowId, { position })
  }
}

function handleUpdateWindowSize(windowId, size) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.updateWindow(sessionId, windowId, { size })
  }
}

function handleBringToFront(windowId) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.updateWindow(sessionId, windowId, { zIndex: canvas.getNextZIndex() })
  }
}

// Handle title update
function handleUpdateTitle(windowId, title) {
  const sessionId = sessions.activeSessionId.value
  if (sessionId) {
    canvas.updateWindow(sessionId, windowId, { title })
  }
}

// Handle go back to previous version
function handleGoBack(windowId) {
  const previousContent = canvas.popFromHistory(windowId)
  if (previousContent) {
    const sessionId = sessions.activeSessionId.value
    if (sessionId) {
      canvas.updateWindow(sessionId, windowId, { content: previousContent })
    }
  }
}

// Handle tool error - add error message to chat
function handleToolError(errorDetails) {
  const { toolName, error } = errorDetails
  console.error('[StudioChat] Tool error:', toolName, error)

  // Add error message to chat
  chat.messages.value.push({
    id: `error-${Date.now()}`,
    role: 'system',
    content: `❌ Tool Error: "${toolName}"\n\n${error}`,
    isError: true,
    timestamp: Date.now()
  })

  // Scroll to bottom to show the error
  nextTick(() => {
    chat.scrollToBottom()
  })
}

// Handle send message
async function handleSend() {
  if (!inputText.value.trim() || chat.isStreaming.value) {
    return
  }
  if (attachments.hasLoadingAttachments.value) {
    return
  }

  const currentInputText = inputText.value
  const attachmentSnapshot = attachments.getSnapshot()

  inputText.value = ''
  attachments.clearAll()
  chatPanelRef.value?.messageInputRef?.resetHeight()

  const searchCallbacks = webSearch.createSearchCallbacks({
    updateMessage: (updates) => chat.updateLastMessage(updates),
    scrollToBottom: () => chat.scrollToBottom()
  })

  const planningCallbacks = planning.createPlanningCallbacks({
    updateMessage: (updates) => chat.updateLastMessage(updates),
    getMessage: () => chat.getLastMessage(),
    scrollToBottom: () => chat.scrollToBottom()
  })

  await chat.sendMessage({
    inputText: currentInputText,
    attachmentSnapshot,
    useThinkingMode: thinkingMode.value,
    searchCallbacks,
    planningCallbacks
  })

  webSearch.reset()
  planning.reset()
}
</script>

<style scoped>
.studio-page {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background-color: var(--color-bg-page);
}

.studio-content {
  display: flex;
  flex: 1;
  min-height: 0;
}

.canvas-wrapper {
  position: relative;
  width: 100%;
  height: 100%;
}
</style>
