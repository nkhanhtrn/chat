<template>
  <div
    class="tree-item-container"
    :class="{
      'drop-above': !hideDropZones && dropTarget?.id === item.id && dropTarget?.position === 'above',
      'drop-below': !hideDropZones && dropTarget?.id === item.id && dropTarget?.position === 'below'
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
        'is-editing': isEditing
      }]"
      :draggable="draggable && !isEditing"
      @dragstart="handleDragStart"
      @dragend="handleDragEnd"
      @click="handleClick"
    >
      <!-- Custom content slot or default content -->
      <slot :item="item" :dragHandleClass="'drag-handle'" :isEditing="isEditing">
        <!-- Collapse/Expand button -->
        <button
          v-if="showCollapseButton && hasChildren && !isEditing"
          class="collapse-button"
          @click.stop="$emit('toggle-expand', item)"
          :title="isExpanded ? 'Collapse' : 'Expand'"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline v-if="isExpanded" points="6 9 12 15 18 9"></polyline>
            <polyline v-else points="9 18 15 12 9 6"></polyline>
          </svg>
        </button>
        <div v-if="!isEditing && !showCollapseButton" class="drag-handle" title="Drag to reorder">⋮⋮</div>
        <div v-else-if="!isEditing && showCollapseButton && !hasChildren" class="collapse-spacer"></div>

        <!-- Editable text -->
        <template v-if="editable">
          <div v-if="!isEditing" class="tree-item-text-wrapper">
            <span
              class="tree-item-text"
              @dblclick.stop="startEditing"
            >{{ item.questionSummarized || item.question }}</span>
            <span v-if="isStreaming" class="streaming-indicator" title="Generating response..."></span>
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
              <button
                class="inline-edit-btn save-btn"
                @click.stop="finishEditing"
                :disabled="!editText.trim()"
                title="Save"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
              <button
                class="inline-edit-btn cancel-btn"
                @click.stop="cancelEditing"
                title="Cancel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
            </div>
          </div>
        </template>
        <div v-else class="tree-item-text-wrapper">
          <span class="tree-item-text">{{ item.questionSummarized || item.question }}</span>
          <span v-if="isStreaming" class="streaming-indicator" title="Generating response..."></span>
        </div>

        <button
          v-if="editable && !isEditing"
          class="edit-button"
          @click.stop="startEditing"
          title="Edit"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
          </svg>
        </button>
        <button
          v-if="showDeleteButton && !isEditing"
          class="delete-button"
          @click.stop="$emit('delete', item)"
          title="Delete"
        >×</button>
      </slot>
    </div>

    <!-- Children slot -->
    <div v-if="$slots.children && isExpanded" class="tree-children">
      <slot name="children"></slot>
    </div>
  </div>
</template>

<script setup>
import { inject, ref, nextTick } from 'vue'
import { useChatStore } from '../stores/chat.js'

// ============================================
// Props & Emits
// ============================================

const props = defineProps({
  item: { type: Object, required: true },
  index: { type: Number, required: true },
  parentId: { type: String, default: null },
  isActive: { type: Boolean, default: false },
  isExpanded: { type: Boolean, default: false },
  showDeleteButton: { type: Boolean, default: false },
  showCollapseButton: { type: Boolean, default: false },
  hasChildren: { type: Boolean, default: false },
  draggable: { type: Boolean, default: true },
  hideDropZones: { type: Boolean, default: false },
  itemClass: { type: [String, Object, Array], default: '' },
  editable: { type: Boolean, default: false },
  isStreaming: { type: Boolean, default: false }
})

const emit = defineEmits(['click', 'delete', 'drop', 'rename', 'toggle-expand'])

// ============================================
// Drag & Drop
// ============================================

const chatStore = useChatStore()
const draggedItem = inject('draggedItem')
const dropTarget = inject('dropTarget')
const treeItemRef = ref(null)

const handleDragStart = (event) => {
  draggedItem.value = { id: props.item.id, parentId: props.parentId }
  event.dataTransfer.effectAllowed = 'copyMove'
  event.dataTransfer.setData('text/plain', props.item.id)
  // Also set custom data for dropping into ChatInput as context
  event.dataTransfer.setData('application/x-question-context', JSON.stringify({
    messageId: props.item.id
  }))
}

const handleDragEnd = () => {
  draggedItem.value = null
  dropTarget.value = null
}

const handleDragOverItem = (event) => {
  if (props.hideDropZones) return
  if (draggedItem.value?.id === props.item.id) return
  if (!treeItemRef.value) return

  const rect = treeItemRef.value.getBoundingClientRect()
  const y = event.clientY

  // Only process if cursor is over the tree-item element (not children)
  if (y < rect.top || y > rect.bottom) return

  // Top half = "above" (same level, before this item)
  // Bottom half = "below" (becomes child of this item)
  const position = y < rect.top + rect.height / 2 ? 'above' : 'below'

  // Prevent circular reference: can't drop a parent onto its descendant as a child
  if (position === 'below' && chatStore._isDescendantOf(props.item.id, draggedItem.value?.id)) {
    dropTarget.value = null
    event.dataTransfer.dropEffect = 'none'
    return
  }

  dropTarget.value = { id: props.item.id, position, parentId: props.parentId }
  event.dataTransfer.dropEffect = 'move'
}

const handleDragLeave = (event) => {
  const rect = event.currentTarget.getBoundingClientRect()
  const { clientX: x, clientY: y } = event
  if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
    dropTarget.value = null
  }
}

const handleDropOnItem = (event) => {
  event.preventDefault()
  if (props.hideDropZones) return
  if (!draggedItem.value || draggedItem.value.id === props.item.id) {
    dropTarget.value = null
    return
  }

  emit('drop', {
    messageId: draggedItem.value.id,
    targetId: props.item.id,
    position: dropTarget.value?.position || 'below',
    targetIndex: props.index,
    targetParentId: props.parentId
  })

  draggedItem.value = null
  dropTarget.value = null
}

// ============================================
// Inline Editing
// ============================================

const isEditing = ref(false)
const editText = ref('')
const editInputRef = ref(null)
const editWrapperRef = ref(null)

const handleClick = () => {
  if (!isEditing.value) emit('click', props.item)
}

const startEditing = () => {
  if (!props.editable) return
  isEditing.value = true
  editText.value = props.item.questionSummarized || props.item.question
  nextTick(() => {
    editInputRef.value?.focus()
    editInputRef.value?.select()
  })
}

const finishEditing = () => {
  const trimmed = editText.value.trim()
  const original = props.item.questionSummarized || props.item.question
  if (trimmed && trimmed !== original) {
    emit('rename', props.item, trimmed)
  }
  isEditing.value = false
  editText.value = ''
}

const cancelEditing = () => {
  isEditing.value = false
  editText.value = ''
}

const onEditBlur = (event) => {
  if (editWrapperRef.value?.contains(event.relatedTarget)) return
  cancelEditing()
}

defineExpose({ startEditing })
</script>

<style scoped>
/* Container */
.tree-item-container { width: 100%; position: relative; }

/* Tree Item */
.tree-item {
  display: flex;
  align-items: flex-start;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 4px;
  gap: 0.25rem;
}
.tree-item:hover,
.tree-item:active,
.tree-item.active,
.tree-item.is-editing { background-color: var(--color-bg-hover); }
.tree-item.active .tree-item-text { color: var(--color-text-secondary); font-weight: 500; }
.tree-item.is-dragging { opacity: 0.5; }

/* Tree Item Text Wrapper */
.tree-item-text-wrapper {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  flex: 1;
  min-width: 0;
}

/* Tree Item Text */
.tree-item-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* Drag Handle */
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

/* Collapse Button */
.collapse-button {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0;
  transition: all 0.15s;
  opacity: 0;
}
.tree-item:hover .collapse-button { opacity: 0.6; }
.collapse-button:hover {
  opacity: 1 !important;
  color: var(--color-text-strong);
  background-color: var(--color-bg-hover);
}

/* Spacer for items without children when collapse buttons are shown */
.collapse-spacer {
  flex-shrink: 0;
  width: 1.25rem;
}

/* Edit Button */
.edit-button {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  padding: 0;
}
.tree-item:hover .edit-button { opacity: 0.6; }
.edit-button:hover { opacity: 1 !important; color: var(--color-text-strong); background-color: var(--color-bg-hover); }

/* Delete Button */
.delete-button {
  flex-shrink: 0;
  width: 1.25rem;
  height: 1.25rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0;
  transition: all 0.15s;
  padding: 0;
}
.tree-item:hover .delete-button { opacity: 0.6; }
.delete-button:hover { opacity: 1 !important; color: var(--color-text-strong); background-color: var(--color-bg-hover); }

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

/* Children */
.tree-children {
  padding-left: 1rem;
  border-left: 1px solid var(--color-border-subtle);
  margin-left: 0.5rem;
}

/* Inline Editing */
.inline-edit-wrapper { position: relative; display: flex; align-items: center; flex: 1; }
.inline-edit-input {
  font-family: 'Georgia', serif;
  font-size: 0.9rem;
  background-color: var(--color-bg-base);
  color: var(--color-text-base);
  border: 2px solid var(--color-primary);
  border-radius: 4px;
  outline: none;
  flex: 1;
  min-width: 0;
  padding: 0.25rem 0.5rem;
  padding-right: 52px;
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

/* Streaming indicator */
.streaming-indicator {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-subtle, #e5e7eb);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  margin-top: 4px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
