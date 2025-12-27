<template>
  <div class="playground">
    <!-- Minimal Header -->
    <PlaygroundHeader
      v-model:two-model-mode="modelSelection.twoModelMode.value"
      v-model:selected-provider="modelSelection.selectedProvider.value"
      v-model:selected-model="modelSelection.selectedModel.value"
      v-model:router-model="modelSelection.routerModel.value"
      v-model:executor-model="modelSelection.executorModel.value"
      :providers="modelSelection.providers.value"
      :models="modelSelection.models.value"
      :all-models="modelSelection.allModels.value"
      @update:selected-provider="modelSelection.onProviderChange"
      @clear="chat.clearChat"
    />

    <!-- Messages Area -->
    <PlaygroundMessages
      ref="messagesRef"
      :messages="chat.messages.value"
      :is-streaming="chat.isStreaming.value"
      :is-searching="webSearch.isSearching.value"
      :search-query="webSearch.searchQuery.value"
      :current-planning-step="planning.currentPlanningStep.value"
    />

    <!-- Input Area -->
    <PlaygroundInput
      ref="inputRef"
      v-model="inputText"
      :is-streaming="chat.isStreaming.value"
      :is-searching="webSearch.isSearching.value"
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
      @file-upload="attachments.handleFileUpload"
      @remove-file="attachments.removeFile"
    />

    <MobileFooter active-page="playground" show-home />
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue'
import PlaygroundHeader from '../components/playground/PlaygroundHeader.vue'
import PlaygroundMessages from '../components/playground/PlaygroundMessages.vue'
import PlaygroundInput from '../components/playground/PlaygroundInput.vue'
import MobileFooter from '../components/MobileFooter.vue'
import { useModelSelection } from '../composables/useModelSelection.js'
import { useAttachments } from '../composables/useAttachments.js'
import { useWebSearch } from '../composables/studio/useWebSearch.js'
import { usePlanning } from '../composables/studio/usePlanning.js'
import { useStudioChat } from '../composables/studio/useStudioChat.js'

// Reuse all composables from Studio
const modelSelection = useModelSelection()
const attachments = useAttachments()
const webSearch = useWebSearch()
const planning = usePlanning()
const chat = useStudioChat()

// Local state
const inputText = ref('')
const messagesRef = ref(null)
const inputRef = ref(null)

// Watch input for URL detection
attachments.watchInputForUrls(inputText)

// Connect message container ref
watch(messagesRef, (newRef) => {
  if (newRef?.containerRef) {
    chat.messagesContainer.value = newRef.containerRef
  }
})

// Initialize on mount
onMounted(async () => {
  await modelSelection.initialize()
})

// Handle send message - same logic as Studio
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
  inputRef.value?.resetHeight()

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
.playground {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--color-bg-page);
}
</style>
