<template>
  <AppLayout storage-key="home-layout">
    <template #side><div class="side-playground-wrapper"><SideChatPlayground /></div></template>
    <div class="homepage">
      <div class="homepage-header">
        <h1>My Notebooks</h1>
        <div class="header-actions">
          <Button variant="primary" @click="createNewNotebook">+ New Notebook</Button>
        </div>
      </div>
      <div class="search-container"><input v-model="searchQuery" type="text" class="search-input" placeholder="Search questions..." /></div>
      <SlideTransition appear direction="vertical">
        <div v-if="searchQuery.trim()" class="search-results">
          <h2 class="search-results-title">Search Results <span class="result-count">({{ searchResults.length }})</span></h2>
          <div v-if="searchResults.length > 0" class="results-list">
            <div v-for="result in searchResults" :key="result.id" class="result-item" @click="openQuestion(result)">
              <div class="result-content">
                <div class="result-question">{{ (result as any).text }}</div>
                <div class="result-notebook">{{ (result as any).notebookTitle }}</div>
              </div>
            </div>
          </div>
          <div v-else class="no-results">No questions found matching "{{ searchQuery }}"</div>
        </div>
        <div v-else class="notebooks-grid">
          <div v-for="chat in notebookStore.chatList" :key="chat.id" class="notebook-card" @click="openNotebook(chat.id)">
            <div class="notebook-icon">📓</div>
            <div class="notebook-info">
              <h3 class="notebook-title">{{ chat.title || 'Untitled Notebook' }}</h3>
              <p class="notebook-meta">{{ chat.messageCount }} {{ chat.messageCount === 1 ? 'question' : 'questions' }}</p>
            </div>
            <button class="delete-btn" @click.stop="deleteNotebook(chat.id)" title="Delete">&times;</button>
          </div>
          <div v-if="notebookStore.chatList.length === 0" class="empty-state">
            <p>No notebooks yet</p>
            <p class="empty-hint">Create your first notebook to get started</p>
          </div>
        </div>
      </SlideTransition>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebook'
import { useGlobalSearch } from '@/composables/useGlobalSearch'
import AppLayout from '@/components/AppLayout.vue'
import Button from '@/components/Button.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'
import SlideTransition from '@/components/SlideTransition.vue'

const router = useRouter()
const notebookStore = useNotebookStore()
const { query: searchQuery, results: searchResults } = useGlobalSearch({ includeNotebooks: true })

const createNewNotebook = () => {
  const newChat = notebookStore.createNewChat()
  router.push({ name: 'current-content', params: { type: 'notebook', id: newChat.id } })
}

const openNotebook = (id: string) => {
  notebookStore.switchToChat(id)
  router.push({ name: 'current-content', params: { type: 'notebook', id } })
}

const openQuestion = (result: Record<string, unknown>) => {
  const chatId = result.chatId as string
  if (notebookStore.currentChatId !== chatId) notebookStore.switchToChat(chatId)
  router.push({ name: 'current-content-question', params: { type: 'notebook', id: chatId, questionId: result.id as string } })
}

const deleteNotebook = (id: string) => {
  if (confirm('Are you sure you want to delete this notebook?')) notebookStore.deleteChat(id)
}
</script>

<style scoped>
.side-playground-wrapper { height: 100%; }
.homepage { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); padding: 2rem; }
.homepage-header { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-base); }
.homepage-header h1 { font-family: Georgia, serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); margin: 0; }
.search-container { max-width: 1200px; margin: 0 auto 1.5rem; }
.search-input { width: 100%; padding: 0.75rem 1rem; font-size: 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; color: var(--color-text-message); }
.search-input:focus { outline: none; border-color: var(--color-border-accent); }
.notebooks-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
.notebook-card { display: flex; align-items: center; gap: 1rem; padding: 1.5rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; cursor: pointer; transition: all 0.2s; position: relative; }
.notebook-card:hover { border-color: var(--color-border-accent); box-shadow: 0 4px 12px var(--shadow-primary); transform: translateY(-2px); }
.notebook-icon { font-size: 2.5rem; flex-shrink: 0; }
.notebook-title { font-family: Georgia, serif; font-size: 1.1rem; font-weight: 500; color: var(--color-text-message); margin: 0 0 0.25rem; }
.notebook-meta { font-size: 0.85rem; color: var(--color-text-muted); margin: 0; }
.delete-btn { position: absolute; top: 0.5rem; right: 0.5rem; width: 24px; height: 24px; border: none; background: transparent; color: var(--color-text-muted); font-size: 1.25rem; cursor: pointer; border-radius: 4px; opacity: 0; transition: opacity 0.2s; }
.notebook-card:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error-text); }
.empty-state { grid-column: 1 / -1; text-align: center; padding: 4rem 2rem; color: var(--color-text-muted); }
.empty-hint { font-size: 0.9rem; font-style: italic; }
.result-item { padding: 1rem; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 8px; cursor: pointer; margin-bottom: 0.5rem; }
.result-item:hover { border-color: var(--color-border-accent); }
.result-question { font-family: Georgia, serif; color: var(--color-text-message); }
.result-notebook { font-size: 0.85rem; color: var(--color-text-muted); }
.no-results { text-align: center; padding: 2rem; color: var(--color-text-muted); font-style: italic; }
@media (max-width: 768px) { .homepage { padding: 1rem; } .notebooks-grid { grid-template-columns: 1fr; } .delete-btn { opacity: 1; } }
</style>
