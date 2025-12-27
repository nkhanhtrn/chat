<template>
  <div class="websearch-progress">
    <div v-if="searchQuery" class="search-query">
      <span class="query-label">Query:</span>
      <span class="query-text">"{{ searchQuery }}"</span>
    </div>
    <div class="search-sources">
      <div
        v-for="(source, idx) in sources"
        :key="idx"
        :class="['source-item', source.status]"
      >
        <div class="source-header">
          <span class="source-number">{{ idx + 1 }}</span>
          <a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer" class="source-title-link">
            {{ source.title || 'Loading...' }}
          </a>
          <span v-else class="source-title">{{ source.title || 'Loading...' }}</span>
          <span :class="['fetch-badge', source.fetchStatus || source.status]">
            <span v-if="source.status === 'loading'" class="spinner small"></span>
            <template v-else>{{ source.fetchStatus === 'fetched' ? 'Fetched' : (source.fetchStatus === 'snippet' ? 'Snippet' : (source.status === 'success' ? '✓' : '✗')) }}</template>
          </span>
        </div>
        <div v-if="source.url" class="source-url">{{ source.url }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
defineProps({
  searchQuery: {
    type: String,
    default: ''
  },
  sources: {
    type: Array,
    default: () => []
  }
})
</script>

<style scoped>
.websearch-progress {
  padding: 0.5rem 0.75rem;
}

.search-query {
  display: flex;
  gap: 0.4rem;
  margin-bottom: 0.5rem;
  font-size: 0.8rem;
}

.query-label {
  color: var(--color-text-muted);
}

.query-text {
  color: var(--color-text-base);
  font-style: italic;
}

.search-sources {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.source-item {
  padding: 0.4rem 0.5rem;
  background-color: var(--color-bg-page);
  border-radius: 4px;
  font-size: 0.75rem;
}

.source-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.source-item.loading {
  opacity: 0.7;
}

.source-item.success {
  border-left: 2px solid #22c55e;
}

.source-item.error {
  border-left: 2px solid #ef4444;
}

.source-number {
  width: 1.2rem;
  height: 1.2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: var(--color-bg-hover);
  border-radius: 50%;
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--color-text-muted);
}

.source-title,
.source-title-link {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--color-text-base);
}

.source-title-link {
  text-decoration: none;
}

.source-title-link:hover {
  text-decoration: underline;
  color: var(--color-primary, #3b82f6);
}

.source-url {
  margin-top: 0.2rem;
  margin-left: 1.7rem;
  font-size: 0.65rem;
  color: var(--color-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fetch-badge {
  margin-left: auto;
  padding: 0.1rem 0.4rem;
  border-radius: 3px;
  font-size: 0.6rem;
  font-weight: 600;
  text-transform: uppercase;
}

.fetch-badge.fetched,
.fetch-badge.success {
  background-color: rgba(34, 197, 94, 0.15);
  color: #22c55e;
}

.fetch-badge.snippet,
.fetch-badge.error {
  background-color: rgba(251, 191, 36, 0.15);
  color: #f59e0b;
}

.fetch-badge.loading {
  background-color: rgba(59, 130, 246, 0.15);
  padding: 0.2rem;
}

.spinner {
  width: 14px;
  height: 14px;
  border: 2px solid var(--color-border-base);
  border-top-color: var(--color-primary, #3b82f6);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.spinner.small {
  width: 10px;
  height: 10px;
  border-width: 1.5px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}
</style>
