<template>
  <component :is="ordered ? 'ol' : 'ul'" class="markdown-list">
    <slot></slot>
  </component>
</template>

<script setup>
defineProps({
  ordered: {
    type: Boolean,
    default: false
  }
})
</script>

<style scoped>
.markdown-list {
  padding-left: 2em;
  margin-top: 1em;
  margin-bottom: 1em;
}

@media (max-width: 768px) {
  .markdown-list {
    padding-left: 1.25em;
  }
}
</style>
