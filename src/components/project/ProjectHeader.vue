<template>
  <header class="project-header">
    <button class="back-btn" @click="$router.push({ name: 'projects' })" title="Back to projects">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="15 18 9 12 15 6"></polyline>
      </svg>
    </button>
    <InlineEdit
      class="header-title"
      textClass="title-text"
      inputClass="title-input"
      :modelValue="name"
      @save="(newName: string) => $emit('rename', newName)"
    />
  </header>
</template>

<script setup lang="ts">
import InlineEdit from '@/components/InlineEdit.vue'

defineProps<{
  name: string
}>()

defineEmits<{
  rename: [name: string]
}>()
</script>

<style scoped>
.project-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-base);
}
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.back-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
.header-title {
  flex: 1;
  min-width: 0;
}
.header-title :deep(.title-text) {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-message);
}
.header-title :deep(.title-input) {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: 1.25rem;
  font-weight: 400;
  width: 100%;
  padding: 2px 4px;
}
.header-title :deep(.inline-edit-wrapper) {
  width: 100%;
}
</style>
