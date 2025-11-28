<template>
  <div>
    <!-- Breadcrumb Navigation -->
    <div v-if="currentMessage" class="breadcrumb-nav">
      <div class="breadcrumb">
        <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
          <Button
            v-if="idx === 0"
            @click="navigateToBreadcrumb(msg.id)"
            class="home-button"
            :title="msg.question"
            variant="tertiary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" style="vertical-align: middle;"><polygon points="12,6 6,12 7.5,12 7.5,18 16.5,18 16.5,12 18,12" fill="currentColor"/><rect x="9.5" y="13.5" width="5" height="4.5" rx="1" fill="currentColor"/><rect x="11.25" y="15.5" width="1.5" height="2.5" rx="0.5" fill="#fff"/></svg>
          </Button>
          <span
            v-else
            class="breadcrumb-item"
            :class="{ active: msg.id === currentMessage.id }"
            @click="navigateToBreadcrumb(msg.id)"
            :title="msg.question"
          >
            {{ msg.questionSummarized }}
          </span>
          <span v-if="idx < breadcrumbMessages.length - 1" class="breadcrumb-sep">&gt;</span>
        </template>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div v-if="currentMessage" class="nav-buttons">
      <Button
        @click="switchToParent"
        class="nav-btn nav-arrow"
        :disabled="!currentMessage.parentId"
        title="Go to parent message"
        variant="tertiary"
      >&lt;</Button>
      <Button
        @click="switchToLastVisitedChild"
        class="nav-btn nav-arrow"
        :disabled="!currentMessage.hasChildren"
        title="Go to child message"
        variant="tertiary"
      >&gt;</Button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'
import Button from './Button.vue'

const props = defineProps({
  currentMessage: {
    type: Object,
    required: true
  }
})

const chatStore = useChatStore()

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
  // If lastVisitedChild exists and is not the current message, append it
  const lastVisitedChildId = props.currentMessage.lastVisitedChild
  if (
    lastVisitedChildId &&
    chatStore.messagesById[lastVisitedChildId] &&
    lastVisitedChildId !== props.currentMessage.id
  ) {
    path.push(chatStore.messagesById[lastVisitedChildId])
  }
  return path
})

function navigateToBreadcrumb(id) {
  if (id === props.currentMessage.id) return
  chatStore.navigateToMessage(id)
}

function switchToParent() {
  chatStore.navigateToParent(props.currentMessage?.id)
}

function switchToLastVisitedChild() {
  chatStore.navigateToLastVisitedChild(props.currentMessage?.id)
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

.breadcrumb-item {
  color: var(--color-accent);
  cursor: pointer;
  padding: 0;
  border-radius: 0;
  background: none;
  font-weight: normal;
  transition: color 0.15s, text-decoration 0.15s;
}

.breadcrumb-item.active {
  color: var(--color-text-on-accent);
  cursor: default;
  text-decoration: none;
}

/* Make the last breadcrumb item grey and no underline on hover */
.breadcrumb-item:last-of-type:not(.active) {
  color: #aaa !important;
  cursor: pointer;
  text-decoration: none !important;
}
.breadcrumb-item:last-of-type:not(.active):hover {
  color: #aaa !important;
  text-decoration: none !important;
}

.breadcrumb-item:hover:not(.active) {
  color: var(--color-accent-hover);
  text-decoration: underline;
  background: none;
}

.breadcrumb-sep {
  color: var(--color-bg-accent-muted);
  font-weight: bold;
  padding: 0 0.25em;
  font-size: 1.1em;
}

/* Navigation buttons container */
.nav-buttons {
  position: absolute;
  top: 0.5em;
  right: 0.5em;
  z-index: 2;
  display: flex;
  gap: 0.15em;
  align-items: center;
}

/* Navigation button styles */
.nav-btn.nav-arrow {
  font-size: 1.2rem;
  line-height: 1;
}

/* Home button styles */
.home-button {
  padding: 0.15rem 0.4rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
</style>
