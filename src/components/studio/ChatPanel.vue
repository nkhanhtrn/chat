<template>
  <div class="chat-panel-content">
    <!-- Header -->
    <StudioHeader />

    <!-- Model Bar -->
    <div class="model-bar-wrapper">
      <div class="model-bar" v-if="showModelSelection">
        <div class="model-selector">
          <span class="model-label">Router</span>
          <select :value="routerModel" @change="$emit('update:routerModel', $event.target.value)" class="model-select" :disabled="allModels.length === 0">
            <option v-if="allModels.length === 0" value="">...</option>
            <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
        <div class="model-selector">
          <span class="model-label">Executor</span>
          <select :value="executorModel" @change="$emit('update:executorModel', $event.target.value)" class="model-select" :disabled="allModels.length === 0">
            <option v-if="allModels.length === 0" value="">...</option>
            <option v-for="m in allModels" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </div>
      <button class="toggle-models-btn" @click="toggleModelSelection" :title="showModelSelection ? 'Hide' : 'Show'">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline :points="showModelSelection ? '18 15 12 9 6 15' : '6 9 12 15 18 9'"></polyline>
        </svg>
      </button>
    </div>

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
import { ref, onMounted } from 'vue'
import StudioHeader from './StudioHeader.vue'
import MessageList from './MessageList.vue'
import MessageInput from './MessageInput.vue'

const STORAGE_KEY = 'studio-show-model-selection'

const showModelSelection = ref(true)

onMounted(() => {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored !== null) {
    showModelSelection.value = stored === 'true'
  }
})

function toggleModelSelection() {
  showModelSelection.value = !showModelSelection.value
  localStorage.setItem(STORAGE_KEY, showModelSelection.value.toString())
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
  isModelReady: { type: Boolean, default: false },
  detectedUrls: { type: Array, default: () => [] },
  uploadedFiles: { type: Array, default: () => [] },
  // Model selection (always 2-model mode)
  allModels: { type: Array, default: () => [] },
  routerModel: { type: String, default: '' },
  executorModel: { type: String, default: '' }
})

const emit = defineEmits([
  'update:modelValue',
  'update:routerModel',
  'update:executorModel',
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

.model-bar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--color-bg-surface);
}

.model-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  width: 100%;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border-base);
}

.model-selector {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  width: 100%;
}

.model-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
  flex-shrink: 0;
  width: 55px;
}

.model-select {
  padding: 0.25rem 0.5rem;
  border: 1px solid var(--color-border-input);
  border-radius: 3px;
  background: var(--color-bg-input);
  color: var(--color-text-base);
  font-size: 0.8rem;
  flex: 1;
  min-width: 0;
  width: 100%;
}

.model-select:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.toggle-models-btn {
  align-self: center;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 12px;
  padding: 0;
  border: 1px solid var(--color-border-base);
  border-top: none;
  border-radius: 0 0 4px 4px;
  background: var(--color-bg-surface);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.toggle-models-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
</style>
