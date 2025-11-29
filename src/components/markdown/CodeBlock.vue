<template>
  <div class="code-block-wrapper">
    <div v-if="isCollapsed" class="collapse-row">
      <button @click="toggleCollapse" class="collapse-btn" title="Expand">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <span class="collapsed-label" @click="toggleCollapse">{{ language }} ({{ lineCount }} lines)</span>
    </div>
    <div v-else class="code-container">
      <button @click="toggleCollapse" class="collapse-btn collapse-btn-side" title="Collapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <div class="code-block">
        <div class="code-header">
          <span>{{ language }}</span>
          <Button @click="copyCode" class="copy-btn" title="Copy code" variant="tertiary">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
            </svg>
          </Button>
        </div>
        <pre :class="{ flashing: isFlashing }"><code>{{ code }}</code></pre>
      </div>
    </div>
  </div>
</template>

<script>
import Button from '../Button.vue'

export default {
  name: 'CodeBlock',
  components: {
    Button
  },
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
  data() {
    return {
      isFlashing: false,
      isCollapsed: false
    }
  },
  computed: {
    lineCount() {
      return this.code.split('\n').length
    }
  },
  methods: {
    toggleCollapse() {
      this.isCollapsed = !this.isCollapsed
    },
    async copyCode() {
      try {
        await navigator.clipboard.writeText(this.code)
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
.code-block-wrapper {
  margin: 12px 0;
}

.collapse-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.code-container {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.collapse-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text-muted, #888);
  opacity: 0.5;
  transition: opacity 0.2s;
}

.collapse-btn:hover {
  opacity: 1;
}

.collapse-btn-side {
  margin-top: 8px;
  flex-shrink: 0;
}

.collapsed-label {
  font-size: 13px;
  color: var(--color-text-muted, #888);
  cursor: pointer;
  font-style: italic;
}

.collapsed-label:hover {
  color: var(--color-text, #333);
}

.code-block {
  flex: 1;
  background-color: var(--color-code-block-bg);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-code-block-border);
}

.code-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--color-code-block-header-bg);
  border-bottom: 1px solid var(--color-code-block-border);
  font-size: 12px;
  color: var(--color-code-block-header-text);
  font-weight: 600;
}

pre {
  margin: 0;
  padding: 10px 12px;
  overflow-x: auto;
  background-color: var(--color-code-block-bg);
}

pre code {
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: var(--color-code-block-text);
}

pre.flashing {
  animation: flash 0.2s ease-out;
}

@keyframes flash {
  0% {
    background-color: rgba(212, 212, 212, 0.2);
  }
  100% {
    background-color: var(--color-code-block-bg);
  }
}
</style>
