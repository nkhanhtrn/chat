<template>
  <div>
    <!-- Breadcrumb Navigation -->
    <div v-if="currentMessage && breadcrumbMessages.length > 1" class="breadcrumb-nav">
      <div class="breadcrumb">
        <template v-for="(msg, idx) in breadcrumbMessages" :key="msg.id">
          <Button
            v-if="idx === 0"
            @click="navigateToBreadcrumb(msg.id)"
            class="breadcrumb-item"
            :title="msg.question"
            variant="tertiary"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 001 1h12a1 1 0 001-1V10"/></svg>
          </Button>
          <Button
            v-else
            class="breadcrumb-item"
            :class="{ active: msg.id === currentMessage.id }"
            @click="navigateToBreadcrumb(msg.id)"
            :title="msg.question"
            variant="tertiary"
          >
            {{ msg.questionSummarized }}
          </Button>
          <span v-if="idx < breadcrumbMessages.length - 1" class="breadcrumb-sep">&gt;</span>
        </template>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
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

function navigateToBreadcrumb(id) {
  if (id === props.currentMessage.id) return
  const scrollPos = chatStore.navigateToMessage(id, getScrollPosition())
  setScrollPosition(scrollPos)
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
</style>
