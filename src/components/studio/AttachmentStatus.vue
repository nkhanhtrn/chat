<template>
  <div class="attachment-status">
    <!-- URL Detection Status -->
    <div v-if="detectedUrls.length > 0" class="url-status-container">
      <div v-for="urlEntry in detectedUrls" :key="urlEntry.url" class="url-status-item">
        <span class="url-status-icon">
          <span v-if="urlEntry.status === 'loading'" class="spinner"></span>
          <span v-else-if="urlEntry.status === 'success'" class="check-icon">&#10003;</span>
          <span v-else class="error-icon">&#10007;</span>
        </span>
        <span class="url-text" :title="urlEntry.url">{{ truncateUrl(urlEntry.url) }}</span>
        <span v-if="urlEntry.status === 'success'" class="url-content-size">
          ({{ formatSize(urlEntry.content.length) }})
        </span>
        <span v-if="urlEntry.status === 'error'" class="url-error">
          {{ urlEntry.content }}
        </span>
      </div>
    </div>

    <!-- Uploaded Files Status -->
    <div v-if="uploadedFiles.length > 0" class="file-status-container">
      <div v-for="(file, index) in uploadedFiles" :key="file.name + index" class="file-status-item">
        <span class="file-status-icon">
          <span v-if="file.status === 'loading'" class="spinner"></span>
          <span v-else-if="file.status === 'success'" class="file-icon">{{ file.name.endsWith('.pdf') ? '&#128213;' : '&#128196;' }}</span>
          <span v-else class="error-icon">&#10007;</span>
        </span>
        <span class="file-name" :title="file.name">{{ truncateFileName(file.name) }}</span>
        <span v-if="file.status === 'success'" class="file-size">({{ formatSize(file.content.length) }})</span>
        <span v-if="file.status === 'error'" class="file-error">{{ file.error }}</span>
        <span v-if="file.readerName" class="file-reader-badge">{{ file.readerName }}</span>
        <button class="file-remove" @click="$emit('removeFile', index)" title="Remove file">&times;</button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { truncateUrl, truncateFileName, formatSize } from '../../utils/format.js'

defineProps({
  detectedUrls: {
    type: Array,
    required: true
  },
  uploadedFiles: {
    type: Array,
    required: true
  }
})

defineEmits(['removeFile'])
</script>

<style scoped>
.url-status-container {
  max-width: 800px;
  margin: 0 auto 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.url-status-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
}

.url-status-icon {
  display: flex;
  align-items: center;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 2px solid var(--color-border-base);
  border-top-color: var(--color-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.check-icon {
  color: #22c55e;
  font-weight: bold;
}

.error-icon {
  color: #ef4444;
  font-weight: bold;
}

.url-text {
  color: var(--color-text-base);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.url-content-size {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.url-error {
  color: #ef4444;
  font-size: 0.75rem;
}

.file-status-container {
  max-width: 800px;
  margin: 0 auto 0.75rem;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.file-status-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.35rem 0.65rem;
  background-color: var(--color-bg-hover);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
}

.file-status-icon {
  display: flex;
  align-items: center;
}

.file-icon {
  font-size: 0.9rem;
}

.file-error {
  color: #ef4444;
  font-size: 0.75rem;
}

.file-reader-badge {
  padding: 0.1rem 0.3rem;
  background-color: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  border-radius: 3px;
  font-size: 0.65rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
}

.file-name {
  color: var(--color-text-base);
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-size {
  color: var(--color-text-muted);
  font-size: 0.75rem;
}

.file-remove {
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  padding: 0 0.25rem;
  font-size: 1rem;
  line-height: 1;
  transition: color 0.2s;
}

.file-remove:hover {
  color: #ef4444;
}
</style>
