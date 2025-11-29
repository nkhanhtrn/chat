<template>
  <mark
    class="custom-highlight"
    :style="{ backgroundColor: color }"
    :data-highlight-id="highlightId"
    :data-md-start="startOffset"
    :data-md-end="endOffset"
    @click="handleClick"
  >
    <slot>{{ text }}</slot>
  </mark>
</template>

<script setup>
const props = defineProps({
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

const emit = defineEmits(['highlight-click'])

function handleClick(event) {
  event.stopPropagation()
  emit('highlight-click', {
    highlightId: props.highlightId,
    text: props.text,
    startOffset: props.startOffset,
    endOffset: props.endOffset,
    x: event.clientX,
    y: event.clientY
  })
}
</script>

<style scoped>
.custom-highlight {
  padding: 2px 0;
  border-radius: 3px;
  background-color: var(--color-highlight);
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.custom-highlight:hover {
  filter: brightness(0.9);
}
</style>
