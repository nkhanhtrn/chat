<template>
  <div class="tool-container" :class="'layout-' + (tool.layout || 'custom')">
    <!-- Display Area -->
    <div v-if="tool.display" class="tool-display" :class="'display-' + tool.display.type">
      <!-- Single line display (calculator style) -->
      <template v-if="tool.display.type === 'single'">
        <div class="display-single">{{ displayValue }}</div>
        <button class="copy-btn" @click="copyToClipboard(displayValue)" :title="copied ? 'Copied!' : 'Copy'">
          <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </template>

      <!-- Multi-line display -->
      <template v-else-if="tool.display.type === 'multi'">
        <div class="display-secondary">{{ displayData.secondary || '' }}</div>
        <div class="display-main">{{ displayData.main || '' }}</div>
        <button class="copy-btn" @click="copyToClipboard(displayData.main)" :title="copied ? 'Copied!' : 'Copy'">
          <svg v-if="!copied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </template>

      <!-- Stats display -->
      <template v-else-if="tool.display.type === 'stats'">
        <div class="display-stats">
          <div v-for="stat in displayData.stats" :key="stat.label" class="stat-item">
            <span class="stat-value">{{ stat.value }}</span>
            <span class="stat-label">{{ stat.label }}</span>
          </div>
        </div>
      </template>

      <!-- Color preview -->
      <template v-else-if="tool.display.type === 'color-preview'">
        <div class="color-preview-container">
          <div class="color-swatch" :style="{ backgroundColor: displayData.color }"></div>
          <div class="color-formats">
            <div v-for="fmt in displayData.formats" :key="fmt.label" class="color-format">
              <span class="format-label">{{ fmt.label }}:</span>
              <span class="format-value">{{ fmt.value }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- Elements -->
    <div class="tool-elements">
      <ToolElement
        v-for="(element, idx) in tool.elements"
        :key="idx"
        :element="element"
        :state="state"
        @update="updateState"
        @action="executeAction"
        @toggle-checkbox="toggleCheckboxOption"
        @toggle-row="toggleRowValue"
        @step="stepValue"
        @color-change="handleColorInput"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import ToolElement from './ToolElement.vue'
import { useToolDataStore } from '../composables/studio/useToolDataStore.js'

const props = defineProps({
  tool: {
    type: Object,
    required: true
  }
})

// Initialize per-tool data store - this is REACTIVE Vue state
const state = reactive({})
const openAccordions = reactive({})
const dismissedAlerts = reactive({})
const copied = ref(false)

// Copy to clipboard with visual feedback
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(String(text))
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 1500)
  } catch (e) {
    console.error('Failed to copy:', e)
  }
}

// Computed db store that updates when tool name changes
const db = computed(() => useToolDataStore(props.tool.name || 'unnamed-tool'))

// Initialize state from tool spec
function initializeState() {
  // Clear existing state
  Object.keys(state).forEach(key => delete state[key])
  // Set new state
  if (props.tool.state) {
    Object.keys(props.tool.state).forEach(key => {
      state[key] = props.tool.state[key]
    })
  }
}

onMounted(initializeState)

// Re-initialize when tool changes
watch(() => props.tool, initializeState, { deep: true })

function fixEscapeSequences(code) {
  // Fix common invalid escape sequences in regex patterns
  // The LLM sometimes outputs \s instead of \\s in JSON strings
  return code
    .replace(/([^\\])\\s/g, '$1\\\\s')
    .replace(/([^\\])\\d/g, '$1\\\\d')
    .replace(/([^\\])\\w/g, '$1\\\\w')
    .replace(/([^\\])\\n/g, '$1\\\\n')
    .replace(/([^\\])\\t/g, '$1\\\\t')
    .replace(/([^\\])\\r/g, '$1\\\\r')
    .replace(/^\\s/g, '\\\\s')
    .replace(/^\\d/g, '\\\\d')
    .replace(/^\\w/g, '\\\\w')
}

// Try to execute formatter, with fallback escape sequence fix
function executeFormatter(formatter) {
  try {
    const fn = new Function('state', 'db', formatter)
    return fn(state, db.value)
  } catch (e) {
    if (e.message.includes('escape') || e.message.includes('Invalid')) {
      const fixed = fixEscapeSequences(formatter)
      const fn = new Function('state', 'db', fixed)
      return fn(state, db.value)
    }
    throw e
  }
}

// Create a reactive snapshot of state to track all changes
const stateSnapshot = computed(() => JSON.stringify(state))

// Compute display value using displayFormatter
const displayValue = computed(() => {
  // Track all state changes by depending on snapshot
  void stateSnapshot.value
  if (!props.tool.displayFormatter) {
    return state.display || ''
  }
  try {
    const result = executeFormatter(props.tool.displayFormatter)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (e) {
    return state.display || ''
  }
})

// Compute display data for complex displays
const displayData = computed(() => {
  // Track all state changes by depending on snapshot
  void stateSnapshot.value
  if (!props.tool.displayFormatter) {
    return { main: '', secondary: '', stats: [], color: '#000000', formats: [] }
  }
  try {
    const result = executeFormatter(props.tool.displayFormatter)
    if (typeof result === 'object') {
      return result
    }
    return { main: result, secondary: '' }
  } catch (e) {
    return { main: '', secondary: '', stats: [], color: '#000000', formats: [] }
  }
})

function updateState(key, value) {
  state[key] = value
}

function executeAction(actionName, value) {
  if (!props.tool.actions || !props.tool.actions[actionName]) {
    console.warn('Action not found:', actionName)
    return
  }

  let actionCode = props.tool.actions[actionName]

  try {
    // Strip wrapping function if LLM generated one
    const trimmed = actionCode.trim()
    if (trimmed.startsWith('function')) {
      const match = trimmed.match(/^function\s*\([^)]*\)\s*\{([\s\S]*)\}\s*$/)
      if (match) {
        actionCode = match[1].trim()
      }
    }
    // Pass reactive state - Vue will auto-update when state changes
    const fn = new Function('state', 'value', 'db', actionCode)
    fn(state, value, db.value)
  } catch (e) {
    // Try fixing escape sequences and retry
    if (e.message.includes('escape') || e.message.includes('Invalid')) {
      try {
        actionCode = fixEscapeSequences(actionCode)
        const fn = new Function('state', 'value', 'db', actionCode)
        fn(state, value, db.value)
      } catch (e2) {
        console.error('Action error after fix attempt:', e2)
      }
    } else {
      console.error('Action error:', e, '\nAction code:', actionCode)
    }
  }
}

function handleColorInput(hexValue) {
  state.hex = hexValue
  // Parse hex to RGB
  const hex = hexValue.replace('#', '')
  if (hex.length === 6) {
    state.r = parseInt(hex.substring(0, 2), 16)
    state.g = parseInt(hex.substring(2, 4), 16)
    state.b = parseInt(hex.substring(4, 6), 16)
  }
}

function toggleCheckboxOption(stateKey, value, checked) {
  if (!state[stateKey]) {
    state[stateKey] = []
  }
  if (checked) {
    if (!state[stateKey].includes(value)) {
      state[stateKey].push(value)
    }
  } else {
    const idx = state[stateKey].indexOf(value)
    if (idx > -1) {
      state[stateKey].splice(idx, 1)
    }
  }
}

function stepValue(stateKey, delta, min, max) {
  let newVal = (state[stateKey] || 0) + delta
  if (min !== undefined) newVal = Math.max(min, newVal)
  if (max !== undefined) newVal = Math.min(max, newVal)
  state[stateKey] = newVal
}

function toggleAccordion(key) {
  openAccordions[key] = !openAccordions[key]
}

function dismissAlert(idx) {
  dismissedAlerts[idx] = true
}

function toggleRowValue(rowsStateKey, rowIdx, colKey) {
  if (state[rowsStateKey] && state[rowsStateKey][rowIdx]) {
    state[rowsStateKey][rowIdx][colKey] = !state[rowsStateKey][rowIdx][colKey]
  }
}

// Watch RGB changes to update hex
watch([() => state.r, () => state.g, () => state.b], ([r, g, b]) => {
  if (r !== undefined && g !== undefined && b !== undefined) {
    const toHex = (n) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
    state.hex = `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }
})
</script>

<style scoped>
.tool-container {
  padding: 0.5rem;
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  color: var(--color-text-base);
}

/* Display Styles */
.tool-display {
  margin-bottom: 1rem;
  border-radius: 8px;
  overflow: hidden;
  flex-shrink: 0;
  position: relative;
}

.copy-btn {
  position: absolute;
  top: 0.5rem;
  right: 0.5rem;
  padding: 0.35rem;
  border: none;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.1);
  color: var(--color-text-muted);
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.15s, background-color 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.tool-display:hover .copy-btn {
  opacity: 1;
}

.copy-btn:hover {
  background-color: rgba(255, 255, 255, 0.2);
  color: var(--color-text-base);
}

.copy-btn svg {
  display: block;
}

.display-single {
  background-color: var(--color-code-block-bg);
  color: var(--color-code-block-text);
  padding: 1rem 1.25rem;
  font-size: 2rem;
  font-family: 'SF Mono', Consolas, monospace;
  text-align: right;
  min-height: 3rem;
  border-radius: 8px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.display-multi {
  background-color: var(--color-code-block-bg);
  padding: 0.75rem 1rem;
  border-radius: 8px;
}

.display-secondary {
  color: var(--color-text-muted);
  font-size: 0.85rem;
  text-align: right;
  min-height: 1.2rem;
}

.display-main {
  color: var(--color-code-block-text);
  font-size: 1.5rem;
  font-family: 'SF Mono', Consolas, monospace;
  text-align: right;
}

.display-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 1.75rem;
  font-weight: 600;
  color: var(--color-text-strong);
}

.stat-label {
  font-size: 0.75rem;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Color Preview */
.color-preview-container {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
}

.color-swatch {
  width: 80px;
  height: 80px;
  border-radius: 8px;
  border: 1px solid var(--color-border-base);
}

.color-formats {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.25rem;
}

.color-format {
  font-size: 0.85rem;
}

.format-label {
  color: var(--color-text-muted);
  margin-right: 0.5rem;
}

.format-value {
  font-family: 'SF Mono', Consolas, monospace;
  color: var(--color-text-base);
}

/* Button Grid */
.button-grid {
  display: grid;
  gap: 8px;
  margin-bottom: 0.5rem;
}

.grid-button {
  padding: 1rem;
  font-size: 1.25rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  background-color: var(--color-bg-button);
  color: var(--color-text-base);
  transition: background-color 0.1s, transform 0.1s;
}

.grid-button:hover {
  background-color: var(--color-bg-button-hover);
}

.grid-button:active {
  transform: scale(0.95);
}

.grid-button.wide {
  grid-column: span 2;
}

.grid-button.operator {
  background-color: var(--color-bg-accent-muted);
  color: var(--color-text-inverse);
}

.grid-button.operator:hover {
  background-color: var(--color-accent);
}

.grid-button.primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

.grid-button.primary:hover {
  background-color: var(--color-primary-hover);
}

.grid-button.secondary {
  background-color: var(--color-bg-secondary);
}

.grid-button.danger {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
}

/* Button Row */
.button-row {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.row-button {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: 1px solid var(--color-border-button);
  border-radius: 6px;
  cursor: pointer;
  background-color: var(--color-bg-button);
  color: var(--color-text-base);
  transition: background-color 0.15s;
}

.row-button:hover {
  background-color: var(--color-bg-button-hover);
}

.row-button.primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.row-button.primary:hover {
  background-color: var(--color-primary-hover);
}

.row-button.secondary {
  background-color: var(--color-bg-secondary);
}

.row-button.danger {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
  border-color: var(--color-error-border);
}

/* Single Button */
.single-button {
  width: 100%;
  padding: 0.75rem 1rem;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
  font-weight: 500;
  border: 1px solid var(--color-border-button);
  border-radius: 6px;
  cursor: pointer;
  background-color: var(--color-bg-button);
  color: var(--color-text-base);
  transition: background-color 0.15s;
}

.single-button:hover {
  background-color: var(--color-bg-button-hover);
}

.single-button.primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

.single-button.secondary {
  background-color: var(--color-bg-secondary);
}

/* Input Styles */
.input-group {
  margin-bottom: 0.75rem;
}

.input-label {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.85rem;
  font-weight: 500;
  color: var(--color-text-secondary);
}

.input-field,
.input-textarea,
.input-select {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  font-family: inherit;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
  box-sizing: border-box;
}

.input-field:focus,
.input-textarea:focus,
.input-select:focus {
  outline: none;
  border-color: var(--color-border-strong);
}

.input-textarea {
  resize: vertical;
  min-height: 100px;
}

.input-select {
  cursor: pointer;
}

/* Input Row */
.input-row {
  display: flex;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

.input-row-item {
  flex: 1;
}

.input-row-item .input-field {
  text-align: center;
}

/* Color Input */
.color-input-group {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.color-picker {
  width: 60px;
  height: 44px;
  padding: 2px;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  cursor: pointer;
  background-color: var(--color-bg-input);
}

.color-text {
  flex: 1;
  padding: 0.75rem;
  font-size: 1rem;
  font-family: 'SF Mono', Consolas, monospace;
  border: 1px solid var(--color-border-input);
  border-radius: 6px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
}

/* Tool Elements Container */
.tool-elements {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* Checkbox Styles */
.checkbox-group,
.checkbox-group-container {
  margin-bottom: 0.75rem;
}

.checkbox-options,
.radio-options {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-top: 0.25rem;
}

.checkbox-label,
.radio-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  font-size: 0.9rem;
  color: var(--color-text-base);
}

.checkbox-input,
.radio-input {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.checkbox-text,
.radio-text {
  user-select: none;
}

/* Radio Group */
.radio-group-container {
  margin-bottom: 0.75rem;
}

/* Range/Slider */
.range-container {
  margin-bottom: 0.75rem;
}

.range-input {
  width: 100%;
  height: 8px;
  cursor: pointer;
  accent-color: var(--color-primary);
}

.range-value {
  float: right;
  font-weight: 600;
  color: var(--color-primary);
}

/* Toggle/Switch */
.toggle-container {
  margin-bottom: 0.75rem;
}

.toggle-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.toggle-text {
  font-size: 0.9rem;
  color: var(--color-text-base);
}

.toggle-switch {
  width: 48px;
  height: 26px;
  background-color: var(--color-bg-secondary);
  border-radius: 13px;
  padding: 2px;
  transition: background-color 0.2s;
  cursor: pointer;
}

.toggle-switch.active {
  background-color: var(--color-primary);
}

.toggle-knob {
  width: 22px;
  height: 22px;
  background-color: var(--color-bg-surface, white);
  border-radius: 50%;
  transition: transform 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

.toggle-switch.active .toggle-knob {
  transform: translateX(22px);
}

/* Progress Bar */
.progress-container {
  margin-bottom: 0.75rem;
}

.progress-bar {
  width: 100%;
  height: 8px;
  background-color: var(--color-bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background-color: var(--color-primary);
  transition: width 0.3s;
}

.progress-text {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-top: 0.25rem;
  display: block;
}

/* Meter */
.meter-container {
  margin-bottom: 0.75rem;
}

.meter-element {
  width: 100%;
  height: 20px;
}

.meter-value {
  font-size: 0.8rem;
  color: var(--color-text-muted);
  margin-left: 0.5rem;
}

/* Rating Stars */
.rating-container {
  margin-bottom: 0.75rem;
}

.rating-stars {
  display: flex;
  gap: 4px;
}

.rating-star {
  font-size: 1.5rem;
  color: var(--color-border-base);
  cursor: pointer;
  transition: color 0.15s, transform 0.1s;
}

.rating-star:hover {
  transform: scale(1.1);
}

.rating-star.filled {
  color: var(--color-warning, #f59e0b);
}

/* Stepper */
.stepper-container {
  margin-bottom: 0.75rem;
}

.stepper-controls {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stepper-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--color-border-button);
  border-radius: 6px;
  background-color: var(--color-bg-button);
  color: var(--color-text-base);
  font-size: 1.25rem;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.stepper-btn:hover {
  background-color: var(--color-bg-button-hover);
}

.stepper-value {
  min-width: 60px;
  text-align: center;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-base);
}

/* Tabs */
.tabs-container {
  margin-bottom: 0.75rem;
}

.tabs-header {
  display: flex;
  border-bottom: 1px solid var(--color-border-base);
  margin-bottom: 1rem;
}

.tab-button {
  padding: 0.75rem 1rem;
  border: none;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.9rem;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}

.tab-button:hover {
  color: var(--color-text-base);
}

.tab-button.active {
  color: var(--color-primary);
  border-bottom-color: var(--color-primary);
}

.tabs-content {
  padding: 0.5rem 0;
}

/* Accordion */
.accordion-container {
  margin-bottom: 0.75rem;
}

.accordion-section {
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  margin-bottom: 0.5rem;
  overflow: hidden;
}

.accordion-header {
  width: 100%;
  padding: 0.75rem 1rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: var(--color-bg-secondary);
  border: none;
  cursor: pointer;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--color-text-base);
}

.accordion-header:hover {
  background-color: var(--color-bg-button-hover);
}

.accordion-header.open {
  border-bottom: 1px solid var(--color-border-base);
}

.accordion-icon {
  font-size: 1.2rem;
  color: var(--color-text-muted);
}

.accordion-content {
  padding: 1rem;
}

/* Card */
.card-container {
  border: 1px solid var(--color-border-base);
  border-radius: 8px;
  margin-bottom: 0.75rem;
  background-color: var(--color-bg-elevated);
  overflow: hidden;
}

.card-header {
  padding: 1rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.card-title {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-strong);
}

.card-subtitle {
  margin: 0.25rem 0 0 0;
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

.card-content {
  padding: 1rem;
}

.card-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--color-border-subtle);
  background-color: var(--color-bg-secondary);
  font-size: 0.85rem;
  color: var(--color-text-muted);
}

/* Alert */
.alert-container {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.75rem 1rem;
  border-radius: 6px;
  margin-bottom: 0.75rem;
  font-size: 0.9rem;
}

.alert-info {
  background-color: var(--color-info-bg, #dbeafe);
  color: var(--color-info-text, #1e40af);
  border: 1px solid var(--color-info-border, #93c5fd);
}

.alert-success {
  background-color: var(--color-success-bg, #dcfce7);
  color: var(--color-success-text, #166534);
  border: 1px solid var(--color-success-border, #86efac);
}

.alert-warning {
  background-color: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning-text, #92400e);
  border: 1px solid var(--color-warning-border, #fcd34d);
}

.alert-error {
  background-color: var(--color-error-bg, #fee2e2);
  color: var(--color-error-text, #991b1b);
  border: 1px solid var(--color-error-border, #fca5a5);
}

.alert-dismiss {
  background: none;
  border: none;
  font-size: 1.25rem;
  cursor: pointer;
  opacity: 0.7;
  color: inherit;
}

.alert-dismiss:hover {
  opacity: 1;
}

/* Badge */
.badge-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}

.badge {
  display: inline-block;
  padding: 0.25rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 500;
  border-radius: 9999px;
  background-color: var(--color-bg-secondary);
  color: var(--color-text-base);
}

.badge-low {
  background-color: var(--color-success-bg, #dcfce7);
  color: var(--color-success-text, #166534);
}

.badge-medium {
  background-color: var(--color-warning-bg, #fef3c7);
  color: var(--color-warning-text, #92400e);
}

.badge-high {
  background-color: var(--color-error-bg, #fee2e2);
  color: var(--color-error-text, #991b1b);
}

/* Table */
.table-container {
  margin-bottom: 0.75rem;
  overflow-x: auto;
}

.data-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.data-table th,
.data-table td {
  padding: 0.75rem;
  text-align: left;
  border-bottom: 1px solid var(--color-border-base);
}

.data-table th {
  background-color: var(--color-bg-secondary);
  font-weight: 600;
  color: var(--color-text-strong);
}

.data-table tr:hover {
  background-color: var(--color-bg-hover);
}

.table-action-btn {
  padding: 0.25rem 0.5rem;
  font-size: 0.8rem;
  border: 1px solid var(--color-border-button);
  border-radius: 4px;
  background-color: var(--color-bg-button);
  color: var(--color-text-base);
  cursor: pointer;
}

.table-action-btn:hover {
  background-color: var(--color-bg-button-hover);
}

.table-action-btn.danger {
  background-color: var(--color-error-bg);
  color: var(--color-error-text);
  border-color: var(--color-error-border);
}

.table-action-btn.primary {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  border-color: var(--color-primary);
}

/* List */
.list-container {
  margin-bottom: 0.75rem;
}

.list-element {
  margin: 0;
  padding-left: 1.5rem;
  color: var(--color-text-base);
}

.list-element li {
  padding: 0.25rem 0;
}

/* Divider */
.divider {
  border: none;
  border-top: 1px solid var(--color-border-base);
  margin: 1rem 0;
}

/* Spacer */
.spacer {
  display: block;
}

.spacer-sm {
  height: 0.5rem;
}

.spacer-md {
  height: 1rem;
}

.spacer-lg {
  height: 2rem;
}

/* Heading */
.heading-element {
  margin: 0 0 0.75rem 0;
  color: var(--color-text-strong);
}

h1.heading-element { font-size: 1.75rem; }
h2.heading-element { font-size: 1.5rem; }
h3.heading-element { font-size: 1.25rem; }
h4.heading-element { font-size: 1.1rem; }
h5.heading-element { font-size: 1rem; }
h6.heading-element { font-size: 0.9rem; }

/* Text */
.text-element {
  margin: 0 0 0.75rem 0;
  color: var(--color-text-base);
  font-size: 0.9rem;
  line-height: 1.5;
}

/* Image */
.image-container {
  margin-bottom: 0.75rem;
}

.image-element {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}
</style>
