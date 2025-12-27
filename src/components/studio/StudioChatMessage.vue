<template>
  <div :class="['message', msg.role]">
    <div class="message-role">{{ msg.role === 'user' ? 'You' : 'AI' }}</div>

    <!-- Capability Progress (unified progress display) -->
    <CapabilityProgress
      v-if="msg.role === 'assistant' && msg.analysis"
      :capability="capabilityType"
      :task-description="msg.analysis.taskDescription || ''"
      :status="status"
      :search-query="msg.webSearchQuery || searchQuery"
      :web-sources="webSources"
      :plan-steps="planSteps"
      :generated-code="msg.generatedCode || ''"
      :attempts="msg.attempts || 0"
      :execution-status="msg.execution?.success ? 'success' : (msg.execution ? 'failed' : null)"
      :viz-type="msg.analysis.visualizationType || 'chart'"
      :raw-output="rawOutput"
    />

    <div class="message-content">
      <!-- Visualization output -->
      <template v-if="msg.role === 'assistant' && msg.visualization">
        <!-- ECharts -->
        <ChartRenderer
          v-if="msg.visualization.type === 'chart'"
          :option="parseChartOption(msg.visualization.content)"
          height="350px"
        />
        <!-- Mermaid diagram -->
        <MermaidBlock
          v-else-if="msg.visualization.type === 'mermaid'"
          :code="msg.visualization.content"
        />
        <!-- SVG drawing -->
        <div
          v-else-if="msg.visualization.type === 'svg'"
          class="svg-container"
          v-html="msg.visualization.content"
        ></div>
      </template>

      <!-- Tool output -->
      <template v-else-if="msg.role === 'assistant' && msg.tool">
        <ToolRenderer :tool="msg.tool" />
      </template>

      <!-- Code execution output: display in code block -->
      <CodeBlock
        v-else-if="msg.role === 'assistant' && msg.execution && msg.execution.success"
        language="output"
        :code="msg.content"
      />

      <!-- Regular assistant response or failed execution: render as markdown -->
      <MarkdownRenderer
        v-else-if="msg.role === 'assistant'"
        :content="msg.content"
      />

      <!-- User message -->
      <template v-else>{{ msg.content }}</template>

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
import CodeBlock from '../markdown/CodeBlock.vue'
import ChartRenderer from '../ChartRenderer.vue'
import MermaidBlock from '../markdown/MermaidBlock.vue'
import ToolRenderer from '../ToolRenderer.vue'
import CapabilityProgress from '../CapabilityProgress.vue'
import { parseChartOption } from '../../utils/chart.js'
import {
  getCapabilityType,
  getMessageStatus,
  getWebSources,
  getPlanSteps,
  getRawOutput
} from '../../utils/messageAnalysis.js'

const props = defineProps({
  msg: {
    type: Object,
    required: true
  },
  isLastMessage: {
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

function getAttachmentIcon(att) {
  if (att.type === 'url') return '🔗'
  if (att.readerName === 'pdf') return '📕'
  return '📄'
}
</script>

<style scoped>
.message {
  margin-bottom: 1.5rem;
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
}

.message-role {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  margin-bottom: 0.25rem;
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.message-content {
  font-family: 'Georgia', serif;
  font-size: 1.05rem;
  line-height: 1.7;
  color: var(--color-text-base);
}

.message.user .message-content {
  background-color: var(--color-bg-hover);
  padding: 1rem 1.25rem;
  border-radius: 4px;
  white-space: pre-wrap;
  max-height: 200px;
  overflow-y: auto;
}

.message.assistant .message-content {
  padding: 0.5rem 0;
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
  gap: 0.5rem;
  margin-top: 0.5rem;
  max-width: 800px;
}

.attachment-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.25rem 0.5rem;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 3px;
  font-size: 0.75rem;
  font-family: system-ui, sans-serif;
  color: var(--color-text-muted);
}

.attachment-icon {
  font-size: 0.85rem;
}

.attachment-name {
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* SVG visualization container */
.svg-container {
  max-width: 400px;
  margin: 0.5rem 0;
  background-color: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
}

.svg-container :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
