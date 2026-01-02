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
  overflow: hidden;
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
  overflow: hidden;
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

/* Apply utility classes to generated tool content */
.themed-tool :deep(.btn) {
  padding: 0.4rem 1rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  font-family: system-ui, -apple-system, sans-serif;
  transition: all 0.15s ease;
}

.themed-tool :deep(.btn:hover) {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.themed-tool :deep(.btn.primary) {
  background: var(--color-primary);
  color: white;
  border-color: var(--color-primary);
}

.themed-tool :deep(.btn.primary:hover) {
  background: var(--color-primary-hover);
}

.themed-tool :deep(.btn.active) {
  background: var(--color-bg-active);
  color: var(--color-text-strong);
}

.themed-tool :deep(.input),
.themed-tool :deep(.select),
.themed-tool :deep(.textarea) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  font-family: inherit;
}

.themed-tool :deep(.input:focus),
.themed-tool :deep(.select:focus),
.themed-tool :deep(.textarea:focus) {
  outline: none;
  border-color: var(--color-border-strong);
}

.themed-tool :deep(.input::placeholder),
.themed-tool :deep(.textarea::placeholder) {
  color: var(--color-text-muted);
}

/* Layout utilities */
.themed-tool :deep(.row) {
  display: flex;
  gap: 0.5rem;
  align-items: center;
}

.themed-tool :deep(.col) {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.themed-tool :deep(.container) {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.themed-tool :deep(.tool-container) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  height: 100%;
  padding: 1rem;
  overflow: hidden;
}

.themed-tool :deep(.header) {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
}

.themed-tool :deep(.content) {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.themed-tool :deep(.form-group) {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.themed-tool :deep(.card) {
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  overflow: hidden;
}

/* Fallback for unstyled buttons/inputs in generated tools */
.themed-tool :deep(button:not(.btn)) {
  padding: 0.4rem 1rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  font-family: system-ui, -apple-system, sans-serif;
  transition: all 0.15s ease;
}

.themed-tool :deep(button:not(.btn):hover) {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}

.themed-tool :deep(input:not(.input)),
.themed-tool :deep(textarea:not(.textarea)),
.themed-tool :deep(select:not(.select)) {
  padding: 0.5rem 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background: var(--color-bg-elevated);
  color: var(--color-text-base);
  font-size: 0.9rem;
  font-family: inherit;
}

.themed-tool :deep(input:not(.input):focus),
.themed-tool :deep(textarea:not(.textarea):focus),
.themed-tool :deep(select:not(.select):focus) {
  outline: none;
  border-color: var(--color-border-strong);
}
</style>
