<template>
  <div
    class="tree-item-container"
    :class="{
      'drop-above': !hideDropZones && dropTarget?.id === item.id && dropTarget?.position === 'above',
      'drop-below': !hideDropZones && dropTarget?.id === item.id && dropTarget?.position === 'below',
    }"
    @dragover.prevent="handleDragOverItem"
    @dragleave="handleDragLeave"
    @drop="handleDropOnItem"
  >
    <div
      ref="treeItemRef"
      :class="['tree-item', itemClass, {
        active: isActive,
        'is-dragging': draggedItem?.id === item.id,
        'is-editing': isEditing,
      }]"
      :draggable="isDraggable && !isEditing"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click="handleClick"
      @touchstart="handleTouchStart"
    >
      <div v-if="!isEditing" class="drag-handle" title="Drag to reorder">⋮⋮</div>

      <div v-if="!isEditing" class="tree-item-text-wrapper">
        <span class="tree-item-text">{{ item.questionSummarized || item.question }}</span>
      </div>
      <div v-else ref="editWrapperRef" class="inline-edit-wrapper" @click.stop>
        <input
          ref="editInputRef"
          v-model="editText"
          @keydown.enter="finishEditing"
          @keydown.esc="cancelEditing"
          @blur="onEditBlur"
          class="inline-edit-input"
          type="text"
        />
        <div class="inline-edit-buttons">
          <button class="inline-edit-btn save-btn" @click.stop="finishEditing" :disabled="!editText.trim()" title="Save">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
          </button>
          <button class="inline-edit-btn cancel-btn" @click.stop="cancelEditing" title="Cancel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>
      </div>

      <div v-if="!isEditing" class="tree-item-actions">
        <button class="tree-item-action-btn" @click.stop="startEditing" title="Rename">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
        </button>
        <button class="tree-item-action-btn" @click.stop="emit('delete', item)" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>
    </div>

    <div v-if="$slots.children && isExpanded" class="tree-children">
      <slot name="children"></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { inject, ref, nextTick, onUnmounted } from 'vue'
import { useMessageTreeStore } from '@/stores/messageTree'
import { startTouchDrag, moveTouchDrag, endTouchDrag, cancelTouchDrag } from '@/utils/touchDrag'

interface TreeItem {
  id: string
  question: string
  questionSummarized?: string | null
  [key: string]: unknown
}

interface DropData {
  messageId: string
  targetId: string
  position: 'above' | 'below'
  targetIndex: number
  targetParentId: string | null
}

const props = withDefaults(defineProps<{
  item: TreeItem
  index: number
  parentId?: string | null
  isActive?: boolean
  isExpanded?: boolean
  isDraggable?: boolean
  hideDropZones?: boolean
  itemClass?: string
}>(), {
  parentId: null,
  isActive: false,
  isExpanded: false,
  isDraggable: true,
  hideDropZones: false,
  itemClass: '',
})

const emit = defineEmits<{
  click: [item: TreeItem]
  delete: [item: TreeItem]
  drop: [data: DropData]
  rename: [item: TreeItem, text: string]
}>()

const treeStore = useMessageTreeStore()
const draggedItem = inject<{ value: { id: string; parentId: string | null } | null }>('draggedItem')!
const dropTarget = inject<{ value: { id: string; position: string; parentId: string | null } | null }>('dropTarget')!

const treeItemRef = ref<HTMLElement | null>(null)

// ── Drag & Drop ────────────────────────────────────────

function handleDragStart(event: DragEvent) {
  draggedItem.value = { id: props.item.id, parentId: props.parentId ?? null }
  event.dataTransfer!.effectAllowed = 'copyMove'
  event.dataTransfer!.setData('text/plain', props.item.id)
  event.dataTransfer!.setData('application/x-question-context', JSON.stringify({ messageId: props.item.id }))
}

function handleDragEnd() {
  draggedItem.value = null
  dropTarget.value = null
}

function handleDragOverItem(event: DragEvent) {
  if (props.hideDropZones) return
  if (draggedItem.value?.id === props.item.id) return
  if (!treeItemRef.value) return

  const rect = treeItemRef.value.getBoundingClientRect()
  const y = event.clientY

  if (y < rect.top || y > rect.bottom) return

  const position = y < rect.top + rect.height / 2 ? 'above' : 'below'

  // Prevent circular reference
  if (position === 'below' && treeStore._isDescendantOf(props.item.id, draggedItem.value?.id ?? '')) {
    dropTarget.value = null
    event.dataTransfer!.dropEffect = 'none'
    return
  }

  dropTarget.value = { id: props.item.id, position, parentId: props.parentId ?? null }
  event.dataTransfer!.dropEffect = 'move'
}

function handleDragLeave(event: DragEvent) {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    dropTarget.value = null
  }
}

function handleDropOnItem(event: DragEvent) {
  event.preventDefault()
  if (props.hideDropZones) return
  if (!draggedItem.value || draggedItem.value.id === props.item.id) {
    dropTarget.value = null
    return
  }

  emit('drop', {
    messageId: draggedItem.value.id,
    targetId: props.item.id,
    position: (dropTarget.value?.position as 'above' | 'below') || 'below',
    targetIndex: props.index,
    targetParentId: props.parentId ?? null,
  })

  draggedItem.value = null
  dropTarget.value = null
}

// ── Touch Drag ─────────────────────────────────────────

function handleTouchStart(event: TouchEvent) {
  if (!props.isDraggable) return
  startTouchDrag(event, props.item.id, { ...props.item })
  document.addEventListener('touchmove', handleTouchMove, { passive: false })
  document.addEventListener('touchend', handleTouchEnd)
  document.addEventListener('touchcancel', handleTouchCancel)
}

function handleTouchMove(event: TouchEvent) { moveTouchDrag(event) }
function handleTouchEnd() { endTouchDrag(); removeTouchListeners() }
function handleTouchCancel() { cancelTouchDrag(); removeTouchListeners() }
function removeTouchListeners() {
  document.removeEventListener('touchmove', handleTouchMove)
  document.removeEventListener('touchend', handleTouchEnd)
  document.removeEventListener('touchcancel', handleTouchCancel)
}

onUnmounted(() => removeTouchListeners())

// ── Inline Editing ─────────────────────────────────────

const isEditing = ref(false)
const editText = ref('')
const editInputRef = ref<HTMLInputElement | null>(null)
const editWrapperRef = ref<HTMLElement | null>(null)

function handleClick() {
  if (!isEditing.value) emit('click', props.item)
}

function startEditing() {
  isEditing.value = true
  editText.value = props.item.questionSummarized || props.item.question
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

function finishEditing() {
  const trimmed = editText.value.trim()
  const original = props.item.questionSummarized || props.item.question
  if (trimmed && trimmed !== original) {
    emit('rename', props.item, trimmed)
  }
  isEditing.value = false
  editText.value = ''
}

function cancelEditing() {
  isEditing.value = false
  editText.value = ''
}

function onEditBlur(event: FocusEvent) {
  if (editWrapperRef.value?.contains(event.relatedTarget as Node)) return
  cancelEditing()
}

defineExpose({ startEditing })
</script>

<style scoped>
.tree-item-container { width: 100%; position: relative; }

.tree-item {
  display: flex;
  align-items: flex-start;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 4px;
  gap: 0.25rem;
  user-select: none;
}
.tree-item:hover,
.tree-item:active,
.tree-item.active,
.tree-item.is-editing { background-color: var(--color-bg-hover); }
.tree-item.active .tree-item-text { color: var(--color-text-strong); font-weight: 600; }
.tree-item.is-dragging { opacity: 0.4; }

.tree-item-text-wrapper {
  display: flex;
  align-items: flex-start;
  flex: 1;
  min-width: 0;
}

.tree-item-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.drag-handle {
  flex-shrink: 0;
  width: 0.75rem;
  height: 1.4rem;
  cursor: grab;
  color: var(--color-text-muted);
  opacity: 0;
  transition: opacity 0.15s;
  font-size: 0.65rem;
  letter-spacing: -2px;
  user-select: none;
  display: flex;
  align-items: center;
}
.tree-item:hover .drag-handle { opacity: 0.6; }
.drag-handle:hover { opacity: 1 !important; color: var(--color-text-strong); }
.drag-handle:active { cursor: grabbing; }

.tree-item-actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.tree-item:hover .tree-item-actions { display: flex; }

.tree-item-action-btn {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 20px; padding: 0;
  background: none; border: none; border-radius: 3px;
  cursor: pointer; color: var(--color-text-muted); opacity: 0.5;
}
.tree-item-action-btn:hover { opacity: 1; color: var(--color-text-strong); background-color: var(--color-bg-active); }

/* Drop Indicators */
.tree-item-container.drop-above::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0.5rem;
  right: 0.5rem;
  height: 3px;
  background-color: var(--color-primary, #6366f1);
  border-radius: 2px;
  z-index: 10;
  box-shadow: 0 0 6px var(--color-primary, #6366f1);
}
.tree-item-container.drop-above .tree-item { border-top: 2px solid transparent; margin-top: -2px; }

.tree-item-container.drop-below::after {
  content: '↳ Move as child';
  position: absolute;
  bottom: -2px;
  left: 1.5rem;
  right: 0.5rem;
  height: 22px;
  background-color: var(--color-primary, #6366f1);
  border-radius: 3px;
  z-index: 10;
  display: flex;
  align-items: center;
  padding-left: 0.5rem;
  font-size: 0.75rem;
  color: white;
  font-weight: 500;
}
.tree-item-container.drop-below .tree-item { background-color: var(--color-bg-hover); }

.tree-children {
  padding-left: 1rem;
  border-left: 1px solid var(--color-border-subtle);
  margin-left: 0.5rem;
}

/* Inline Editing */
.inline-edit-wrapper { position: relative; display: flex; align-items: center; flex: 1; }
.inline-edit-input {
  font-size: 0.9rem;
  background-color: var(--color-bg-base);
  color: var(--color-text-base);
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  flex: 1;
  min-width: 0;
  padding: 0.1rem 0.25rem;
  padding-right: 52px;
  line-height: 1.4;
}
.inline-edit-input:focus { box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99, 102, 241, 0.1)); }
.inline-edit-buttons {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  gap: 2px;
}
.inline-edit-btn {
  background: none;
  border: none;
  padding: 3px;
  cursor: pointer;
  color: var(--color-text-muted);
  opacity: 0.7;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 3px;
  transition: opacity 0.15s;
}
.inline-edit-btn:hover:not(:disabled) { opacity: 1; }
.inline-edit-btn:disabled { opacity: 0.3; cursor: not-allowed; }
</style>
