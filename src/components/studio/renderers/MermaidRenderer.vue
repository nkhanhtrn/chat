<template>
  <MermaidBlock :code="content" />
</template>

<script setup>
import MermaidBlock from '../../markdown/MermaidBlock.vue'

defineProps({
  content: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
/* MermaidBlock provides its own styles */
</style>
