<template>
  <span v-html="content"></span>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    default: ''
  }
})
</script>
