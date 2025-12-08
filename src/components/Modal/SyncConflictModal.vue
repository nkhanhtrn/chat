<template>
  <Modal
    :visible="visible"
    title="Data Sync Conflict"
    size="medium"
    :preventClose="true"
  >
    <div class="conflict-container">
      <p class="conflict-description">
        Your local data and cloud data are different. Choose which version to keep:
      </p>

      <div class="data-options">
        <!-- Local Data Option -->
        <button
          class="data-option"
          :class="{ selected: selectedOption === 'local' }"
          @click="selectedOption = 'local'"
        >
          <div class="option-header">
            <span class="option-icon">💻</span>
            <span class="option-title">Local Data</span>
          </div>
          <div class="option-meta">
            <span class="option-timestamp">{{ formatTimestamp(localTimestamp) }}</span>
          </div>
          <div class="option-stats">
            <span>{{ localStats.chats }} notebooks</span>
            <span>{{ localStats.messages }} messages</span>
          </div>
        </button>

        <!-- Cloud Data Option -->
        <button
          class="data-option"
          :class="{ selected: selectedOption === 'cloud' }"
          @click="selectedOption = 'cloud'"
        >
          <div class="option-header">
            <span class="option-icon">☁️</span>
            <span class="option-title">Cloud Data</span>
          </div>
          <div class="option-meta">
            <span class="option-timestamp">{{ formatTimestamp(cloudTimestamp) }}</span>
          </div>
          <div class="option-stats">
            <span>{{ cloudStats.chats }} notebooks</span>
            <span>{{ cloudStats.messages }} messages</span>
          </div>
        </button>
      </div>

      <div class="conflict-warning">
        ⚠️ The data you don't choose will be permanently overwritten.
      </div>

      <div class="force-upload-section">
        <button
          class="force-upload-btn"
          :disabled="isUploading"
          @click="handleForceUpload"
        >
          {{ isUploading ? 'Uploading...' : 'Force Upload Local to Cloud' }}
        </button>
        <div v-if="uploadStatus" :class="['upload-status', uploadStatus.type]">
          {{ uploadStatus.message }}
        </div>
      </div>
    </div>

    <template #footer>
      <button
        class="confirm-btn"
        :disabled="!selectedOption"
        @click="handleConfirm"
      >
        Use {{ selectedOption === 'local' ? 'Local' : 'Cloud' }} Data
      </button>
    </template>
  </Modal>
</template>

<script setup>
import { ref, computed } from 'vue'
import Modal from './Modal.vue'
import { forceUploadToCloud } from '../../services/storage.js'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  localData: {
    type: Object,
    default: null
  },
  cloudData: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['resolve'])

const selectedOption = ref(null)
const isUploading = ref(false)
const uploadStatus = ref(null)

const localTimestamp = computed(() => {
  return props.localData?.lastUpdated || null
})

const cloudTimestamp = computed(() => {
  if (!props.cloudData?.lastUpdated) return null
  // Handle Firestore Timestamp object
  if (props.cloudData.lastUpdated.toDate) {
    return props.cloudData.lastUpdated.toDate().getTime()
  }
  // Handle seconds format
  if (props.cloudData.lastUpdated.seconds) {
    return props.cloudData.lastUpdated.seconds * 1000
  }
  return props.cloudData.lastUpdated
})

const localStats = computed(() => {
  if (!props.localData) return { chats: 0, messages: 0 }
  return {
    chats: props.localData.chats?.length || 0,
    messages: Object.keys(props.localData.messagesById || {}).length
  }
})

const cloudStats = computed(() => {
  if (!props.cloudData) return { chats: 0, messages: 0 }
  return {
    chats: props.cloudData.chats?.length || 0,
    messages: Object.keys(props.cloudData.messagesById || {}).length
  }
})

const formatTimestamp = (timestamp) => {
  if (!timestamp) return 'Unknown'
  const date = new Date(timestamp)
  return date.toLocaleString()
}

const handleConfirm = () => {
  if (selectedOption.value) {
    emit('resolve', selectedOption.value)
  }
}

const handleForceUpload = async () => {
  isUploading.value = true
  uploadStatus.value = null

  try {
    await forceUploadToCloud()
    uploadStatus.value = { type: 'success', message: 'Successfully uploaded local data to cloud' }
    // Auto-resolve with local after successful upload
    setTimeout(() => {
      emit('resolve', 'local')
    }, 1500)
  } catch (error) {
    uploadStatus.value = { type: 'error', message: error.message || 'Failed to upload to cloud' }
  } finally {
    isUploading.value = false
  }
}
</script>

<style scoped>
.conflict-container {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.conflict-description {
  margin: 0;
  color: var(--color-text-base, #333);
  font-size: 0.9375rem;
  line-height: 1.5;
}

.data-options {
  display: flex;
  gap: 1rem;
}

.data-option {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1.25rem;
  background: var(--color-bg-page, #f9f9f9);
  border: 2px solid var(--color-border-subtle, #ddd);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  text-align: left;
}

.data-option:hover {
  border-color: var(--color-border-accent, #aaa);
  background: var(--color-bg-hover, #f5f5f5);
}

.data-option.selected {
  border-color: var(--color-accent, #2563eb);
  background: var(--color-accent-bg, #eff6ff);
}

.option-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.option-icon {
  font-size: 1.5rem;
}

.option-title {
  font-weight: 600;
  font-size: 1rem;
  color: var(--color-text-strong, #222);
}

.option-meta {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.option-timestamp {
  font-size: 0.875rem;
  color: var(--color-text-muted, #666);
}

.option-stats {
  display: flex;
  gap: 1rem;
  font-size: 0.8125rem;
  color: var(--color-text-muted, #666);
}

.conflict-warning {
  padding: 0.75rem;
  background: #fff8e6;
  border: 1px solid #ffe58f;
  border-radius: 4px;
  color: #ad6800;
  font-size: 0.8125rem;
  text-align: center;
}

.confirm-btn {
  padding: 0.75rem 1.5rem;
  background: var(--color-accent, #2563eb);
  color: white;
  border: none;
  border-radius: 6px;
  font-weight: 500;
  font-size: 0.9375rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.confirm-btn:hover:not(:disabled) {
  background: var(--color-accent-hover, #1d4ed8);
}

.confirm-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.force-upload-section {
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-border-subtle, #ddd);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.force-upload-btn {
  padding: 0.5rem 1rem;
  background: var(--color-bg-elevated, #fff);
  border: 1px solid var(--color-border-base, #ccc);
  border-radius: 4px;
  color: var(--color-text-base, #333);
  font-size: 0.875rem;
  cursor: pointer;
  transition: all 0.2s ease;
}

.force-upload-btn:hover:not(:disabled) {
  background: var(--color-bg-hover, #f5f5f5);
  border-color: var(--color-border-accent, #aaa);
}

.force-upload-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.upload-status {
  font-size: 0.8125rem;
  padding: 0.4rem 0.6rem;
  border-radius: 4px;
}

.upload-status.success {
  color: #166534;
  background: #dcfce7;
}

.upload-status.error {
  color: #991b1b;
  background: #fee2e2;
}
</style>
