<template>
  <div v-if="windows.length > 0" class="minimized-bar">
    <button
      v-for="win in windows"
      :key="win.id"
      class="minimized-tab"
      @click="$emit('restore', win.id)"
      :title="win.title"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
      </svg>
      <span class="tab-title">{{ win.title }}</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import type { ProjectWindow } from '@/types/project'

defineProps<{
  windows: ProjectWindow[]
}>()

defineEmits<{
  restore: [windowId: string]
}>()
</script>

<style scoped>
.minimized-bar { position: absolute; bottom: 0; left: 0; right: 0; display: flex; gap: 2px; padding: 0.5rem; background: var(--color-bg-base); border-top: 1px solid var(--color-border-base); z-index: 9999; }
.minimized-tab { display: flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.6rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); color: var(--color-text-base); font-size: 0.75rem; font-family: system-ui, sans-serif; cursor: pointer; transition: all 0.15s; max-width: 160px; }
.minimized-tab:hover { border-color: var(--color-border-accent); background: var(--color-bg-hover); }
.tab-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
</style>
