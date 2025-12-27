<template>
  <div class="messages-area" ref="containerRef">
    <div v-if="messages.length === 0" class="empty-state">
      <div class="empty-icon">
        <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
      </div>
      <p class="empty-title">Start a conversation</p>
      <p class="empty-hint">Your messages are ephemeral and won't be saved.</p>
    </div>

    <PlaygroundMessage
      v-for="(msg, index) in messages"
      :key="index"
      :msg="msg"
      :is-last-message="index === messages.length - 1"
      :is-streaming="isStreaming"
      :is-searching="isSearching"
      :search-query="searchQuery"
      :current-planning-step="currentPlanningStep"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PlaygroundMessage from './PlaygroundMessage.vue'

defineProps({
  messages: {
    type: Array,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  },
  isSearching: {
    type: Boolean,
    default: false
  },
  searchQuery: {
    type: String,
    default: ''
  },
  currentPlanningStep: {
    type: Number,
    default: -1
  }
})

const containerRef = ref(null)

defineExpose({
  containerRef
})
</script>

<style scoped>
.messages-area {
  flex: 1;
  overflow-y: auto;
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 2rem;
}

.empty-icon {
  color: var(--color-text-muted);
  opacity: 0.4;
  margin-bottom: 1rem;
}

.empty-title {
  font-size: 1.1rem;
  font-weight: 500;
  color: var(--color-text-base);
  margin: 0 0 0.5rem;
  font-family: system-ui, -apple-system, sans-serif;
}

.empty-hint {
  font-size: 0.85rem;
  color: var(--color-text-muted);
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
}

@media (max-width: 768px) {
  .messages-area {
    padding: 1rem;
  }
}
</style>
