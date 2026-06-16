<template>
  <div class="subproject-home">
    <div class="home-header">
      <h3>Subprojects</h3>
      <span class="count">{{ subprojects.length }}</span>
    </div>
    <div class="subproject-list">
      <div
        v-for="(sub, i) in subprojects"
        :key="sub.id"
        class="subproject-item"
        :data-index="i"
        :class="{
          closed: isClosed(sub.id),
          'drag-over-top': dragOverIndex === i && dragOverSide === 'top',
          'drag-over-bottom': dragOverIndex === i && dragOverSide === 'bottom',
          'is-dragging': draggedId === sub.id,
        }"
        draggable="true"
        @dragstart="onDragStart($event, sub.id)"
        @dragend="onDragEnd"
        @dragover.prevent="onDragOver($event, i)"
        @dragleave="onDragLeave"
        @drop.prevent="onDrop($event, i)"
        @pointerdown="handleSubPointerDown($event, sub.id)"
      >
        <div class="item-drag-handle" title="Drag to reorder">⋮⋮</div>
        <div class="item-info" @click="$emit('open-subproject', sub.id)">
          <span class="item-name">{{ sub.name }}</span>
          <span class="item-date">{{ formatDate(sub.createdAt) }}</span>
        </div>
        <div class="item-actions">
          <button
            class="action-btn delete-btn"
            :disabled="subprojects.length <= 1"
            @click.stop="handleDelete(sub)"
            :title="subprojects.length <= 1 ? 'Cannot delete last subproject' : 'Delete'"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      </div>
    </div>
    <Modal :visible="confirmDelete !== null" title="Delete subproject" size="small" @close="confirmDelete = null">
      <p>Delete "{{ confirmDelete?.name }}"? This cannot be undone.</p>
      <template #footer>
        <button class="modal-btn cancel" @click="confirmDelete = null">Cancel</button>
        <button class="modal-btn danger" @click="confirmDeleteAction">Delete</button>
      </template>
    </Modal>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Modal from '@/components/modal/Modal.vue'
import type { SubProject } from '@/types/project'

const props = defineProps<{
  subprojects: SubProject[]
  closedIds: string[]
}>()

const emit = defineEmits<{
  'open-subproject': [subprojectId: string]
  'delete-subproject': [subprojectId: string]
  'reorder-subprojects': [orderedIds: string[]]
}>()

const confirmDelete = ref<SubProject | null>(null)

function isClosed(id: string) {
  return props.closedIds.includes(id)
}

function formatDate(ts: number) {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function handleDelete(sub: SubProject) {
  if (props.subprojects.length <= 1) return
  confirmDelete.value = sub
}

function confirmDeleteAction() {
  if (confirmDelete.value) {
    emit('delete-subproject', confirmDelete.value.id)
    confirmDelete.value = null
  }
}

const draggedId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const dragOverSide = ref<'top' | 'bottom' | null>(null)

function onDragStart(e: DragEvent, id: string) {
  draggedId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragEnd() {
  draggedId.value = null
  dragOverIndex.value = null
  dragOverSide.value = null
}

function onDragOver(e: DragEvent, index: number) {
  if (!draggedId.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midY = rect.top + rect.height / 2
  dragOverIndex.value = index
  dragOverSide.value = e.clientY < midY ? 'top' : 'bottom'
}

function onDragLeave() {
  dragOverIndex.value = null
  dragOverSide.value = null
}

function onDrop(_e: DragEvent, dropIndex: number) {
  if (!draggedId.value) return
  const ids = props.subprojects.map(s => s.id)
  const fromIdx = ids.indexOf(draggedId.value!)
  if (fromIdx === -1) { onDragEnd(); return }
  const toIdx = dragOverSide.value === 'top' ? dropIndex : dropIndex + 1
  ids.splice(fromIdx, 1)
  const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx
  ids.splice(adjustedTo, 0, draggedId.value!)
  emit('reorder-subprojects', ids)
  onDragEnd()
}

function handleSubPointerDown(e: PointerEvent, id: string) {
  if (e.pointerType !== 'touch') return
  const startY = e.clientY
  let started = false

  function onMove(ev: PointerEvent) {
    if (!started) {
      if (Math.abs(ev.clientY - startY) < 5) return
      started = true
      draggedId.value = id
    }
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
    const item = el?.closest('.subproject-item') as HTMLElement | null
    if (item) {
      const itemIndex = parseInt(item.dataset.index ?? '', 10)
      if (!isNaN(itemIndex)) {
        const rect = item.getBoundingClientRect()
        dragOverIndex.value = itemIndex
        dragOverSide.value = ev.clientY < rect.top + rect.height / 2 ? 'top' : 'bottom'
      }
    }
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (started && dragOverIndex.value !== null) {
      const ids = props.subprojects.map(s => s.id)
      const fromIdx = ids.indexOf(id)
      if (fromIdx !== -1) {
        const toIdx = dragOverSide.value === 'top' ? dragOverIndex.value : dragOverIndex.value + 1
        ids.splice(fromIdx, 1)
        const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx
        ids.splice(adjustedTo, 0, id)
        emit('reorder-subprojects', ids)
      }
    }
    onDragEnd()
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
</script>

<style scoped>
.subproject-home {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 0.75rem;
}
.home-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
}
.home-header h3 {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.count {
  font-size: 0.7rem;
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  padding: 0.1rem 0.4rem;
  border-radius: 8px;
}
.subproject-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.subproject-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.5rem;
  border-radius: 6px;
  border: 1px solid transparent;
  transition: all 0.15s;
  position: relative;
}
.subproject-item:hover {
  background: var(--color-bg-hover);
}
.subproject-item.closed {
  opacity: 0.6;
}
.subproject-item.is-dragging {
  opacity: 0.3;
}
.subproject-item.drag-over-top {
  border-top: 2px solid var(--color-primary);
}
.subproject-item.drag-over-bottom {
  border-bottom: 2px solid var(--color-primary);
}
.item-drag-handle {
  cursor: grab;
  color: var(--color-text-muted);
  font-size: 0.7rem;
  user-select: none;
  opacity: 0.4;
  transition: opacity 0.15s;
}
.subproject-item:hover .item-drag-handle {
  opacity: 0.8;
}
.item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  cursor: pointer;
}
.item-name {
  font-size: 0.85rem;
  color: var(--color-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.item-date {
  font-size: 0.7rem;
  color: var(--color-text-muted);
}
.item-badge {
  font-size: 0.65rem;
  padding: 0.1rem 0.4rem;
  border-radius: 4px;
  background: var(--color-bg-hover);
  color: var(--color-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.item-actions {
  display: flex;
  gap: 0.25rem;
  opacity: 0;
  transition: opacity 0.15s;
}
.subproject-item:hover .item-actions {
  opacity: 1;
}
.action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  transition: all 0.15s;
}
.action-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
.action-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.delete-btn:hover:not(:disabled) {
  color: var(--color-error, #ef4444);
  background: var(--color-error-subtle, #fee2e2);
}
.modal-btn {
  padding: 0.4rem 0.8rem;
  border-radius: 4px;
  border: 1px solid var(--color-border-base);
  background: var(--color-bg-base);
  color: var(--color-text-base);
  cursor: pointer;
  font-size: 0.8rem;
  transition: all 0.15s;
}
.modal-btn.danger {
  background: var(--color-error, #ef4444);
  color: white;
  border-color: var(--color-error, #ef4444);
}
.modal-btn.danger:hover {
  opacity: 0.9;
}
.modal-btn.cancel:hover {
  background: var(--color-bg-hover);
}
</style>
