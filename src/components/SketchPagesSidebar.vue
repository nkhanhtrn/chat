<template>
  <div class="pages-sidebar">
    <div class="pages-list">
      <div
        v-for="p in pages"
        :key="p"
        class="page-thumb"
        :class="{ active: p === currentPage, blank: strokesForPage(p).length === 0 }"
        @click="emit('select', p)"
      >
        <svg viewBox="0 0 794 1123" preserveAspectRatio="xMidYMid meet" class="page-svg">
          <rect width="794" height="1123" fill="var(--color-bg-page, #fff)" />
          <g v-if="strokesForPage(p).length">
            <template v-for="s in strokesForPage(p)" :key="s.id">
              <polyline
                v-if="s.tool === 'highlighter'"
                :points="toPoints(s.points)"
                fill="none"
                :style="{ stroke: strokeColor(s.tool, s.colorIndex) }"
                :stroke-width="s.width ?? 14"
                stroke-linecap="round"
                stroke-linejoin="round"
                opacity="0.7"
              />
              <polyline
                v-else
                :points="toPoints(s.points)"
                fill="none"
                :style="{ stroke: strokeColor(s.tool, s.colorIndex) }"
                :stroke-width="s.width ?? 1.8"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </template>
          </g>
          <text v-else x="500" y="720" text-anchor="middle" font-size="60" fill="var(--color-text-muted)">Blank</text>
        </svg>
        <span class="page-num">{{ p }}</span>
        <button
          class="page-delete"
          title="Delete page"
          @click.stop="emit('delete', p)"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
        </button>
      </div>
    </div>
    <button class="add-page-btn" @click="emit('add')">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
      <span>New Page</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useStrokesStore } from '@/stores/strokes'
import { strokeColor } from '@/services/strokeLayer'
import type { Stroke, StrokePoint } from '@/types/stroke'

const props = defineProps<{
  notebookKey: string
  currentPage: number
  pageCount: number
}>()

const emit = defineEmits<{
  select: [page: number]
  add: []
  delete: [page: number]
}>()

const strokesStore = useStrokesStore()

const allStrokes = computed<Stroke[]>(() => strokesStore.byBook[props.notebookKey] ?? [])

const pages = computed(() => {
  const top = Math.max(props.pageCount, props.currentPage, 1)
  return Array.from({ length: top }, (_, i) => i + 1)
})

function strokesForPage(page: number): Stroke[] {
  return strokesStore.forPage(props.notebookKey, page)
}

function toPoints(points: StrokePoint[]): string {
  return points.map(p => `${p.x},${p.y}`).join(' ')
}
</script>

<style scoped>
.pages-sidebar { height: 100%; display: flex; flex-direction: column; min-height: 0; }
.pages-list { flex: 1; min-height: 0; overflow-y: auto; padding: 0.5rem; display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 95px), 1fr)); gap: 0.6rem; }
.page-thumb {
  position: relative; width: 100%; aspect-ratio: 794 / 1123;
  background: var(--color-bg-page, #fff); border: 2px solid var(--color-border-base);
  border-radius: 4px; cursor: pointer; padding: 0; overflow: hidden; transition: border-color 0.15s, box-shadow 0.15s;
}
.page-thumb:hover { border-color: var(--color-border-accent); }
.page-thumb.active { border-color: var(--color-primary, var(--color-border-accent)); box-shadow: 0 0 0 2px var(--color-primary-subtle, rgba(99,102,241,0.15)); }
.page-thumb.blank .page-svg { opacity: 0.6; }
.page-svg { width: 100%; height: 100%; display: block; }
.page-num {
  position: absolute; bottom: 0.15rem; right: 0.2rem; font-size: 0.55rem; font-weight: 600;
  color: var(--color-text-muted); background: var(--color-bg-base); padding: 0.05rem 0.3rem;
  border-radius: 3px; border: 1px solid var(--color-border-subtle);
}
.page-thumb.active .page-num { color: var(--color-primary, var(--color-text-base)); border-color: var(--color-border-accent); }
.page-delete {
  position: absolute; top: 0.2rem; right: 0.2rem; width: 18px; height: 18px;
  display: flex; align-items: center; justify-content: center;
  background: var(--color-bg-base); border: 1px solid var(--color-border-base);
  border-radius: 4px; color: var(--color-text-muted); cursor: pointer; padding: 0;
  opacity: 0.4; transition: opacity 0.15s, color 0.15s, background 0.15s; z-index: 5;
}
.page-thumb:hover .page-delete { opacity: 1; }
.page-delete:hover { color: #d65a5a; border-color: #d65a5a; background: var(--color-bg-hover); }
.page-delete svg { width: 10px; height: 10px; }
.add-page-btn {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  padding: 0.4rem; margin: 0 0.5rem 0.5rem; border: 1px dashed var(--color-border-base);
  border-radius: 6px; background: transparent; color: var(--color-text-muted); cursor: pointer;
  font-size: 0.85rem; transition: all 0.15s;
}
.add-page-btn:hover { border-color: var(--color-border-accent); color: var(--color-text-base); background: var(--color-bg-hover); }
.add-page-btn svg { width: 16px; height: 16px; }
</style>
