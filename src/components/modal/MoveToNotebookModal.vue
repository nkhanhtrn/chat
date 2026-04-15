<template>
  <Modal :visible="visible" title="Move to Notebook" size="medium" @close="$emit('cancel')">
    <p>Move to notebook coming soon.</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

defineProps<{
  visible?: boolean
  notebooks?: Array<Record<string, unknown>>
  currentNotebookId?: string | null
}>()

defineEmits<{
  'select-new': []
  'select-existing': [notebook: Record<string, unknown>]
  cancel: []
}>()
</script>
