<template>
  <div class="chat-sidebar">
    <div class="sidebar-header">
      <div class="search-input-wrapper">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search questions..." @keydown.escape="searchQuery = ''" />
      </div>
    </div>
    <div class="chat-list">
      <div v-if="currentNotebook" class="overview-header-item" @click="navigateToNotebookOverview">
        <span>{{ currentNotebook.title }}</span>
      </div>
      <QuestionTree :root-messages="rootMessages" :current-message-id="currentMessageId" @select="handleTreeSelect" />
      <div v-if="rootMessages.length === 0" class="empty-state"><p>No questions yet</p></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, toRef } from 'vue'
import { useRouter } from 'vue-router'
import QuestionTree from './QuestionTree.vue'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'
import type { NotebookListItem } from '@/types/notebook'

const props = defineProps<{
  chats: NotebookListItem[]
  currentChatId?: string | null
  currentMessageId?: string | null
  isAddingNewQuestion?: boolean
  fullPage?: boolean
}>()

const emit = defineEmits<{
  'select-question': [data: { id: string; chatId: string; rootIndex: number }]
  'delete-question': [messageId: string, chatId: string]
  'rename-question': [messageId: string, text: string]
  'new-question': []
}>()

const router = useRouter()
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()
const searchQuery = ref('')

const currentNotebook = computed(() => props.chats.find(c => c.id === props.currentChatId))

const rootMessages = computed(() => {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return []
  return chat.questions.map(q => {
    const msg = treeStore.getMessageById(q.id)
    return msg ? { id: msg.id, question: msg.question, questionSummarized: msg.questionSummarized } : { id: q.id, question: q.text, questionSummarized: q.text }
  })
})

function handleTreeSelect(selection: { id: string }) {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return
  emit('select-question', { id: selection.id, chatId: chat.id, rootIndex: 0 })
}

function navigateToNotebookOverview() {
  if (props.currentChatId) router.push({ name: 'notebook', params: { id: props.currentChatId } })
}
</script>

<style scoped>
.chat-sidebar { width: 100%; height: 100%; background-color: var(--color-bg-base); display: flex; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
.sidebar-header { padding: 1rem; border-bottom: 1px solid var(--color-border-subtle); }

/* Overview header item */
.overview-header-item { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; margin-bottom: 0.25rem; cursor: pointer; border-radius: 4px; transition: background-color 0.15s; }
.overview-header-item:hover { background-color: var(--color-bg-hover); }
.overview-header-item span { font-size: 0.9rem; font-weight: 600; color: var(--color-text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.overview-header-item:hover span { color: var(--color-primary); }

.chat-list { flex: 1; overflow-y: auto; padding: 1rem 0.5rem; }
.chat-list::-webkit-scrollbar { width: 8px; }
.chat-list::-webkit-scrollbar-track { background: var(--color-scrollbar-track); }
.chat-list::-webkit-scrollbar-thumb { background: var(--color-scrollbar-thumb); border-radius: 4px; }
.chat-list::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }

/* New question button */
.new-question-button { display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0.75rem; margin-top: 0.5rem; cursor: pointer; transition: all 0.15s; opacity: 0.6; border-radius: 4px; }
.new-question-button:hover, .new-question-button.active { opacity: 1; background-color: var(--color-bg-hover); }
.new-question-icon { font-size: 1rem; font-weight: bold; color: var(--color-text-muted); }
.new-question-text { font-size: 0.9rem; color: var(--color-text-muted); }

.empty-state { text-align: center; padding: 2rem 1rem; color: var(--color-text-muted); }
.empty-state p { margin: 0.5rem 0; }

/* Search input */
.search-input-wrapper { position: relative; flex: 1; min-width: 0; }
.search-input { width: 100%; padding: 0.5rem 2rem 0.5rem 0.75rem; font-size: 0.85rem; font-family: inherit; background-color: var(--color-bg-page); border: 1px solid var(--color-border-subtle); border-radius: 6px; color: var(--color-text-secondary); transition: border-color 0.2s, box-shadow 0.2s; }
.search-input:focus { outline: none; border-color: var(--color-border-accent); box-shadow: 0 0 0 2px var(--shadow-primary); }
.search-input::placeholder { color: var(--color-text-muted); }

/* Search results */
.search-results-container { display: flex; flex-direction: column; gap: 0.5rem; }
.search-results-header { padding: 0 0.25rem; }
.search-results-count { font-size: 0.8rem; color: var(--color-text-muted); }
.search-results-list { display: flex; flex-direction: column; gap: 0.25rem; }
.search-result-item { padding: 0.5rem 0.75rem; border-radius: 6px; cursor: pointer; transition: background-color 0.15s; }
.search-result-item:hover { background-color: var(--color-bg-hover); }
.search-result-path { display: flex; flex-wrap: wrap; align-items: center; gap: 0.25rem; margin-bottom: 0.25rem; }
.path-segment { display: flex; align-items: center; gap: 0.25rem; }
.path-text { font-size: 0.75rem; color: var(--color-text-muted); max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.path-separator { font-size: 0.7rem; color: var(--color-text-disabled); }
.search-result-question { font-size: 0.875rem; color: var(--color-text-secondary); line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.search-no-results { text-align: center; padding: 2rem 1rem; color: var(--color-text-muted); font-size: 0.875rem; }
</style>
