<template>
  <component :is="'h' + level" :class="headingClass">
    <slot></slot>
  </component>
</template>

<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  level: number
}>()

const headingClass = computed(() => `markdown-heading-${props.level}`)
</script>

<style scoped>
h1, h2, h3, h4, h5, h6 {
  margin-top: 2em;
  margin-bottom: 1em;
  font-weight: 600;
  color: var(--color-text-strong);
}
h1:first-child, h2:first-child, h3:first-child, h4:first-child, h5:first-child, h6:first-child { margin-top: 0; }
h1 { font-size: 1.8em; border-bottom: 2px solid var(--color-border-subtle); padding-bottom: 0.3em; }
h2 { font-size: 1.5em; border-bottom: 1px solid var(--color-border-subtle); padding-bottom: 0.3em; }
h3 { font-size: 1.3em; }
h4 { font-size: 1.15em; }
h5 { font-size: 1.05em; }
h6 { font-size: 1em; }
</style>
