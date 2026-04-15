<template>
  <Teleport to="body">
    <div v-if="visible" class="mermaid-modal-overlay" @click.self="$emit('close')">
      <div class="mermaid-modal-content">
        <div class="mermaid-modal-header">
          <span>Mermaid Diagram</span>
          <button class="close-btn" @click="$emit('close')">&times;</button>
        </div>
        <div class="mermaid-modal-body" v-html="svg"></div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean
  svg: string
}>()

defineEmits<{ close: [] }>()
</script>

<style scoped>
.mermaid-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.mermaid-modal-content {
  background: var(--color-bg-base);
  border-radius: 8px;
  max-width: 90vw;
  max-height: 90vh;
  overflow: auto;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}
.mermaid-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--color-border-base);
  font-weight: 600;
  color: var(--color-text-message);
}
.close-btn {
  background: none;
  border: none;
  font-size: 1.5rem;
  cursor: pointer;
  color: var(--color-text-muted);
  padding: 0 4px;
}
.close-btn:hover { color: var(--color-text-message); }
.mermaid-modal-body {
  padding: 24px;
  display: flex;
  justify-content: center;
}
</style>
