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
.progress-bar-container { width: 100%; height: 3px; }
.progress-bar { width: 100%; height: 100%; background: var(--color-border-base, rgba(0,0,0,0.1)); border-radius: 2px; overflow: hidden; }
.progress-fill { height: 100%; min-width: 3px; background: var(--color-primary, #404040); transition: width 0.3s ease; }
</style>
