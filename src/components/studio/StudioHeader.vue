<template>
  <header class="studio-header">
    <router-link to="/" class="back-link">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
      </svg>
      Home
    </router-link>
    <h1>AI Studio</h1>
  </header>
</template>

<script setup>
</script>

<style scoped>
.studio-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 2rem;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-surface);
}

.back-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: var(--color-text-muted);
  text-decoration: none;
  font-family: 'Georgia', serif;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.back-link:hover {
  color: var(--color-text-base);
}

.studio-header h1 {
  font-family: 'Georgia', serif;
  font-size: 1.25rem;
  font-weight: normal;
  color: var(--color-text-base);
  margin: 0;
  flex: 1;
}

@media (max-width: 768px) {
  .studio-header {
    padding: 0.75rem 1rem;
  }
}
</style>
