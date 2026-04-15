<template>
  <div class="collapse-wrapper">
    <div class="collapse-row">
      <button @click="$emit('toggle')" class="collapse-btn" :title="isCollapsed ? 'Expand' : 'Collapse'">
        <svg class="collapse-icon" :class="{ collapsed: isCollapsed }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <span class="collapsed-label" @click="$emit('toggle')">{{ label }}</span>
    </div>
    <Transition name="collapse">
      <div v-if="!isCollapsed" class="collapse-content">
        <slot></slot>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  isCollapsed: boolean
  label: string
}>()

defineEmits<{ toggle: [] }>()
</script>

<style scoped>
.collapse-wrapper { display: flex; flex-direction: column; gap: 4px; }
.collapse-row { display: flex; align-items: center; gap: 6px; }
.collapse-btn { background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted, #888); opacity: 0.5; transition: opacity 0.2s; }
.collapse-btn:hover { opacity: 1; }
.collapse-icon { transition: transform 0.2s ease; }
.collapse-icon.collapsed { transform: rotate(-180deg); }
.collapsed-label { font-size: 13px; color: var(--color-text-muted, #888); cursor: pointer; font-style: italic; }
.collapsed-label:hover { color: var(--color-text, #333); }
.collapse-content { transform-origin: top; }
.collapse-enter-active, .collapse-leave-active { transition: opacity 0.2s ease, transform 0.2s ease; }
.collapse-enter-from, .collapse-leave-to { opacity: 0; transform: translateY(-8px); }
</style>
