<template>
  <div :class="['message', msg.role]">
    <div class="message-role">
      {{ msg.role === 'user' ? 'You' : 'AI' }}
      <span v-if="msg.role === 'assistant' && usageDisplay" class="token-usage">
        <span v-if="usageDisplay.router" class="token-router" title="Router tokens">R:{{ usageDisplay.router }}</span>
        <span v-if="usageDisplay.router && usageDisplay.prompt" class="token-sep">|</span>
        <span v-if="usageDisplay.prompt" class="token-in" title="Input tokens">{{ usageDisplay.prompt }}</span>
        <span v-if="usageDisplay.prompt" class="token-sep">/</span>
        <span v-if="usageDisplay.completion" class="token-out" title="Output tokens">{{ usageDisplay.completion }}</span>
      </span>
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

    <!-- Capability Progress (unified progress display) -->
    <CapabilityProgress
      v-if="msg.role === 'assistant' && msg.analysis"
      :capability="capabilityType"
      :task-description="msg.analysis.taskDescription || ''"
      :status="status"
      :search-query="msg.webSearchQuery || searchQuery"
      :web-sources="webSources"
      :plan-steps="planSteps"
      :build-steps="msg.buildSteps || []"
      :generated-code="msg.generatedCode || ''"
      :attempts="msg.attempts || 0"
      :execution-status="msg.execution?.success ? 'success' : (msg.execution ? 'failed' : null)"
      :viz-type="msg.analysis.visualizationType || 'chart'"
      :raw-output="rawOutput"
    />

    <div class="message-content">
      <!-- Output sent to canvas indicator -->
      <div v-if="msg.role === 'assistant' && hasCanvasOutput" class="canvas-output-indicator">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="9" y1="3" x2="9" y2="21"></line>
        </svg>
        <span>{{ canvasOutputLabel }}</span>
      </div>

      <!-- Regular assistant response: render as markdown -->
      <MarkdownRenderer
        v-else-if="msg.role === 'assistant' && msg.content"
        :content="msg.content"
      />

      <!-- Empty assistant message while streaming -->
      <template v-else-if="msg.role === 'assistant'"></template>

      <!-- User message (editable) -->
      <InlineEdit
        v-else
        :modelValue="msg.content"
        textClass="user-message-text"
        inputClass="user-message-input"
        @save="(newContent) => $emit('edit', newContent)"
      />

      <!-- Streaming cursor -->
      <span v-if="showCursor" class="cursor">|</span>
    </div>

    <!-- Attachments indicator for user messages -->
    <div v-if="msg.role === 'user' && msg.attachments && msg.attachments.length > 0" class="attachments-indicator">
      <div v-for="(att, attIndex) in msg.attachments" :key="attIndex" class="attachment-badge">
        <span class="attachment-icon">{{ getAttachmentIcon(att) }}</span>
        <span class="attachment-name">{{ att.name }}</span>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownRenderer from '../MarkdownRenderer.vue'
import CapabilityProgress from '../CapabilityProgress.vue'
import InlineEdit from '../InlineEdit.vue'
import {
  getCapabilityType,
  getMessageStatus,
  getWebSources,
  getPlanSteps,
  getRawOutput
} from '../../utils/messageAnalysis.js'
import { formatTokenCount } from '../../utils/tokenUsage.js'

defineEmits(['edit'])

const props = defineProps({
  msg: {
    type: Object,
    required: true
  },
  isLastMessage: {
    type: Boolean,
    default: false
  },
  isLastUserMessage: {
    type: Boolean,
    default: false
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  isSearching: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  currentPlanningStep: {
    type: Number,
    default: -1
  }
})

const capabilityType = computed(() => getCapabilityType(props.msg))

const status = computed(() =>
  getMessageStatus(props.msg, props.isLastMessage, props.isStreaming)
)

const webSources = computed(() =>
  getWebSources(props.msg, props.isLastMessage, props.isSearching)
)

const planSteps = computed(() =>
  getPlanSteps(props.msg, props.currentPlanningStep)
)

const rawOutput = computed(() => getRawOutput(props.msg))

const showCursor = computed(() =>
  props.isStreaming && props.isLastMessage && props.msg.role === 'assistant'
)

// Token usage display
const usageDisplay = computed(() => {
  const usage = props.msg.usage
  if (!usage) return null

  const result = {}

  // Router usage (total tokens for routing)
  if (usage.router) {
    result.router = formatTokenCount(usage.router.totalTokens)
  }

  // Executor usage (in/out breakdown)
  if (usage.executor) {
    result.prompt = formatTokenCount(usage.executor.promptTokens)
    result.completion = formatTokenCount(usage.executor.completionTokens)
  }

  // Return null if no data
  if (!result.router && !result.prompt) return null
  return result
})

// Check if message has output that goes to canvas
const hasCanvasOutput = computed(() => {
  const msg = props.msg
  return msg.visualization || msg.tool || (msg.execution && msg.execution.success)
})

// Label for canvas output indicator
const canvasOutputLabel = computed(() => {
  const msg = props.msg
  if (msg.visualization) {
    switch (msg.visualization.type) {
      case 'chart': return 'Chart in canvas'
      case 'mermaid': return 'Diagram in canvas'
      case 'svg': return 'SVG in canvas'
      default: return 'Output in canvas'
    }
  }
  if (msg.tool) return 'Tool in canvas'
  if (msg.execution?.success) return 'Result in canvas'
  return 'Output in canvas'
})

function getAttachmentIcon(att) {
  if (att.type === 'url') return '🔗'
  if (att.readerName === 'pdf') return '📕'
  return '📄'
}
</script>

<style scoped>
.message {
  margin-bottom: 1.25rem;
}

.message-role {
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-muted);
  margin-bottom: 0.35rem;
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message.user .message-role {
  color: var(--color-primary, #6366f1);
}

.token-usage {
  margin-left: 0.5rem;
  padding: 0.1rem 0.35rem;
  background-color: var(--color-bg-hover);
  font-size: 0.6rem;
  font-weight: 500;
  border-radius: 3px;
}

.token-router {
  color: var(--color-text-muted);
  opacity: 0.7;
  cursor: help;
}

.token-in {
  color: var(--color-text-muted);
  cursor: help;
}

.token-sep {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin: 0 0.2rem;
}

.token-out {
  color: var(--color-primary, #6366f1);
  cursor: help;
}

.message-content {
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-base);
}

.message.user .message-content {
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  padding: 0.75rem 1rem;
  white-space: pre-wrap;
  max-height: 150px;
  overflow-y: auto;
}

.message.assistant .message-content {
  padding: 0.25rem 0;
}

.cursor {
  animation: blink 0.7s infinite;
  color: var(--color-primary);
  font-weight: bold;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.attachments-indicator {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
  margin-top: 0.5rem;
}

.attachment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.4rem;
  background-color: var(--color-bg-hover);
  font-size: 0.7rem;
  font-family: system-ui, sans-serif;
  color: var(--color-text-muted);
}

.attachment-icon {
  font-size: 0.75rem;
}

.attachment-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Canvas output indicator */
.canvas-output-indicator {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-subtle);
  color: var(--color-text-muted);
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
}

.canvas-output-indicator svg {
  opacity: 0.6;
}

/* Retry icon button (next to You label) */
.retry-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 0.35rem;
  padding: 2px;
  background: none;
  border: none;
  border-radius: 3px;
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
}

.message:hover .retry-icon-btn {
  opacity: 0.6;
}

.retry-icon-btn:hover {
  opacity: 1;
  background-color: var(--color-bg-hover);
  color: var(--color-text-base);
}

/* User message text (editable) */
.message-content :deep(.user-message-text) {
  display: block;
}

.message-content :deep(.user-message-input) {
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
}

.message-content :deep(.inline-edit-wrapper) {
  width: 100%;
}
</style>
