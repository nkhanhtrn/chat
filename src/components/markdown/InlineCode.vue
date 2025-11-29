<template>
  <span class="inline-code-wrapper">
    <code
      :class="['inline-code', { flashing: isFlashing }]"
      :data-md-start="startOffset"
      :data-md-end="endOffset"
    >
      <slot>{{ content }}</slot>
    </code>
    <Button @click="copyCode" class="copy-btn" title="Copy code" variant="tertiary">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </Button>
  </span>
</template>

<script>
import Button from '../Button.vue'

export default {
  name: 'InlineCode',
  components: {
    Button
  },
  props: {
    content: {
      type: String,
      default: ''
    },
    startOffset: {
      type: Number,
      default: undefined
    },
    endOffset: {
      type: Number,
      default: undefined
    }
  },
  data() {
    return {
      isFlashing: false
    }
  },
  computed: {
    codeText() {
      // Get text from slot or prop
      return this.$slots.default ? this.$slots.default()[0].children : this.content
    }
  },
  methods: {
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.codeText)
        this.isFlashing = true
        setTimeout(() => {
          this.isFlashing = false
        }, 200)
      } catch (error) {
        console.error('Failed to copy code:', error)
      }
    }
  }
}
</script>

<style scoped>
.inline-code-wrapper {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.inline-code {
  background-color: var(--color-inline-code-bg);
  color: var(--color-inline-code-text);
  padding: 2px 6px;
  border-radius: 4px;
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 0.9em;
}

.copy-btn {
  padding: 2px 4px;
  min-width: auto;
  opacity: 0.6;
}

.copy-btn:hover {
  opacity: 1;
}

.inline-code.flashing {
  animation: flash 0.2s ease-out;
}

@keyframes flash {
  0% {
    background-color: rgba(212, 212, 212, 0.3);
  }
  100% {
    background-color: var(--color-inline-code-bg);
  }
}
</style>
