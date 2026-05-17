<template>
  <div :class="['message', msg.role]">
    <div class="message-role">
      {{ msg.role === 'user' ? 'You' : 'AI' }}
      <button
        v-if="msg.role === 'user' && !isStreaming && isLastUserMessage"
        class="retry-icon-btn"
        @click="$emit('edit', msg.content)"
        title="Retry this message"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="1 4 1 10 7 10"></polyline>
          <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
        </svg>
      </button>
    </div>
    <div class="message-content">
      <MarkdownRenderer
        v-if="msg.role === 'assistant' && msg.content"
        :content="msg.content"
      />
      <template v-else-if="msg.role === 'assistant'"></template>
      <InlineEdit
        v-else
        :modelValue="msg.content"
        textClass="user-message-text"
        inputClass="user-message-input"
        @save="(newContent: string) => $emit('edit', newContent)"
      />
      <span v-if="showCursor" class="cursor">|</span>
    </div>
    <div v-if="msg.role === 'user' && msg.attachments && msg.attachments.length > 0" class="attachments-indicator">
      <div v-for="(att, attIndex) in msg.attachments" :key="attIndex" class="attachment-badge">
        <span class="attachment-icon">{{ getAttachmentIcon(att.type) }}</span>
        <span class="attachment-name">{{ att.name }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import MarkdownRenderer from '@/components/MarkdownRenderer.vue'
import InlineEdit from '@/components/InlineEdit.vue'
import type { ProjectMessage } from '@/types/project'

const props = defineProps<{
  msg: ProjectMessage
  isLastMessage?: boolean
  isLastUserMessage?: boolean
  isStreaming?: boolean
}>()

defineEmits<{
  edit: [content: string]
}>()

const showCursor = computed(() =>
  props.isStreaming && props.isLastMessage && props.msg.role === 'assistant'
)

function getAttachmentIcon(type: string): string {
  if (type === 'url') return '\uD83D\uDD17'
  if (type === 'image') return '\uD83D\uDDBC\uFE0F'
  return '\uD83D\uDCC4'
}
</script>

<style scoped>
.message { margin-bottom: 1.25rem; }
.message-role { font-size: 0.65rem; font-weight: 600; color: var(--color-text-muted); margin-bottom: 0.35rem; font-family: system-ui, sans-serif; text-transform: uppercase; letter-spacing: 0.05em; }
.message.user .message-role { color: var(--color-primary, #6366f1); }
.message-content { font-family: Georgia, serif; font-size: 0.95rem; line-height: 1.6; color: var(--color-text-base); }
.message.user .message-content { background-color: var(--color-bg-base); border: 1px solid var(--color-border-subtle); padding: 0.75rem 1rem; white-space: pre-wrap; max-height: 150px; overflow-y: auto; }
.message.assistant .message-content { padding: 0.25rem 0; }
.cursor { animation: blink 0.7s infinite; color: var(--color-primary); font-weight: bold; }
@keyframes blink { 0%, 50% { opacity: 1; } 51%, 100% { opacity: 0; } }
.attachments-indicator { display: flex; flex-wrap: wrap; gap: 0.35rem; margin-top: 0.5rem; }
.attachment-badge { display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.2rem 0.4rem; background-color: var(--color-bg-hover); font-size: 0.7rem; font-family: system-ui, sans-serif; color: var(--color-text-muted); }
.attachment-icon { font-size: 0.75rem; }
.attachment-name { max-width: 120px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.retry-icon-btn { display: inline-flex; align-items: center; justify-content: center; margin-left: 0.35rem; padding: 2px; background: none; border: none; border-radius: 3px; color: var(--color-text-muted); cursor: pointer; opacity: 0; transition: all 0.15s; }
.message:hover .retry-icon-btn { opacity: 0.6; }
.retry-icon-btn:hover { opacity: 1; background-color: var(--color-bg-hover); color: var(--color-text-base); }
.message-content :deep(.user-message-text) { display: block; }
.message-content :deep(.user-message-input) { font-family: Georgia, serif; font-size: 0.95rem; width: 100%; padding: 0.5rem 0.75rem; }
.message-content :deep(.inline-edit-wrapper) { width: 100%; }
</style>
