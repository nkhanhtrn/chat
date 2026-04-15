<template>
  <a :href="href" :title="title" class="markdown-link" target="_blank" rel="noopener noreferrer">
    <slot></slot>
  </a>
</template>

<script setup lang="ts">
defineProps<{
  href: string
  title?: string
}>()
</script>

<style scoped>
.markdown-link { color: var(--color-primary, #667eea); text-decoration: none; }
.markdown-link:hover { text-decoration: underline; }
</style>
