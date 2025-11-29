<template>
  <a :href="href" :title="title" class="markdown-link" target="_blank" rel="noopener noreferrer">
    <slot></slot>
  </a>
</template>

<script setup>
defineProps({
  href: {
    type: String,
    required: true
  },
  title: {
    type: String,
    default: ''
  }
})
</script>

<style scoped>
.markdown-link {
  color: #667eea;
  text-decoration: none;
}

.markdown-link:hover {
  text-decoration: underline;
}
</style>
