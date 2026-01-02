<template>
  <div class="vue-tool-renderer themed-tool" :data-tool-scope="scopeId">
    <div v-if="error" class="error-message">
      <div class="error-content">
        <strong>Tool Error:</strong> {{ error }}
      </div>
      <button class="remove-broken-btn" @click="emit('compile-error')" title="Remove this broken tool">
        Remove Tool
      </button>
    </div>
    <component v-else-if="compiledComponent" :is="compiledComponent" />
  </div>
</template>

<script setup>
import { watch, onErrorCaptured, onUnmounted } from 'vue'
import { useToolInstanceStore } from '../composables/studio/useToolInstanceStore.js'
import { useDynamicCompiler } from '../composables/useDynamicCompiler.js'
import { createProxiedFetch as createFetchProxy } from '../utils/toolFetch.js'
import { getProxyBaseUrl } from '../services/urlFetcher.js'

// Debug logging - only in development, not in tests
const isDev = import.meta.env.DEV
const isTest = import.meta.env.MODE === 'test' || (typeof process !== 'undefined' && process.env?.VITEST === 'true')
const shouldLog = isDev && !isTest

function debugLog(...args) {
  if (shouldLog) {
    console.log(...args)
  }
}

const props = defineProps({
  code: { type: String, required: true },
  toolId: { type: String, default: () => `inst-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` },
  sessionId: { type: String, default: 'default' },
  toolName: { type: String, default: 'unknown' }
})

const emit = defineEmits(['compile-error'])

// Create proxied fetch factory
function createProxiedFetch() {
  return createFetchProxy({
    getProxyBaseUrl,
    fetch: window.fetch,
    debugLog
  })
}

// Use the dynamic compiler composable with injected dependencies
const {
  compiledComponent,
  error,
  scopeId,
  compile: compileCode,
  cleanup: cleanupCompiler
} = useDynamicCompiler({
  storeFactory: useToolInstanceStore,
  fetchFactory: createProxiedFetch,
  debugLog
})

onErrorCaptured((err) => {
  error.value = err.message
  console.error('Component error:', err)
  return false
})

// Watch for code changes and recompile
watch(() => props.code, (newCode) => {
  compileCode(newCode, props.toolName, props.toolId, props.sessionId)
}, { immediate: true })

// Clean up on unmount
onUnmounted(() => {
  cleanupCompiler()
})
</script>

<style scoped>
.vue-tool-renderer {
  width: 100%;
  height: 100%;
  overflow: auto;
  display: flex;
  flex-direction: column;
  background: var(--color-bg-base);
  color: var(--color-text-base);
  font-family: inherit;
}

.vue-tool-renderer > :deep(*) {
  flex: 1;
  min-height: 0;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  background: var(--color-bg-base) !important;
}

.error-message {
  padding: 1rem;
  background: var(--color-error-bg, #fee2e2);
  color: var(--color-error-text, #991b1b);
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.error-content {
  flex: 1;
  font-size: 0.85rem;
  line-height: 1.4;
}

.remove-broken-btn {
  padding: 0.5rem 1rem;
  background: var(--color-error, #ef4444);
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 0.8rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
  align-self: flex-start;
}

.remove-broken-btn:hover {
  background: var(--color-error-hover, #dc2626);
}

/* Theme base styles for generated components */
.themed-tool :deep(button) {
  background: var(--color-bg-button);
  color: var(--color-text-base);
  border: 1px solid var(--color-border-button);
  padding: 0.5rem 1rem;
  cursor: pointer;
  font: inherit;
  transition: all 0.15s ease;
}

.themed-tool :deep(button:hover) {
  background: var(--color-bg-button-hover);
  border-color: var(--color-border-button-hover);
}

.themed-tool :deep(button:active) {
  background: var(--color-bg-button-active);
}

.themed-tool :deep(button.primary) {
  background: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.themed-tool :deep(button.primary:hover) {
  background: var(--color-primary-hover);
}

.themed-tool :deep(input),
.themed-tool :deep(textarea),
.themed-tool :deep(select) {
  background: var(--color-bg-input);
  color: var(--color-text-base);
  border: 1px solid var(--color-border-input);
  padding: 0.5rem 0.75rem;
  font: inherit;
}

.themed-tool :deep(input:focus),
.themed-tool :deep(textarea:focus),
.themed-tool :deep(select:focus) {
  outline: none;
  border-color: var(--color-primary);
}

.themed-tool :deep(input::placeholder),
.themed-tool :deep(textarea::placeholder) {
  color: var(--color-text-placeholder);
}
</style>
