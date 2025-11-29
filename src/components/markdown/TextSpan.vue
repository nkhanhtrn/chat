<template>
  <span
    :data-md-start="startOffset"
    :data-md-end="endOffset"
  >
    <slot>{{ content }}</slot>
  </span>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    default: ''
  },
  startOffset: {
    type: Number,
    required: true
  },
  endOffset: {
    type: Number,
    required: true
  }
})
</script>
