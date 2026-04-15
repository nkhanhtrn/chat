<template>
  <Modal :visible="visible" title="Vocabulary Review" size="medium" @close="$emit('close')">
    <p>Vocabulary review coming soon.</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

defineProps<{ visible?: boolean }>()
defineEmits<{ close: [] }>()
</script>
