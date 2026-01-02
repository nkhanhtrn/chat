<template>
  <div v-if="urls.length > 0" class="url-attachments" :class="sizeClass">
    <div v-for="urlAttachment in urls" :key="urlAttachment.url"
         :class="['url-attachment', urlAttachment.status]">
      <span class="url-icon">🔗</span>
      <span class="url-text">{{ truncateUrl(urlAttachment.url) }}</span>
      <span v-if="urlAttachment.status === 'loading'" class="url-status">Loading...</span>
      <span v-else-if="urlAttachment.status === 'success'" class="url-status success">✓</span>
      <span v-else-if="urlAttachment.status === 'error'" class="url-status error">✗</span>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { truncateUrl } from '../utils/format.js'

const props = defineProps({
  urls: {
    type: Array,
    default: () => []
  },
  size: {
    type: String,
    default: 'medium',
    validator: (value) => ['small', 'medium', 'large'].includes(value)
  }
})

const sizeClass = computed(() => `size-${props.size}`)
</script>

<style scoped>
.url-attachments {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  background: var(--color-bg-hover);
  border-top: 1px solid var(--color-border-base);
}

.url-attachments.size-small {
  padding: 0.35rem 0.5rem;
}

.url-attachments.size-medium {
  padding: 0.5rem 0.75rem;
}

.url-attachments.size-large {
  padding: 0.65rem 0.85rem;
}

.url-attachment {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  background: var(--color-bg-page);
  border-radius: 5px;
  font-size: 0.8rem;
  border: 1px solid var(--color-border-base);
}

.url-attachments.size-small .url-attachment {
  padding: 0.25rem 0.4rem;
  font-size: 0.75rem;
}

.url-attachments.size-medium .url-attachment {
  padding: 0.35rem 0.5rem;
  font-size: 0.8rem;
}

.url-attachments.size-large .url-attachment {
  padding: 0.45rem 0.6rem;
  font-size: 0.85rem;
}

.url-attachment.loading {
  border-color: var(--color-border-muted);
}

.url-attachment.success {
  border-color: #22c55e;
}

.url-attachment.error {
  border-color: #ef4444;
}

.url-icon {
  flex-shrink: 0;
  font-size: 0.75rem;
}

.url-attachments.size-small .url-icon {
  font-size: 0.7rem;
}

.url-attachments.size-medium .url-icon {
  font-size: 0.75rem;
}

.url-attachments.size-large .url-icon {
  font-size: 0.8rem;
}

.url-text {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-muted);
}

.url-status {
  flex-shrink: 0;
  font-size: 0.7rem;
  color: var(--color-text-muted);
}

.url-attachments.size-small .url-status {
  font-size: 0.65rem;
}

.url-attachments.size-medium .url-status {
  font-size: 0.7rem;
}

.url-attachments.size-large .url-status {
  font-size: 0.75rem;
}

.url-status.success {
  color: #22c55e;
}

.url-status.error {
  color: #ef4444;
}
</style>
