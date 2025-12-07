<template>
  <div>
    <!-- Breadcrumb Navigation -->
    <div v-if="currentMessage" class="breadcrumb-nav">
      <div class="breadcrumb">
        <Button
          class="breadcrumb-item breadcrumb-index"
          @click="navigateToIndex"
          title="Go to index"
          variant="tertiary"
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z"/>
          </svg>
        </Button>
        <span class="breadcrumb-sep">&gt;</span>
        <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
          <div class="breadcrumb-item-wrapper">
            <Button
              class="breadcrumb-item"
              :class="{ active: msg.id === currentMessage.id && !getChildren(msg).length }"
              @click="onBreadcrumbClick(msg)"
              :title="msg.question"
              variant="tertiary"
            >
              {{ msg.questionSummarized }}
              <span v-if="isMessageStreaming(msg.id)" class="streaming-indicator"></span>
            </Button>
            <!-- Children popup -->
            <div
              v-if="msg.id === currentMessage.id && showChildrenPopup && getChildren(msg).length"
              class="children-popup"
            >
              <div class="children-popup-backdrop" @click="showChildrenPopup = false"></div>
              <div class="children-popup-content">
                <Button
                  v-for="child in getChildren(msg)"
                  :key="child.id"
                  class="children-popup-item"
                  @click="navigateToChild(child.id)"
                  :title="child.question"
                  variant="tertiary"
                >
                  {{ child.questionSummarized || truncateQuestion(child.question) }}
                </Button>
              </div>
            </div>
          </div>
          <span v-if="idx < breadcrumbMessages.length - 1" class="breadcrumb-sep">&gt;</span>
        </template>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat.js'
import Button from './Button.vue'

const props = defineProps({
  currentMessage: {
    type: Object,
    required: true
  }
})

const router = useRouter()
const chatStore = useChatStore()
const getScrollPosition = inject('getScrollPosition', () => 0)

const showChildrenPopup = ref(false)

const breadcrumbMessages = computed(() => {
  const path = []
  let msg = props.currentMessage
  const visited = new Set()
  // Build path up to current message
  while (msg && !visited.has(msg.id)) {
    path.unshift(msg)
    visited.add(msg.id)
    msg = msg.parentId ? chatStore.messagesById[msg.parentId] : null
  }
  return path
})

function getChildren(msg) {
  return chatStore.getChildren(msg.id)
}

function onBreadcrumbClick(msg) {
  if (msg.id === props.currentMessage.id) {
    // Toggle children popup for current message
    const children = getChildren(msg)
    if (children.length) {
      showChildrenPopup.value = !showChildrenPopup.value
    }
  } else {
    // Save current scroll position before navigating
    if (chatStore.currentMessageId) {
      chatStore.saveScrollPosition(chatStore.currentMessageId, getScrollPosition())
    }

    // Update the router - the router watcher in ChatView will handle updating the store
    router.push({
      name: 'question',
      params: { id: chatStore.currentChatId, questionId: msg.id }
    })
  }
}

function navigateToChild(id) {
  showChildrenPopup.value = false

  // Save current scroll position before navigating
  if (chatStore.currentMessageId) {
    chatStore.saveScrollPosition(chatStore.currentMessageId, getScrollPosition())
  }

  // Update the router - the router watcher in ChatView will handle updating the store
  router.push({
    name: 'question',
    params: { id: chatStore.currentChatId, questionId: id }
  })
}

function navigateToIndex() {
  // Save current scroll position before navigating
  if (chatStore.currentMessageId) {
    chatStore.saveScrollPosition(chatStore.currentMessageId, getScrollPosition())
  }

  // Navigate to the notebook index page
  router.push({
    name: 'notebook',
    params: { id: chatStore.currentChatId }
  })
}

function truncateQuestion(question) {
  if (!question) return ''
  return question.length > 30 ? question.substring(0, 30) + '...' : question
}

function isMessageStreaming(messageId) {
  return chatStore.streamingMessageId === messageId
}
</script>

<style scoped>
/* Breadcrumb styles */
.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 0.97em;
  margin: 0.2em 0;
  gap: 0;
  user-select: none;
}

.breadcrumb-item.active {
  pointer-events: none;
  opacity: 0.6;
}

.breadcrumb-index {
  display: flex;
  align-items: center;
}

.breadcrumb-sep {
  color: var(--color-bg-accent-muted);
  font-weight: bold;
  padding: 0;
  font-size: 1.1em;
}

.breadcrumb-item-wrapper {
  position: relative;
}

.children-popup {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 100;
}

.children-popup-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: transparent;
  z-index: 99;
}

.children-popup-content {
  position: relative;
  z-index: 100;
  min-width: 180px;
  max-width: 300px;
  max-height: 300px;
  overflow-y: auto;
  background: var(--color-bg-context-menu);
  border: 1px solid var(--color-border-context);
  box-shadow: 0 4px 12px var(--shadow-md);
  border-radius: 4px;
  padding: 0.25rem;
}

.children-popup-item {
  width: 100%;
  text-align: left;
  justify-content: flex-start;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Streaming indicator */
.streaming-indicator {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-left: 6px;
  border: 2px solid var(--color-border-subtle, #e5e7eb);
  border-top-color: var(--color-primary, #6366f1);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

</style>
