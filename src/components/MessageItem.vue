<template>
  <div :class="['message', message.role, { loading: message.loading }]">
    <div class="message-role">
      {{ message.role === 'user' ? 'You' : 'Assistant' }}
    </div>
    <div class="message-content">
      <div v-if="message.thinking" class="thinking-section">
        <div 
          class="thinking-header" 
          @click="toggleThinking(message)"
        >
          <span class="thinking-icon">{{ message.showThinking ? '▼' : '▶' }}</span>
          <span class="thinking-label">
            {{ message.compressed ? `Compressed previous conversation (${message.compressedCount} messages)` : 'Thinking...' }}
          </span>
        </div>
        <div v-if="message.showThinking" class="thinking-content">
          {{ message.thinking }}
        </div>
      </div>
      <MessageContent v-if="!message.compressed || !message.thinking" :content="message.displayContent" />
    </div>
    <div v-if="message.role === 'user' && isLastUserMessage" class="message-actions">
      <button 
        @click="$emit('retry')" 
        class="retry-btn"
        :disabled="isLoading"
        title="Retry this message"
      >
        ↻
      </button>
    </div>
  </div>
</template>

<script>
import MessageContent from './MessageContent.vue'

export default {
  name: 'MessageItem',
  components: {
    MessageContent
  },
  props: {
    message: {
      type: Object,
      required: true
    },
    isLoading: {
      type: Boolean,
      default: false
    },
    isLastUserMessage: {
      type: Boolean,
      default: false
    }
  },
  emits: ['retry'],
  setup() {
    const toggleThinking = (message) => {
      message.showThinking = !message.showThinking
    }

    return {
      toggleThinking
    }
  }
}
</script>
