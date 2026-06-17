<template>
  <header class="project-header">
    <div class="header-row">
      <button class="back-btn" @click="$router.push({ name: 'projects' })" title="Back to projects">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <div class="header-tabs">
        <button class="header-tab" :class="{ active: sideTab === 'project' }" @click="$emit('switch-tab', 'project')">
          <InlineEdit
            class="header-title"
            textClass="title-text"
            inputClass="title-input"
            :modelValue="name"
            @save="(newName: string) => $emit('rename', newName)"
          />
        </button>
        <button class="header-tab" :class="{ active: sideTab === 'chat' }" @click="$emit('switch-tab', 'chat')">Chat</button>
      </div>
      <button class="scratchpad-btn" :class="{ active: hasScratchpad }" @click="$emit('open-scratchpad')" title="Context notes">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
          <polyline points="14 2 14 8 20 8"></polyline>
          <line x1="16" y1="13" x2="8" y2="13"></line>
          <line x1="16" y1="17" x2="8" y2="17"></line>
        </svg>
      </button>
    </div>
    <div class="subproject-bar">
      <div class="tabs-scroll">
        <button
          class="subproject home-tab"
          :class="{ active: isHome }"
          @click="$emit('show-home')"
          title="All subprojects"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7"></rect>
            <rect x="14" y="3" width="7" height="7"></rect>
            <rect x="3" y="14" width="7" height="7"></rect>
            <rect x="14" y="14" width="7" height="7"></rect>
          </svg>
        </button>
        <div class="tabs-separator"></div>
        <button
          v-for="(sub, i) in openSubprojects"
          :key="sub.id"
          class="subproject"
          :data-index="i"
          :class="{
            active: sub.id === activeSubprojectId,
            'drag-over-left': dragOverIndex === i && dragOverSide === 'left',
            'drag-over-right': dragOverIndex === i && dragOverSide === 'right',
            'is-dragging': draggedId === sub.id,
          }"
          draggable="true"
          @click="$emit('switch-subproject', sub.id)"
          @dblclick="startRename(sub.id)"
          @dragstart="onDragStart($event, sub.id)"
          @dragend="onDragEnd"
          @dragover.prevent="onDragOver($event, i)"
          @dragleave="onDragLeave"
          @drop.prevent="onDrop($event, i)"
          @pointerdown="handleSubPointerDown($event, sub.id)"
        >
          <InlineEdit
            :ref="(el: any) => { if (el) inlineRefs[sub.id] = el }"
            :modelValue="sub.name"
            textClass="subproject-name"
            inputClass="tab-name-input"
            @save="(n: string) => $emit('rename-subproject', sub.id, n)"
          />
          <button
            v-if="!isStreaming"
            class="subproject-close"
            @click.stop="$emit('close-subproject', sub.id)"
            title="Close subproject"
          >&times;</button>
        </button>
      </div>
      <button class="subproject-add" @click="$emit('add-subproject')" title="New subproject">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"></line>
          <line x1="5" y1="12" x2="19" y2="12"></line>
        </svg>
      </button>
    </div>
  </header>
</template>

<script setup lang="ts">
import { ref, type ComponentPublicInstance } from 'vue'
import InlineEdit from '@/components/InlineEdit.vue'
import type { SubProject } from '@/types/project'

const props = defineProps<{
  name: string
  subprojects: SubProject[]
  openSubprojects: SubProject[]
  activeSubprojectId: string
  isHome: boolean
  isStreaming?: boolean
  hasScratchpad?: boolean
  sideTab?: 'project' | 'chat'
}>()

const emit = defineEmits<{
  rename: [name: string]
  'show-home': []
  'switch-subproject': [subprojectId: string]
  'add-subproject': []
  'close-subproject': [subprojectId: string]
  'rename-subproject': [subprojectId: string, name: string]
  'open-scratchpad': []
  'reorder-subprojects': [orderedIds: string[]]
  'switch-tab': [tab: 'project' | 'chat']
}>()

const inlineRefs = ref<Record<string, ComponentPublicInstance<{ startEditing: () => void }>>>({})

function startRename(subId: string) {
  inlineRefs.value[subId]?.startEditing()
}

const draggedId = ref<string | null>(null)
const dragOverIndex = ref<number | null>(null)
const dragOverSide = ref<'left' | 'right' | null>(null)

function onDragStart(e: DragEvent, id: string) {
  draggedId.value = id
  if (e.dataTransfer) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }
}

function onDragEnd() {
  draggedId.value = null
  dragOverIndex.value = null
  dragOverSide.value = null
}

function onDragOver(e: DragEvent, index: number) {
  if (!draggedId.value) return
  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const midX = rect.left + rect.width / 2
  dragOverIndex.value = index
  dragOverSide.value = e.clientX < midX ? 'left' : 'right'
}

function onDragLeave() {
  dragOverIndex.value = null
  dragOverSide.value = null
}

function onDrop(_e: DragEvent, dropIndex: number) {
  if (!draggedId.value) return
  const ids = props.openSubprojects.map(s => s.id)
  const fromIdx = ids.indexOf(draggedId.value!)
  if (fromIdx === -1) { onDragEnd(); return }
  const toIdx = dragOverSide.value === 'left' ? dropIndex : dropIndex + 1
  ids.splice(fromIdx, 1)
  const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx
  ids.splice(adjustedTo, 0, draggedId.value!)
  emit('reorder-subprojects', ids)
  onDragEnd()
}

function handleSubPointerDown(e: PointerEvent, id: string) {
  if (e.pointerType !== 'touch') return
  const startX = e.clientX
  let started = false

  function onMove(ev: PointerEvent) {
    if (!started) {
      if (Math.abs(ev.clientX - startX) < 5) return
      started = true
      draggedId.value = id
    }
    const el = document.elementFromPoint(ev.clientX, ev.clientY) as HTMLElement | null
    const item = el?.closest('.subproject') as HTMLElement | null
    if (item) {
      const itemIndex = parseInt(item.dataset.index ?? '', 10)
      if (!isNaN(itemIndex)) {
        const rect = item.getBoundingClientRect()
        dragOverIndex.value = itemIndex
        dragOverSide.value = ev.clientX < rect.left + rect.width / 2 ? 'left' : 'right'
      }
    }
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (started && dragOverIndex.value !== null) {
      const ids = props.openSubprojects.map(s => s.id)
      const fromIdx = ids.indexOf(id)
      if (fromIdx !== -1) {
        const toIdx = dragOverSide.value === 'left' ? dragOverIndex.value : dragOverIndex.value + 1
        ids.splice(fromIdx, 1)
        const adjustedTo = toIdx > fromIdx ? toIdx - 1 : toIdx
        ids.splice(adjustedTo, 0, id)
        emit('reorder-subprojects', ids)
      }
    }
    onDragEnd()
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}
</script>

<style scoped>
.project-header {
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--color-border-base);
  background-color: var(--color-bg-base);
}
.header-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
}
.back-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
}
.back-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
.scratchpad-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: all 0.15s;
  position: relative;
}
.scratchpad-btn:hover { background: var(--color-bg-hover); color: var(--color-text-base); }
.scratchpad-btn.active { color: var(--color-primary); }
.header-tabs {
  display: flex;
  gap: 0.25rem;
  flex: 1;
  min-width: 0;
}
.header-tab {
  flex: 1;
  padding: 0.3rem 0.6rem;
  font-size: 0.8rem;
  font-weight: 500;
  background: transparent;
  border: none;
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  min-width: 0;
  transition: all 0.15s;
}
.header-tab:hover { background: var(--color-bg-hover); }
.header-tab.active { background: var(--color-bg-hover); color: var(--color-primary); }
.header-title {
  min-width: 0;
}
.header-title :deep(.title-text) {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: 1.25rem;
  font-weight: 400;
  color: var(--color-text-message);
}
.header-title :deep(.title-input) {
  font-family: Georgia, 'Palatino Linotype', serif;
  font-size: 1.25rem;
  font-weight: 400;
  width: 100%;
  padding: 2px 4px;
}
.header-title :deep(.inline-edit-wrapper) {
  width: 100%;
}
.subproject-bar {
  display: flex;
  align-items: center;
  padding: 0 0.5rem;
  gap: 0;
  border-top: 1px solid var(--color-border-subtle);
}
.tabs-scroll {
  display: flex;
  align-items: center;
  gap: 0;
  overflow-x: auto;
  flex: 1;
  scrollbar-width: none;
}
.tabs-scroll::-webkit-scrollbar { display: none; }
.tabs-separator {
  width: 1px;
  height: 16px;
  background: var(--color-border-subtle);
  margin: 0 0.15rem;
  flex-shrink: 0;
}
.home-tab {
  padding: 0.4rem 0.5rem !important;
}
.subproject {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.4rem 0.6rem;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.8rem;
  white-space: nowrap;
  transition: all 0.15s;
  position: relative;
}
.subproject:hover {
  color: var(--color-text-base);
  background: var(--color-bg-hover);
}
.subproject.active {
  color: var(--color-text-base);
  border-bottom-color: var(--color-primary, var(--color-border-accent));
}
.subproject.is-dragging {
  opacity: 0.4;
}
.subproject.drag-over-left::before {
  content: '';
  position: absolute;
  left: -1px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--color-primary);
  border-radius: 1px;
}
.subproject.drag-over-right::after {
  content: '';
  position: absolute;
  right: -1px;
  top: 4px;
  bottom: 4px;
  width: 2px;
  background: var(--color-primary);
  border-radius: 1px;
}
.subproject-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
}
.tab-name-input {
  font-family: system-ui, sans-serif;
  font-size: 0.8rem;
  width: 80px;
  padding: 0 2px;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 3px;
  color: var(--color-text-base);
}
.subproject-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-size: 0.9rem;
  line-height: 1;
  border-radius: 3px;
  opacity: 0;
  transition: all 0.1s;
}
.subproject:hover .subproject-close { opacity: 0.6; }
.subproject-close:hover { opacity: 1 !important; background: var(--color-bg-hover); color: var(--color-text-base); }
.subproject-add {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;
  transition: all 0.15s;
}
.subproject-add:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
</style>
