<template>
  <span v-html="content"></span>
</template>

<script setup lang="ts">
defineProps<{
  content?: string
}>()
</script>
