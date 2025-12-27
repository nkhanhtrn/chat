<template>
  <details class="capability-progress" :class="[capability, { 'has-content': hasContent }]">
    <!-- Clickable Header -->
    <summary class="progress-header">
      <span :class="['capability-badge', capability]">{{ capabilityLabel }}</span>
      <span class="task-description">{{ taskDescription }}</span>
      <!-- Extra status info in header -->
      <span v-if="attempts > 1" class="attempts-badge">{{ attempts }} attempts</span>
      <span v-if="executionStatus" :class="['execution-badge', executionStatus]">
        {{ executionStatus === 'success' ? 'Executed' : 'Failed' }}
      </span>
      <span :class="['status-indicator', statusClass]">
        <span v-if="isRunning" class="spinner"></span>
        <span v-else-if="isComplete" class="status-icon complete">✓</span>
        <span v-else-if="isFailed" class="status-icon failed">✗</span>
        <span v-else-if="isPending" class="status-icon pending">○</span>
      </span>
    </summary>

    <!-- Collapsed Content -->
    <div class="progress-content">
      <!-- Planning Progress -->
      <template v-if="capability === 'planning'">
        <div class="planning-progress">
          <CapabilityProgress
            v-for="(step, idx) in planSteps"
            :key="idx"
            :capability="step.capability"
            :task-description="step.task"
            :status="step.status === 'complete' ? 'complete' : (step.status === 'failed' ? 'failed' : (step.status === 'running' ? 'running' : 'pending'))"
            class="nested-step"
          />
        </div>
      </template>

      <!-- Web Search Progress -->
      <template v-else-if="capability === 'websearch'">
        <WebSearchProgress :search-query="searchQuery" :sources="webSources" />
      </template>

      <!-- Code Progress -->
      <template v-else-if="capability === 'code'">
        <pre v-if="generatedCode" class="output-content code">{{ generatedCode }}</pre>
      </template>

      <!-- Visualization Progress -->
      <template v-else-if="capability === 'visualization'">
        <pre v-if="rawOutput" class="output-content">{{ formatOutput(rawOutput) }}</pre>
      </template>

      <!-- Build Progress -->
      <template v-else-if="capability === 'build'">
        <div v-if="buildSteps && buildSteps.length > 0" class="build-progress">
          <div
            v-for="(step, idx) in buildSteps"
            :key="idx"
            class="build-step-item"
            :class="step.status"
          >
            <div
              class="build-step-summary"
              :class="{ clickable: step.output && step.status === 'complete' }"
              @click="step.output && step.status === 'complete' && toggleBuildStep(idx)"
            >
              <span v-if="step.status === 'running'" class="spinner small"></span>
              <span v-else-if="step.status === 'complete'" class="step-check">✓</span>
              <span v-else class="step-pending">○</span>
              <span class="step-label">{{ step.task }}</span>
              <span v-if="step.output && step.status === 'complete'" class="step-expand">
                {{ expandedBuildSteps[idx] ? '▼' : '▶' }}
              </span>
            </div>
            <CodeDisplay
              v-if="step.output && step.status === 'complete' && expandedBuildSteps[idx]"
              language="json"
              :code="formatOutput(step.output)"
              class="build-step-output"
            />
          </div>
        </div>
        <pre v-else-if="rawOutput" class="output-content">{{ formatOutput(rawOutput) }}</pre>
      </template>
    </div>
  </details>
</template>

<script setup>
import { computed, reactive } from 'vue'
import WebSearchProgress from './WebSearchProgress.vue'
import CodeDisplay from './studio/CodeDisplay.vue'

// Component name for recursive use
defineOptions({
  name: 'CapabilityProgress'
})

// Track which build steps are expanded (collapsed by default)
const expandedBuildSteps = reactive({})

function toggleBuildStep(idx) {
  expandedBuildSteps[idx] = !expandedBuildSteps[idx]
}

const props = defineProps({
  capability: {
    type: String,
    required: true
  },
  taskDescription: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    default: 'running' // running, complete, failed
  },
  // Web search specific
  searchQuery: {
    type: String,
    default: ''
  },
  webSources: {
    type: Array,
    default: () => []
  },
  // Planning specific
  planSteps: {
    type: Array,
    default: () => []
  },
  // Code specific
  generatedCode: {
    type: String,
    default: ''
  },
  attempts: {
    type: Number,
    default: 0
  },
  executionStatus: {
    type: String,
    default: null // null, 'success', 'failed'
  },
  // Visualization specific
  vizType: {
    type: String,
    default: ''
  },
  // Build specific
  buildSteps: {
    type: Array,
    default: () => []
  },
  // Raw output (JSON, code result, etc.)
  rawOutput: {
    type: [String, Object, Array, Number],
    default: null
  }
})

// Format output for display
function formatOutput(output) {
  if (output === null || output === undefined) return 'null'
  if (typeof output === 'string') return output
  try {
    return JSON.stringify(output, null, 2)
  } catch {
    return String(output)
  }
}

const capabilityLabel = computed(() => {
  const labels = {
    planning: 'Multi-Step',
    websearch: 'Web Search',
    code: 'Code',
    visualization: 'Visualization',
    build: 'Build Tool',
    text: 'Response'
  }
  return labels[props.capability] || props.capability
})

const isRunning = computed(() => props.status === 'running')
const isComplete = computed(() => props.status === 'complete')
const isFailed = computed(() => props.status === 'failed')

const isPending = computed(() => props.status === 'pending')

const statusClass = computed(() => {
  if (isRunning.value) return 'running'
  if (isComplete.value) return 'complete'
  if (isFailed.value) return 'failed'
  if (isPending.value) return 'pending'
  return ''
})

// Check if there's expandable content
const hasContent = computed(() => {
  if (props.capability === 'planning') return props.planSteps.length > 0 || props.rawOutput
  if (props.capability === 'websearch') return props.searchQuery || props.webSources.length > 0
  if (props.capability === 'code') return !!props.generatedCode
  if (props.capability === 'visualization') return !!props.rawOutput
  if (props.capability === 'build') return props.buildSteps.length > 0 || !!props.rawOutput
  return false
})
</script>

<style scoped>
.capability-progress {
  margin-bottom: 0.75rem;
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  overflow: hidden;
  background-color: var(--color-bg-surface);
  font-family: system-ui, -apple-system, sans-serif;
  font-size: 0.85rem;
}

.capability-progress:not(.has-content) {
  pointer-events: none;
}

.capability-progress.has-content .progress-header {
  cursor: pointer;
}

.capability-progress.has-content .progress-header:hover {
  background-color: var(--color-bg-surface);
}

.capability-progress.has-content .progress-header::before {
  content: '▶';
  font-size: 0.6rem;
  color: var(--color-text-muted);
  transition: transform 0.2s;
}

.capability-progress[open].has-content .progress-header::before {
  transform: rotate(90deg);
}

.progress-header {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  background-color: var(--color-bg-hover);
  list-style: none;
  user-select: none;
}

.progress-header::-webkit-details-marker {
  display: none;
}

.progress-content {
  border-top: 1px solid var(--color-border-base);
}

.capability-badge {
  padding: 0.15rem 0.5rem;
  border-radius: 3px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.capability-badge.planning {
  background-color: rgba(236, 72, 153, 0.15);
  color: #ec4899;
}

.capability-badge.websearch {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.capability-badge.code {
  background-color: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}

.capability-badge.visualization {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.capability-badge.build {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.capability-badge.text {
  background-color: rgba(156, 163, 175, 0.15);
  color: #6b7280;
}

.task-description {
  flex: 1;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-indicator {
  display: flex;
  align-items: center;
}

.status-icon {
  font-size: 0.9rem;
}

.status-icon.complete {
  color: #22c55e;
}

.status-icon.failed {
  color: #ef4444;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-base);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 10px;
  height: 10px;
  border-width: 1.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Planning Styles */
.planning-progress {
  padding: 0.5rem;
}

.plan-step {
  padding: 0.5rem 0.6rem;
  margin-bottom: 0.3rem;
  border: 1px solid var(--color-border-base);
  border-radius: 4px;
  background-color: var(--color-bg-page);
  transition: all 0.2s;
}

.plan-step:last-child {
  margin-bottom: 0;
}

.plan-step.pending {
  opacity: 0.5;
}

.plan-step.running {
  border-color: #3b82f6;
  background-color: rgba(59, 130, 246, 0.05);
}

.plan-step.complete {
  border-color: #22c55e;
  background-color: rgba(34, 197, 94, 0.05);
}

.plan-step.failed {
  border-color: #ef4444;
  background-color: rgba(239, 68, 68, 0.05);
}

.step-header {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.25rem;
}

.step-number {
  width: 1.3rem;
  height: 1.3rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-hover);
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.step-capability {
  padding: 0.1rem 0.35rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.step-capability.websearch {
  background-color: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.step-capability.code {
  background-color: rgba(99, 102, 241, 0.15);
  color: #6366f1;
}

.step-capability.visualization {
  background-color: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.step-capability.build {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.step-capability.text {
  background-color: rgba(156, 163, 175, 0.15);
  color: #6b7280;
}

.step-status {
  margin-left: auto;
  font-size: 0.8rem;
}

.step-status.complete {
  color: #22c55e;
}

.step-status.failed {
  color: #ef4444;
}

.pending-dot {
  color: var(--color-text-muted);
}

.step-task {
  font-size: 0.75rem;
  color: var(--color-text-base);
  line-height: 1.3;
}

/* Code Styles */
.code-progress {
  padding: 0.5rem;
}

/* Header badges */
.attempts-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
  background-color: rgba(251, 191, 36, 0.15);
  color: #f59e0b;
}

.execution-badge {
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.65rem;
  font-weight: 600;
}

.execution-badge.success {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.execution-badge.failed {
  background-color: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Output Content */
.output-content {
  margin: 0;
  padding: 0.6rem;
  background-color: var(--color-bg-page);
  font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
  font-size: 0.7rem;
  line-height: 1.4;
  overflow-x: auto;
  white-space: pre-wrap;
  word-break: break-word;
  max-height: 250px;
  overflow-y: auto;
  color: var(--color-text-base);
}

.output-content.code {
  color: #22c55e;
}

/* Nested steps in planning */
.planning-progress {
  padding: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.nested-step {
  margin-bottom: 0;
}

.nested-step .progress-header {
  padding: 0.4rem 0.6rem;
}

.nested-step .capability-badge {
  font-size: 0.6rem;
  padding: 0.1rem 0.4rem;
}

.nested-step .task-description {
  font-size: 0.75rem;
}

/* Pending status */
.status-indicator.pending {
  color: var(--color-text-muted);
}

.status-icon.pending {
  color: var(--color-text-muted);
}

/* Build Progress */
.build-progress {
  display: flex;
  flex-direction: column;
  gap: 0;
  margin-top: 0.2rem;
}

.build-step-item {
  font-size: 0.7rem;
}

.build-step-summary {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.1rem 0;
  color: var(--color-text-muted);
}

.build-step-item.complete .build-step-summary,
.build-step-item.running .build-step-summary {
  color: var(--color-text-base);
}

.build-step-summary .step-check {
  color: #22c55e;
  font-size: 0.65rem;
}

.build-step-summary .step-pending {
  opacity: 0.5;
  font-size: 0.65rem;
}

.build-step-summary .step-label {
  font-size: 0.65rem;
}

.build-step-summary.clickable {
  cursor: pointer;
}

.build-step-summary.clickable:hover {
  color: var(--color-text-base);
}

.build-step-summary .step-expand {
  font-size: 0.5rem;
  opacity: 0.4;
  margin-left: 0.15rem;
}

.build-step-output {
  margin-left: 1rem;
  margin-top: 0.15rem;
  margin-bottom: 0.15rem;
}

</style>
