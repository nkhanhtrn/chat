<template>
  <div class="code-block-wrapper">
    <div class="code-block">
      <div class="code-header">
        <span>{{ language }}</span>
        <button @click="copyCode" class="copy-btn" title="Copy code">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
      </div>
      <pre :class="{ flashing: isFlashing }"><code>{{ code }}</code></pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

const props = withDefaults(defineProps<{
  language?: string
  code?: string
}>(), {
  language: 'plaintext',
  code: '',
})

const isFlashing = ref(false)
const lineCount = computed(() => (props.code || '').split('\n').length)

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code || '')
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, 200)
  } catch (error) {
    console.error('Failed to copy code:', error)
  }
}
</script>

<style scoped>
.code-block-wrapper { margin: 12px 0; }
.code-block { background-color: var(--color-code-block-bg); border-radius: 6px; overflow: hidden; border: 1px solid var(--color-code-block-border); }
.code-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background-color: var(--color-code-block-header-bg); border-bottom: 1px solid var(--color-code-block-border); font-size: 12px; color: var(--color-code-block-header-text); font-weight: 600; }
.copy-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 2px; border-radius: 3px; }
.copy-btn:hover { background: var(--color-bg-hover); }
pre { margin: 0; padding: 10px 12px; overflow-x: auto; background-color: var(--color-code-block-bg); }
pre code { font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace; font-size: 13px; line-height: 1.6; color: var(--color-code-block-text); }
pre.flashing { animation: flash 0.2s ease-out; }
@keyframes flash { 0% { background-color: rgba(212, 212, 212, 0.2); } 100% { background-color: var(--color-code-block-bg); } }
</style>
