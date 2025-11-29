<template>
  <blockquote class="markdown-blockquote">
    <slot></slot>
  </blockquote>
</template>

<script setup>
</script>

<style scoped>
.markdown-blockquote {
  border-left: 4px solid #667eea;
  padding-left: 1em;
  margin: 1.5em 0;
  color: #4a5568;
  font-style: italic;
}
</style>
