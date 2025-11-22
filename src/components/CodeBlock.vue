<template>
  <div class="code-block">
    <div class="code-header">
      <span>{{ language }}</span>
      <button @click="copyCode" class="copy-btn" title="Copy code">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
      </button>
    </div>
    <pre><code>{{ code }}</code></pre>
  </div>
</template>

<script>
export default {
  name: 'CodeBlock',
  props: {
    language: {
      type: String,
      default: 'plaintext'
    },
    code: {
      type: String,
      required: true
    }
  },
  methods: {
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.code)
      } catch (error) {
        console.error('Failed to copy code:', error)
      }
    }
  }
}
</script>

<style scoped>
.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.copy-btn {
  background: none;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
}

.copy-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
}

.copy-btn:active {
  transform: scale(0.95);
}
</style>
