<template>
  <div class="toc-entry">
    <div
      :class="['toc-item', { active: item.href === activeHref, 'has-children': item.subitems?.length }]"
      :style="{ paddingLeft: depth * 0.75 + 0.5 + 'rem' }"
      @click="handleClick"
    >
      <span v-if="item.subitems?.length" class="expand-icon" @click.stop="toggleExpand">{{ expanded ? '▾' : '▸' }}</span>
      <span class="toc-item-text">{{ item.label }}</span>
    </div>
    <div v-if="expanded && item.subitems?.length" class="toc-children">
      <BookTocItem
        v-for="child in item.subitems"
        :key="child.id"
        :item="child"
        :depth="depth + 1"
        :active-href="activeHref"
        @navigate="$emit('navigate', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import type { TocItem } from '@/types/book'

const props = defineProps<{
  item: TocItem
  depth: number
  activeHref?: string | null
}>()

const emit = defineEmits<{
  navigate: [href: string]
}>()

const expanded = ref(props.depth === 0)

function toggleExpand() {
  expanded.value = !expanded.value
}

function handleClick() {
  if (props.item.subitems?.length) {
    expanded.value = !expanded.value
  }
  emit('navigate', props.item.href)
}
</script>

<style scoped>
.toc-entry { width: 100%; }

.toc-item {
  display: flex;
  align-items: flex-start;
  padding-top: 0.35rem;
  padding-bottom: 0.35rem;
  padding-right: 0.5rem;
  cursor: pointer;
  transition: all 0.15s;
  border-radius: 4px;
  gap: 0.25rem;
  user-select: none;
}
.toc-item:hover, .toc-item.active { background-color: var(--color-bg-hover); }
.toc-item.active .toc-item-text { color: var(--color-text-strong); font-weight: 600; }

.expand-icon {
  flex-shrink: 0;
  width: 0.85rem;
  font-size: 0.7rem;
  color: var(--color-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1.4;
  cursor: pointer;
}
.expand-icon:hover { color: var(--color-text-strong); }

.toc-item-text {
  font-size: 0.9rem;
  color: var(--color-text-muted);
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.toc-children {
  border-left: 1px solid var(--color-border-subtle);
  margin-left: 0.5rem;
}
</style>
