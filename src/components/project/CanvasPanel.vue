<template>
  <div class="canvas-panel">
    <div v-if="windows.length === 0" class="canvas-empty">
      <div class="empty-icon">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="3" y1="9" x2="21" y2="9"></line>
          <line x1="9" y1="21" x2="9" y2="9"></line>
        </svg>
      </div>
      <p>Canvas Area</p>
      <p class="hint">Windows will appear here</p>
    </div>
    <div class="minimized-bar">
      <GlobalToolMenu @select="(t) => $emit('instantiate-tool', t)" />
      <div v-if="windows.length" class="minimized-separator" />
      <template v-for="win in windows" :key="win.id">
        <button
          :class="['minimized-chip', { active: win.displayState === 'open' }]"
          :title="win.title"
          @click="$emit('toggle-window', win.id)"
        >
          <span class="chip-title">{{ win.title }}</span>
        </button>
      </template>
    </div>
    <OutputWindow
      v-for="win in openWindows"
      :key="win.id"
      :window="win"
      @close="$emit('close-window', win.id)"
      @minimize="$emit('minimize-window', win.id)"
      @update:position="(pos) => $emit('update-position', win.id, pos)"
      @update:size="(size) => $emit('update-size', win.id, size)"
      @update:title="(title) => $emit('update-title', win.id, title)"
      @bring-to-front="$emit('bring-to-front', win.id)"
      @clone="$emit('clone-window', win)"
      @delete="(id) => $emit('delete-window', id)"
      @update:code="(code) => $emit('update-code', win.id, code)"
      @promote="(win) => $emit('promote-tool', win)"
      @revert="(id) => $emit('revert-window', id)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OutputWindow from './OutputWindow.vue'
import GlobalToolMenu from './GlobalToolMenu.vue'
import type { ProjectWindow } from '@/types/project'
import type { ToolTemplate } from '@/types/tool'

const props = defineProps<{
  windows: ProjectWindow[]
  sessionId: string
}>()

defineEmits<{
  'close-window': [windowId: string]
  'minimize-window': [windowId: string]
  'restore-window': [windowId: string]
  'toggle-window': [windowId: string]
  'update-position': [windowId: string, position: { x: number; y: number }]
  'update-size': [windowId: string, size: { width: number; height: number }]
  'update-title': [windowId: string, title: string]
  'update-code': [windowId: string, code: string]
  'bring-to-front': [windowId: string]
  'clone-window': [window: ProjectWindow]
  'delete-window': [windowId: string]
  'instantiate-tool': [template: ToolTemplate]
  'promote-tool': [window: ProjectWindow]
  'revert-window': [windowId: string]
}>()

const openWindows = computed(() =>
  [...props.windows].filter(w => w.displayState === 'open').sort((a, b) => a.zIndex - b.zIndex)
)
</script>

<style scoped>
.canvas-panel { position: relative; width: 100%; height: 100%; background-color: var(--color-bg-page); background-image: radial-gradient(var(--color-border-subtle) 1px, transparent 1px); background-size: 20px 20px; overflow: hidden; display: flex; flex-direction: column; }
.canvas-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; color: var(--color-text-muted); cursor: pointer; user-select: none; }
.empty-icon { opacity: 0.2; margin-bottom: 1rem; }
.canvas-empty p { margin: 0; font-family: system-ui, sans-serif; font-size: 0.95rem; }
.canvas-empty .hint { font-size: 0.85rem; opacity: 0.6; margin-top: 0.5rem; }

.minimized-bar {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.3rem 0.5rem;
  background: var(--color-bg-base);
  border-bottom: 1px solid var(--color-border-subtle);
  flex-shrink: 0;
  overflow-x: auto;
  scrollbar-width: none;
}
.minimized-bar::-webkit-scrollbar { display: none; }
.minimized-separator {
  width: 1px;
  height: 16px;
  background: var(--color-border-subtle);
  flex-shrink: 0;
}
.minimized-chip {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.25rem 0.5rem;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.7rem;
  white-space: nowrap;
  transition: all 0.15s;
  flex-shrink: 0;
}
.minimized-chip:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-base);
  color: var(--color-text-base);
}
.minimized-chip.active {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-text-base);
}
.chip-title {
  max-width: 100px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.chip-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 14px;
  height: 14px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.85rem;
  line-height: 1;
  border-radius: 2px;
  opacity: 0;
  transition: all 0.1s;
}
.minimized-chip:hover .chip-close { opacity: 0.6; }
.chip-close:hover { opacity: 1 !important; background: var(--color-error-subtle, #fee2e2); color: var(--color-error, #ef4444); }
</style>
