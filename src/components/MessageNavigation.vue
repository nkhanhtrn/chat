<template>
  <div v-if="currentMessage" class="breadcrumb-nav">
    <div class="breadcrumb">
      <button class="breadcrumb-item" @click="navigateToIndex" title="Go to index">
        <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16"><path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/></svg>
      </button>
      <span class="breadcrumb-sep">&gt;</span>
      <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
        <button class="breadcrumb-item" :class="{ active: msg.id === currentMessage.id }" @click="onBreadcrumbClick(msg)" :title="msg.question">
          {{ msg.questionSummarized }}
        </button>
        <span v-if="idx < breadcrumbMessages.length - 1" class="breadcrumb-sep">&gt;</span>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useNotebookStore } from '@/stores/notebook'
import { useMessageTreeStore } from '@/stores/messageTree'
import type { Message } from '@/models/Message'

const props = defineProps<{ currentMessage: Message }>()
const router = useRouter()
const notebookStore = useNotebookStore()
const treeStore = useMessageTreeStore()
const getScrollPosition = inject('getScrollPosition', () => 0) as () => number

const breadcrumbMessages = computed(() => {
  const path: Message[] = []
  let msg: Message | null = props.currentMessage
  const visited = new Set<string>()
  while (msg && !visited.has(msg.id)) {
    path.unshift(msg)
    visited.add(msg.id)
    msg = msg.parentId ? treeStore.getMessageById(msg.parentId) : null
  }
  return path
})

function onBreadcrumbClick(msg: Message) {
  if (msg.id === props.currentMessage.id) return
  if (treeStore.currentMessageId) {
    treeStore.saveScrollPosition(treeStore.currentMessageId, getScrollPosition())
  }
  router.push({ name: 'question', params: { id: notebookStore.currentChatId, questionId: msg.id } })
}

function navigateToIndex() {
  if (treeStore.currentMessageId) {
    treeStore.saveScrollPosition(treeStore.currentMessageId, getScrollPosition())
  }
  router.push({ name: 'notebook', params: { id: notebookStore.currentChatId } })
}
</script>

<style scoped>
.breadcrumb { display: flex; align-items: center; font-size: 0.97em; gap: 0; user-select: none; }
.breadcrumb-item { background: none; border: none; color: var(--color-text-tertiary); cursor: pointer; padding: 2px 4px; border-radius: 3px; font-size: inherit; }
.breadcrumb-item:hover { background: var(--color-bg-hover); }
.breadcrumb-item.active { opacity: 0.6; pointer-events: none; }
.breadcrumb-sep { color: var(--color-bg-accent-muted); font-weight: bold; padding: 0; font-size: 1.1em; }
</style>
