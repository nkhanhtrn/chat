<template>
  <div class="code-display">
    <div class="code-header">
      <span class="language-badge">{{ language }}</span>
      <button class="copy-btn" @click="copyCode" title="Copy code">
        <svg v-if="!copied" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
        <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"></polyline>
        </svg>
      </button>
    </div>
    <pre class="code-block"><code>{{ content }}</code></pre>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  content: string
  language?: string
}>()

const copied = ref(false)

async function copyCode() {
  try {
    await navigator.clipboard.writeText('') // placeholder
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // noop
  }
}
</script>

<style scoped>
.code-display { height: 100%; display: flex; flex-direction: column; background: var(--color-bg-base); }
.code-header { display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.6rem; background: var(--color-bg-page); border-bottom: 1px solid var(--color-border-subtle); }
.language-badge { font-size: 0.65rem; font-family: system-ui, sans-serif; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.05em; }
.copy-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
.copy-btn:hover { color: var(--color-text-base); }
.code-block { flex: 1; margin: 0; padding: 0.75rem; overflow: auto; font-family: 'SF Mono', 'Fira Code', 'Consolas', monospace; font-size: 0.8rem; line-height: 1.5; color: var(--color-text-base); white-space: pre-wrap; word-break: break-word; }
</style>
