<template>
  <StudioChartRenderer :option="parsedOption" height="100%" />
</template>

<script setup>
import { computed } from 'vue'
import StudioChartRenderer from '../../ChartRenderer.vue'

const props = defineProps({
  content: {
    type: [Object, String],
    required: true
  }
})

const parsedOption = computed(() => {
  if (typeof props.content === 'object') return props.content
  try {
    return JSON.parse(props.content)
  } catch {
    return { title: { text: 'Chart parsing error' } }
  }
})
</script>

<style scoped>
/* StudioChartRenderer provides its own styles */
</style>
