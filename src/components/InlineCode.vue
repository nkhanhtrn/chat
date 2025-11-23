<template>
  <span class="inline-code-wrapper">
    <code :class="['inline-code', { flashing: isFlashing }]">{{ text }}</code>
    <button @click="copyCode" class="copy-btn" title="Copy code">
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    </button>
  </span>
</template>

<script>
export default {
  name: 'InlineCode',
  props: {
    text: {
      type: String,
      required: true
    }
  },
  data() {
    return {
      isFlashing: false
    }
  },
  methods: {
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.text)
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
  gap: 4px;
}

.copy-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  vertical-align: middle;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.copy-btn:active {
  transform: scale(0.95);
}

.inline-code.flashing {
  animation: flash 0.2s ease-out;
}

@keyframes flash {
  0% {
    background-color: rgba(233, 105, 0, 0.3);
    color: #e96900;
  }
  100% {
    background-color: #2d2d2d;
    color: #e96900;
  }
}
</style>
