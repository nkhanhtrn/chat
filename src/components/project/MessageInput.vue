<template>
  <div class="message-input-wrapper">
    <div v-if="pasteSnippets.length" class="paste-bar">
      <div v-for="(snippet, i) in pasteSnippets" :key="i" class="paste-chip">
        <span class="paste-preview">{{ snippet.preview }}</span>
        <button class="paste-remove" @click="removeSnippet(i)" title="Remove">&times;</button>
      </div>
    </div>
    <ExpandableInput
      ref="expandableRef"
      :model-value="modelValue"
      :is-streaming="isStreaming"
      :tools="tools"
      @update:model-value="$emit('update:modelValue', $event)"
      @send="handleSend"
      @stop="$emit('stop')"
    >
      <template #before-send>
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
      </template>
    </ExpandableInput>
    <div v-if="isStreaming" class="status-text">Generating...</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import ExpandableInput from '../ExpandableInput.vue'
import type { ToolRef } from '@/utils/chatCommands'

const PASTE_THRESHOLD = 300

interface PasteSnippet {
  full: string
  preview: string
}

const props = defineProps<{
  modelValue: string
  isStreaming?: boolean
  messagesEmpty?: boolean
  tools?: ToolRef[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  stop: []
  clear: []
}>()

const expandableRef = ref<InstanceType<typeof ExpandableInput> | null>(null)
const pasteSnippets = ref<PasteSnippet[]>([])

function handleSend() {
  emit('send')
}

function removeSnippet(index: number) {
  pasteSnippets.value.splice(index, 1)
}

function consumeSnippets(): string {
  if (!pasteSnippets.value.length) return ''
  const parts = pasteSnippets.value.map(s => s.full)
  pasteSnippets.value = []
  return parts.join('\n\n')
}

function resetHeight() {
  expandableRef.value?.resetHeight()
}

defineExpose({ consumeSnippets, resetHeight })
</script>

<style scoped>
.message-input-wrapper { width: 100%; }

.paste-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
  margin-bottom: 0.4rem;
  padding: 0 1.25rem;
}

.paste-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  max-width: 100%;
}

.paste-preview {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

.paste-remove {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  border-radius: 2px;
  flex-shrink: 0;
}

.paste-remove:hover {
  color: var(--color-error, #ef4444);
  background: var(--color-error-subtle, #fee2e2);
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

.clear-btn:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
}

.divider {
  width: 1px;
  height: 20px;
  background-color: var(--color-border-subtle);
  margin: 0 0.25rem;
}

.status-text {
  text-align: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-top: 0.5rem;
  font-family: system-ui, sans-serif;
}
</style>
