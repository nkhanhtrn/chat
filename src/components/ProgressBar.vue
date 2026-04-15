<template>
  <div class="progress-bar-container">
    <div class="progress-bar">
      <div class="progress-fill" :style="{ width: Math.max(progress, 1) + '%' }"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  progress?: number
}>()
</script>

<style scoped>
.progress-bar-container { width: 80%; height: 7px; }
.progress-bar { width: 100%; height: 100%; background: rgba(255, 255, 255, 0.3); border-radius: 4px; overflow: hidden; }
.progress-fill { height: 100%; min-width: 3px; background: rgba(255, 255, 255, 0.9); transition: width 0.3s ease; }
</style>
