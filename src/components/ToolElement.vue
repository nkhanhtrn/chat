<template>
  <!-- Button Grid -->
  <div v-if="element.type === 'button-grid'" class="button-grid" :style="{ gridTemplateColumns: `repeat(${element.columns || 4}, 1fr)` }">
    <button
      v-for="(btn, btnIdx) in element.buttons"
      :key="btnIdx"
      class="grid-button"
      :class="[btn.class, { 'wide': btn.class?.includes('wide') }]"
      @click="$emit('action', btn.action, btn.value)"
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
      @click="$emit('action', btn.action, btn.value)"
    >
      {{ btn.label }}
    </button>
  </div>

  <!-- Single Button -->
  <button
    v-else-if="element.type === 'button'"
    class="single-button"
    :class="element.class"
    @click="$emit('action', element.action, element.value)"
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
      @input="$emit('update', element.stateKey, $event.target.value)"
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
      @input="$emit('update', element.stateKey, $event.target.value)"
      class="input-textarea"
    ></textarea>
  </div>

  <!-- Select -->
  <div v-else-if="element.type === 'select'" class="input-group">
    <label class="input-label">{{ element.label }}</label>
    <select
      :value="state[element.stateKey]"
      @change="$emit('update', element.stateKey, $event.target.value)"
      class="input-select"
    >
      <option v-for="opt in element.options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </option>
    </select>
  </div>

  <!-- Checkbox -->
  <div v-else-if="element.type === 'checkbox'" class="checkbox-group">
    <label class="checkbox-label">
      <input
        type="checkbox"
        :checked="state[element.stateKey]"
        @change="$emit('update', element.stateKey, $event.target.checked)"
        class="checkbox-input"
      />
      <span class="checkbox-text">{{ element.label }}</span>
    </label>
  </div>

  <!-- Checkbox Group -->
  <div v-else-if="element.type === 'checkbox-group'" class="checkbox-group-container">
    <label class="input-label">{{ element.label }}</label>
    <div class="checkbox-options">
      <label v-for="opt in element.options" :key="opt.value" class="checkbox-label">
        <input
          type="checkbox"
          :checked="(state[element.stateKey] || []).includes(opt.value)"
          @change="$emit('toggle-checkbox', element.stateKey, opt.value, $event.target.checked)"
          class="checkbox-input"
        />
        <span class="checkbox-text">{{ opt.label }}</span>
      </label>
    </div>
  </div>

  <!-- Radio Group -->
  <div v-else-if="element.type === 'radio-group'" class="radio-group-container">
    <label class="input-label">{{ element.label }}</label>
    <div class="radio-options">
      <label v-for="opt in element.options" :key="opt.value" class="radio-label">
        <input
          type="radio"
          :name="element.stateKey"
          :value="opt.value"
          :checked="state[element.stateKey] === opt.value"
          @change="$emit('update', element.stateKey, opt.value)"
          class="radio-input"
        />
        <span class="radio-text">{{ opt.label }}</span>
      </label>
    </div>
  </div>

  <!-- Range/Slider -->
  <div v-else-if="element.type === 'range'" class="range-container">
    <label class="input-label">
      {{ element.label }}
      <span v-if="element.showValue" class="range-value">{{ state[element.stateKey] }}</span>
    </label>
    <input
      type="range"
      :min="element.min || 0"
      :max="element.max || 100"
      :step="element.step || 1"
      :value="state[element.stateKey]"
      @input="$emit('update', element.stateKey, Number($event.target.value))"
      class="range-input"
    />
  </div>

  <!-- Toggle/Switch -->
  <div v-else-if="element.type === 'toggle'" class="toggle-container">
    <label class="toggle-label">
      <span class="toggle-text">{{ element.label }}</span>
      <div class="toggle-switch" :class="{ active: state[element.stateKey] }" @click="$emit('update', element.stateKey, !state[element.stateKey])">
        <div class="toggle-knob"></div>
      </div>
    </label>
  </div>

  <!-- Date Input -->
  <div v-else-if="element.type === 'date'" class="input-group">
    <label class="input-label">{{ element.label }}</label>
    <input
      type="date"
      :value="state[element.stateKey]"
      @input="$emit('update', element.stateKey, $event.target.value)"
      class="input-field"
    />
  </div>

  <!-- Time Input -->
  <div v-else-if="element.type === 'time'" class="input-group">
    <label class="input-label">{{ element.label }}</label>
    <input
      type="time"
      :value="state[element.stateKey]"
      @input="$emit('update', element.stateKey, $event.target.value)"
      class="input-field"
    />
  </div>

  <!-- Progress Bar -->
  <div v-else-if="element.type === 'progress'" class="progress-container">
    <label v-if="element.label" class="input-label">{{ element.label }}</label>
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: (state[element.stateKey] || 0) + '%' }"></div>
    </div>
    <span class="progress-text">{{ state[element.stateKey] || 0 }}%</span>
  </div>

  <!-- Rating Stars -->
  <div v-else-if="element.type === 'rating'" class="rating-container">
    <label v-if="element.label" class="input-label">{{ element.label }}</label>
    <div class="rating-stars">
      <span
        v-for="star in (element.max || 5)"
        :key="star"
        class="rating-star"
        :class="{ filled: star <= (state[element.stateKey] || 0) }"
        @click="$emit('update', element.stateKey, star)"
      >★</span>
    </div>
  </div>

  <!-- Stepper -->
  <div v-else-if="element.type === 'stepper'" class="stepper-container">
    <label v-if="element.label" class="input-label">{{ element.label }}</label>
    <div class="stepper-controls">
      <button class="stepper-btn" @click="$emit('step', element.stateKey, -(element.step || 1), element.min, element.max)">−</button>
      <span class="stepper-value">{{ state[element.stateKey] }}</span>
      <button class="stepper-btn" @click="$emit('step', element.stateKey, element.step || 1, element.min, element.max)">+</button>
    </div>
  </div>

  <!-- Alert -->
  <div v-else-if="element.type === 'alert'" class="alert-container" :class="'alert-' + (element.alertType || 'info')" v-show="!dismissed">
    <span class="alert-message">{{ element.message }}</span>
    <button v-if="element.dismissible" class="alert-dismiss" @click="dismissed = true">×</button>
  </div>

  <!-- Table -->
  <div v-else-if="element.type === 'table'" class="table-container">
    <table class="data-table">
      <thead>
        <tr>
          <th v-for="col in element.columns" :key="col.key">{{ col.label }}</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, rowIdx) in (state[element.rowsStateKey] || [])" :key="rowIdx">
          <td v-for="col in element.columns" :key="col.key">
            <template v-if="col.type === 'checkbox'">
              <input type="checkbox" :checked="row[col.key]" @change="$emit('toggle-row', element.rowsStateKey, rowIdx, col.key)" />
            </template>
            <template v-else-if="col.type === 'badge'">
              <span class="badge" :class="'badge-' + row[col.key]">{{ row[col.key] }}</span>
            </template>
            <template v-else-if="col.type === 'action'">
              <button
                class="table-action-btn"
                :class="col.class"
                @click="$emit('action', col.action, { row, rowIdx, rowsStateKey: element.rowsStateKey })"
              >{{ col.buttonLabel || col.label }}</button>
            </template>
            <template v-else>{{ row[col.key] }}</template>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- List -->
  <div v-else-if="element.type === 'list'" class="list-container">
    <component :is="element.ordered ? 'ol' : 'ul'" class="list-element">
      <li v-for="(item, itemIdx) in (state[element.stateKey] || [])" :key="itemIdx">{{ item }}</li>
    </component>
  </div>

  <!-- Divider -->
  <hr v-else-if="element.type === 'divider'" class="divider" />

  <!-- Spacer -->
  <div v-else-if="element.type === 'spacer'" class="spacer" :class="'spacer-' + (element.size || 'md')"></div>

  <!-- Heading -->
  <component
    v-else-if="element.type === 'heading'"
    :is="'h' + (element.level || 3)"
    class="heading-element"
  >{{ element.text }}</component>

  <!-- Text -->
  <p v-else-if="element.type === 'text'" class="text-element">{{ element.text }}</p>

  <!-- Color Input -->
  <div v-else-if="element.type === 'color-input'" class="color-input-group">
    <input
      type="color"
      :value="state[element.stateKey]"
      @input="$emit('color-change', $event.target.value)"
      class="color-picker"
    />
    <input
      type="text"
      :value="state[element.stateKey]"
      @input="$emit('color-change', $event.target.value)"
      class="color-text"
      placeholder="#000000"
    />
  </div>

  <!-- Input Row -->
  <div v-else-if="element.type === 'input-row'" class="input-row">
    <div v-for="inp in element.inputs" :key="inp.stateKey" class="input-row-item">
      <label class="input-label">{{ inp.label }}</label>
      <input
        :type="inp.type || 'text'"
        :min="inp.min"
        :max="inp.max"
        :value="state[inp.stateKey]"
        @input="$emit('update', inp.stateKey, inp.type === 'number' ? Number($event.target.value) : $event.target.value)"
        class="input-field"
      />
    </div>
  </div>

  <!-- DateTime Input -->
  <div v-else-if="element.type === 'datetime'" class="input-group">
    <label class="input-label">{{ element.label }}</label>
    <input
      type="datetime-local"
      :value="state[element.stateKey]"
      @input="$emit('update', element.stateKey, $event.target.value)"
      class="input-field"
    />
  </div>

  <!-- Meter -->
  <div v-else-if="element.type === 'meter'" class="meter-container">
    <label v-if="element.label" class="input-label">{{ element.label }}</label>
    <meter
      :min="element.min || 0"
      :max="element.max || 100"
      :low="element.low"
      :high="element.high"
      :optimum="element.optimum"
      :value="state[element.stateKey] || 0"
      class="meter-element"
    ></meter>
    <span class="meter-value">{{ (state[element.stateKey] || 0).toFixed(2) }}</span>
  </div>

  <!-- Badge Group -->
  <div v-else-if="element.type === 'badge-group'" class="badge-group">
    <span v-for="(badge, badgeIdx) in (state[element.stateKey] || [])" :key="badgeIdx" class="badge">{{ badge }}</span>
  </div>

  <!-- Image -->
  <div v-else-if="element.type === 'image'" class="image-container">
    <img :src="state[element.srcStateKey] || element.src" :alt="element.alt || ''" class="image-element" />
  </div>

  <!-- Card (with nested elements) -->
  <div v-else-if="element.type === 'card'" class="card-container">
    <div v-if="element.title" class="card-header">
      <h4 class="card-title">{{ element.title }}</h4>
      <p v-if="element.subtitle" class="card-subtitle">{{ element.subtitle }}</p>
    </div>
    <div class="card-content">
      <ToolElement
        v-for="(childEl, childIdx) in (element.content || [])"
        :key="childIdx"
        :element="childEl"
        :state="state"
        @update="(key, val) => $emit('update', key, val)"
        @action="(action, val) => $emit('action', action, val)"
        @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
        @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
        @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
      />
    </div>
    <div v-if="element.footer" class="card-footer">{{ element.footer }}</div>
  </div>

  <!-- Accordion -->
  <div v-else-if="element.type === 'accordion'" class="accordion-container">
    <div v-for="(section, secIdx) in element.sections" :key="secIdx" class="accordion-section">
      <button
        class="accordion-header"
        :class="{ open: openSections[secIdx] }"
        @click="toggleSection(secIdx)"
      >
        <span>{{ section.title }}</span>
        <span class="accordion-icon">{{ openSections[secIdx] ? '−' : '+' }}</span>
      </button>
      <div v-show="openSections[secIdx]" class="accordion-content">
        <ToolElement
          v-for="(childEl, childIdx) in (section.content || [])"
          :key="childIdx"
          :element="childEl"
          :state="state"
          @update="(key, val) => $emit('update', key, val)"
          @action="(action, val) => $emit('action', action, val)"
          @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
          @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
          @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
        />
      </div>
    </div>
  </div>

  <!-- Row (horizontal flex) -->
  <div v-else-if="element.type === 'row'" class="layout-row" :class="element.class" :style="rowStyle(element)">
    <div
      v-for="(child, idx) in element.children"
      :key="idx"
      class="row-child"
      :style="{ flex: child.flex || 1 }"
    >
      <ToolElement
        :element="child"
        :state="state"
        @update="(key, val) => $emit('update', key, val)"
        @action="(action, val) => $emit('action', action, val)"
        @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
        @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
        @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
      />
    </div>
  </div>

  <!-- Column (vertical flex) -->
  <div v-else-if="element.type === 'column'" class="layout-column" :class="element.class">
    <ToolElement
      v-for="(child, idx) in element.children"
      :key="idx"
      :element="child"
      :state="state"
      @update="(key, val) => $emit('update', key, val)"
      @action="(action, val) => $emit('action', action, val)"
      @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
      @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
      @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
    />
  </div>

  <!-- Grid -->
  <div v-else-if="element.type === 'grid'" class="layout-grid" :style="gridStyle(element)">
    <div
      v-for="(child, idx) in element.children"
      :key="idx"
      class="grid-child"
      :style="child.gridArea ? { gridArea: child.gridArea } : {}"
    >
      <ToolElement
        :element="child"
        :state="state"
        @update="(key, val) => $emit('update', key, val)"
        @action="(action, val) => $emit('action', action, val)"
        @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
        @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
        @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
      />
    </div>
  </div>

  <!-- Item List (CRUD-optimized) -->
  <div v-else-if="element.type === 'item-list'" class="item-list-container">
    <!-- Empty State -->
    <div v-if="!(getItems(element) || []).length" class="empty-state">
      <div class="empty-icon">{{ element.emptyIcon || '📝' }}</div>
      <div class="empty-text">{{ element.emptyText || 'No items yet' }}</div>
      <div class="empty-hint">{{ element.emptyHint || 'Add your first item above' }}</div>
    </div>

    <!-- Item List -->
    <div v-else class="item-list">
      <div
        v-for="(item, idx) in getItems(element)"
        :key="item.id || idx"
        class="item-row"
        :class="{ 'item-done': item[element.doneKey || 'done'] }"
      >
        <!-- Checkbox -->
        <input
          v-if="element.showCheckbox !== false"
          type="checkbox"
          class="item-checkbox"
          :checked="item[element.doneKey || 'done']"
          @change="$emit('action', element.onToggle || 'toggleItem', item.id || idx)"
        />

        <!-- Content -->
        <div class="item-content">
          <span
            class="item-text"
            :class="{ 'item-text-done': item[element.doneKey || 'done'] }"
          >{{ item[element.textKey || 'text'] || item.title || item.name }}</span>
          <span v-if="element.subtextKey && item[element.subtextKey]" class="item-subtext">
            {{ item[element.subtextKey] }}
          </span>
        </div>

        <!-- Actions -->
        <div class="item-actions">
          <button
            v-if="element.showEdit !== false"
            class="item-action-btn edit"
            @click="$emit('action', element.onEdit || 'editItem', item.id || idx)"
            title="Edit"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            class="item-action-btn delete"
            @click="$emit('action', element.onDelete || 'deleteItem', item.id || idx)"
            title="Delete"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Count Footer -->
    <div v-if="element.showCount !== false && getItems(element)?.length" class="item-count">
      {{ getItemCount(element) }}
    </div>
  </div>

  <!-- Filter Tabs -->
  <div v-else-if="element.type === 'filter-tabs'" class="filter-tabs">
    <button
      v-for="tab in element.tabs"
      :key="tab.value"
      class="filter-tab"
      :class="{ active: state[element.stateKey] === tab.value }"
      @click="$emit('update', element.stateKey, tab.value)"
    >
      {{ tab.label }}
      <span v-if="tab.countKey && state[tab.countKey] !== undefined" class="filter-count">
        {{ state[tab.countKey] }}
      </span>
    </button>
  </div>

  <!-- Inline Add (input + button combined) -->
  <div v-else-if="element.type === 'inline-add'" class="inline-add">
    <input
      type="text"
      class="inline-add-input"
      :placeholder="element.placeholder || 'Add new item...'"
      :value="state[element.stateKey]"
      @input="$emit('update', element.stateKey, $event.target.value)"
      @keydown.enter="$emit('action', element.action || 'addItem')"
    />
    <button
      class="inline-add-btn"
      @click="$emit('action', element.action || 'addItem')"
      :disabled="!state[element.stateKey]?.trim()"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <line x1="12" y1="5" x2="12" y2="19"></line>
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    </button>
  </div>

  <!-- Stats Bar -->
  <div v-else-if="element.type === 'stats-bar'" class="stats-bar">
    <div v-for="stat in element.stats" :key="stat.label" class="stats-bar-item">
      <span class="stats-bar-value">{{ state[stat.stateKey] ?? stat.value ?? 0 }}</span>
      <span class="stats-bar-label">{{ stat.label }}</span>
    </div>
  </div>

  <!-- Tabs -->
  <div v-else-if="element.type === 'tabs'" class="tabs-container">
    <div class="tabs-header">
      <button
        v-for="(tab, tabIdx) in element.tabs"
        :key="tabIdx"
        class="tab-button"
        :class="{ active: activeTab === tabIdx }"
        @click="activeTab = tabIdx"
      >{{ tab.label }}</button>
    </div>
    <div class="tabs-content">
      <ToolElement
        v-for="(childEl, childIdx) in (element.tabs[activeTab]?.content || [])"
        :key="childIdx"
        :element="childEl"
        :state="state"
        @update="(key, val) => $emit('update', key, val)"
        @action="(action, val) => $emit('action', action, val)"
        @toggle-checkbox="(key, val, checked) => $emit('toggle-checkbox', key, val, checked)"
        @toggle-row="(key, idx, col) => $emit('toggle-row', key, idx, col)"
        @step="(key, delta, min, max) => $emit('step', key, delta, min, max)"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'

defineOptions({ name: 'ToolElement' })

const props = defineProps({
  element: {
    type: Object,
    required: true
  },
  state: {
    type: Object,
    required: true
  }
})

defineEmits(['update', 'action', 'toggle-checkbox', 'toggle-row', 'step', 'color-change'])

// Local state for accordion sections
const openSections = reactive({})

function toggleSection(idx) {
  openSections[idx] = !openSections[idx]
}

// Local state for tabs
const activeTab = ref(0)

// Local state for dismissible alerts
const dismissed = ref(false)

// Helper for row layout style
function rowStyle(element) {
  return {
    gap: element.gap || '0.75rem',
    alignItems: element.align || 'stretch',
    justifyContent: element.justify || 'flex-start'
  }
}

// Helper for grid layout style
function gridStyle(element) {
  return {
    gridTemplateColumns: element.columns || 'repeat(2, 1fr)',
    gridTemplateRows: element.rows || 'auto',
    gap: element.gap || '0.75rem'
  }
}

// Helper to get items from state (supports computed keys like 'filteredItems')
function getItems(element) {
  const key = element.itemsKey || element.stateKey || 'items'
  return props.state[key] || []
}

// Helper to format item count
function getItemCount(element) {
  const items = getItems(element)
  const doneKey = element.doneKey || 'done'
  const done = items.filter(i => i[doneKey]).length
  const total = items.length

  if (element.countFormat === 'done') {
    return `${done}/${total} done`
  } else if (element.countFormat === 'remaining') {
    return `${total - done} remaining`
  }
  return `${total} item${total !== 1 ? 's' : ''}`
}
</script>

<style scoped>
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
  background-color: white;
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
  color: #f59e0b;
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
  background-color: #dbeafe;
  color: #1e40af;
  border: 1px solid #93c5fd;
}

.alert-success {
  background-color: #dcfce7;
  color: #166534;
  border: 1px solid #86efac;
}

.alert-warning {
  background-color: #fef3c7;
  color: #92400e;
  border: 1px solid #fcd34d;
}

.alert-error {
  background-color: #fee2e2;
  color: #991b1b;
  border: 1px solid #fca5a5;
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
  background-color: #dcfce7;
  color: #166534;
}

.badge-medium {
  background-color: #fef3c7;
  color: #92400e;
}

.badge-high {
  background-color: #fee2e2;
  color: #991b1b;
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

/* Item List (CRUD-optimized) */
.item-list-container {
  margin-bottom: 0.75rem;
}

.empty-state {
  text-align: center;
  padding: 2rem 1rem;
  color: var(--color-text-muted);
}

.empty-icon {
  font-size: 2.5rem;
  margin-bottom: 0.5rem;
  opacity: 0.5;
}

.empty-text {
  font-size: 1rem;
  font-weight: 500;
  margin-bottom: 0.25rem;
}

.empty-hint {
  font-size: 0.85rem;
  opacity: 0.7;
}

.item-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  background-color: var(--color-bg-elevated);
  border-radius: 6px;
  transition: background-color 0.15s;
}

.item-row:hover {
  background-color: var(--color-bg-hover);
}

.item-row.item-done {
  opacity: 0.6;
}

.item-checkbox {
  width: 18px;
  height: 18px;
  cursor: pointer;
  accent-color: var(--color-primary);
  flex-shrink: 0;
}

.item-content {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.item-text {
  font-size: 0.95rem;
  color: var(--color-text-base);
  word-break: break-word;
}

.item-text-done {
  text-decoration: line-through;
  color: var(--color-text-muted);
}

.item-subtext {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

.item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.item-row:hover .item-actions {
  opacity: 1;
}

.item-action-btn {
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--color-text-muted);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, color 0.15s;
}

.item-action-btn:hover {
  background-color: var(--color-bg-secondary);
}

.item-action-btn.edit:hover {
  color: var(--color-primary);
}

.item-action-btn.delete:hover {
  color: var(--color-error-text);
  background-color: var(--color-error-bg);
}

.item-count {
  text-align: center;
  padding: 0.5rem;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border-subtle);
  margin-top: 0.5rem;
}

/* Filter Tabs */
.filter-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.filter-tab {
  flex: 1;
  padding: 0.5rem 0.75rem;
  border: none;
  border-radius: 6px;
  background: none;
  color: var(--color-text-muted);
  font-size: 0.85rem;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.filter-tab:hover {
  color: var(--color-text-base);
}

.filter-tab.active {
  background-color: var(--color-bg-elevated);
  color: var(--color-text-strong);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.filter-count {
  font-size: 0.75rem;
  padding: 0.1rem 0.4rem;
  background-color: var(--color-bg-secondary);
  border-radius: 10px;
  min-width: 1.25rem;
  text-align: center;
}

.filter-tab.active .filter-count {
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
}

/* Inline Add */
.inline-add {
  display: flex;
  gap: 0;
  margin-bottom: 0.75rem;
}

.inline-add-input {
  flex: 1;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  border: 1px solid var(--color-border-input);
  border-right: none;
  border-radius: 8px 0 0 8px;
  background-color: var(--color-bg-input);
  color: var(--color-text-base);
}

.inline-add-input:focus {
  outline: none;
  border-color: var(--color-primary);
}

.inline-add-input:focus + .inline-add-btn {
  border-color: var(--color-primary);
}

.inline-add-btn {
  padding: 0.75rem 1rem;
  border: 1px solid var(--color-border-input);
  border-radius: 0 8px 8px 0;
  background-color: var(--color-primary);
  color: var(--color-text-inverse);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background-color 0.15s, opacity 0.15s;
}

.inline-add-btn:hover:not(:disabled) {
  background-color: var(--color-primary-hover);
}

.inline-add-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Stats Bar */
.stats-bar {
  display: flex;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background-color: var(--color-bg-secondary);
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.stats-bar-item {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
}

.stats-bar-value {
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--color-text-strong);
}

.stats-bar-label {
  font-size: 0.8rem;
  color: var(--color-text-muted);
}

/* Layout: Row */
.layout-row {
  display: flex;
  flex-direction: row;
  margin-bottom: 0.75rem;
}

.row-child {
  min-width: 0; /* Allow children to shrink */
}

.layout-row.wrap {
  flex-wrap: wrap;
}

.layout-row.center {
  align-items: center;
}

.layout-row.end {
  justify-content: flex-end;
}

.layout-row.space-between {
  justify-content: space-between;
}

/* Layout: Column */
.layout-column {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 0.75rem;
}

/* Layout: Grid */
.layout-grid {
  display: grid;
  margin-bottom: 0.75rem;
}

.grid-child {
  min-width: 0; /* Allow children to shrink */
}
</style>
