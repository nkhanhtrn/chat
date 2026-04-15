<template>
  <div class="collapsible-block-wrapper">
    <div class="collapsible-header" @click="isCollapsed = !isCollapsed">
      <button class="collapse-btn" :title="isCollapsed ? 'Expand' : 'Collapse'">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline v-if="isCollapsed" points="6 9 12 15 18 9"></polyline>
          <polyline v-else points="18 15 12 9 6 15"></polyline>
        </svg>
      </button>
      <span class="collapse-label">{{ isCollapsed ? 'Show hidden content' : 'Hide content' }}</span>
    </div>
    <div v-show="!isCollapsed" class="collapsible-content">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isCollapsed = ref(true)
</script>

<style scoped>
.collapsible-block-wrapper { margin: 12px 0; border: 1px solid var(--color-code-block-border); border-radius: 6px; overflow: hidden; background-color: var(--color-code-block-bg); }
.collapsible-header { display: flex; align-items: center; gap: 6px; padding: 10px 12px; background-color: var(--color-code-block-header-bg); border-bottom: 1px solid var(--color-code-block-border); cursor: pointer; user-select: none; }
.collapsible-header:hover { background-color: var(--color-bg-hover); }
.collapse-btn { background: transparent; border: none; cursor: pointer; padding: 4px; display: flex; align-items: center; justify-content: center; color: var(--color-text-muted); opacity: 0.5; transition: opacity 0.2s; }
.collapse-btn:hover { opacity: 1; }
.collapse-label { font-size: 12px; color: var(--color-code-block-header-text); font-weight: 600; }
.collapsible-content { padding: 12px 16px; background-color: var(--color-code-block-bg); }
</style>
