<template>
  <div class="dev-toolbar">
    <Button @click="handleClearCache" class="dev-button" title="Clear localStorage cache" variant="secondary">
      Reset localStorage
    </Button>
  </div>
</template>

<script setup>
import { clearAllStorage } from '../services/storage.js'
import Button from './Button.vue'

const handleClearCache = () => {
  if (confirm('Are you sure you want to clear all localStorage cache? This will delete all your chat history.')) {
    clearAllStorage()
    window.location.reload()
  }
}
</script>

<style scoped>
.dev-toolbar {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background: var(--color-bg-toolbar);
}
</style>
