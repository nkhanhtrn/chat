<template>
  <div class="input-area">
    <!-- Attachment indicators -->
    <div v-if="hasAttachments" class="attachments-bar">
      <div v-for="url in detectedUrls" :key="url.url" class="attachment-tag">
        <span class="tag-icon">🔗</span>
        <span class="tag-text">{{ url.url.slice(0, 30) }}{{ url.url.length > 30 ? '...' : '' }}</span>
        <span v-if="url.loading" class="tag-status loading">fetching...</span>
        <span v-else-if="url.content" class="tag-status done">ready</span>
      </div>
      <div v-for="file in uploadedFiles" :key="file.name" class="attachment-tag">
        <span class="tag-icon">{{ file.readerName === 'pdf' ? '📕' : '📄' }}</span>
        <span class="tag-text">{{ file.name }}</span>
        <button @click="$emit('removeFile', file.name)" class="tag-remove" title="Remove">&times;</button>
      </div>
    </div>

    <div class="input-row">
      <!-- File upload button -->
      <input
        type="file"
        ref="fileInputRef"
        @change="$emit('fileUpload', $event)"
        multiple
        style="display: none"
      />
      <button
        @click="$refs.fileInputRef.click()"
        class="icon-btn attach-btn"
        :disabled="isStreaming"
        title="Attach file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
        </svg>
      </button>

      <!-- Text input -->
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        @keydown.enter.exact.prevent="$emit('send')"
        placeholder="Send a message..."
        :disabled="isStreaming"
        rows="1"
      ></textarea>

      <!-- Send / Stop button -->
      <button
        v-if="!isStreaming"
        @click="$emit('send')"
        :disabled="!canSend"
        class="icon-btn send-btn"
        :class="{ ready: canSend }"
        title="Send message"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="22" y1="2" x2="11" y2="13"></line>
          <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
        </svg>
      </button>
      <button
        v-else
        @click="$emit('stop')"
        class="icon-btn stop-btn"
        title="Stop generating"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <rect x="6" y="6" width="12" height="12" rx="2"></rect>
        </svg>
      </button>
    </div>

    <!-- Status indicator -->
    <div v-if="statusText" class="status-text">{{ statusText }}</div>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'

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
  isModelReady: {
    type: Boolean,
    default: false
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
  'fileUpload',
  'removeFile'
])

const textareaRef = ref(null)
const fileInputRef = ref(null)

const hasAttachments = computed(() =>
  props.detectedUrls.length > 0 || props.uploadedFiles.length > 0
)

const canSend = computed(() =>
  props.modelValue.trim() &&
  props.isModelReady &&
  !props.hasLoadingUrls &&
  !props.hasLoadingFiles
)

const statusText = computed(() => {
  if (props.hasLoadingUrls || props.hasLoadingFiles) return 'Loading attachments...'
  if (props.isSearching) return props.searchStatus || 'Searching...'
  if (props.isRouting) return 'Routing...'
  if (props.currentVerifyAttempt > 0) return `Retrying (${props.currentVerifyAttempt})...`
  return ''
})

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  adjustHeight()
}

function adjustHeight() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 150) + 'px'
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

defineExpose({
  textareaRef,
  fileInputRef,
  resetHeight
})
</script>

<style scoped>
.input-area {
  padding: 1rem 1.5rem 1.25rem;
  background: var(--color-bg-base);
  border-top: 1px solid var(--color-border-base);
}

.attachments-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-bottom: 0.75rem;
  max-width: 900px;
  margin-left: auto;
  margin-right: auto;
}

.attachment-tag {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.7rem;
  font-family: system-ui, -apple-system, sans-serif;
  color: var(--color-text-muted);
}

.tag-icon {
  font-size: 0.8rem;
}

.tag-text {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag-status {
  font-size: 0.65rem;
  padding: 0.1rem 0.3rem;
  border-radius: 3px;
}

.tag-status.loading {
  background: var(--color-bg-page);
  color: var(--color-text-muted);
}

.tag-status.done {
  background: #d4edda;
  color: #155724;
}

.tag-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 1rem;
  line-height: 1;
  padding: 0 0.2rem;
  margin-left: 0.1rem;
}

.tag-remove:hover {
  color: var(--color-text-base);
}

.input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  max-width: 900px;
  margin: 0 auto;
}

textarea {
  flex: 1;
  padding: 0.65rem 1rem;
  border: 1px solid var(--color-border-input);
  border-radius: 8px;
  font-size: 0.9rem;
  font-family: system-ui, -apple-system, sans-serif;
  resize: none;
  min-height: 42px;
  max-height: 150px;
  overflow-y: auto;
  background: var(--color-bg-input);
  color: var(--color-text-base);
  line-height: 1.5;
}

textarea:focus {
  outline: none;
  border-color: var(--color-primary);
}

textarea:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
}

.icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 42px;
  height: 42px;
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  background: var(--color-bg-input);
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}

.icon-btn:hover:not(:disabled) {
  border-color: var(--color-border-strong);
  color: var(--color-text-base);
}

.icon-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.send-btn.ready {
  background: var(--color-primary);
  border-color: var(--color-primary);
  color: white;
}

.send-btn.ready:hover {
  opacity: 0.9;
}

.stop-btn {
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
}

.stop-btn:hover {
  background: var(--color-bg-input);
  color: var(--color-text-base);
}

.status-text {
  text-align: center;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}

@media (max-width: 768px) {
  .input-area {
    padding: 0.75rem 1rem;
  }

  .input-row {
    gap: 0.4rem;
  }

  .icon-btn {
    width: 38px;
    height: 38px;
  }

  textarea {
    min-height: 38px;
    padding: 0.5rem 0.75rem;
  }
}
</style>
