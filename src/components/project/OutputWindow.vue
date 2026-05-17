<template>
  <div
    v-if="window.displayState === 'open'"
    class="output-window"
    :style="windowStyle"
    @mousedown="$emit('bring-to-front')"
  >
    <div class="window-header" @mousedown.left="startDrag">
      <div class="window-title-area">
        <InlineEdit
          :modelValue="window.title"
          @save="(newTitle: string) => $emit('update:title', newTitle)"
        />
      </div>
      <div class="window-controls" @mousedown.stop>
        <button class="control-btn" @click="$emit('clone', window)" title="Clone">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
        </button>
        <button class="control-btn" @click="$emit('minimize')" title="Minimize">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="5" y1="12" x2="19" y2="12"></line>
          </svg>
        </button>
        <button class="control-btn close" @click="$emit('close')" title="Close">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
    </div>
    <div class="resize-handle right" @mousedown.left.stop="startResize('e', $event)"></div>
    <div class="resize-handle bottom" @mousedown.left.stop="startResize('s', $event)"></div>
    <div class="resize-handle corner" @mousedown.left.stop="startResize('se', $event)"></div>
    <div class="window-body">
      <CodeDisplay v-if="window.type === 'code' || window.type === 'html'" :content="window.content" :language="window.type === 'html' ? 'html' : 'javascript'" />
      <div v-else class="window-placeholder">
        <p>{{ window.type }} window</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import InlineEdit from '@/components/InlineEdit.vue'
import CodeDisplay from './CodeDisplay.vue'
import type { ProjectWindow } from '@/types/project'

const props = defineProps<{
  window: ProjectWindow
}>()

const emit = defineEmits<{
  close: []
  minimize: []
  'update:position': [position: { x: number; y: number }]
  'update:size': [size: { width: number; height: number }]
  'update:title': [title: string]
  'bring-to-front': []
  clone: [window: ProjectWindow]
}>()

const windowStyle = computed(() => ({
  left: `${props.window.position.x}px`,
  top: `${props.window.position.y}px`,
  width: `${props.window.size.width}px`,
  height: `${props.window.size.height}px`,
  zIndex: props.window.zIndex,
}))

function startDrag(e: MouseEvent) {
  const startX = e.clientX
  const startY = e.clientY
  const startPos = { ...props.window.position }

  function onMouseMove(e: MouseEvent) {
    emit('update:position', {
      x: startPos.x + (e.clientX - startX),
      y: startPos.y + (e.clientY - startY),
    })
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function startResize(direction: string, e: MouseEvent) {
  const startX = e.clientX
  const startY = e.clientY
  const startSize = { ...props.window.size }

  function onMouseMove(e: MouseEvent) {
    const newWidth = Math.max(200, startSize.width + (e.clientX - startX))
    const newHeight = Math.max(100, startSize.height + (e.clientY - startY))
    emit('update:size', { width: newWidth, height: newHeight })
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove)
    document.removeEventListener('mouseup', onMouseUp)
  }

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}
</script>

<style scoped>
.output-window { position: absolute; display: flex; flex-direction: column; background: var(--color-bg-page); border: 1px solid var(--color-border-base); box-shadow: 0 4px 20px var(--shadow-primary); min-width: 200px; min-height: 100px; }
.window-header { display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; background: var(--color-bg-base); border-bottom: 1px solid var(--color-border-base); cursor: grab; user-select: none; flex-shrink: 0; }
.window-header:active { cursor: grabbing; }
.window-title-area { flex: 1; min-width: 0; font-size: 0.8rem; font-family: system-ui, sans-serif; font-weight: 500; color: var(--color-text-base); }
.window-title-area :deep(.inline-edit-wrapper) { width: 100%; }
.window-title-area :deep(.inline-edit-text) { display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.8rem; }
.window-title-area :deep(.inline-edit-input) { font-size: 0.8rem; width: 100%; padding: 2px 4px; }
.window-controls { display: flex; gap: 0.25rem; flex-shrink: 0; }
.control-btn { display: flex; align-items: center; justify-content: center; width: 22px; height: 22px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; }
.control-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.control-btn.close:hover { background: var(--color-error-subtle, #fee2e2); color: var(--color-error, #ef4444); }
.resize-handle { position: absolute; }
.resize-handle.right { top: 0; right: -3px; width: 6px; height: 100%; cursor: ew-resize; }
.resize-handle.bottom { bottom: -3px; left: 0; width: 100%; height: 6px; cursor: ns-resize; }
.resize-handle.corner { bottom: -3px; right: -3px; width: 12px; height: 12px; cursor: nwse-resize; }
.window-body { flex: 1; overflow: auto; position: relative; }
.window-placeholder { display: flex; align-items: center; justify-content: center; height: 100%; color: var(--color-text-muted); font-family: system-ui, sans-serif; font-size: 0.85rem; }
</style>
