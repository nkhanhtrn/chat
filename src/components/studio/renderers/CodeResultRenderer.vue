<template>
  <div class="code-result-renderer">
    <div v-if="stdout" class="stdout-output">
      <div class="stdout-header">Output</div>
      <pre class="stdout-value">{{ stdout }}</pre>
    </div>
    <div class="result-output">
      <pre class="result-value">{{ formattedResult }}</pre>
    </div>
    <details v-if="code" class="code-details">
      <summary>View code</summary>
      <pre class="code-source"><code>{{ code }}</code></pre>
    </details>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  content: {
    type: Object,
    required: true
  }
})

const code = computed(() => props.content.code || '')
const result = computed(() => props.content.result)
const stdout = computed(() => props.content.stdout)

const formattedResult = computed(() => {
  const r = result.value
  if (typeof r === 'string') return r
  if (r === null || r === undefined) return ''
  try {
    return JSON.stringify(r, null, 2)
  } catch {
    return String(r)
  }
})
</script>

<style scoped>
.code-result-renderer {
  display: flex;
  flex-direction: column;
  height: 100%;
  gap: 0.5rem;
}

.stdout-output {
  flex-shrink: 0;
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
}

.stdout-header {
  padding: 0.4rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-bg-hover);
  border-bottom: 1px solid var(--color-border-subtle);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stdout-value {
  margin: 0;
  padding: 0.75rem;
  background-color: var(--color-code-block-bg, #1a1a2e);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.4;
  color: #a6e3a1;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.result-output {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.result-value {
  margin: 0;
  padding: 0.75rem;
  background-color: var(--color-bg-base);
  border-radius: 6px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.85rem;
  line-height: 1.5;
  color: var(--color-text-base);
  white-space: pre-wrap;
  word-break: break-word;
}

.code-details {
  flex-shrink: 0;
  border-top: 1px solid var(--color-border-subtle);
}

.code-details summary {
  padding: 0.5rem 0.75rem;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  cursor: pointer;
  user-select: none;
}

.code-details summary:hover {
  color: var(--color-text-base);
}

.code-source {
  margin: 0;
  padding: 0.75rem;
  background-color: var(--color-code-block-bg, #1e1e1e);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  font-size: 0.8rem;
  line-height: 1.5;
  color: var(--color-code-block-text, #d4d4d4);
  overflow-x: auto;
  max-height: 200px;
  overflow-y: auto;
}

.code-source code {
  font-family: inherit;
}
</style>
