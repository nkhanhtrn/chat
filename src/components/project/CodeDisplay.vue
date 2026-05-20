<template>
  <div class="code-display">
    <div class="code-header">
      <span class="language-badge">{{ language }}</span>
      <div class="code-actions">
        <button class="copy-btn" @click="handleSearch" title="Search (Ctrl+F)">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
        </button>
        <button class="copy-btn" @click="$emit('edit')" title="Edit code">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
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
    </div>
    <CodeEditor ref="editorRef" :model-value="content" read-only :language="resolvedLanguage" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import CodeEditor from './CodeEditor.vue'

const props = defineProps<{
  content: string
  language?: string
}>()

const resolvedLanguage = computed(() => {
  if (props.language === 'html') return 'html' as const
  if (props.language === 'css') return 'css' as const
  if (props.language === 'javascript') return 'javascript' as const
  return 'vue' as const
})

const copied = ref(false)
const editorRef = ref<InstanceType<typeof CodeEditor> | null>(null)

const emit = defineEmits<{
  edit: []
}>()

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.content)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // noop
  }
}

function handleSearch() {
  editorRef.value?.openSearch()
}
</script>

<style scoped>
.code-display { height: 100%; display: flex; flex-direction: column; background: var(--color-bg-base); }
.code-header { display: flex; align-items: center; justify-content: space-between; padding: 0.35rem 0.6rem; background: var(--color-bg-page); border-bottom: 1px solid var(--color-border-subtle); flex-shrink: 0; }
.code-actions { display: flex; gap: 0.15rem; }
.language-badge { font-size: 0.65rem; font-family: system-ui, sans-serif; text-transform: uppercase; color: var(--color-text-muted); letter-spacing: 0.05em; }
.copy-btn { display: flex; align-items: center; justify-content: center; width: 24px; height: 24px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
.copy-btn:hover { color: var(--color-text-base); }
</style>
