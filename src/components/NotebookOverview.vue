<template>
  <div class="notebook-overview">
    <div class="overview-header">
      <InlineEdit
        :model-value="notebook?.title || 'Untitled Notebook'"
        text-class="overview-title"
        input-class="overview-title-input"
        @save="handleNotebookRename"
      />
      <p class="overview-subtitle">{{ questionCount }} question{{ questionCount !== 1 ? 's' : '' }}</p>
    </div>

    <div class="overview-content">
      <QuestionTree
        ref="questionTreeRef"
        v-if="rootMessages.length > 0"
        :root-messages="rootMessages"
        :show-collapse-button="true"
        :initial-expand-all="true"
        @select="handleSelect"
        @delete-root="handleDeleteRoot"
        @delete-child="handleDeleteChild"
        @rename="handleRename"
        @drop="handleDrop"
      />

      <div v-else class="empty-state">
        <p>No questions yet</p>
        <p class="empty-hint">Ask a question to get started</p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import QuestionTree from './QuestionTree.vue'
import InlineEdit from './InlineEdit.vue'

const props = defineProps({
  notebookId: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['select-question'])

const chatStore = useChatStore()

const notebook = computed(() => {
  return chatStore.chatList.find(c => c.id === props.notebookId)
})

const rootMessages = computed(() => {
  if (!notebook.value?.questions) return []
  return notebook.value.questions.map(q => {
    const msg = chatStore.messagesById[q.id]
    return msg || { id: q.id, question: q.text, questionSummarized: q.text }
  })
})

const questionCount = computed(() => {
  return notebook.value?.questions?.length || 0
})

const handleSelect = (selection) => {
  emit('select-question', { id: selection.id })
}

const handleNotebookRename = (newTitle) => {
  chatStore.renameChat(props.notebookId, newTitle)
}

const handleDeleteRoot = (rootMsg) => {
  chatStore.deleteQuestion(rootMsg.id, props.notebookId)
}

const handleDeleteChild = (childMsg) => {
  chatStore.deleteChildMessage(childMsg.id)
}

const handleRename = (item, newText) => {
  chatStore.setQuestionSummarized(item.id, newText)
}

const handleDrop = (dropData) => {
  const { messageId, targetId, position, targetIndex } = dropData
  if (position === 'above') {
    chatStore.moveMessage(messageId, null, targetIndex)
  } else {
    chatStore.moveMessage(messageId, targetId, 0)
  }
}
</script>

<style scoped>
.notebook-overview {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

.overview-header {
  text-align: center;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-subtle);
}

.overview-title {
  font-family: 'Georgia', serif;
  font-size: 1.75rem;
  font-weight: 500;
  color: var(--color-text-strong);
  margin: 0 0 0.5rem;
  cursor: pointer;
}

.overview-title:hover {
  color: var(--color-primary);
}

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

/* Use a slightly smaller font size than the message setting for tree items */
:deep(.tree-item-text) {
  font-size: calc(var(--message-font-size, 18px) * 0.9);
}

/* Remove left border from tree children in overview */
:deep(.tree-children) {
  border-left: none;
}
</style>
