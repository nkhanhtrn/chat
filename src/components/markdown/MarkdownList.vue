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
</style>
