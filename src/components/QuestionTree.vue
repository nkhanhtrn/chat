<template>
  <div class="question-tree">
    <DraggableTreeItem
      v-for="(msg, index) in rootMessages"
      :key="msg.id"
      :item="msg as TreeItem"
      :index="index"
      :parent-id="null"
      :is-active="msg.id === currentMessageId"
      :is-expanded="isExpanded(msg.id as string)"
      :is-draggable="true"
      item-class="root-header"
      @click="handleRootClick(msg)"
      @delete="confirmDelete(msg, 'root')"
      @drop="handleDrop"
      @rename="(item: TreeItem, text: string) => emit('rename', item, text)"
    >
      <template #children>
        <DraggableTreeItem
          v-for="(child, childIdx) in getChildren(msg.id as string)"
          :key="child.id"
          :item="child as TreeItem"
          :index="childIdx"
          :parent-id="msg.id as string"
          :is-active="child.id === currentMessageId"
          :is-expanded="true"
          :is-draggable="true"
          item-class="child-item"
          @click="$emit('select', { id: child.id, rootId: msg.id as string })"
          @delete="confirmDelete(child, 'child')"
          @drop="handleDrop"
          @rename="(item: TreeItem, text: string) => emit('rename', item, text)"
        >
          <template v-if="autoExpandAll && getChildren(child.id).length > 0" #children>
            <DraggableTreeItem
              v-for="(gc, gcIdx) in getChildren(child.id)"
              :key="gc.id"
              :item="gc as TreeItem"
              :index="gcIdx"
              :parent-id="child.id"
              :is-active="gc.id === currentMessageId"
              :is-expanded="true"
              :is-draggable="true"
              item-class="child-item"
              @click="$emit('select', { id: gc.id, rootId: msg.id as string })"
              @delete="confirmDelete(gc, 'child')"
              @drop="handleDrop"
              @rename="(item: TreeItem, text: string) => emit('rename', item, text)"
            />
          </template>
        </DraggableTreeItem>
      </template>
    </DraggableTreeItem>
  </div>
</template>

<script setup lang="ts">
import { ref, provide, watch } from 'vue'
import { useMessageTreeStore } from '@/stores/messageTree'
import DraggableTreeItem from './DraggableTreeItem.vue'

interface TreeItem {
  id: string
  question: string
  questionSummarized?: string | null
  [key: string]: unknown
}

const props = withDefaults(defineProps<{
  rootMessages: Array<Record<string, unknown>>
  currentMessageId?: string | null
  autoExpandAll?: boolean
}>(), { currentMessageId: null, autoExpandAll: false })

const emit = defineEmits<{
  select: [data: { id: string; rootId: string }]
  'delete-root': [data: Record<string, unknown>]
  'delete-child': [data: Record<string, unknown>]
  rename: [data: Record<string, unknown>, text: string]
  drop: [data: {
    messageId: string
    targetId: string
    position: 'above' | 'below'
    targetIndex: number
    targetParentId: string | null
  }]
}>()

const treeStore = useMessageTreeStore()
const expandedRootId = ref<string | null>(null)

// Shared drag state via provide/inject
const draggedItem = ref<{ id: string; parentId: string | null } | null>(null)
const dropTarget = ref<{ id: string; position: string; parentId: string | null } | null>(null)
provide('draggedItem', draggedItem)
provide('dropTarget', dropTarget)

function findRootForMessage(messageId: string | null | undefined): string | null {
  if (!messageId) return null
  for (const msg of props.rootMessages) {
    const id = msg.id as string
    if (id === messageId) return id
    if (isDescendantOf(messageId, id)) return id
  }
  return null
}

function isDescendantOf(messageId: string, ancestorId: string): boolean {
  const msg = treeStore.getMessageById(ancestorId)
  if (!msg?.childIds?.length) return false
  for (const cid of msg.childIds) {
    if (cid === messageId) return true
    if (isDescendantOf(messageId, cid)) return true
  }
  return false
}

watch(() => props.currentMessageId, (newId) => {
  if (newId && !props.autoExpandAll) {
    const rootId = findRootForMessage(newId)
    if (rootId) expandedRootId.value = rootId
  }
}, { immediate: true })

function isExpanded(id: string): boolean {
  if (props.autoExpandAll) return true
  return expandedRootId.value === id
}

function handleRootClick(msg: Record<string, unknown>) {
  const id = msg.id as string
  if (!props.autoExpandAll) {
    expandedRootId.value = expandedRootId.value === id ? null : id
  }
  emit('select', { id, rootId: id })
}

function getChildren(id: string) {
  const msg = treeStore.getMessageById(id)
  if (!msg?.childIds?.length) return []
  return msg.childIds
    .map(cid => treeStore.getMessageById(cid))
    .filter(Boolean)
    .map(c => ({ id: c!.id, question: c!.question, questionSummarized: c!.questionSummarized }))
}

function handleDrop(data: { messageId: string; targetId: string; position: 'above' | 'below'; targetIndex: number; targetParentId: string | null }) {
  emit('drop', data)
}

function confirmDelete(item: Record<string, unknown>, type: 'root' | 'child') {
  const text = (item.questionSummarized || item.question || 'this item') as string
  if (confirm(`Delete "${text}"?`)) {
    emit(type === 'root' ? 'delete-root' : 'delete-child', item)
  }
}
</script>

<style scoped>
.question-tree { width: 100%; display: flex; flex-direction: column; }

:deep(.root-header) { padding: 0.5rem 0.75rem; }
:deep(.child-item) { padding-left: 0; }
</style>
