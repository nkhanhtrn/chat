<template>
  <div class="tool-container" :class="'layout-' + (tool.layout || 'custom')">
    <div class="tool-header">
      <h3 class="tool-name">{{ tool.name }}</h3>
      <p class="tool-description">{{ tool.description }}</p>
    </div>

    <!-- Display Area -->
    <div v-if="tool.display" class="tool-display" :class="'display-' + tool.display.type">
      <!-- Single line display (calculator style) -->
      <template v-if="tool.display.type === 'single'">
        <div class="display-single">{{ displayValue }}</div>
      </template>

      <!-- Multi-line display -->
      <template v-else-if="tool.display.type === 'multi'">
        <div class="display-secondary">{{ displayData.secondary || '' }}</div>
        <div class="display-main">{{ displayData.main || '' }}</div>
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
      <template v-for="(element, idx) in tool.elements" :key="idx">
        <!-- Button Grid (calculator style) -->
        <div v-if="element.type === 'button-grid'" class="button-grid" :style="{ gridTemplateColumns: `repeat(${element.columns || 4}, 1fr)` }">
          <button
            v-for="(btn, btnIdx) in element.buttons"
            :key="btnIdx"
            class="grid-button"
            :class="[btn.class, { 'wide': btn.class?.includes('wide') }]"
            @click="executeAction(btn.action, btn.value)"
          >
            {{ btn.label }}
          </button>
        </div>

        <!-- Button Row -->
        <div v-else-if="element.type === 'button-row'" class="button-row">
          <button
            v-for="(btn, btnIdx) in element.buttons"
            :key="btnIdx"
            class="row-button"
            :class="btn.class"
            @click="executeAction(btn.action, btn.value)"
          >
            {{ btn.label }}
          </button>
        </div>

        <!-- Single Button -->
        <button
          v-else-if="element.type === 'button'"
          class="single-button"
          :class="element.class"
          @click="executeAction(element.action, element.value)"
        >
          {{ element.label }}
        </button>

        <!-- Text Input -->
        <div v-else-if="element.type === 'input'" class="input-group">
          <label class="input-label">{{ element.label }}</label>
          <input
            :type="element.inputType || 'text'"
            :placeholder="element.placeholder"
            :value="state[element.stateKey]"
            @input="updateState(element.stateKey, $event.target.value)"
            class="input-field"
          />
        </div>

        <!-- Textarea -->
        <div v-else-if="element.type === 'textarea'" class="input-group">
          <label class="input-label">{{ element.label }}</label>
          <textarea
            :placeholder="element.placeholder"
            :rows="element.rows || 4"
            :value="state[element.stateKey]"
            @input="updateState(element.stateKey, $event.target.value)"
            class="input-textarea"
          ></textarea>
        </div>

        <!-- Select -->
        <div v-else-if="element.type === 'select'" class="input-group">
          <label class="input-label">{{ element.label }}</label>
          <select
            :value="state[element.stateKey]"
            @change="updateState(element.stateKey, $event.target.value)"
            class="input-select"
          >
            <option v-for="opt in element.options" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>

        <!-- Color Input -->
        <div v-else-if="element.type === 'color-input'" class="color-input-group">
          <input
            type="color"
            :value="state[element.stateKey]"
            @input="handleColorInput($event.target.value)"
            class="color-picker"
          />
          <input
            type="text"
            :value="state[element.stateKey]"
            @input="handleColorInput($event.target.value)"
            class="color-text"
            placeholder="#000000"
          />
        </div>

        <!-- Input Row (multiple inputs in a row) -->
        <div v-else-if="element.type === 'input-row'" class="input-row">
          <div v-for="inp in element.inputs" :key="inp.stateKey" class="input-row-item">
            <label class="input-label">{{ inp.label }}</label>
            <input
              :type="inp.type || 'text'"
              :min="inp.min"
              :max="inp.max"
              :value="state[inp.stateKey]"
              @input="updateState(inp.stateKey, inp.type === 'number' ? Number($event.target.value) : $event.target.value)"
              class="input-field"
            />
          </div>
        </div>
      </template>
    </div>

    <!-- View Code -->
    <details class="code-details">
      <summary class="code-summary">View Specification</summary>
      <CodeBlock language="json" :code="JSON.stringify(tool, null, 2)" />
    </details>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import CodeBlock from './markdown/CodeBlock.vue'

const props = defineProps({
  tool: {
    type: Object,
    required: true
  }
})

const state = reactive({})

// Initialize state from tool spec
onMounted(() => {
  if (props.tool.state) {
    Object.keys(props.tool.state).forEach(key => {
      state[key] = props.tool.state[key]
    })
  }
})

// Compute display value using displayFormatter
const displayValue = computed(() => {
  if (!props.tool.displayFormatter) {
    return state.display || ''
  }
  try {
    const fn = new Function('state', props.tool.displayFormatter)
    const result = fn(state)
    return typeof result === 'string' ? result : JSON.stringify(result)
  } catch (e) {
    return state.display || ''
  }
})

// Compute display data for complex displays
const displayData = computed(() => {
  if (!props.tool.displayFormatter) {
    return { main: '', secondary: '', stats: [], color: '#000000', formats: [] }
  }
  try {
    const fn = new Function('state', props.tool.displayFormatter)
    const result = fn(state)
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

  try {
    const actionCode = props.tool.actions[actionName]
    const fn = new Function('state', 'value', 'updateDisplay', actionCode)
    fn(state, value, () => {})
  } catch (e) {
    console.error('Action error:', e)
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
  border: 1px solid var(--color-border-base);
  border-radius: 12px;
  padding: 1.5rem;
  background-color: var(--color-bg-elevated);
  margin: 1rem 0;
  width: fit-content;
  min-width: 200px;
  max-width: 100%;
}

.tool-header {
  margin-bottom: 1rem;
  text-align: center;
}

.tool-name {
  margin: 0 0 0.25rem 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--color-text-strong);
}

.tool-description {
  margin: 0;
  color: var(--color-text-muted);
  font-size: 0.8rem;
}

/* Display Styles */
.tool-display {
  margin-bottom: 1rem;
  border-radius: 8px;
  overflow: hidden;
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

/* Code Details */
.code-details {
  margin-top: 1rem;
  border-top: 1px solid var(--color-border-subtle);
  padding-top: 0.75rem;
}

.code-summary {
  cursor: pointer;
  color: var(--color-text-muted);
  font-size: 0.8rem;
  padding: 0.25rem 0;
}

.code-summary:hover {
  color: var(--color-text-secondary);
}

/* Tool Elements Container */
.tool-elements {
  display: flex;
  flex-direction: column;
}
</style>
