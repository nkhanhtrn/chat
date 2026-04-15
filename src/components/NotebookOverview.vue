<template>
  <div class="notebook-overview">
    <div class="overview-header">
      <div class="title-row">
        <InlineEdit
          ref="titleEditRef"
          :model-value="title ?? 'Untitled Notebook'"
          text-class="overview-title"
          input-class="overview-title-input"
          @save="$emit('rename-notebook', $event)"
        />
        <button class="title-edit-button" @click="titleEditRef?.startEditing()" title="Edit title">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <path d="M17 3l4 4L7 21H3v-4L17 3z"/>
          </svg>
        </button>
      </div>
      <p class="overview-subtitle">{{ rootMessages?.length || 0 }} question{{ (rootMessages?.length || 0) !== 1 ? 's' : '' }}</p>
    </div>

    <div class="overview-content">
      <QuestionTree
        v-if="rootMessages && rootMessages.length > 0"
        :root-messages="rootMessages"
        :auto-expand-all="true"
        @select="(data: Record<string, unknown>) => $emit('select-question', data)"
        @rename="(data: Record<string, unknown>, text: string) => $emit('rename', data, text)"
        @delete-root="(data: Record<string, unknown>) => $emit('delete-root', data)"
        @delete-child="(data: Record<string, unknown>) => $emit('delete-child', data)"
        @drop="(data: Record<string, unknown>) => $emit('drop', data)"
      />

      <div v-else class="empty-state">
        <p>No questions yet</p>
        <p class="empty-hint">Ask a question to get started</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import InlineEdit from './InlineEdit.vue'
import QuestionTree from './QuestionTree.vue'

const titleEditRef = ref<InstanceType<typeof InlineEdit> | null>(null)

defineProps<{
  notebookId?: string
  title?: string
  questionCount?: number
  rootMessages?: Array<Record<string, unknown>>
}>()

defineEmits<{
  'select-question': [data: Record<string, unknown>]
  'rename-notebook': [title: string]
  'delete-root': [data: Record<string, unknown>]
  'delete-child': [data: Record<string, unknown>]
  rename: [data: Record<string, unknown>, text: string]
  drop: [data: Record<string, unknown>]
}>()
</script>

<style scoped>
.notebook-overview {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1rem;
  font-family: 'Georgia', 'Palatino Linotype', 'Book Antiqua', 'Times New Roman', serif;
  height: 100%;
  overflow-y: auto;
}

.notebook-overview::-webkit-scrollbar { width: 8px; }
.notebook-overview::-webkit-scrollbar-track { background: var(--color-scrollbar-track); border-radius: 4px; }
.notebook-overview::-webkit-scrollbar-thumb { background: var(--color-scrollbar-thumb); border-radius: 4px; }
.notebook-overview::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }

.overview-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.title-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
}

.title-edit-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 1.5rem;
  height: 1.5rem;
  background: none;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  color: var(--color-text-muted);
  opacity: 0;
  transition: all 0.15s;
  padding: 0;
}

.title-row:hover .title-edit-button { opacity: 0.6; }
.title-edit-button:hover { opacity: 1 !important; color: var(--color-text-strong); background-color: var(--color-bg-hover); }

.overview-title {
  font-family: 'Georgia', serif;
  font-size: 1.75rem;
  font-weight: 500;
  color: var(--color-text-strong);
  margin: 0 0 0.5rem;
  cursor: pointer;
}

.overview-title:hover { color: var(--color-primary); }

:deep(.overview-title-input) {
  font-family: 'Georgia', serif;
  font-size: 1.75rem;
  font-weight: 500;
  text-align: center;
  width: 100%;
  padding: 0.25rem 0.5rem;
}

.overview-subtitle {
  font-size: 0.95rem;
  color: var(--color-text-muted);
  margin: 0;
}

.overview-content {
  padding: 0;
}

:deep(.tree-item-text) {
  font-size: calc(var(--message-font-size, 18px) * 0.9);
}

:deep(.tree-children) {
  border-left: none;
}

.empty-state {
  text-align: center;
  padding: 4rem 2rem;
  color: var(--color-text-muted);
}

.empty-state p {
  margin: 0.5rem 0;
  font-family: 'Georgia', serif;
}

.empty-hint {
  font-size: 0.9rem;
  font-style: italic;
  color: var(--color-text-disabled);
}

@media (max-width: 768px) {
  .notebook-overview { padding: 0.75rem 0.5rem; }
  .overview-header { margin-bottom: 0.75rem; padding-bottom: 0.5rem; }
  .overview-title { font-size: 1.35rem; }
  :deep(.overview-title-input) { font-size: 1.35rem; }
  .overview-subtitle { font-size: 0.875rem; }
  .empty-state { padding: 2.5rem 1rem; }
  :deep(.tree-item) { padding: 0.6rem 0.5rem; min-height: 44px; }
  .title-row { position: relative; justify-content: center; }
  .title-edit-button { position: absolute; right: 0; }
}
</style>
