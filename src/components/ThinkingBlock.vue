<template>
  <div class="thinking-section">
    <div 
      class="thinking-header" 
      @click="toggleThinking"
    >
      <span class="thinking-icon">{{ isExpanded ? '▼' : '▶' }}</span>
      <span class="thinking-label">
        <template v-if="compressed">
          Compressed previous conversation ({{ compressedCount }} messages)
        </template>
        <template v-else>
          Thinking<span class="thinking-dots"><span>.</span><span>.</span><span>.</span></span>
        </template>
      </span>
    </div>
    <div v-if="isExpanded" class="thinking-content">
      <div v-if="Array.isArray(thinkingMessages)" class="thinking-list">
        <div v-for="(message, index) in visibleMessages" :key="index" class="thinking-item">
          {{ message }}
        </div>
      </div>
      <div v-else>
        {{ thinkingMessages }}
      </div>
    </div>
  </div>
</template>

<script>
import { ref, watch, computed } from 'vue'

export default {
  name: 'ThinkingBlock',
  props: {
    content: {
      type: [String, Array],
      required: true
    },
    showThinking: {
      type: Boolean,
      default: false
    },
    compressed: {
      type: Boolean,
      default: false
    },
    compressedCount: {
      type: Number,
      default: 0
    }
  },
  setup(props) {
    const isExpanded = ref(props.showThinking)

    const thinkingMessages = computed(() => props.content)

    // Filter to show only completed tasks and the next active task
    const visibleMessages = computed(() => {
      if (!Array.isArray(props.content)) {
        return props.content
      }

      const messages = props.content
      const visible = []
      
      for (let i = 0; i < messages.length; i++) {
        const message = messages[i]
        // Check if task is complete (starts with ✓ or ✗)
        const isComplete = message.startsWith('✓') || message.startsWith('✗')
        
        visible.push(message)
        
        // If this task is not complete, stop here (don't show future tasks)
        if (!isComplete) {
          break
        }
      }
      
      return visible
    })

    // Watch for changes to showThinking prop
    watch(() => props.showThinking, (newValue) => {
      isExpanded.value = newValue
    })

    const toggleThinking = () => {
      isExpanded.value = !isExpanded.value
    }

    return {
      isExpanded,
      thinkingMessages,
      visibleMessages,
      toggleThinking
    }
  }
}
</script>

<style scoped>
.thinking-section {
  margin-bottom: 0.75rem;
  border: 1px solid var(--border-color);
  border-radius: 6px;
  overflow: hidden;
}

.thinking-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  background: var(--thinking-bg);
  cursor: pointer;
  user-select: none;
  transition: background-color 0.15s;
}

.thinking-header:hover {
  background: var(--thinking-hover-bg);
}

.thinking-icon {
  font-size: 0.75rem;
  color: var(--text-secondary);
  transition: transform 0.15s;
}

.thinking-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-weight: 500;
}

.thinking-dots {
  display: inline-flex;
  gap: 2px;
}

.thinking-dots span {
  animation: blink 1.4s infinite both;
}

.thinking-dots span:nth-child(2) {
  animation-delay: 0.2s;
}

.thinking-dots span:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes blink {
  0%, 80%, 100% {
    opacity: 0;
  }
  40% {
    opacity: 1;
  }
}

.thinking-content {
  padding: 0.75rem;
  background: var(--code-bg);
  white-space: pre-wrap;
  font-family: monospace;
  font-size: 0.875rem;
  line-height: 1.5;
  color: var(--text-primary);
  border-top: 1px solid var(--border-color);
}

.thinking-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.thinking-item {
  padding: 0.25rem 0;
}
</style>
