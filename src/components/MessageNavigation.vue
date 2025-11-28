<template>
  <div>
    <!-- Breadcrumb Navigation -->
    <div v-if="currentMessage" class="breadcrumb-nav">
      <div class="breadcrumb">
        <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
          <span
            class="breadcrumb-item"
            :class="{ active: msg.id === currentMessage.id }"
            @click="navigateToBreadcrumb(msg.id)"
            :title="msg.question"
          >
            <template v-if="idx === 0">
              <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" style="vertical-align: middle; margin-bottom: 2px;"><polygon points="12,6 6,12 7.5,12 7.5,18 16.5,18 16.5,12 18,12" fill="#38b2ac"/><rect x="9.5" y="13.5" width="5" height="4.5" rx="1" fill="#38b2ac"/><rect x="11.25" y="15.5" width="1.5" height="2.5" rx="0.5" fill="#fff"/></svg>
            </template>
            <template v-else>
              {{ msg.questionSummarized }}
            </template>
          </span>
          <span v-if="idx < breadcrumbMessages.length - 1" class="breadcrumb-sep">&gt;</span>
        </template>
      </div>
    </div>

    <!-- Navigation Buttons -->
    <div v-if="currentMessage" class="nav-buttons">
      <button
        @click="switchToParent"
        class="nav-btn nav-arrow"
        :disabled="!currentMessage.parentId"
        title="Go to parent message"
        style="font-size: 1.2rem; color: #38b2ac; line-height: 1; padding-bottom: 2px; cursor: pointer;"
      >&lt;</button>
      <button
        @click="switchToLastVisitedChild"
        class="nav-btn nav-arrow"
        :disabled="!currentMessage.hasChildren"
        title="Go to child message"
        style="font-size: 1.2rem; color: #38b2ac; line-height: 1; padding-bottom: 2px; cursor: pointer;"
      >&gt;</button>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { useChatStore } from '../stores/chat.js'

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
.nav-btn {
  background: var(--color-accent);
  color: var(--color-text-inverse);
  width: 1.7em;
  height: 1.7em;
  font-size: 1.1em;
  font-weight: 600;
  border: none;
  border-radius: 8px;
  outline: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: none;
  transition: background 0.2s, color 0.2s;
  padding: 0;
  cursor: pointer;
}

.nav-btn svg {
  width: 22px;
  height: 22px;
  display: block;
}

.nav-btn.nav-arrow {
  background: var(--color-bg-base) !important;
}

.nav-btn:hover {
  background: var(--color-bg-accent-subtle) !important;
  color: var(--color-accent-hover);
  box-shadow: 0 2px 6px var(--shadow-accent);
}

.nav-btn:active {
  background: var(--color-accent-hover);
  color: var(--color-text-inverse);
}

.nav-btn:disabled {
  background: var(--color-nav-disabled-bg);
  color: var(--color-nav-disabled-text);
  cursor: not-allowed;
  opacity: 0.5;
  box-shadow: none;
}

.nav-btn:disabled:hover {
  background: var(--color-nav-disabled-bg);
  color: var(--color-nav-disabled-text);
}

.home-btn {
  background: var(--color-bg-base) !important;
}

.home-btn svg {
  width: 28px;
  height: 28px;
  display: block;
}

/* Home button specific styles */
.home-btn svg {
  width: 28px;
  height: 28px;
}
</style>
