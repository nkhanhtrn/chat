<template>
  <button
    type="button"
    class="collapse-toggle"
    :class="{ collapsed }"
    :title="collapsed ? 'Expand' : 'Collapse'"
    :aria-expanded="!collapsed"
    @click.stop="$emit('toggle')"
  >
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="6 9 12 15 18 9"></polyline>
    </svg>
  </button>
</template>

<script setup lang="ts">
defineProps<{ collapsed?: boolean }>()
defineEmits<{ toggle: [] }>()
</script>

<style scoped>
.collapse-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 2px;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 3px;
  transition: all 0.15s;
  flex-shrink: 0;
  vertical-align: middle;
}
.collapse-toggle svg { width: 12px; height: 12px; transition: transform 0.15s ease; display: block; }
.collapse-toggle:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.collapse-toggle.collapsed svg { transform: rotate(-90deg); }
</style>
