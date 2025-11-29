<template>
  <div>
    <!-- Breadcrumb Navigation -->
    <div v-if="currentMessage" class="breadcrumb-nav">
      <div class="breadcrumb">
        <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
          <div class="breadcrumb-item-wrapper">
            <Button
              class="breadcrumb-item"
              :class="{ active: msg.id === currentMessage.id && !getChildren(msg).length }"
              @click="onBreadcrumbClick(msg)"
              :title="msg.question"
              variant="tertiary"
            >
              <svg v-if="!msg.parentId" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/></svg>
              <template v-else>{{ msg.questionSummarized }}</template>
              <span v-if="msg.id === currentMessage.id" class="children-indicator">{{ getChildren(msg).length }}</span>
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
import { useChatStore } from '../stores/chat.js'
import Button from './Button.vue'

const props = defineProps({
  currentMessage: {
    type: Object,
    required: true
  }
})

const chatStore = useChatStore()
const getScrollPosition = inject('getScrollPosition', () => 0)
const setScrollPosition = inject('setScrollPosition', () => {})

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
    const scrollPos = chatStore.navigateToMessage(msg.id, getScrollPosition())
    setScrollPosition(scrollPos)
  }
}

function navigateToChild(id) {
  showChildrenPopup.value = false
  const scrollPos = chatStore.navigateToMessage(id, getScrollPosition())
  setScrollPosition(scrollPos)
}

function truncateQuestion(question) {
  if (!question) return ''
  return question.length > 30 ? question.substring(0, 30) + '...' : question
}
</script>

<style scoped>
/* Breadcrumb styles */
.breadcrumb-nav {
  margin-bottom: 0.5em;
}

.breadcrumb {
  display: flex;
  align-items: center;
  font-size: 0.97em;
  margin-bottom: 0.2em;
  gap: 0.2em;
  user-select: none;
}

.breadcrumb-item.active {
  pointer-events: none;
  opacity: 0.6;
}

.breadcrumb-sep {
  color: var(--color-bg-accent-muted);
  font-weight: bold;
  padding: 0 0.25em;
  font-size: 1.1em;
}

.breadcrumb-item-wrapper {
  position: relative;
}

.children-indicator {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.2em;
  height: 1.2em;
  font-size: 0.75em;
  background: var(--color-bg-accent-muted);
  color: var(--color-text-strong);
  border-radius: 50%;
  margin-left: 0.3em;
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
</style>
