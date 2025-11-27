<template>
  <div>
    <!-- User question -->
    <div class="message message-user">
      <div class="message-header">
        <span class="role-badge">You</span>
      </div>
      <div class="message-content">
        <div class="user-message">
          {{ message.question }}
        </div>
      </div>
    </div>
    <!-- Assistant answer -->
    <div v-if="message.response" class="message message-assistant">
      <div class="message-header">
        <span class="role-badge">Study Assistant</span>
      </div>
      <div class="message-content">
        <div class="assistant-message">
          <MarkdownRenderer :content="message.response" />
          <span v-if="isStreaming" class="cursor">▊</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MarkdownRenderer from './MarkdownRenderer.vue'

const props = defineProps({
  message: {
    type: Object,
    required: true
  },
  isStreaming: {
    type: Boolean,
    default: false
  }
})

// messageClass and roleName are no longer needed since we split the elements
</script>

<style scoped>
.message {
  margin-bottom: 0.75rem;
  animation: fadeIn 0.3s ease-in;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-header {
  margin-bottom: 0.5rem;
}

.role-badge {
  display: inline-block;
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: 600;
}

.message-user .role-badge {
  background-color: #667eea;
  color: white;
}

.message-assistant .role-badge {
  background-color: #38b2ac;
  color: white;
}

.message-content {
  padding: 1rem 1.5rem;
  border-radius: 12px;
  line-height: 1.6;
}

.message-user .message-content {
  background-color: #f0f4ff;
  border-left: 4px solid #667eea;
}

.message-assistant .message-content {
  background-color: white;
  border-left: 4px solid #38b2ac;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
}

.user-message {
  color: #2d3748;
  white-space: pre-wrap;
  word-wrap: break-word;
}

.assistant-message {
  color: #2d3748;
}

.cursor {
  animation: blink 1s infinite;
  color: #38b2ac;
  font-weight: bold;
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0;
  }
}
</style>
