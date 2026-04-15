<template>
  <span :data-md-start="startOffset" :data-md-end="endOffset">
    <slot>{{ content }}</slot>
  </span>
</template>

<script setup lang="ts">
defineProps<{
  content?: string
  startOffset?: number
  endOffset?: number
}>()
</script>
