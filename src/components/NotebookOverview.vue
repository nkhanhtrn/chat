<template>
  <div class="notebook-overview">
    <p>Notebook overview coming soon.</p>
  </div>
</template>
<script setup lang="ts">
defineProps<{
  notebookId?: string
  title?: string
  questionCount?: number
  rootMessages?: Array<Record<string, unknown>>
}>()

defineEmits<{
  'select-question': [data: Record<string, unknown>]
  'rename-notebook': [title: string]
  'delete-root': [data: Record<string, unknown>]
  'delete-child': [data: Record<string, unknown>]
  rename: [data: Record<string, unknown>, text: string]
  drop: [data: Record<string, unknown>]
}>()
</script>
