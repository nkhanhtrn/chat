<template>
  <div class="question-tree">
    <template v-for="msg in rootMessages" :key="msg.id">
      <div>
        <div
          :class="['tree-item', 'root-header', { active: msg.id === currentMessageId }]"
          @click="handleRootClick(msg)"
        >
          <InlineEdit
            :ref="(el: any) => setEditRef(msg.id as string, el)"
            :model-value="(msg.questionSummarized || msg.question) as string"
            text-class="tree-item-text"
            input-class="tree-item-input"
            @save="(text: string) => emit('rename', msg, text)"
          />
          <div class="tree-item-actions">
            <button class="tree-item-action-btn" @click.stop="handleEditClick(msg.id)" title="Rename">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
            </button>
            <button class="tree-item-action-btn" @click.stop="confirmDelete(msg, 'root')" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>
        <div v-if="isExpanded(msg.id) && getChildren(msg.id).length > 0" class="tree-children">
          <div v-for="child in getChildren(msg.id)" :key="child.id">
            <div
              :class="['tree-item', 'child-item', { active: child.id === currentMessageId }]"
              @click="$emit('select', { id: child.id, rootId: msg.id as string })"
            >
              <InlineEdit
                :ref="(el: any) => setEditRef(child.id, el)"
                :model-value="(child.questionSummarized || child.question) as string"
                text-class="tree-item-text"
                input-class="tree-item-input"
                @save="(text: string) => emit('rename', child, text)"
              />
              <div class="tree-item-actions">
                <button class="tree-item-action-btn" @click.stop="handleEditClick(child.id)" title="Rename">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
                </button>
                <button class="tree-item-action-btn" @click.stop="confirmDelete(child, 'child')" title="Delete">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>
            </div>
            <div v-if="autoExpandAll && getChildren(child.id).length > 0" class="tree-children">
              <div
                v-for="grandChild in getChildren(child.id)"
                :key="grandChild.id"
                :class="['tree-item', 'child-item', { active: grandChild.id === currentMessageId }]"
                @click="$emit('select', { id: grandChild.id, rootId: msg.id as string })"
              >
                <InlineEdit
                  :ref="(el: any) => setEditRef(grandChild.id, el)"
                  :model-value="(grandChild.questionSummarized || grandChild.question) as string"
                  text-class="tree-item-text"
                  input-class="tree-item-input"
                  @save="(text: string) => emit('rename', grandChild, text)"
                />
                <div class="tree-item-actions">
                  <button class="tree-item-action-btn" @click.stop="handleEditClick(grandChild.id)" title="Rename">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M17 3l4 4L7 21H3v-4L17 3z"/></svg>
                  </button>
                  <button class="tree-item-action-btn" @click.stop="confirmDelete(grandChild, 'child')" title="Delete">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useMessageTreeStore } from '@/stores/messageTree'
import InlineEdit from './InlineEdit.vue'

const props = withDefaults(defineProps<{
  rootMessages: Array<Record<string, unknown>>
  currentMessageId?: string | null
  /** When true, show all children at all levels (for index/overview). When false, click to show direct children only (sidebar). */
  autoExpandAll?: boolean
}>(), { currentMessageId: null, autoExpandAll: false })

const emit = defineEmits<{
  select: [data: { id: string; rootId: string }]
  'delete-root': [data: Record<string, unknown>]
  'delete-child': [data: Record<string, unknown>]
  rename: [data: Record<string, unknown>, text: string]
  drop: [data: Record<string, unknown>]
}>()

const treeStore = useMessageTreeStore()
const expandedRootId = ref<string | null>(null)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const editRefs = new Map<string, any>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function setEditRef(id: string, el: any) {
  if (el) editRefs.set(id, el)
}

// Auto-expand the root containing the current message
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

function handleEditClick(id: string | undefined) {
  if (!id) return
  editRefs.get(id)?.startEditing()
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
.tree-item:active { background-color: var(--color-bg-hover); }
.tree-item.active { background-color: var(--color-bg-hover); }
.tree-item.active .tree-item-text { color: var(--color-text-strong); font-weight: 600; }

.root-header { padding: 0.5rem 0.75rem; }

.child-item { padding-left: 1.5rem; }
.tree-children {
  border-left: 1px solid var(--color-border-subtle);
  margin-left: 1rem;
}

.tree-item-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  flex: 1;
  min-width: 0;
}

.tree-item-input {
  font-size: 0.9rem;
  line-height: 1.4;
  padding: 0.1rem 0.25rem;
}

.tree-item-actions {
  display: none;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}
.tree-item:hover .tree-item-actions { display: flex; }

.tree-item-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  color: var(--color-text-muted);
  background: none;
  border: none;
  border-radius: 3px;
  cursor: pointer;
  opacity: 0.5;
}
.tree-item-action-btn:hover { opacity: 1; color: var(--color-text-strong); background-color: var(--color-bg-active); }
</style>
