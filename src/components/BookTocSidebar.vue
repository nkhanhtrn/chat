<template>
  <div class="book-toc-sidebar">
    <div class="sidebar-header">
      <div v-if="bookTitle" class="book-title">{{ bookTitle }}</div>
    </div>
    <div class="sidebar-search">
      <input v-model="searchQuery" type="text" class="search-input" placeholder="Search chapters..." @keydown.escape="searchQuery = ''" />
    </div>
    <div class="toc-list">
      <template v-if="searchQuery.trim()">
        <div v-if="searchResults.length > 0" class="search-results-list">
          <div
            v-for="r in searchResults"
            :key="r.id"
            :class="['toc-item', 'search-result-item', { active: r.href === activeHref }]"
            @click="$emit('navigate', r.href)"
          >
            <div v-if="r.parentLabel" class="search-result-path">
              <span class="path-text">{{ r.parentLabel }}</span>
              <span class="path-separator">›</span>
            </div>
            <div class="toc-item-text">{{ r.label }}</div>
          </div>
        </div>
        <div v-else class="empty-state">No results found</div>
      </template>
      <template v-else>
        <BookTocItem
          v-for="item in toc"
          :key="item.id"
          :item="item"
          :depth="0"
          :active-href="activeHref"
          @navigate="$emit('navigate', $event)"
        />
        <div v-if="!toc.length" class="empty-state">No chapters found</div>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import type { TocItem } from '@/types/book'
import BookTocItem from './BookTocItem.vue'

const props = defineProps<{
  toc: TocItem[]
  bookTitle: string
  activeHref?: string | null
}>()

defineEmits<{
  navigate: [href: string]
}>()

const searchQuery = ref('')

interface SearchResult {
  id: string
  label: string
  href: string
  parentLabel?: string
}

function flattenToc(items: TocItem[], parent?: string): SearchResult[] {
  const results: SearchResult[] = []
  for (const item of items) {
    results.push({ id: item.id ?? '', label: item.label, href: item.href, parentLabel: parent })
    if (item.subitems?.length) {
      results.push(...flattenToc(item.subitems, item.label))
    }
  }
  return results
}

const searchResults = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return []
  return flattenToc(props.toc).filter(r => r.label.toLowerCase().includes(query))
})
</script>

<style scoped>
.book-toc-sidebar { width: 100%; height: 100%; background-color: var(--color-bg-base); display: flex; flex-direction: column; overflow: hidden; font-family: system-ui, -apple-system, sans-serif; }
.sidebar-header { padding: 0.75rem; border-bottom: 1px solid var(--color-border-subtle); }
.book-title { font-size: 0.9rem; font-weight: 600; color: var(--color-text-strong); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.sidebar-search { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border-subtle); }
.search-input { width: 100%; padding: 0.5rem 0.75rem; font-size: 0.85rem; font-family: inherit; background-color: var(--color-bg-page); border: 1px solid var(--color-border-subtle); border-radius: 6px; color: var(--color-text-secondary); transition: border-color 0.2s, box-shadow 0.2s; }
.search-input:focus { outline: none; border-color: var(--color-border-accent); box-shadow: 0 0 0 2px var(--shadow-primary); }
.search-input::placeholder { color: var(--color-text-muted); }

.toc-list { flex: 1; overflow-y: auto; padding: 0.5rem; }
.toc-list::-webkit-scrollbar { width: 8px; }
.toc-list::-webkit-scrollbar-track { background: var(--color-scrollbar-track); }
.toc-list::-webkit-scrollbar-thumb { background: var(--color-scrollbar-thumb); border-radius: 4px; }
.toc-list::-webkit-scrollbar-thumb:hover { background: var(--color-scrollbar-thumb-hover); }

.toc-item { display: flex; align-items: flex-start; padding: 0.35rem 0.5rem; cursor: pointer; transition: all 0.15s; border-radius: 4px; user-select: none; }
.toc-item:hover, .toc-item.active { background-color: var(--color-bg-hover); }
.toc-item.active .toc-item-text { color: var(--color-text-strong); font-weight: 600; }

.toc-item-text { font-size: 0.9rem; color: var(--color-text-muted); line-height: 1.4; flex: 1; min-width: 0; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }

/* Search results */
.search-results-list { display: flex; flex-direction: column; gap: 0.25rem; }
.search-result-item { border-radius: 6px; }
.search-result-path { display: flex; align-items: center; gap: 0.25rem; margin-bottom: 0.15rem; }
.path-text { font-size: 0.75rem; color: var(--color-text-muted); max-width: 120px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.path-separator { font-size: 0.7rem; color: var(--color-text-disabled); }

.empty-state { text-align: center; padding: 2rem 1rem; color: var(--color-text-muted); font-size: 0.875rem; }
</style>
