<template>
  <div class="studio-page">
    <!-- Header -->
    <StudioHeader
      v-model:two-model-mode="modelSelection.twoModelMode.value"
      v-model:selected-provider="modelSelection.selectedProvider.value"
      v-model:selected-model="modelSelection.selectedModel.value"
      v-model:router-model="modelSelection.routerModel.value"
      v-model:executor-model="modelSelection.executorModel.value"
      :providers="modelSelection.providers.value"
      :models="modelSelection.models.value"
      :all-models="modelSelection.allModels.value"
      @update:selected-provider="modelSelection.onProviderChange"
    />

    <SlideTransition appear direction="vertical">
      <StudioLayout class="studio-content">
        <!-- Chat Panel (Left) -->
        <template #chat>
          <ChatPanel
            ref="chatPanelRef"
            v-model="inputText"
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
            @send="handleSend"
            @stop="chat.stopStreaming"
            @clear="handleClearChat"
            @trigger-upload="triggerFileUpload"
            @file-upload="attachments.handleFileUpload"
            @remove-file="attachments.removeFile"
            @edit="handleEdit"
          />
        </template>

        <!-- Canvas Panel (Right) -->
        <template #canvas>
          <CanvasPanel
            :visible-windows="canvas.visibleWindows.value"
            :minimized-categories="canvas.minimizedWindowsByCategory.value"
            @close-window="canvas.removeWindow"
            @minimize-window="canvas.minimizeWindow"
            @restore-window="canvas.restoreWindow"
            @update-position="canvas.updateWindowPosition"
            @update-size="canvas.updateWindowSize"
            @update-title="canvas.updateWindowTitle"
            @bring-to-front="canvas.bringToFront"
            @improve-tool="handleImproveTool"
          />
        </template>
      </StudioLayout>
    </SlideTransition>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import SlideTransition from '../components/SlideTransition.vue'
import StudioHeader from '../components/studio/StudioHeader.vue'
import StudioLayout from '../components/studio/StudioLayout.vue'
import ChatPanel from '../components/studio/ChatPanel.vue'
import CanvasPanel from '../components/studio/CanvasPanel.vue'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/studio/useWebSearch.js'
import { usePlanning } from '../composables/studio/usePlanning.js'
import { useStudioChat } from '../composables/studio/useStudioChat.js'
import { useStudioCanvas } from '../composables/studio/useStudioCanvas.js'

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

// Handle tool improvement request
async function handleImproveTool({ windowId, currentSpec, prompt, onDone }) {
  if (!modelSelection.isModelReady.value || chat.isStreaming.value) {
    onDone?.()
    return
  }

  try {
    await chat.improveTool({
      currentSpec,
      prompt,
      modelSelection: {
        executorModel: modelSelection.executorModel.value,
        executorProviderId: modelSelection.executorModelData.value?.providerId || 'lmstudio',
        routerProviderId: modelSelection.routerModelData.value?.providerId || 'lmstudio',
        selectedModel: modelSelection.selectedModel.value
      },
      onComplete: (improvedTool) => {
        // Update the window with the improved tool
        canvas.updateWindowContent(windowId, improvedTool)
      }
    })
  } catch (error) {
    console.error('Failed to improve tool:', error)
  } finally {
    onDone?.()
  }
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

  // Send message
  await chat.sendMessage({
    inputText: currentInputText,
    attachmentSnapshot,
    twoModelMode: modelSelection.twoModelMode.value,
    modelSelection: {
      routerModel: modelSelection.routerModel.value,
      routerProviderId: modelSelection.routerModelData.value?.providerId || 'lmstudio',
      executorModel: modelSelection.executorModel.value,
      executorProviderId: modelSelection.executorModelData.value?.providerId || 'lmstudio',
      selectedModel: modelSelection.selectedModel.value
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
