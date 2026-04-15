<template>
  <Modal :visible="visible" title="Settings" size="large" @close="$emit('update:modelValue', false)">
    <p>Settings content coming soon.</p>
  </Modal>
</template>

<script setup lang="ts">
import Modal from './Modal.vue'

const props = defineProps<{ modelValue?: boolean }>()
const visible = computed(() => props.modelValue ?? false)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

import { computed } from 'vue'
</script>
