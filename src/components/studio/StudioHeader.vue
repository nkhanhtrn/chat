<template>
  <header class="studio-header">
    <h1>AI Studio</h1>
  </header>
</template>

<script setup>
</script>

<style scoped>
.studio-header {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-base);
}

.studio-header h1 {
  font-family: 'Georgia', 'Palatino Linotype', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-message);
  margin: 0;
}
</style>
