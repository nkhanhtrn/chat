<template>
  <div class="input-container">
    <AttachmentStatus
      :detected-urls="detectedUrls"
      :uploaded-files="uploadedFiles"
      @remove-file="$emit('removeFile', $event)"
    />

    <div class="input-wrapper">
      <input
        type="file"
        ref="fileInputRef"
        @change="$emit('fileUpload', $event)"
        multiple
        style="display: none"
      />
      <button
        @click="$emit('triggerUpload')"
        class="upload-button"
        :disabled="isStreaming"
        title="Upload file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
        </svg>
      </button>
      <textarea
        ref="textareaRef"
        :value="modelValue"
        @input="handleInput"
        @keydown.enter.exact.prevent="$emit('send')"
        placeholder="Type your message..."
        :disabled="isStreaming"
        rows="1"
      ></textarea>
      <Button
        v-if="!isStreaming"
        @click="$emit('send')"
        :disabled="!canSend"
        variant="primary"
        class="send-button"
      >
        {{ buttonText }}
      </Button>
      <button
        v-else
        @click="$emit('stop')"
        class="stop-button"
      >
        {{ stopButtonText }}
      </button>
    </div>
    <button @click="$emit('clear')" class="clear-button" :disabled="messagesEmpty">
      Clear chat
    </button>
  </div>
</template>

<script setup>
import { ref, nextTick, computed } from 'vue'
import Button from '../Button.vue'
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
  isModelReady: {
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
    props.isModelReady &&
    !props.hasLoadingUrls &&
    !props.hasLoadingFiles
})

const buttonText = computed(() => {
  if (props.hasLoadingUrls || props.hasLoadingFiles) return 'Loading...'
  if (props.isSearching) return 'Searching...'
  return 'Send'
})

const stopButtonText = computed(() => {
  if (props.isSearching) return props.searchStatus
  if (props.isRouting) return 'Routing...'
  if (props.currentVerifyAttempt > 0) return `Retrying (${props.currentVerifyAttempt})...`
  return 'Stop generating'
})

function handleInput(event) {
  emit('update:modelValue', event.target.value)
  adjustHeight()
}

function adjustHeight() {
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = 'auto'
      textareaRef.value.style.height = Math.min(textareaRef.value.scrollHeight, 200) + 'px'
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
  padding: 1.5rem 4rem;
  border-top: 1px solid var(--color-border-base);
  background-color: var(--color-bg-surface);
}

.input-wrapper {
  display: flex;
  gap: 1rem;
  align-items: flex-end;
  max-width: 800px;
  margin: 0 auto;
}

.upload-button {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.875rem;
  background-color: var(--color-bg-input);
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.2s;
  min-height: 50px;
  align-self: flex-end;
}

.upload-button:hover:not(:disabled) {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

.upload-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea {
  flex: 1;
  padding: 0.875rem 1.125rem;
  border: 1px solid var(--color-border-input);
  border-radius: 4px;
  font-size: 1.05rem;
  font-family: 'Georgia', serif;
  resize: none;
  min-height: 50px;
  max-height: 200px;
  overflow-y: auto;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  line-height: 1.6;
}

textarea:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

textarea:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

textarea::placeholder {
  color: var(--color-text-placeholder);
  font-style: italic;
}

.send-button {
  padding: 0.875rem 1.5rem;
  min-height: 50px;
  font-family: 'Georgia', serif;
  align-self: flex-end;
}

.stop-button {
  padding: 0.875rem 1.25rem;
  min-height: 50px;
  background-color: var(--color-bg-page);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-base);
  border-radius: 2px;
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  align-self: flex-end;
}

.stop-button:hover {
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
  border-color: var(--color-border-strong);
}

.clear-button {
  display: block;
  margin: 0.75rem auto 0;
  padding: 0.5rem 1rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-size: 0.85rem;
  cursor: pointer;
  transition: color 0.2s;
}

.clear-button:hover:not(:disabled) {
  color: var(--color-text-base);
  text-decoration: underline;
}

.clear-button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .input-container {
    padding: 1rem;
  }

  .input-wrapper {
    position: relative;
    gap: 0;
  }

  textarea {
    padding-right: 5rem;
    padding-left: 3rem;
  }

  .send-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    height: auto;
    padding: 0.5rem 1rem;
  }

  .stop-button {
    position: absolute;
    right: 0.5rem;
    bottom: 0.5rem;
    padding: 0.5rem 0.75rem;
    font-size: 0.8rem;
  }

  .upload-button {
    position: absolute;
    left: 0.5rem;
    bottom: 0.5rem;
    height: auto;
    padding: 0.5rem;
    z-index: 1;
  }
}
</style>
