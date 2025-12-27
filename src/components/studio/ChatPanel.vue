<template>
  <div class="chat-panel-content">
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

    <!-- Input -->
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
      :is-model-ready="isModelReady"
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
</template>

<script setup>
import { ref } from 'vue'
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'

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
  isModelReady: { type: Boolean, default: false },
  detectedUrls: { type: Array, default: () => [] },
  uploadedFiles: { type: Array, default: () => [] }
})

const emit = defineEmits([
  'update:modelValue',
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
</style>
