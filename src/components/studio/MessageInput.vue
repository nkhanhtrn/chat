<template>
  <div class="input-container">
    <AttachmentStatus
      :detected-urls="detectedUrls"
      :uploaded-files="uploadedFiles"
      @remove-file="$emit('removeFile', $event)"
    />

    <div class="input-box">
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        @keydown.enter.exact.prevent="$emit('send')"
        placeholder="Message..."
        :disabled="isStreaming"
        rows="1"
      ></textarea>

      <div class="input-actions">
        <input
          type="file"
          ref="fileInputRef"
          @change="$emit('fileUpload', $event)"
          multiple
          style="display: none"
        />

        <button
          @click="$emit('triggerUpload')"
          class="action-btn upload-btn"
          :disabled="isStreaming"
          title="Attach file"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
          </svg>
        </button>

        <button
          v-if="!messagesEmpty"
          @click="$emit('clear')"
          class="action-btn clear-btn"
          title="Clear chat"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
        </button>

        <div class="divider"></div>

        <button
          v-if="!isStreaming"
          @click="$emit('send')"
          :disabled="!canSend"
          class="action-btn send-btn"
          :title="buttonText"
        >
          <svg v-if="!hasLoadingUrls && !hasLoadingFiles" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="22" y1="2" x2="11" y2="13"></line>
            <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
          </svg>
          <span v-else class="loading-spinner"></span>
        </button>

        <button
          v-else
          @click="$emit('stop')"
          class="action-btn stop-btn"
          :title="stopButtonText"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"></rect>
          </svg>
        </button>
      </div>
    </div>

    <div v-if="isStreaming" class="status-text">
      {{ stopButtonText }}
    </div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import AttachmentStatus from './AttachmentStatus.vue'

const props = defineProps({
  modelValue: {
    type: String,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  isSearching: {
    type: Boolean,
    default: false
  },
  isRouting: {
    type: Boolean,
    default: false
  },
  currentVerifyAttempt: {
    type: Number,
    default: 0
  },
  searchStatus: {
    type: String,
    default: ''
  },
  hasLoadingUrls: {
    type: Boolean,
    default: false
  },
  hasLoadingFiles: {
    type: Boolean,
    default: false
  },
  messagesEmpty: {
    type: Boolean,
    default: true
  },
  detectedUrls: {
    type: Array,
    default: () => []
  },
  uploadedFiles: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits([
  'update:modelValue',
  'send',
  'stop',
  'clear',
  'triggerUpload',
  'fileUpload',
  'removeFile'
])

const textareaRef = ref(null)
const fileInputRef = ref(null)

const canSend = computed(() => {
  return props.modelValue.trim() &&
    !props.hasLoadingUrls &&
    !props.hasLoadingFiles
})

const buttonText = computed(() => {
  if (props.hasLoadingUrls || props.hasLoadingFiles) return 'Loading attachments...'
  if (props.isSearching) return 'Searching...'
  return 'Send message'
})

const stopButtonText = computed(() => {
  if (props.isSearching) return props.searchStatus
  if (props.isRouting) return 'Analyzing...'
  if (props.currentVerifyAttempt > 0) return `Retrying (${props.currentVerifyAttempt})...`
  return 'Generating...'
})

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  adjustHeight()
}

function adjustHeight() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 160) + 'px'
    }
  })
}

function resetHeight() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
    }
  })
}

// Expose refs and methods for parent
defineExpose({
  textareaRef,
  fileInputRef,
  resetHeight
})
</script>

<style scoped>
.input-container {
  padding: 1rem 1.25rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-base);
}

.input-box {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  padding: 0.5rem;
  transition: border-color 0.15s;
}

.input-box:focus-within {
  border-color: var(--color-border-strong);
}

textarea {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  font-size: 0.95rem;
  font-family: 'Georgia', serif;
  resize: none;
  min-height: 24px;
  max-height: 160px;
  overflow-y: auto;
  background-color: transparent;
  color: var(--color-text-base);
  line-height: 1.5;
}

textarea:focus {
  outline: none;
}

textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
}

.input-actions {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border-subtle);
  margin: 0 0.25rem;
}

.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.action-btn:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

.action-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn {
  background-color: var(--color-primary, #6366f1);
  color: white;
}

.send-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover, #4f46e5);
  color: white;
}

.send-btn:disabled {
  background-color: var(--color-bg-hover);
  color: var(--color-text-muted);
  opacity: 1;
}

.stop-btn {
  background-color: var(--color-error-subtle, #fee2e2);
  color: var(--color-error, #ef4444);
}

.stop-btn:hover {
  background-color: var(--color-error, #ef4444);
  color: white;
}

.clear-btn:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
}

.loading-spinner {
  width: 16px;
  height: 16px;
  border: 2px solid currentColor;
  border-top-color: transparent;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.status-text {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  font-family: system-ui, sans-serif;
}

@media (max-width: 768px) {
  .input-container {
    padding: 0.75rem 1rem;
  }
}
</style>
