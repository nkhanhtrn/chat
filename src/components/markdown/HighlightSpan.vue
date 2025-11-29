<template>
  <mark
    class="custom-highlight"
    :style="{ backgroundColor: highlightColor }"
    :data-highlight-id="highlightId"
    :data-md-start="startOffset"
    :data-md-end="endOffset"
    @click="handleClick"
  >
    <slot>{{ text }}</slot>
  </mark>
</template>

<script setup>
import { computed } from 'vue'
import { highlightColors } from '../../constants/highlightColors.js'

const props = defineProps({
  text: {
    type: String,
    default: ''
  },
  colorIndex: {
    type: Number,
    default: 0
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

const highlightColor = computed(() => highlightColors[props.colorIndex] || highlightColors[0])

const emit = defineEmits(['highlight-click'])

function handleClick(event) {
  event.stopPropagation()
  emit('highlight-click', {
    highlightId: props.highlightId,
    text: props.text,
    colorIndex: props.colorIndex,
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
  border-radius: 0;
  background-color: var(--color-highlight);
  transition: background-color 0.2s ease;
  cursor: pointer;
}

.custom-highlight:hover {
  filter: brightness(0.9);
}
</style>
