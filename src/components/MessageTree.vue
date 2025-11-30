<template>
  <div class="message-tree">
    <div
      v-for="child in children"
      :key="child.id"
      class="tree-node"
    >
      <div
        :class="['tree-item', {
          active: child.id === currentMessageId,
          'has-children': hasChildren(child.id),
          expanded: isExpanded(child.id)
        }]"
        @click="handleSelect(child)"
      >
        <span
          v-if="hasChildren(child.id)"
          class="expand-icon"
          @click.stop="toggleExpand(child.id)"
        >
          {{ isExpanded(child.id) ? '▾' : '▸' }}
        </span>
        <span v-else class="expand-icon-placeholder"></span>
        <span class="tree-item-text">{{ child.questionSummarized || child.question }}</span>
      </div>

      <!-- Recursive children -->
      <div v-if="hasChildren(child.id) && isExpanded(child.id)" class="tree-children">
        <MessageTree
          :parent-id="child.id"
          :current-message-id="currentMessageId"
          :expanded-path="expandedPath"
          @select="$emit('select', $event)"
          @toggle-expand="$emit('toggle-expand', $event)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'

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
  }
})

const emit = defineEmits(['select', 'toggle-expand'])

const chatStore = useChatStore()

const children = computed(() => {
  return chatStore.getChildren(props.parentId)
})

const hasChildren = (messageId) => {
  const msg = chatStore.messagesById[messageId]
  return msg?.childIds?.length > 0
}

const isExpanded = (messageId) => {
  return props.expandedPath.has(messageId)
}

const handleSelect = (child) => {
  emit('select', child)
}

const toggleExpand = (messageId) => {
  emit('toggle-expand', messageId)
}
</script>

<style scoped>
.message-tree {
  width: 100%;
}

.tree-node {
  width: 100%;
}

.tree-item {
  display: flex;
  align-items: flex-start;
  padding: 0.35rem 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 4px;
  gap: 0.25rem;
}

.tree-item:hover {
  background-color: var(--color-bg-hover);
}

.tree-item.active {
  background-color: var(--color-bg-hover);
}

.tree-item.active .tree-item-text {
  color: var(--color-text-secondary);
  font-weight: 500;
}

.expand-icon {
  flex-shrink: 0;
  width: 1rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.85rem;
  color: var(--color-text-muted);
  cursor: pointer;
}

.expand-icon:hover {
  color: var(--color-text-strong);
}

.expand-icon-placeholder {
  flex-shrink: 0;
  width: 1rem;
}

.tree-item-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  flex: 1;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.tree-children {
  padding-left: 1rem;
  border-left: 1px solid var(--color-border-subtle);
  margin-left: 0.5rem;
}
</style>
