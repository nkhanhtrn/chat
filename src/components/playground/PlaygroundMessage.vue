<template>
  <div :class="['pg-message', msg.role]">
    <div class="message-avatar">
      <span v-if="msg.role === 'user'" class="avatar user-avatar">U</span>
      <span v-else class="avatar ai-avatar">AI</span>
    </div>

    <div class="message-body">
      <!-- Capability Progress -->
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
        <!-- Visualization output -->
        <template v-if="msg.role === 'assistant' && msg.visualization">
          <ChartRenderer
            v-if="msg.visualization.type === 'chart'"
            :option="parseChartOption(msg.visualization.content)"
            height="300px"
          />
          <MermaidBlock
            v-else-if="msg.visualization.type === 'mermaid'"
            :code="msg.visualization.content"
          />
          <div
            v-else-if="msg.visualization.type === 'svg'"
            class="svg-output"
            v-html="msg.visualization.content"
          ></div>
        </template>

        <!-- Tool output -->
        <template v-else-if="msg.role === 'assistant' && msg.tool">
          <ToolRenderer :tool="msg.tool" />
        </template>

        <!-- Code execution output -->
        <CodeBlock
          v-else-if="msg.role === 'assistant' && msg.execution && msg.execution.success"
          language="output"
          :code="msg.content"
        />

        <!-- Regular assistant response or failed execution -->
        <MarkdownRenderer
          v-else-if="msg.role === 'assistant'"
          :content="msg.content"
        />

        <!-- User message -->
        <div v-else class="user-text">{{ msg.content }}</div>

        <!-- Streaming cursor -->
        <span v-if="showCursor" class="cursor"></span>
      </div>

      <!-- Attachments -->
      <div v-if="msg.role === 'user' && msg.attachments?.length" class="attachments">
        <div v-for="(att, i) in msg.attachments" :key="i" class="attachment-chip">
          <span class="att-icon">{{ getIcon(att) }}</span>
          <span class="att-name">{{ att.name }}</span>
        </div>
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

function getIcon(att) {
  if (att.type === 'url') return '🔗'
  if (att.readerName === 'pdf') return '📕'
  return '📄'
}
</script>

<style scoped>
.pg-message {
  display: flex;
  gap: 0.75rem;
  max-width: 900px;
  width: 100%;
  margin: 0 auto;
}

.message-avatar {
  flex-shrink: 0;
}

.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 6px;
  font-size: 0.65rem;
  font-weight: 600;
  font-family: system-ui, -apple-system, sans-serif;
}

.user-avatar {
  background: var(--color-primary);
  color: white;
}

.ai-avatar {
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border-base);
}

.message-body {
  flex: 1;
  min-width: 0;
}

.message-content {
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.9rem;
  line-height: 1.6;
  color: var(--color-text-base);
}

.pg-message.user .message-content {
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.pg-message.assistant .message-content {
  padding: 0.25rem 0;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
}

.cursor {
  display: inline-block;
  width: 8px;
  height: 16px;
  background: var(--color-primary);
  margin-left: 2px;
  animation: blink 0.8s infinite;
  vertical-align: text-bottom;
}

@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

.attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  margin-top: 0.5rem;
}

.attachment-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.2rem 0.5rem;
  background: var(--color-bg-hover);
  border-radius: 4px;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  font-family: system-ui, -apple-system, sans-serif;
}

.att-icon {
  font-size: 0.75rem;
}

.att-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.svg-output {
  max-width: 350px;
  margin: 0.5rem 0;
  background: var(--color-bg-surface);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  padding: 1rem;
  display: flex;
  justify-content: center;
}

.svg-output :deep(svg) {
  max-width: 100%;
  height: auto;
}
</style>
