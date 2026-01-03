<template>
  <div class="chat-panel-content">
    <!-- Header -->
    <StudioHeader />

    <!-- Messages -->
    <MessageList
      ref="messageListRef"
      :messages="messages"
      :is-streaming="isStreaming"
      :is-searching="isSearching"
      :search-query="searchQuery"
      :current-planning-step="currentPlanningStep"
      @edit="(index, content) => $emit('edit', index, content)"
    />

    <!-- Input with Thinking Mode -->
    <div class="input-wrapper">
      <div class="thinking-bar">
        <ThinkingModeToggle
          :model-value="thinkingMode"
          @update:model-value="toggleThinkingMode"
        />
      </div>
      <MessageInput
      ref="messageInputRef"
      :model-value="modelValue"
      @update:model-value="$emit('update:modelValue', $event)"
      :is-streaming="isStreaming"
      :is-searching="isSearching"
      :is-routing="isRouting"
      :current-verify-attempt="currentVerifyAttempt"
      :search-status="searchStatus"
      :has-loading-urls="hasLoadingUrls"
      :has-loading-files="hasLoadingFiles"
      :messages-empty="messages.length === 0"
      :detected-urls="detectedUrls"
      :uploaded-files="uploadedFiles"
      @send="$emit('send')"
      @stop="$emit('stop')"
      @clear="$emit('clear')"
      @trigger-upload="$emit('trigger-upload')"
      @file-upload="$emit('file-upload', $event)"
      @remove-file="$emit('remove-file', $event)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import StudioHeader from './StudioHeader.vue'
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'
import ThinkingModeToggle from './ThinkingModeToggle.vue'

const THINKING_STORAGE_KEY = 'studio-thinking-mode'

// Thinking mode with localStorage persistence
const thinkingMode = ref(false)

onMounted(() => {
  const stored = localStorage.getItem(THINKING_STORAGE_KEY)
  if (stored !== null) {
    thinkingMode.value = stored === 'true'
  }
})

function toggleThinkingMode(value) {
  thinkingMode.value = value
  localStorage.setItem(THINKING_STORAGE_KEY, thinkingMode.value.toString())
}

defineProps({
  messages: { type: Array, default: () => [] },
  isStreaming: { type: Boolean, default: false },
  isSearching: { type: Boolean, default: false },
  searchQuery: { type: String, default: '' },
  currentPlanningStep: { type: Number, default: -1 },
  modelValue: { type: String, default: '' },
  isRouting: { type: Boolean, default: false },
  currentVerifyAttempt: { type: Number, default: 0 },
  searchStatus: { type: String, default: '' },
  hasLoadingUrls: { type: Boolean, default: false },
  hasLoadingFiles: { type: Boolean, default: false },
  detectedUrls: { type: Array, default: () => [] },
  uploadedFiles: { type: Array, default: () => [] },
  // Thinking mode
  thinkingMode: { type: Boolean, default: false }
})

const emit = defineEmits([
  'update:modelValue',
  'update:thinkingMode',
  'send',
  'stop',
  'clear',
  'trigger-upload',
  'file-upload',
  'remove-file',
  'edit'
])

const messageListRef = ref(null)
const messageInputRef = ref(null)

defineExpose({
  messageListRef,
  messageInputRef
})
</script>

<style scoped>
.chat-panel-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

/* Input Wrapper */
.input-wrapper {
  display: flex;
  flex-direction: column;
  padding: 0 1rem 0.5rem 1rem;
  background: var(--color-bg-base);
}

.thinking-bar {
  display: flex;
  align-items: center;
  padding-bottom: 0.25rem;
}
</style>
