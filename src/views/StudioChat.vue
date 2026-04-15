<template>
  <AppLayout storage-key="studio-layout">
    <template #side>
      <div class="studio-sidebar">
        <div class="sidebar-header">
          <h3>Studio</h3>
          <button class="new-session-btn" @click="handleNewSession">+ New</button>
        </div>
        <div class="sidebar-content">
          <SideChatPlayground />
        </div>
      </div>
    </template>
    <div class="studio-page">
      <div class="studio-placeholder">
        <h2>Studio</h2>
        <p>Code canvas and multi-tool workspace.</p>
        <p class="hint">Studio components are being rebuilt for TypeScript.</p>
      </div>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import AppLayout from '@/components/AppLayout.vue'
import SideChatPlayground from '@/components/SideChatPlayground.vue'

// TODO: Full studio implementation requires these composables/components:
// - composables/studio/useStudioSessions.ts
// - composables/studio/useStudioChat.ts
// - composables/studio/useStudioCanvas.ts
// - composables/studio/useWebSearch.ts
// - composables/studio/usePlanning.ts
// - composables/studio/useContentEditor.ts
// - components/studio/ChatPanel.vue
// - components/studio/CanvasPanel.vue
// - components/studio/SessionTabs.vue
// - components/studio/SessionBrowser.vue
// - components/studio/WindowBrowser.vue

const handleNewSession = () => {
  // TODO: create new studio session
}
</script>

<style scoped>
.studio-sidebar { display: flex; flex-direction: column; height: 100%; }
.sidebar-header { display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; border-bottom: 1px solid var(--color-border-base); }
.sidebar-header h3 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0; }
.new-session-btn { padding: 0.3rem 0.6rem; background: var(--color-primary); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem; }
.sidebar-content { flex: 1; overflow: hidden; }
.studio-page { height: 100%; display: flex; align-items: center; justify-content: center; background: var(--color-bg-page); }
.studio-placeholder { text-align: center; }
.studio-placeholder h2 { font-family: Georgia, serif; font-weight: 400; color: var(--color-text-message); margin: 0 0 0.5rem; }
.studio-placeholder p { color: var(--color-text-muted); margin: 0 0 0.25rem; }
.hint { font-size: 0.85rem; font-style: italic; }
</style>
