<template>
  <Modal :visible="visible" title="Dictionary" @close="onClose" size="medium">
    <div class="dictionary-content">
      <!-- Word header -->
      <div class="dictionary-word">{{ word }}</div>

      <!-- Loading state -->
      <div v-if="isStreaming && !definition" class="dictionary-loading">
        Loading definition<span class="loading-dots">...</span>
      </div>

      <!-- Definition content -->
      <div v-if="definition" class="dictionary-definition">
        <MarkdownRenderer :content="definition" />
        <span v-if="isStreaming" class="streaming-cursor">▊</span>
      </div>

      <!-- No definition state -->
      <div v-if="!isStreaming && !definition" class="dictionary-empty">
        No definition available
      </div>
    </div>

    <template #footer>
      <Button variant="secondary" @click="onClose">Close</Button>
    </template>
  </Modal>
</template>

<script setup>
import Modal from './Modal.vue'
import Button from '../Button.vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'

const props = defineProps({
  visible: {
    type: Boolean,
    default: false
  },
  word: {
    type: String,
    default: ''
  },
  definition: {
    type: String,
    default: ''
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['close'])

function onClose() {
  emit('close')
}
</script>

<style scoped>
.dictionary-content {
  min-height: 100px;
}

.dictionary-word {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-strong, #333);
  margin-bottom: 1rem;
  padding-bottom: 0.75rem;
  border-bottom: 1px solid var(--color-border-subtle, #eee);
}

.dictionary-definition {
  font-size: 1rem;
  line-height: 1.7;
  color: var(--color-text-base, #333);
}

.dictionary-definition :deep(h3) {
  font-size: 1.1rem;
  margin-top: 0;
  margin-bottom: 0.5rem;
}

.dictionary-definition :deep(p) {
  margin: 0 0 0.5em 0;
}

.dictionary-definition :deep(p:last-child) {
  margin-bottom: 0;
}

.dictionary-loading {
  color: var(--color-text-muted, #666);
  font-style: italic;
}

.loading-dots {
  animation: dots 1.5s infinite;
}

@keyframes dots {
  0%, 20% { content: '.'; }
  40% { content: '..'; }
  60%, 100% { content: '...'; }
}

.dictionary-empty {
  color: var(--color-text-muted, #666);
  font-style: italic;
}

.streaming-cursor {
  animation: blink 1s infinite;
  color: var(--color-text-muted, #666);
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}
</style>
