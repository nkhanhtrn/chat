<template>
  <div class="chat-sidebar">
    <div class="sidebar-header">
      <div class="search-input-wrapper">
        <input v-model="searchQuery" type="text" class="search-input" placeholder="Search questions..." @keydown.escape="searchQuery = ''" />
      </div>
    </div>
    <div class="chat-list">
      <div class="chat-list-header">
        <div v-if="currentNotebook" class="overview-header-item" @click="navigateToNotebookOverview">
          <span>{{ currentNotebook.title }}</span>
        </div>
        <button class="sort-btn" :class="{ asc: sortDir === 'asc', desc: sortDir === 'desc' }" @click="toggleSort" title="Sort">⇅</button>
      </div>
      <template v-if="searchQuery.trim()">
        <div v-if="searchResults.length > 0" class="search-results-list">
          <div v-for="r in searchResults" :key="r.id" :class="['search-result-item', { active: r.id === currentMessageId }]" @click="handleSearchSelect(r)">
            <div v-if="r.parentQuestion" class="search-result-path">
              <span class="path-text">{{ r.parentQuestion }}</span>
              <span class="path-separator">›</span>
            </div>
            <div class="search-result-question">{{ r.questionSummarized || r.question }}</div>
          </div>
        </div>
        <div v-else class="search-no-results">No results found</div>
      </template>
      <template v-else>
        <QuestionTree :root-messages="rootMessages" :current-message-id="currentMessageId" @select="handleTreeSelect" @rename="handleTreeRename" @delete-root="handleTreeDeleteRoot" @delete-child="handleTreeDeleteChild" @drop="handleTreeDrop" />
        <div v-if="rootMessages.length === 0" class="empty-state"><p>No questions yet</p></div>
      </template>
      <div class="new-question-item" :class="{ active: isAddingNewQuestion }" @click="$emit('new-question')">
        <span class="new-question-icon">+</span>
        <span class="new-question-text">New question</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
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
const sortDir = ref<'none' | 'asc' | 'desc'>('none')

const sortRootMessages = (dir: 'asc' | 'desc') => {
  const sorted = [...treeStore.rootMessageIds].sort((a, b) => {
    const ma = treeStore.getMessageById(a)
    const mb = treeStore.getMessageById(b)
    const ta = ma?.questionSummarized || ma?.question || ''
    const tb = mb?.questionSummarized || mb?.question || ''
    return dir === 'asc' ? ta.localeCompare(tb) : tb.localeCompare(ta)
  })
  treeStore.setRootMessageIds(sorted)
  notebookStore.syncCurrentChat()
}

const toggleSort = () => {
  sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  sortRootMessages(sortDir.value)
}

const currentNotebook = computed(() => props.chats.find(c => c.id === props.currentChatId))

const rootMessages = computed(() => {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return []
  return chat.questions.map(q => {
    const msg = treeStore.getMessageById(q.id)
    return msg ? { id: msg.id, question: msg.question, questionSummarized: msg.questionSummarized } : { id: q.id, question: q.text, questionSummarized: q.text }
  })
})

interface SearchResult {
  id: string
  question: string
  questionSummarized: string | null
  parentQuestion?: string
}

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []

  const results: SearchResult[] = []

  for (const rm of rootMessages.value) {
    const q = (rm.questionSummarized || rm.question || '').toLowerCase()
    const id = rm.id as string

    if (q.includes(query)) {
      results.push({ id, question: rm.question as string, questionSummarized: rm.questionSummarized as string | null })
    }

    const msg = treeStore.getMessageById(id)
    if (msg?.childIds?.length) {
      for (const cid of msg.childIds) {
        const child = treeStore.getMessageById(cid)
        if (!child) continue
        const cq = (child.questionSummarized || child.question || '').toLowerCase()
        if (cq.includes(query)) {
          results.push({
            id: child.id,
            question: child.question,
            questionSummarized: child.questionSummarized,
            parentQuestion: rm.questionSummarized || rm.question as string,
          })
        }
      }
    }
  }

  return results
})

function handleSearchSelect(result: SearchResult) {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return
  emit('select-question', { id: result.id, chatId: chat.id, rootIndex: 0 })
  searchQuery.value = ''
}

function handleTreeSelect(selection: { id: string }) {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return
  emit('select-question', { id: selection.id, chatId: chat.id, rootIndex: 0 })
}

function handleTreeRename(data: Record<string, unknown>, text: string) {
  const id = data.id as string
  if (id) treeStore.setQuestionSummarized(id, text)
}

function handleTreeDeleteRoot(data: Record<string, unknown>) {
  const id = data.id as string
  if (!id || !props.currentChatId) return
  emit('delete-question', id, props.currentChatId)
}

function handleTreeDeleteChild(data: Record<string, unknown>) {
  const id = data.id as string
  if (!id) return
  treeStore.deleteChildMessage(id)
}

function handleTreeDrop(dropData: { messageId: string; targetId: string; position: 'above' | 'below'; targetIndex: number; targetParentId: string | null }) {
  const chat = props.chats.find(c => c.id === props.currentChatId)
  if (!chat) return
  const rootIds = [...chat.questions.map(q => q.id)]

  if (dropData.position === 'above') {
    treeStore.moveMessage(dropData.messageId, dropData.targetParentId, dropData.targetIndex, rootIds)
  } else {
    treeStore.moveMessage(dropData.messageId, dropData.targetId, 0, rootIds)
  }

  notebookStore.syncCurrentChat()
}

function navigateToNotebookOverview() {
  if (props.currentChatId) router.push({ name: 'current-content', params: { type: 'notebook', id: props.currentChatId } })
}
</script>

<style scoped>
.chat-sidebar { width: 100%; height: 100%; background-color: var(--color-bg-base); display: flex; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
.sidebar-header { padding: 1rem; border-bottom: 1px solid var(--color-border-subtle); }

.chat-list-header { display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem 0.25rem; }
.sort-btn { padding: 0.15rem 0.5rem; font-size: 0.7rem; font-weight: 600; background: var(--color-bg-page); border: 1px solid var(--color-border-subtle); border-radius: 4px; color: var(--color-text-muted); cursor: pointer; transition: all 0.15s; flex-shrink: 0; }
.sort-btn:hover { background: var(--color-bg-hover); }
.sort-btn.asc, .sort-btn.desc { color: var(--color-border-accent); border-color: var(--color-border-accent); }
.sort-btn.desc { transform: rotate(180deg); }

/* Overview header item */
.overview-header-item { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; border-radius: 4px; transition: background-color 0.15s; min-width: 0; }
.overview-header-item:hover { background-color: var(--color-bg-hover); }
.overview-header-item span { font-size: 0.9rem; font-weight: 600; color: var(--color-text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.chat-list { flex: 1; overflow-y: auto; padding: 1rem 0.5rem; }
.chat-list::-webkit-scrollbar { width: 8px; }
.chat-list::-webkit-scrollbar-track { background: var(--color-scrollbar-track); }
.chat-list::-webkit-scrollbar-thumb { background: var(--color-scrollbar-thumb); border-radius: 4px; }
.chat-list::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }

/* New question button */
.new-question-item { display: flex; align-items: flex-start; gap: 0.25rem; padding: 0.35rem 0.5rem; cursor: pointer; transition: all 0.15s; border-radius: 4px; user-select: none; opacity: 0.5; }
.new-question-item:hover, .new-question-item.active { opacity: 1; background-color: var(--color-bg-hover); }
.new-question-icon { font-size: 0.95rem; font-weight: bold; color: var(--color-text-muted); line-height: 1.4; }
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
