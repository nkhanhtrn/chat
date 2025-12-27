<template>
  <div class="messages-container" ref="containerRef">
    <div v-if="messages.length === 0" class="empty-state">
      <p>Start a conversation with the AI.</p>
      <p class="hint">Messages are not saved.</p>
    </div>
    <StudioChatMessage
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
import StudioChatMessage from './StudioChatMessage.vue'

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

// Expose container ref for parent to control scrolling
defineExpose({
  containerRef
})
</script>

<style scoped>
.messages-container {
  flex: 1;
  overflow-y: auto;
  padding: 2rem 4rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-family: 'Georgia', serif;
  font-style: italic;
}

.empty-state .hint {
  font-size: 0.85rem;
  margin-top: 0.5rem;
}

@media (max-width: 768px) {
  .messages-container {
    padding: 1rem;
  }
}
</style>
