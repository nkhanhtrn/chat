<template>
  <div class="collapsible-block-wrapper">
    <div class="collapsible-header" @click="toggleCollapse">
      <button class="collapse-btn" :title="isCollapsed ? 'Expand' : 'Collapse'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline v-if="isCollapsed" points="6 9 12 15 18 9"></polyline>
          <polyline v-else points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <span class="collapse-label">{{ isCollapsed ? 'Show hidden content' : 'Hide content' }}</span>
    </div>
    <div v-show="!isCollapsed" class="collapsible-content">
      <slot>{{ content }}</slot>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CollapsibleBlock',
  props: {
    content: {
      type: String,
      default: ''
    }
  },
  data() {
    return {
      isCollapsed: true
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
    }
  }
}
</script>

<style scoped>
.collapsible-block-wrapper {
  margin: 12px 0;
  border: 1px solid var(--color-border, #e0e0e0);
  border-radius: 6px;
  overflow: hidden;
}

.collapsible-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  background-color: var(--color-bg-secondary, #f5f5f5);
  cursor: pointer;
  user-select: none;
}

.collapsible-header:hover {
  background-color: var(--color-bg-hover, #ebebeb);
}

.collapse-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #888);
  transition: color 0.2s;
}

.collapse-label {
  font-size: 13px;
  color: var(--color-text-muted, #888);
  font-style: italic;
}

.collapsible-content {
  padding: 12px 16px;
  background-color: var(--color-bg, #fff);
}
</style>
