<template>
  <div class="svg-renderer" v-html="content"></div>
</template>

<script setup>
defineProps({
  content: {
    type: String,
    required: true
  }
})
</script>

<style scoped>
.svg-renderer {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.svg-renderer :deep(svg) {
  max-width: 100%;
  max-height: 100%;
}
</style>
