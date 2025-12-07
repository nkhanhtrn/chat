<template>
  <div class="message-tree">
    <DraggableTreeItem
      v-for="(child, index) in children"
      :key="child.id"
      :item="child"
      :index="index"
      :parent-id="parentId"
      :is-active="child.id === currentMessageId"
      :is-expanded="isExpanded(child.id)"
      :editable="editable"
      :show-delete-button="showDeleteButton"
      :show-collapse-button="showCollapseButton"
      :has-children="hasChildren(child.id)"
      :is-streaming="isMessageStreaming(child.id)"
      @click="handleItemClick"
      @drop="handleDrop"
      @rename="(item, newText) => emit('rename', item, newText)"
      @delete="(item) => emit('delete', item)"
      @toggle-expand="handleToggleExpand"
    >
      <template #children>
        <MessageTree
          v-if="hasChildren(child.id)"
          :parent-id="child.id"
          :current-message-id="currentMessageId"
          :expanded-path="expandedPath"
          :editable="editable"
          :show-delete-button="showDeleteButton"
          :show-collapse-button="showCollapseButton"
          :expand-all="expandAll"
          :collapsed-nodes="collapsedNodes"
          @select="$emit('select', $event)"
          @toggle-expand="$emit('toggle-expand', $event)"
          @rename="(item, newText) => emit('rename', item, newText)"
          @delete="(item) => emit('delete', item)"
        />
      </template>
    </DraggableTreeItem>
  </div>
</template>

<script setup>
import { ref, computed, inject, provide } from 'vue'
import { useChatStore } from '../stores/chat.js'
import DraggableTreeItem from './DraggableTreeItem.vue'

const props = defineProps({
  parentId: {
    type: String,
    required: true
  },
  currentMessageId: {
    type: String,
    default: null
  },
  expandedPath: {
    type: Set,
    default: () => new Set()
  },
  editable: {
    type: Boolean,
    default: false
  },
  showDeleteButton: {
    type: Boolean,
    default: false
  },
  showCollapseButton: {
    type: Boolean,
    default: false
  },
  expandAll: {
    type: Boolean,
    default: false
  },
  // Track manually collapsed nodes (used when initialExpandAll is active)
  collapsedNodes: {
    type: Set,
    default: null
  }
})

const emit = defineEmits(['select', 'toggle-expand', 'rename', 'delete'])

const chatStore = useChatStore()

const children = computed(() => {
  return chatStore.getChildren(props.parentId)
})

const hasChildren = (messageId) => {
  const msg = chatStore.messagesById[messageId]
  return msg?.childIds?.length > 0
}

const isMessageStreaming = (messageId) => {
  return chatStore.streamingMessageId === messageId
}

const isExpanded = (messageId) => {
  // If collapsedNodes is provided (initialExpandAll mode), check if node was manually collapsed
  if (props.collapsedNodes) {
    return !props.collapsedNodes.has(messageId)
  }
  return props.expandAll || props.expandedPath.has(messageId)
}

// Handle clicking an item - select and toggle expand
const handleItemClick = (child) => {
  emit('select', child)
  emit('toggle-expand', child.id)
}

// Handle toggle expand from collapse button
const handleToggleExpand = (item) => {
  emit('toggle-expand', item.id)
}

// Drag state - shared across tree via provide/inject
const draggedItem = inject('draggedItem', ref(null))
const dropTarget = inject('dropTarget', ref(null))

provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

// Handle drop event from DraggableTreeItem
const handleDrop = (dropData) => {
  const { messageId, targetId, position, targetIndex } = dropData

  if (position === 'above') {
    // Move to same level as target, before target
    chatStore.moveMessage(messageId, props.parentId, targetIndex)
  } else {
    // Move as first child of target
    chatStore.moveMessage(messageId, targetId, 0)
  }
}

</script>

<style scoped>
.message-tree {
  width: 100%;
}
</style>
