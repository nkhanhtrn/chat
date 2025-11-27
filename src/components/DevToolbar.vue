<template>
  <div class="dev-toolbar">
    <button @click="handleClearCache" class="dev-button" title="Clear localStorage cache">
      Reset localStorage
    </button>
  </div>
</template>

<script setup>
import { clearAllStorage } from '../services/storage.js'

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
  background: #f8f8f8;
}
.dev-button {
  background: #f3f3f3;
  border: 1px solid #bbb;
  color: #333;
  font: inherit;
  padding: 0.25rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
  box-shadow: none;
  transition: background 0.15s, border 0.15s;
}
.dev-button:hover {
  background: #e2e2e2;
  border-color: #888;
}
.dev-button:active {
  background: #d1d1d1;
  border-color: #666;
}
</style>
