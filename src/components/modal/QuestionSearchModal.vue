<template>
  <Modal :visible="visible" title="Find Question" size="medium" @close="$emit('cancel')">
    <p>Question search coming soon.</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

defineProps<{ visible?: boolean }>()
defineEmits<{
  select: [data: { targetMessageId: string }]
  cancel: []
}>()
</script>
