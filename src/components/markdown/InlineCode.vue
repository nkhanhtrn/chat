<template>
  <span class="inline-code-wrapper">
    <code
      :class="['inline-code', { flashing: isFlashing }]"
      :data-md-start="startOffset"
      :data-md-end="endOffset"
    >
      <slot>{{ content }}</slot>
    </code>
    <button @click="copyCode" class="copy-btn" title="Copy code">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  </span>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  content?: string
  startOffset?: number
  endOffset?: number
}>()

const isFlashing = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content || '')
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, 200)
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}
</script>

<style scoped>
.inline-code-wrapper { display: inline-flex; align-items: center; gap: 2px; }
.inline-code { background-color: var(--color-inline-code-bg); color: var(--color-inline-code-text); padding: 2px 6px; border-radius: 4px; font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace; font-size: 0.9em; }
.copy-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px 4px; min-width: auto; opacity: 0.6; border-radius: 3px; }
.copy-btn:hover { opacity: 1; background: var(--color-bg-hover); }
.inline-code.flashing { animation: flash 0.2s ease-out; }
@keyframes flash { 0% { background-color: rgba(212, 212, 212, 0.3); } 100% { background-color: var(--color-inline-code-bg); } }
</style>
