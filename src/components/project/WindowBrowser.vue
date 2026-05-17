<template>
  <div class="window-browser" @click.self="$emit('close')">
    <div class="browser-panel">
      <div class="browser-header">
        <h3>Windows</h3>
        <button class="close-btn" @click="$emit('close')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div class="browser-list">
        <div v-for="win in windows" :key="win.id" class="browser-item" :class="{ minimized: win.displayState === 'minimized', closed: win.displayState === 'closed' }">
          <div class="item-info">
            <div class="item-icon">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </div>
            <InlineEdit
              :modelValue="win.title"
              @save="(newTitle: string) => $emit('rename', win.id, newTitle)"
            />
          </div>
          <div class="item-actions">
            <button v-if="win.displayState !== 'open'" class="action-btn" @click="$emit('restore', win.id)" title="Restore">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <path d="M21 3l-7 7"></path>
              </svg>
            </button>
            <button class="action-btn delete" @click="$emit('delete', win.id)" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="3 6 5 6 21 6"></polyline>
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
          </div>
        </div>
        <div v-if="windows.length === 0" class="empty">No windows</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import InlineEdit from '@/components/InlineEdit.vue'
import type { ProjectWindow } from '@/types/project'

defineProps<{
  windows: ProjectWindow[]
}>()

defineEmits<{
  close: []
  restore: [windowId: string]
  delete: [windowId: string]
  rename: [windowId: string, title: string]
}>()
</script>

<style scoped>
.window-browser { position: absolute; inset: 0; background: rgba(0, 0, 0, 0.3); z-index: 10000; display: flex; align-items: center; justify-content: center; }
.browser-panel { background: var(--color-bg-page); border: 1px solid var(--color-border-base); box-shadow: 0 8px 32px var(--shadow-primary); width: 90%; max-width: 500px; max-height: 80%; display: flex; flex-direction: column; }
.browser-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; border-bottom: 1px solid var(--color-border-base); }
.browser-header h3 { margin: 0; font-size: 0.9rem; font-weight: 600; color: var(--color-text-base); font-family: system-ui, sans-serif; }
.close-btn { display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
.close-btn:hover { color: var(--color-text-base); background: var(--color-bg-hover); }
.browser-list { overflow-y: auto; padding: 0.5rem; }
.browser-item { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border-subtle); }
.browser-item:last-child { border-bottom: none; }
.browser-item.minimized { opacity: 0.7; }
.browser-item.closed { opacity: 0.5; }
.item-info { display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 0; font-size: 0.85rem; }
.item-info :deep(.inline-edit-wrapper) { width: 100%; }
.item-info :deep(.inline-edit-text) { font-size: 0.85rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-info :deep(.inline-edit-input) { font-size: 0.85rem; width: 100%; padding: 2px 4px; }
.item-icon { color: var(--color-text-muted); flex-shrink: 0; }
.item-actions { display: flex; gap: 0.25rem; flex-shrink: 0; }
.action-btn { display: flex; align-items: center; justify-content: center; width: 26px; height: 26px; padding: 0; background: none; border: none; color: var(--color-text-muted); cursor: pointer; }
.action-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.action-btn.delete:hover { background: var(--color-error-subtle, #fee2e2); color: var(--color-error, #ef4444); }
.empty { padding: 2rem; text-align: center; color: var(--color-text-muted); font-size: 0.85rem; font-family: system-ui, sans-serif; }
</style>
