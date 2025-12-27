<template>
  <div class="chat-panel-content">
    <!-- Model Bar -->
    <div class="model-bar">
      <label class="two-model-toggle">
        <input type="checkbox" :checked="twoModelMode" @change="$emit('update:twoModelMode', $event.target.checked)" />
        <span class="toggle-switch"></span>
        <span class="toggle-label">2-Model</span>
      </label>
      <template v-if="twoModelMode">
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
      </template>
      <template v-else>
        <div class="model-selector">
          <span class="model-label">Service</span>
          <select :value="selectedProvider" @change="$emit('update:selectedProvider', $event.target.value)" class="model-select">
            <option v-for="p in providers" :key="p.id" :value="p.id">{{ p.name }}</option>
          </select>
        </div>
        <div class="model-selector">
          <span class="model-label">Model</span>
          <select :value="selectedModel" @change="$emit('update:selectedModel', $event.target.value)" class="model-select" :disabled="models.length === 0">
            <option v-if="models.length === 0" value="">Loading...</option>
            <option v-for="m in models" :key="m.id" :value="m.id">{{ m.name }}</option>
          </select>
        </div>
      </template>
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
  uploadedFiles: { type: Array, default: () => [] },
  // Model selection
  twoModelMode: { type: Boolean, default: false },
  allModels: { type: Array, default: () => [] },
  routerModel: { type: String, default: '' },
  executorModel: { type: String, default: '' },
  // Single model mode
  providers: { type: Array, default: () => [] },
  selectedProvider: { type: String, default: '' },
  models: { type: Array, default: () => [] },
  selectedModel: { type: String, default: '' }
})

const emit = defineEmits([
  'update:modelValue',
  'update:twoModelMode',
  'update:routerModel',
  'update:executorModel',
  'update:selectedProvider',
  'update:selectedModel',
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

.model-bar {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid var(--color-border-base);
  background: var(--color-bg-surface);
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

.two-model-toggle {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
}

.two-model-toggle input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-switch {
  position: relative;
  width: 32px;
  height: 18px;
  background: var(--color-border-base);
  border-radius: 9px;
  transition: background 0.2s;
}

.toggle-switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  background: white;
  border-radius: 50%;
  transition: transform 0.2s;
}

.two-model-toggle input:checked + .toggle-switch {
  background: var(--color-primary);
}

.two-model-toggle input:checked + .toggle-switch::after {
  transform: translateX(14px);
}

.toggle-label {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.03em;
}
</style>
