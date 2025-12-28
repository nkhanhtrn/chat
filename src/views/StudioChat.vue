<template>
  <AppLayout ref="appLayoutRef" storage-key="studio-layout">
    <!-- Side Panel: Chat -->
    <template #side>
      <SessionTabs
        :sessions="sessions.sortedSessions.value"
        :active-session-id="sessions.activeSessionId.value"
        @select="handleSelectSession"
        @close="handleCloseSession"
        @new="handleNewSession"
        @rename="handleRenameSession"
      />
      <ChatPanel
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
import SlideTransition from '../components/SlideTransition.vue'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/studio/useWebSearch.js'
import { usePlanning } from '../composables/studio/usePlanning.js'
import { useStudioChat } from '../composables/studio/useStudioChat.js'
import { useStudioCanvas } from '../composables/studio/useStudioCanvas.js'
import { useStudioSessions } from '../composables/studio/useStudioSessions.js'

// Initialize composables
const modelSelection = useModelSelection()
const attachments = useAttachments()
const webSearch = useWebSearch()
const planning = usePlanning()
const chat = useStudioChat()
const canvas = useStudioCanvas()
const sessions = useStudioSessions()

// Local state
const inputText = ref('')
const chatPanelRef = ref(null)
const appLayoutRef = ref(null)
const canvasPanelRef = ref(null)

// Track if session state has been loaded
const isSessionLoaded = ref(false)

// Session handlers
function handleSelectSession(sessionId) {
  if (sessionId === sessions.activeSessionId.value) return

  // Save current session state
  sessions.updateChatState(chat.getState())
  sessions.updateCanvasState(canvas.getState())

  // Switch to new session and load its data
  const sessionData = sessions.switchToSession(sessionId)
  if (sessionData) {
    loadSessionData(sessionData)
  }
}

function handleNewSession() {
  // Save current session state first
  if (isSessionLoaded.value) {
    sessions.updateChatState(chat.getState())
    sessions.updateCanvasState(canvas.getState())
  }

  // Create new session
  sessions.createNewSession()

  // Clear chat and canvas for new session
  chat.loadState({ messages: [], nextMessageId: 1 })
  canvas.loadState({ canvasWindows: [], nextWindowId: 1, cascadeOffset: { x: 0, y: 0 }, maxZIndex: 100 })
  isSessionLoaded.value = true
}

function handleCloseSession(sessionId) {
  // Don't allow closing the last session
  if (sessions.sessions.value.length <= 1) return

  const switchToId = sessions.deleteSession(sessionId)
  if (switchToId !== null) {
    // Load the session we switched to
    const sessionData = sessions.switchToSession(switchToId)
    if (sessionData) {
      loadSessionData(sessionData)
    }
  }
}

function handleRenameSession(sessionId, newName) {
  sessions.renameSession(sessionId, newName)
}

// Load session data into chat and canvas
function loadSessionData(sessionData) {
  chat.loadState(sessionData.chat)
  canvas.loadState(sessionData.canvas)

  // Load model selections if available
  if (sessionData.models.routerModel && modelSelection.allModels.value.find(m => m.id === sessionData.models.routerModel)) {
    modelSelection.routerModel.value = sessionData.models.routerModel
  }
  if (sessionData.models.executorModel && modelSelection.allModels.value.find(m => m.id === sessionData.models.executorModel)) {
    modelSelection.executorModel.value = sessionData.models.executorModel
  }

  isSessionLoaded.value = true
}

// Watch for model selection changes and save to session
watch([modelSelection.routerModel, modelSelection.executorModel], ([router, executor]) => {
  if (isSessionLoaded.value && sessions.activeSessionId.value) {
    sessions.updateModelSelections(router, executor)
  }
})

// Watch for chat state changes and save to session
watch(() => chat.getState(), (chatState) => {
  if (isSessionLoaded.value && sessions.activeSessionId.value) {
    sessions.updateChatState(chatState)
  }
}, { deep: true })

// Watch for canvas state changes and save to session
watch(() => canvas.getState(), (canvasState) => {
  if (isSessionLoaded.value && sessions.activeSessionId.value) {
    sessions.updateCanvasState(canvasState)
  }
}, { deep: true })

// Initialize on mount
onMounted(async () => {
  // Initialize sessions from localStorage
  const sessionId = sessions.initializeSessions()

  await modelSelection.initialize()

  // Load the active session's data
  const chatState = sessions.loadChatState(sessionId)
  const canvasState = sessions.loadCanvasState(sessionId)
  const modelsState = sessions.getModelSelections(sessionId)

  chat.loadState(chatState)
  canvas.loadState(canvasState)

  // Load model selections if models exist and are still available
  if (modelsState.routerModel && modelSelection.allModels.value.find(m => m.id === modelsState.routerModel)) {
    modelSelection.routerModel.value = modelsState.routerModel
  }
  if (modelsState.executorModel && modelSelection.allModels.value.find(m => m.id === modelsState.executorModel)) {
    modelSelection.executorModel.value = modelsState.executorModel
  }

  isSessionLoaded.value = true
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

// Initialize on mount
onMounted(async () => {
  await modelSelection.initialize()
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
        // Refresh tool library after content edit
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

// Handle clone window - clones and refreshes tool library
function handleCloneWindow(window) {
  canvas.cloneWindow(window)
  // Refresh tool library after clone
  setTimeout(() => {
    canvasPanelRef.value?.reloadToolLibrary()
  }, 100)
}

// Handle title update - updates and refreshes tool library
function handleUpdateTitle(windowId, title) {
  canvas.updateWindowTitle(windowId, title)
  // Refresh tool library after title change (for tools)
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

  // Get attachment snapshot before clearing
  const attachmentSnapshot = attachments.getSnapshot()

  // Clear input and attachments
  inputText.value = ''
  attachments.clearAll()

  // Reset textarea height
  chatPanelRef.value?.messageInputRef?.resetHeight()

  // Create callbacks for web search
  const searchCallbacks = webSearch.createSearchCallbacks({
    updateMessage: (updates) => chat.updateLastMessage(updates),
    scrollToBottom: () => chat.scrollToBottom()
  })

  // Create callbacks for planning
  const planningCallbacks = planning.createPlanningCallbacks({
    updateMessage: (updates) => chat.updateLastMessage(updates),
    getMessage: () => chat.getLastMessage(),
    scrollToBottom: () => chat.scrollToBottom()
  })

  // Send message (always uses 2-model mode)
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

  // Reset search and planning state
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
