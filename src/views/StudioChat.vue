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
      <div class="studio-content">
        <!-- Messages -->
        <MessageList
          ref="messageListRef"
          :messages="chat.messages.value"
          :is-streaming="chat.isStreaming.value"
          :is-searching="webSearch.isSearching.value"
          :search-query="webSearch.searchQuery.value"
          :current-planning-step="planning.currentPlanningStep.value"
        />

        <!-- Input -->
        <MessageInput
          ref="messageInputRef"
          v-model="inputText"
          :is-streaming="chat.isStreaming.value"
          :is-searching="webSearch.isSearching.value"
          :is-routing="chat.isRouting.value"
          :current-verify-attempt="chat.currentVerifyAttempt.value"
          :search-status="webSearch.searchStatus.value"
          :has-loading-urls="attachments.hasLoadingUrls.value"
          :has-loading-files="attachments.hasLoadingFiles.value"
          :is-model-ready="modelSelection.isModelReady.value"
          :messages-empty="chat.messages.value.length === 0"
          :detected-urls="attachments.detectedUrls.value"
          :uploaded-files="attachments.uploadedFiles.value"
          @send="handleSend"
          @stop="chat.stopStreaming"
          @clear="chat.clearChat"
          @trigger-upload="triggerFileUpload"
          @file-upload="attachments.handleFileUpload"
          @remove-file="attachments.removeFile"
        />
      </div>
    </SlideTransition>
  </div>
</template>

<script setup>
import { ref, onMounted, watch, nextTick } from 'vue'
import SlideTransition from '../components/SlideTransition.vue'
import StudioHeader from '../components/studio/StudioHeader.vue'
import MessageList from '../components/studio/MessageList.vue'
import MessageInput from '../components/studio/MessageInput.vue'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/useWebSearch.js'
import { usePlanning } from '../composables/usePlanning.js'
import { useStudioChat } from '../composables/useStudioChat.js'

// Initialize composables
const modelSelection = useModelSelection()
const attachments = useAttachments()
const webSearch = useWebSearch()
const planning = usePlanning()
const chat = useStudioChat()

// Local state
const inputText = ref('')
const messageListRef = ref(null)
const messageInputRef = ref(null)

// Watch input for URL detection
attachments.watchInputForUrls(inputText)

// Connect message container ref
watch(messageListRef, (newRef) => {
  if (newRef?.containerRef) {
    chat.messagesContainer.value = newRef.containerRef
  }
})

// Initialize on mount
onMounted(async () => {
  await modelSelection.initialize()
})

// Trigger file upload
function triggerFileUpload() {
  messageInputRef.value?.fileInputRef?.click()
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
  messageInputRef.value?.resetHeight()

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
  flex-direction: column;
  flex: 1;
  min-height: 0;
}
</style>
