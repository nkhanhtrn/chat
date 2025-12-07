<template>
  <div class="mermaid-block-wrapper">
    <div v-if="isCollapsed" class="collapse-row">
      <button @click="toggleCollapse" class="collapse-btn" title="Expand">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
      </button>
      <span class="collapsed-label" @click="toggleCollapse">mermaid ({{ lineCount }} lines)</span>
    </div>
    <div v-else class="mermaid-container">
      <button @click="toggleCollapse" class="collapse-btn collapse-btn-side" title="Collapse">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <div class="mermaid-block">
        <div class="mermaid-header">
          <span>mermaid</span>
          <div class="header-actions">
            <Button @click="openModal" class="expand-btn" title="Open in modal" variant="tertiary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </Button>
            <Button @click="copyCode" class="copy-btn" title="Copy code" variant="tertiary">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </Button>
          </div>
        </div>
        <div class="mermaid-content" :class="{ flashing: isFlashing }">
          <div v-if="error" class="mermaid-error">{{ error }}</div>
          <div v-else class="mermaid-svg-container" v-html="svg"></div>
        </div>
      </div>
    </div>

    <MermaidModal
      :visible="isModalOpen"
      :svg="svg"
      @close="closeModal"
    />
  </div>
</template>

<script>
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import mermaid from 'mermaid'
import Button from '../Button.vue'
import MermaidModal from '../Modal/MermaidModal.vue'

function isDarkMode() {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'sepia') return true
  if (stored === 'light') return false
  // Auto mode - check system preference
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function initMermaid() {
  const dark = isDarkMode()
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    fontFamily: 'inherit',
    themeVariables: dark ? {
      // Dark theme colors
      primaryColor: '#3a3a3a',
      primaryTextColor: '#e0e0e0',
      primaryBorderColor: '#5a5a5a',
      lineColor: '#808080',
      secondaryColor: '#2d2d2d',
      tertiaryColor: '#252525',
      background: '#1e1e1e',
      mainBkg: '#2d2d2d',
      nodeBorder: '#5a5a5a',
      clusterBkg: '#252525',
      clusterBorder: '#4a4a4a',
      titleColor: '#e0e0e0',
      edgeLabelBackground: '#2d2d2d',
      nodeTextColor: '#e0e0e0',
    } : {
      // Light theme colors
      primaryColor: '#e8e8e8',
      primaryTextColor: '#333333',
      primaryBorderColor: '#c0c0c0',
      lineColor: '#666666',
      secondaryColor: '#f0f0f0',
      tertiaryColor: '#f5f5f5',
      background: '#ffffff',
      mainBkg: '#f5f5f5',
      nodeBorder: '#c0c0c0',
      clusterBkg: '#f8f8f8',
      clusterBorder: '#d0d0d0',
      titleColor: '#333333',
      edgeLabelBackground: '#ffffff',
      nodeTextColor: '#333333',
    }
  })
}

export default {
  name: 'MermaidBlock',
  components: {
    Button,
    MermaidModal
  },
  props: {
    code: {
      type: String,
      required: true
    }
  },
  setup(props) {
    const svg = ref('')
    const error = ref('')
    const isFlashing = ref(false)
    const isCollapsed = ref(false)
    const isModalOpen = ref(false)

    const lineCount = computed(() => props.code.split('\n').length)

    const renderDiagram = async () => {
      initMermaid()
      error.value = ''
      svg.value = ''

      try {
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
        const { svg: renderedSvg } = await mermaid.render(id, props.code)
        svg.value = renderedSvg
      } catch (e) {
        error.value = e.message || 'Failed to render mermaid diagram'
      }
    }

    // Re-render when theme changes
    const handleStorageChange = (e) => {
      if (e.key === 'theme') {
        nextTick(renderDiagram)
      }
    }

    const toggleCollapse = () => {
      isCollapsed.value = !isCollapsed.value
    }

    const openModal = () => {
      isModalOpen.value = true
    }

    const closeModal = () => {
      isModalOpen.value = false
    }

    const copyCode = async () => {
      try {
        await navigator.clipboard.writeText(props.code)
        isFlashing.value = true
        setTimeout(() => {
          isFlashing.value = false
        }, 200)
      } catch (e) {
        console.error('Failed to copy:', e)
      }
    }

    onMounted(() => {
      nextTick(renderDiagram)
      window.addEventListener('storage', handleStorageChange)
    })

    onUnmounted(() => {
      window.removeEventListener('storage', handleStorageChange)
    })

    watch(() => props.code, () => {
      nextTick(renderDiagram)
    })

    return {
      svg,
      error,
      isFlashing,
      isCollapsed,
      isModalOpen,
      lineCount,
      toggleCollapse,
      openModal,
      closeModal,
      copyCode
    }
  }
}
</script>

<style scoped>
.mermaid-block-wrapper {
  margin: 12px 0;
}

.collapse-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.mermaid-container {
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

.mermaid-block {
  flex: 1;
  background-color: var(--color-mermaid-bg);
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid var(--color-mermaid-border);
}

.mermaid-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 12px;
  background-color: var(--color-mermaid-header-bg);
  border-bottom: 1px solid var(--color-mermaid-border);
  font-size: 12px;
  color: var(--color-mermaid-label-text);
  font-weight: 600;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 4px;
}

.mermaid-content {
  padding: 16px;
  display: flex;
  justify-content: center;
  overflow: auto;
  background-color: var(--color-mermaid-bg);
}

.mermaid-svg-container {
  display: flex;
  justify-content: center;
}

.mermaid-content.flashing {
  animation: flash 0.2s ease-out;
}

@keyframes flash {
  0% {
    background-color: rgba(212, 212, 212, 0.2);
  }
  100% {
    background-color: var(--color-mermaid-bg);
  }
}

.mermaid-error {
  color: var(--color-mermaid-error-text);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'source-code-pro', monospace;
  font-size: 13px;
  white-space: pre-wrap;
}
</style>
