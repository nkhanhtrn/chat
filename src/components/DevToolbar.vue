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
  background: var(--color-bg-toolbar);
}
.dev-button {
  background: var(--color-bg-button);
  border: 1px solid var(--color-button-border);
  color: var(--color-text-code);
  font: inherit;
  padding: 0.25rem 0.9rem;
  border-radius: 4px;
  cursor: pointer;
  margin-left: 0.5rem;
  box-shadow: none;
  transition: background 0.15s, border 0.15s;
}
.dev-button:hover {
  background: var(--color-bg-button-hover);
  border-color: var(--color-button-border-hover);
}
.dev-button:active {
  background: var(--color-bg-button-active);
  border-color: var(--color-button-border-active);
}
</style>
