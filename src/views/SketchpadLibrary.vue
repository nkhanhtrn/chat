<template>
  <AppLayout storage-key="sidebar">
    <div class="sketchpad-library">
      <div class="library-header">
        <h1>Sketchpads</h1>
        <div class="header-actions">
          <Button variant="primary" @click="createNew">+ New Sketchpad</Button>
        </div>
      </div>
      <SlideTransition appear direction="vertical">
        <div class="sketch-grid">
          <div
            v-for="sb in sketchbooksStore.sorted"
            :key="sb.id"
            class="sketch-card"
            @click="open(sb.id)"
          >
            <div class="sketch-cover">
              <svg viewBox="0 0 100 141" preserveAspectRatio="xMidYMid meet">
                <rect width="100" height="141" fill="var(--color-bg-page, #fff)" />
                <PreviewStrokes :strokes="previewStrokes(sb.id)" />
              </svg>
            </div>
            <div class="sketch-info">
              <h3 v-if="editingId !== sb.id" class="sketch-title" @dblclick.stop="startRename(sb)">{{ sb.title || 'Untitled' }}</h3>
              <input
                v-else
                ref="renameInputs"
                v-model="renameValue"
                class="rename-input"
                @click.stop
                @keydown.enter="commitRename(sb)"
                @keydown.escape="cancelRename"
                @blur="commitRename(sb)"
              />
              <p class="sketch-meta">{{ strokeCount(sb.id) }} strokes · {{ formatDate(sb.updatedAt) }}</p>
            </div>
            <button class="delete-btn" @click.stop="confirmDelete(sb)" title="Delete">&times;</button>
          </div>
          <div v-if="sketchbooksStore.sorted.length === 0" class="empty-state">
            <div class="empty-icon">✏️</div>
            <p>No sketchpads yet</p>
            <p class="empty-hint">Create your first sketchpad to start drawing</p>
          </div>
        </div>
      </SlideTransition>
    </div>
  </AppLayout>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, h, defineComponent } from 'vue'
import { useRouter } from 'vue-router'
import AppLayout from '@/components/AppLayout.vue'
import Button from '@/components/Button.vue'
import SlideTransition from '@/components/SlideTransition.vue'
import { useSketchbooksStore } from '@/stores/sketchbooks'
import { useStrokesStore } from '@/stores/strokes'
import { sketchbookKey, type Sketchbook, PAGE_WIDTH, PAGE_HEIGHT } from '@/types/sketchbook'
import type { Stroke } from '@/types/stroke'
import { strokeColor } from '@/services/strokeLayer'

const router = useRouter()
const sketchbooksStore = useSketchbooksStore()
const strokesStore = useStrokesStore()

const editingId = ref<string | null>(null)
const renameValue = ref('')
const renameInputs = ref<HTMLInputElement[]>([])

function open(id: string): void {
  router.push({ name: 'sketchbook', params: { id } })
}

async function createNew(): Promise<void> {
  const sb = await sketchbooksStore.create('Untitled')
  router.push({ name: 'sketchbook', params: { id: sb.id } })
}

function startRename(sb: Sketchbook): void {
  editingId.value = sb.id
  renameValue.value = sb.title
  nextTick(() => renameInputs.value[0]?.focus())
}

async function commitRename(sb: Sketchbook): Promise<void> {
  if (editingId.value !== sb.id) return
  const title = renameValue.value.trim()
  await sketchbooksStore.rename(sb.id, title || 'Untitled')
  editingId.value = null
}

function cancelRename(): void {
  editingId.value = null
}

async function confirmDelete(sb: Sketchbook): Promise<void> {
  if (!confirm(`Delete "${sb.title || 'Untitled'}"? This removes all its pages.`)) return
  await sketchbooksStore.remove(sb.id)
}

function formatDate(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// Preview rendering for the card cover — first page's strokes, scaled into the thumbnail
function previewStrokes(id: string): Stroke[] {
  const key = sketchbookKey(id)
  return strokesStore.forPage(key, 1).slice(0, 60)
}

function strokeCount(id: string): number {
  const key = sketchbookKey(id)
  return strokesStore.byBook[key]?.length ?? 0
}

// Functional render of stroke thumbnails
const PreviewStrokes = defineComponent({
  props: { strokes: { type: Array as () => Stroke[], required: true } },
  setup(props) {
    const W = 100, H = 141
    return () => {
      const children = props.strokes.map(s =>
        h('polyline', {
          key: s.id,
          points: s.points.map(p => `${(p.x / PAGE_WIDTH) * W},${(p.y / PAGE_HEIGHT) * H}`).join(' '),
          fill: 'none',
          stroke: strokeColor(s.tool, s.colorIndex),
          'stroke-width': String((s.width ?? 2) * 0.12),
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          opacity: s.tool === 'highlighter' ? 0.7 : 1,
        })
      )
      return children.length ? h('g', {}, children) : h('text', { x: 50, y: 75, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--color-text-muted)' }, 'Blank')
    }
  },
})

onMounted(async () => {
  await sketchbooksStore.load()
  // Eagerly load strokes for previews
  for (const sb of sketchbooksStore.list) {
    strokesStore.loadForBook(sketchbookKey(sb.id)).catch(() => {})
  }
})
</script>

<style scoped>
.sketchpad-library { height: 100%; overflow-y: auto; background-color: var(--color-bg-base); padding: 2rem; }
.library-header { display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto 2rem; padding-bottom: 1rem; border-bottom: 1px solid var(--color-border-base); }
.library-header h1 { font-family: Georgia, serif; font-size: 2rem; font-weight: 400; color: var(--color-text-message); margin: 0; }
.header-actions { display: flex; gap: 0.5rem; align-items: center; }
.sketch-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 1.5rem; max-width: 1200px; margin: 0 auto; }
.sketch-card { position: relative; display: flex; flex-direction: column; background: var(--color-bg-page); border: 1px solid var(--color-border-base); border-radius: 12px; overflow: hidden; cursor: pointer; transition: all 0.2s; }
.sketch-card:hover { border-color: var(--color-border-accent); box-shadow: 0 4px 12px var(--shadow-primary); transform: translateY(-2px); }
.sketch-cover { width: 100%; aspect-ratio: 100 / 141; background: var(--color-bg-hover); border-bottom: 1px solid var(--color-border-subtle); }
.sketch-cover svg { width: 100%; height: 100%; display: block; }
.sketch-info { padding: 0.75rem 1rem; }
.sketch-title { margin: 0 0 0.25rem; font-size: 1rem; font-weight: 600; color: var(--color-text-base); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; cursor: text; }
.rename-input { width: 100%; padding: 0.15rem 0.3rem; border: 1px solid var(--color-border-accent); border-radius: 4px; background: var(--color-bg-base); color: var(--color-text-base); font-size: 1rem; font-weight: 600; margin: 0 0 0.25rem; }
.rename-input:focus { outline: none; }
.sketch-meta { margin: 0; font-size: 0.8rem; color: var(--color-text-muted); }
.delete-btn { position: absolute; top: 0.5rem; right: 0.5rem; width: 24px; height: 24px; border: none; background: transparent; color: var(--color-text-muted); font-size: 1.25rem; cursor: pointer; border-radius: 4px; opacity: 0; transition: opacity 0.2s; }
.sketch-card:hover .delete-btn { opacity: 1; }
.delete-btn:hover { background: var(--color-error-bg); color: var(--color-error-text); }
.empty-state { grid-column: 1 / -1; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4rem 2rem; text-align: center; color: var(--color-text-muted); }
.empty-icon { font-size: 4rem; margin-bottom: 1rem; opacity: 0.5; }
.empty-state p { margin: 0.25rem 0; }
.empty-hint { font-size: 0.875rem; font-style: italic; }
@media (max-width: 768px) {
  .sketchpad-library { padding: 1rem; }
  .sketch-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 1rem; }
  .delete-btn { opacity: 1; }
}
</style>
