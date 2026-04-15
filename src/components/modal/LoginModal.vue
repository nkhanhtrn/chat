<template>
  <Modal :visible="visible" title="Sign In" size="small" @close="$emit('close')">
    <p>Login coming soon.</p>
  </Modal>
</template>
<script setup lang="ts">
import Modal from './Modal.vue'
defineProps<{ visible?: boolean }>()
defineEmits<{ close: []; success: [] }>()
</script>
