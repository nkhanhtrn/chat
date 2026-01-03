<template>
  <div class="tool-renderer" :class="{ 'is-reloading': isReloading }">
    <VueToolRenderer
      :code="content.code"
      :toolId="windowId"
      :sessionId="sessionId"
      :toolName="content.name || 'unnamed-tool'"
      @compile-error="handleCompileError"
    />

    <!-- Code AI Output for tools (only shown when edit panel is open) -->
    <details v-if="stdout && showEditPanel" class="tool-stdout-details">
      <summary>Code AI Output</summary>
      <pre class="tool-stdout-value">{{ stdout }}</pre>
    </details>
  </div>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import VueToolRenderer from '../../VueToolRenderer.vue'

const props = defineProps({
  content: {
    type: Object,
    required: true
  },
  windowId: {
    type: String,
    required: true
  },
  sessionId: {
    type: String,
    default: 'default'
  },
  showEditPanel: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits(['error'])

const isReloading = ref(false)

const stdout = computed(() => props.content?.stdout || '')

// Watch for content changes to trigger reload animation
watch(() => props.content?.code, (newCode, oldCode) => {
  if (oldCode !== undefined && newCode !== oldCode) {
    isReloading.value = true
    setTimeout(() => {
      isReloading.value = false
    }, 1000)
  }
}, { deep: true })

function handleCompileError(errorDetails) {
  const toolName = errorDetails?.toolName || props.content?.name || 'Unknown tool'
  const errorMsg = errorDetails?.error || 'Compilation error'
  console.warn(`[ToolRenderer] Tool error: "${toolName}" - ${errorMsg}`)

  emit('error', {
    toolName,
    error: errorMsg
  })
}
</script>

<style scoped>
.tool-renderer {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  margin: -0.5rem;
  background: var(--color-bg-base);
  transition: background 1s ease;
}

.tool-renderer.is-reloading {
  animation: tool-reload 1s ease-out;
}

@keyframes tool-reload {
  0% {
    background: var(--color-bg-base);
  }
  50% {
    background: linear-gradient(135deg, var(--color-primary-subtle, #dbeafe) 0%, var(--color-bg-base) 100%);
  }
  100% {
    background: var(--color-bg-base);
  }
}

.tool-stdout-details {
  flex-shrink: 0;
  max-height: 200px;
  overflow: auto;
  border: 1px solid var(--color-border-subtle);
  border-radius: 6px;
  margin-top: 0.5rem;
}

.tool-stdout-details summary {
  padding: 0.4rem 0.75rem;
  font-size: 0.7rem;
  font-weight: 600;
  color: var(--color-text-muted);
  background-color: var(--color-bg-hover);
  cursor: pointer;
  user-select: none;
  list-style: none;
}

.tool-stdout-details summary:hover {
  background-color: var(--color-bg-elevated);
}

.tool-stdout-details summary::-webkit-details-marker {
  display: none;
}

.tool-stdout-details summary::before {
  content: '▶ ';
  font-size: 0.6rem;
  margin-right: 0.3rem;
}

.tool-stdout-details[open] summary::before {
  content: '▼ ';
}

.tool-stdout-value {
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
  border-top: 1px solid var(--color-border-subtle);
}
</style>
