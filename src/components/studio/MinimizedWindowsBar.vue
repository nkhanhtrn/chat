<template>
  <div v-if="categories.length > 0" class="minimized-bar">
    <div class="bar-content">
      <div
        v-for="category in categories"
        :key="category.type"
        class="category-chip"
        :class="{ expanded: expandedCategory === category.type }"
      >
        <button
          class="chip-button"
          @click="toggleCategory(category.type)"
        >
          <span class="chip-icon">{{ category.icon }}</span>
          <span class="chip-label">{{ category.name }}</span>
          <span class="chip-count">{{ category.windows.length }}</span>
          <svg class="chevron" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
        </button>

        <!-- Dropdown -->
        <Transition name="dropdown">
          <div v-if="expandedCategory === category.type" class="dropdown">
            <div class="dropdown-content">
              <div
                v-for="win in category.windows"
                :key="win.id"
                class="window-item"
                @click="handleRestore(win.id)"
              >
                <span class="window-icon">{{ win.content?.emoji || category.icon }}</span>
                <span class="window-title">{{ win.title }}</span>
                <button
                  class="window-close"
                  @click.stop="$emit('close', win.id)"
                  title="Close"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const props = defineProps({
  categories: { type: Array, default: () => [] }
})

const emit = defineEmits(['restore', 'close'])

const _expandedCategory = ref(null)

// Auto-clears if category no longer exists
const expandedCategory = computed({
  get() {
    const val = _expandedCategory.value
    if (!val) return null
    const exists = props.categories.some(c => c.type === val)
    return exists ? val : null
  },
  set(val) {
    _expandedCategory.value = val
  }
})

function toggleCategory(type) {
  expandedCategory.value = expandedCategory.value === type ? null : type
}

function handleRestore(windowId) {
  emit('restore', windowId)
  expandedCategory.value = null
}
</script>

<style scoped>
.minimized-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  padding: 0.5rem;
  z-index: 1000;
  pointer-events: none;
}

.bar-content {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  gap: 0.25rem;
  pointer-events: auto;
}

.category-chip {
  position: relative;
}

.chip-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  cursor: pointer;
  transition: all 0.15s;
}

.chip-button:hover {
  background: var(--color-bg-hover);
}

.category-chip.expanded .chip-button {
  background: var(--color-bg-hover);
  border-color: var(--color-border-strong, var(--color-border-base));
}

.chip-icon {
  font-size: 0.875rem;
}

.chip-label {
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--color-text-base);
}

.chip-count {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  font-size: 0.7rem;
  font-weight: 600;
  background: var(--color-primary, #3b82f6);
  color: white;
}

.chevron {
  color: var(--color-text-muted);
  transition: transform 0.15s;
}

.category-chip.expanded .chevron {
  transform: rotate(180deg);
}

/* Dropdown */
.dropdown {
  position: absolute;
  bottom: calc(100% + 2px);
  left: 0;
  min-width: 200px;
  max-width: 280px;
  background: var(--color-bg-base);
  border: 1px solid var(--color-border-base);
  overflow: hidden;
}

.dropdown-content {
  max-height: 300px;
  overflow-y: auto;
}

.window-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}

.window-item:hover {
  background: var(--color-bg-hover);
}

.window-icon {
  font-size: 0.875rem;
  flex-shrink: 0;
}

.window-title {
  flex: 1;
  font-size: 0.8rem;
  color: var(--color-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.window-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  cursor: pointer;
  color: var(--color-text-muted);
  opacity: 0;
  transition: all 0.15s;
  flex-shrink: 0;
}

.window-item:hover .window-close {
  opacity: 1;
}

.window-close:hover {
  background: var(--color-error-subtle, #fee2e2);
  color: var(--color-error, #ef4444);
}

/* Dropdown animation */
.dropdown-enter-active,
.dropdown-leave-active {
  transition: all 0.15s ease;
}

.dropdown-enter-from,
.dropdown-leave-to {
  opacity: 0;
  transform: translateY(4px);
}
</style>
