<template>
  <div class="messages-container" ref="containerRef">
    <div v-if="messages.length === 0" class="empty-state">
      <p>What do you want to build today? ✨</p>
      <p class="subtext">Describe your idea to get started</p>
    </div>
    <StudioChatMessage
      v-for="(msg, index) in messages"
      :key="index"
      :msg="msg"
      :is-last-message="index === messages.length - 1"
      :is-last-user-message="index === lastUserMessageIndex"
      :is-streaming="isStreaming"
      :is-searching="isSearching"
      :search-query="searchQuery"
      :current-planning-step="currentPlanningStep"
      @edit="(newContent) => $emit('edit', index, newContent)"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import StudioChatMessage from './StudioChatMessage.vue'

defineEmits(['edit'])

const props = defineProps({
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

// Find the index of the last user message
const lastUserMessageIndex = computed(() => {
  for (let i = props.messages.length - 1; i >= 0; i--) {
    if (props.messages[i].role === 'user') {
      return i
    }
  }
  return -1
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
  padding: 1.25rem;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
  font-size: 0.9rem;
  text-align: center;
  padding: 2rem;
}

.empty-state p {
  margin: 0;
}

.empty-state .subtext {
  font-size: 0.85rem;
  margin-top: 0.5rem;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .messages-container {
    padding: 1rem;
  }
}
</style>
