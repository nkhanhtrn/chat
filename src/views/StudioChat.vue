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
        v-model:router-model="modelSelection.routerModel.value"
        v-model:executor-model="modelSelection.executorModel.value"
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
        :is-model-ready="modelSelection.isModelReady.value"
        :detected-urls="attachments.detectedUrls.value"
        :uploaded-files="attachments.uploadedFiles.value"
        :all-models="modelSelection.allModels.value"
        @send="handleSend"
        @stop="chat.stopStreaming"
        @clear="handleClearChat"
        @trigger-upload="triggerFileUpload"
        @file-upload="attachments.handleFileUpload"
        @remove-file="attachments.removeFile"
        @edit="handleEdit"
      />
    </template>

    <!-- Main Panel: Canvas -->
    <SlideTransition appear direction="vertical">
      <CanvasPanel
      ref="canvasPanelRef"
      :visible-windows="canvas.visibleWindows.value"
      :minimized-categories="canvas.minimizedWindowsByCategory.value"
      :sessionId="sessions.activeSessionId.value || 'default'"
      @close-window="canvas.removeWindow"
      @minimize-window="canvas.minimizeWindow"
      @restore-window="canvas.restoreWindow"
      @update-position="canvas.updateWindowPosition"
      @update-size="canvas.updateWindowSize"
      @update-title="handleUpdateTitle"
      @bring-to-front="canvas.bringToFront"
      @edit-window="handleEditWindow"
      @clone-window="handleCloneWindow"
      @open-tool="canvas.addWindow"
      />
    </SlideTransition>
  </AppLayout>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import AppLayout from '../components/AppLayout.vue'
import ChatPanel from '../components/studio/ChatPanel.vue'
import CanvasPanel from '../components/studio/CanvasPanel.vue'
import SessionTabs from '../components/studio/SessionTabs.vue'
import SessionBrowser from '../components/studio/SessionBrowser.vue'
import SlideTransition from '../components/SlideTransition.vue'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/studio/useWebSearch.js'
import { usePlanning } from '../composables/studio/usePlanning.js'
import { useStudioChat } from '../composables/studio/useStudioChat.js'
import { useStudioCanvas } from '../composables/studio/useStudioCanvas.js'
import { useStudioSessions } from '../composables/studio/useStudioSessions.js'

// Initialize sessions (simplified - single session mode)
const sessions = useStudioSessions()

// Initialize composables
const modelSelection = useModelSelection()
const attachments = useAttachments()
const webSearch = useWebSearch()
const planning = usePlanning()
const chat = useStudioChat()
const canvas = useStudioCanvas()

// Local state
const inputText = ref('')
const chatPanelRef = ref(null)
const appLayoutRef = ref(null)
const canvasPanelRef = ref(null)
const isBrowsingSessions = ref(false)

// Set up session manager integration
chat.setSessionManager(sessions)
canvas.setSessionManager(sessions)

// Session handlers
function handleSelectSession(sessionId) {
  if (sessionId === sessions.activeSessionId.value) {
    // Close browser if clicking the active session
    isBrowsingSessions.value = false
    return
  }

  // Show the session in tabs (in case it was hidden)
  sessions.showSession(sessionId)

  // Explicitly save current chat and canvas state before switching
  sessions.updateChatState(chat.getState())
  sessions.updateCanvasState(canvas.getState())

  // Switch to the selected session
  const sessionData = sessions.switchToSession(sessionId)
  if (sessionData) {
    // Load the new session's data into chat and canvas
    chat.loadState(sessionData.chat)
    canvas.loadState(sessionData.canvas)
    isBrowsingSessions.value = false
  }
}

function handleNewSession() {
  sessions.createNewSession()
  // New session starts with empty state
  chat.loadState({ messages: [], nextMessageId: 1 })
  canvas.loadState({
    windows: [],
    nextWindowId: 1,
    cascadeOffset: { x: 0, y: 0 },
    maxZIndex: 100
  })
  isBrowsingSessions.value = false
}

function handleCloseTab(sessionId) {
  // If closing the active session, first switch to another visible session
  if (sessionId === sessions.activeSessionId.value) {
    const visibleSessions = sessions.sortedSessions.value
    if (visibleSessions.length > 0) {
      // Explicitly save current state before switching
      sessions.updateChatState(chat.getState())
      sessions.updateCanvasState(canvas.getState())

      // Switch to the first visible session (usually the previous one)
      const targetSessionId = visibleSessions[0].id
      sessions.showSession(targetSessionId)
      const sessionData = sessions.switchToSession(targetSessionId)
      if (sessionData) {
        chat.loadState(sessionData.chat)
        canvas.loadState(sessionData.canvas)
      }
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
  await modelSelection.initialize()

  // Load the initial session's data into chat and canvas
  const initialChatState = sessions.activeChatState.value
  const initialCanvasState = sessions.activeCanvasState.value
  chat.loadState(initialChatState)
  canvas.loadState(initialCanvasState)
})

// Watch input for URL detection
attachments.watchInputForUrls(inputText)

// Connect message container ref
watch(() => chatPanelRef.value?.messageListRef?.containerRef, (newRef) => {
  if (newRef) {
    chat.messagesContainer.value = newRef
  }
})

// Listen for output events and add windows to canvas
chat.onOutput((output) => {
  canvas.addWindow(output)
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
async function handleEditWindow({ windowId, windowType, currentContent, prompt, onDone }) {
  if (!modelSelection.isModelReady.value || chat.isStreaming.value) {
    onDone?.()
    return
  }

  try {
    await chat.editWindow({
      windowType,
      currentContent,
      prompt,
      modelSelection: {
        executorModel: modelSelection.executorModel.value,
        executorProviderId: modelSelection.executorModelData.value?.providerId || 'lmstudio',
        routerProviderId: modelSelection.routerModelData.value?.providerId || 'lmstudio',
        selectedModel: modelSelection.selectedModel.value
      },
      onComplete: (updatedContent) => {
        canvas.updateWindowContent(windowId, updatedContent)
        setTimeout(() => {
          canvasPanelRef.value?.reloadToolLibrary()
        }, 100)
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
  canvas.cloneWindow(window)
  setTimeout(() => {
    canvasPanelRef.value?.reloadToolLibrary()
  }, 100)
}

// Handle title update
function handleUpdateTitle(windowId, title) {
  canvas.updateWindowTitle(windowId, title)
  setTimeout(() => {
    canvasPanelRef.value?.reloadToolLibrary()
  }, 100)
}

// Handle send message
async function handleSend() {
  if (!inputText.value.trim() || !modelSelection.isModelReady.value || chat.isStreaming.value) {
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
    twoModelMode: true,
    modelSelection: {
      routerModel: modelSelection.routerModel.value,
      routerProviderId: modelSelection.routerModelData.value?.providerId || 'lmstudio',
      executorModel: modelSelection.executorModel.value,
      executorProviderId: modelSelection.executorModelData.value?.providerId || 'lmstudio'
    },
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
</style>
