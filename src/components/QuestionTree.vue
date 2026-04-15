<template>
  <div class="question-tree">
    <div
      v-for="(msg, index) in rootMessages"
      :key="msg.id"
      :class="['tree-item', { active: msg.id === currentMessageId }]"
      @click="$emit('select', { id: msg.id, rootId: msg.id })"
    >
      <span class="tree-item-text">{{ msg.questionSummarized || msg.question }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  rootMessages: Array<Record<string, unknown>>
  currentMessageId?: string | null
  expandAll?: boolean
}>()

defineEmits<{
  select: [data: { id: string; rootId: string }]
  'delete-root': [data: Record<string, unknown>]
  'delete-child': [data: Record<string, unknown>]
  rename: [data: Record<string, unknown>, text: string]
  drop: [data: Record<string, unknown>]
}>()
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
.tree-item:active {
  background-color: var(--color-bg-hover);
}
.tree-item.active {
  background-color: var(--color-bg-hover);
}
.tree-item.active .tree-item-text {
  color: var(--color-text-strong);
  font-weight: 600;
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
</style>
