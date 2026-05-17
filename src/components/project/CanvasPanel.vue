<template>
  <div class="canvas-panel" @click.self="$emit('browse-windows')">
    <div v-if="windows.length === 0" class="canvas-empty" @click="$emit('browse-windows')">
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
    <OutputWindow
      v-for="win in sortedWindows"
      :key="win.id"
      :window="win"
      @close="$emit('close-window', win.id)"
      @minimize="$emit('minimize-window', win.id)"
      @update:position="(pos) => $emit('update-position', win.id, pos)"
      @update:size="(size) => $emit('update-size', win.id, size)"
      @update:title="(title) => $emit('update-title', win.id, title)"
      @bring-to-front="$emit('bring-to-front', win.id)"
      @clone="$emit('clone-window', win)"
    />
    <MinimizedWindowsBar
      :windows="minimizedWindows"
      @restore="$emit('restore-window', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import OutputWindow from './OutputWindow.vue'
import MinimizedWindowsBar from './MinimizedWindowsBar.vue'
import type { ProjectWindow } from '@/types/project'

const props = defineProps<{
  windows: ProjectWindow[]
  sessionId: string
}>()

defineEmits<{
  'close-window': [windowId: string]
  'minimize-window': [windowId: string]
  'restore-window': [windowId: string]
  'update-position': [windowId: string, position: { x: number; y: number }]
  'update-size': [windowId: string, size: { width: number; height: number }]
  'update-title': [windowId: string, title: string]
  'bring-to-front': [windowId: string]
  'clone-window': [window: ProjectWindow]
  'browse-windows': []
}>()

const sortedWindows = computed(() =>
  [...props.windows].sort((a, b) => a.zIndex - b.zIndex)
)

const minimizedWindows = computed(() =>
  props.windows.filter(w => w.displayState === 'minimized')
)
</script>

<style scoped>
.canvas-panel { position: relative; width: 100%; height: 100%; background-color: var(--color-bg-page); overflow: hidden; }
.canvas-empty { display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); cursor: pointer; user-select: none; }
.empty-icon { opacity: 0.2; margin-bottom: 1rem; }
.canvas-empty p { margin: 0; font-family: system-ui, sans-serif; font-size: 0.95rem; }
.canvas-empty .hint { font-size: 0.85rem; opacity: 0.6; margin-top: 0.5rem; }
</style>
