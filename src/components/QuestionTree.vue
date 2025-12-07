<template>
  <div class="question-tree">
    <DraggableTreeItem
      v-for="(rootMsg, index) in rootMessages"
      :key="rootMsg.id"
      :item="rootMsg"
      :index="index"
      :parent-id="null"
      :is-active="isInActivePath(rootMsg.id)"
      :is-expanded="(expandAll || isRootExpanded(rootMsg.id)) && hasChildren(rootMsg.id)"
      :draggable="draggable"
      :hide-drop-zones="!draggable"
      :editable="editable"
      :show-delete-button="showDeleteButton"
      :show-collapse-button="showCollapseButton"
      :has-children="hasChildren(rootMsg.id)"
      :is-streaming="isMessageStreaming(rootMsg.id)"
      :item-class="getRootItemClass(rootMsg)"
      @click="handleRootClick"
      @drop="handleDrop"
      @rename="handleRename"
      @delete="handleDeleteRoot"
      @toggle-expand="handleToggleRootExpand"
    >
      <template #children>
        <MessageTree
          :parent-id="rootMsg.id"
          :current-message-id="currentMessageId"
          :expanded-path="expandedPath"
          :editable="editable"
          :show-delete-button="showDeleteButton"
          :show-collapse-button="showCollapseButton"
          :expand-all="expandAll"
          :collapsed-nodes="initialExpandAll ? collapsedChildNodes : null"
          @select="handleSelectChild"
          @toggle-expand="handleToggleChildExpand"
          @rename="handleRename"
          @delete="handleDeleteChild"
        />
      </template>
    </DraggableTreeItem>
  </div>
</template>

<script setup>
import { computed, inject, ref, provide, toRef } from 'vue'
import { useChatStore } from '../stores/chat.js'
import { useTreeExpansion } from '../composables/useTreeExpansion.js'
import DraggableTreeItem from './DraggableTreeItem.vue'
import MessageTree from './MessageTree.vue'

const props = defineProps({
  // Messages to display (array of root messages)
  rootMessages: {
    type: Array,
    required: true
  },
  // Current selected message ID
  currentMessageId: {
    type: String,
    default: null
  },
  // Enable drag and drop
  draggable: {
    type: Boolean,
    default: true
  },
  // Enable inline editing
  editable: {
    type: Boolean,
    default: true
  },
  // Show delete buttons
  showDeleteButton: {
    type: Boolean,
    default: true
  },
  // Show collapse buttons
  showCollapseButton: {
    type: Boolean,
    default: false
  },
  // Expand all children by default (overrides user interaction)
  expandAll: {
    type: Boolean,
    default: false
  },
  // Start with all nodes expanded but allow user to collapse
  initialExpandAll: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits([
  'select',           // Emitted when a message is selected
  'delete-root',      // Emitted when a root message is deleted
  'delete-child',     // Emitted when a child message is deleted
  'rename',           // Emitted when a message is renamed
  'drop'              // Emitted when a drop occurs
])

const chatStore = useChatStore()

// Track collapsed child nodes when initialExpandAll is true
const collapsedChildNodes = ref(new Set())

// Tree expansion management
const {
  expandedPath,
  findRootId,
  isInActivePath: treeIsInActivePath,
  isRootExpanded,
  toggleExpand,
  toggleRoot,
  expandToMessage
} = useTreeExpansion({
  getMessageById: (id) => chatStore.messagesById[id],
  currentMessageId: toRef(props, 'currentMessageId'),
  initialExpandAll: props.initialExpandAll
})

// Drag state - shared with MessageTree via provide
const draggedItem = inject('draggedItem', ref(null))
const dropTarget = inject('dropTarget', ref(null))

provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

// Check if a message is in the active path
const isInActivePath = (messageId) => {
  return treeIsInActivePath(messageId, props.currentMessageId)
}

// Check if a message has children
const hasChildren = (messageId) => {
  const msg = chatStore.messagesById[messageId]
  return msg?.childIds?.length > 0
}

// Check if a message is currently streaming
const isMessageStreaming = (messageId) => {
  return chatStore.streamingMessageId === messageId
}

// Get the current root message ID
const currentRootId = computed(() => {
  return props.currentMessageId ? findRootId(props.currentMessageId) : null
})

// Get CSS classes for root items
const getRootItemClass = (rootMsg) => {
  return {
    'root-header': true,
    'is-current-root': rootMsg.id === currentRootId.value
  }
}

// Handle clicking a root message
const handleRootClick = (rootMsg) => {
  emit('select', { id: rootMsg.id, isRoot: true })
  // Always expand on click (never collapse when selecting)
  toggleRoot(rootMsg.id, { expandOnly: true })
}

// Handle toggle expand for root messages (from collapse button)
const handleToggleRootExpand = (rootMsg) => {
  toggleRoot(rootMsg.id)
}

// Handle selecting a child message
const handleSelectChild = (childMsg) => {
  const rootId = findRootId(childMsg.id)
  emit('select', { id: childMsg.id, rootId, isRoot: false })
  // Rebuild expanded path to show full tree to selected child
  expandToMessage(childMsg.id)
}

// Handle toggle expand (wrapper to always expand on click)
const handleToggleExpand = (messageId) => {
  toggleExpand(messageId, { expandOnly: true })
}

// Handle toggle expand for child nodes (from collapse button in initialExpandAll mode)
const handleToggleChildExpand = (messageId) => {
  if (props.initialExpandAll) {
    // In initialExpandAll mode, toggle collapsed state
    const newCollapsed = new Set(collapsedChildNodes.value)
    if (newCollapsed.has(messageId)) {
      newCollapsed.delete(messageId)
    } else {
      newCollapsed.add(messageId)
    }
    collapsedChildNodes.value = newCollapsed
  } else {
    // Normal mode - use toggleExpand
    toggleExpand(messageId)
  }
}

// Handle deleting a root message
const handleDeleteRoot = (rootMsg) => {
  emit('delete-root', rootMsg)
}

// Handle deleting a child message
const handleDeleteChild = (childMsg) => {
  emit('delete-child', childMsg)
}

// Handle renaming a message
const handleRename = (item, newText) => {
  emit('rename', item, newText)
}

// Handle drop event
const handleDrop = (dropData) => {
  emit('drop', dropData)
}

// Expose expansion methods for parent components
defineExpose({
  expandToMessage,
  expandedPath
})
</script>

<style scoped>
.question-tree {
  width: 100%;
}

/* Root header styles */
:deep(.root-header) {
  display: flex;
  gap: 0.5rem;
  align-items: flex-start;
  padding: 0.5rem 0.75rem;
  transition: all 0.15s;
  user-select: none;
  border-radius: 4px;
}

:deep(.root-header:hover) {
  background-color: var(--color-bg-hover);
}

:deep(.root-header.active),
:deep(.root-header.is-current-root) {
  background-color: var(--color-bg-hover);
}

:deep(.root-header.active .tree-item-text),
:deep(.root-header.is-current-root .tree-item-text) {
  color: var(--color-text-strong);
  font-weight: 600;
}
</style>
