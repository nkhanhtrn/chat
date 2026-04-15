<template>
  <div class="mermaid-block-wrapper">
    <CollapseToggle :is-collapsed="isCollapsed" :label="`mermaid (${lineCount} lines)`" @toggle="isCollapsed = !isCollapsed">
      <div class="mermaid-block">
        <div class="mermaid-header">
          <span>mermaid</span>
          <div class="header-actions">
            <button @click="isModalOpen = true" class="expand-btn" title="Open in modal">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="15 3 21 3 21 9"></polyline>
                <polyline points="9 21 3 21 3 15"></polyline>
                <line x1="21" y1="3" x2="14" y2="10"></line>
                <line x1="3" y1="21" x2="10" y2="14"></line>
              </svg>
            </button>
            <button @click="copyCode" class="copy-btn" title="Copy code">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            </button>
          </div>
        </div>
        <div class="mermaid-content" :class="{ flashing: isFlashing }">
          <div v-if="error" class="mermaid-error">{{ error }}</div>
          <div v-else class="mermaid-svg-container" v-html="svg"></div>
        </div>
      </div>
    </CollapseToggle>
    <MermaidModal :visible="isModalOpen" :svg="svg" @close="isModalOpen = false" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import MermaidModal from '../Modal/MermaidModal.vue'
import CollapseToggle from './CollapseToggle.vue'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let mermaidInstance: any = null

async function getMermaid() {
  if (!mermaidInstance) {
    const { default: mermaid } = await import('mermaid')
    mermaidInstance = mermaid
  }
  return mermaidInstance
}

function isDarkMode(): boolean {
  const stored = localStorage.getItem('theme')
  if (stored === 'dark' || stored === 'sepia') return true
  if (stored === 'light') return false
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

async function initMermaid() {
  const mermaid = await getMermaid()
  const dark = isDarkMode()
  mermaid.initialize({
    startOnLoad: false,
    theme: 'base',
    securityLevel: 'strict',
    fontFamily: 'inherit',
    themeVariables: dark ? {
      primaryColor: '#3a3a3a', primaryTextColor: '#e0e0e0', primaryBorderColor: '#5a5a5a',
      lineColor: '#808080', secondaryColor: '#2d2d2d', tertiaryColor: '#252525',
      background: '#1e1e1e', mainBkg: '#2d2d2d', nodeBorder: '#5a5a5a',
      clusterBkg: '#252525', clusterBorder: '#4a4a4a', titleColor: '#e0e0e0',
      edgeLabelBackground: '#2d2d2d', nodeTextColor: '#e0e0e0',
    } : {
      primaryColor: '#e8e8e8', primaryTextColor: '#333333', primaryBorderColor: '#c0c0c0',
      lineColor: '#666666', secondaryColor: '#f0f0f0', tertiaryColor: '#f5f5f5',
      background: '#ffffff', mainBkg: '#f5f5f5', nodeBorder: '#c0c0c0',
      clusterBkg: '#f8f8f8', clusterBorder: '#d0d0d0', titleColor: '#333333',
      edgeLabelBackground: '#ffffff', nodeTextColor: '#333333',
    },
  })
  return mermaid
}

const props = defineProps<{ code: string }>()

const svg = ref('')
const error = ref('')
const isFlashing = ref(false)
const isCollapsed = ref(false)
const isModalOpen = ref(false)

const lineCount = computed(() => props.code.split('\n').length)

async function renderDiagram() {
  error.value = ''
  svg.value = ''
  try {
    const mermaid = await initMermaid()
    const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
    const { svg: renderedSvg } = await mermaid.render(id, props.code)
    svg.value = renderedSvg
  } catch (e) {
    error.value = (e as Error).message || 'Failed to render mermaid diagram'
  }
}

function handleStorageChange(e: StorageEvent) {
  if (e.key === 'theme') nextTick(renderDiagram)
}

async function copyCode() {
  try {
    await navigator.clipboard.writeText(props.code)
    isFlashing.value = true
    setTimeout(() => { isFlashing.value = false }, 200)
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

watch(() => props.code, () => { nextTick(renderDiagram) })
</script>

<style scoped>
.mermaid-block-wrapper { margin: 12px 0; }
.mermaid-block { flex: 1; background-color: var(--color-mermaid-bg); border-radius: 6px; overflow: hidden; border: 1px solid var(--color-mermaid-border); }
.mermaid-header { display: flex; justify-content: space-between; align-items: center; padding: 10px 12px; background-color: var(--color-mermaid-header-bg); border-bottom: 1px solid var(--color-mermaid-border); font-size: 12px; color: var(--color-mermaid-label-text); font-weight: 600; }
.header-actions { display: flex; align-items: center; gap: 4px; }
.expand-btn, .copy-btn { background: none; border: none; color: var(--color-text-muted); cursor: pointer; padding: 4px; border-radius: 3px; }
.expand-btn:hover, .copy-btn:hover { background: var(--color-bg-hover); }
.mermaid-content { padding: 16px; display: flex; justify-content: center; overflow: auto; background-color: var(--color-mermaid-bg); }
.mermaid-svg-container { display: flex; justify-content: center; }
.mermaid-content.flashing { animation: flash 0.2s ease-out; }
@keyframes flash { 0% { background-color: rgba(212, 212, 212, 0.2); } 100% { background-color: var(--color-mermaid-bg); } }
.mermaid-error { color: var(--color-mermaid-error-text); font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', monospace; font-size: 13px; white-space: pre-wrap; }
</style>
