<template>
  <mark
    class="custom-highlight"
    :style="{ backgroundColor: color }"
    :data-highlight-id="highlightId"
    :data-md-start="startOffset"
    :data-md-end="endOffset"
  >
    <slot>{{ text }}</slot>
  </mark>
</template>

<script setup>
defineProps({
  text: {
    type: String,
    default: ''
  },
  color: {
    type: String,
    default: 'var(--color-highlight)'
  },
  highlightId: {
    type: String,
    required: true
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

<style scoped>
.custom-highlight {
  padding: 2px 0;
  border-radius: 3px;
  background-color: var(--color-highlight);
  transition: background-color 0.2s ease;
}
</style>
