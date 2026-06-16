<template>
  <div class="global-tool-launcher">
    <button ref="btnRef" class="launcher-btn" :class="{ active: isOpen }" @click.stop="toggleMenu" title="Tool Library">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="isOpen" class="gtm-overlay" @pointerdown="handleOverlayDown" />
      <div v-if="isOpen" ref="menuRef" class="gtm-menu" :style="menuStyle">
        <div class="gtm-search-row">
          <svg class="gtm-search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            ref="searchInput"
            v-model="query"
            class="gtm-search"
            type="text"
            placeholder="Search tools..."
            @keydown.escape.stop="closeMenu"
          />
          <button :class="['gtm-sort-btn', { active: sortAsc !== 'default' }]" :title="sortAsc === 'default' ? 'Sort A-Z' : sortAsc === 'az' ? 'Sort Z-A' : 'Reset order'" @click.stop="cycleSort">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 8l4-4 4 4M7 4v16M17 16l-4 4-4-4M13 20V4" />
            </svg>
          </button>
        </div>
        <div class="gtm-list">
          <div
            v-for="t in filteredTemplates"
            :key="t.id"
            class="gtm-item"
            @click="handleSelect(t)"
          >
            <div class="gtm-item-text">
              <span class="gtm-item-name">{{ t.name }}</span>
              <span v-if="t.description" class="gtm-item-desc">{{ t.description }}</span>
            </div>
            <button class="gtm-item-delete" @click.stop="handleDelete(t)" title="Delete">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
          <div v-if="filteredTemplates.length === 0" class="gtm-empty">
            {{ query ? 'No matching tools' : 'No global tools yet' }}
          </div>
        </div>
        <div class="gtm-resize-handle" @pointerdown.stop="startResize" />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useGlobalToolStore } from '@/stores/globalTool'
import type { ToolTemplate } from '@/types/tool'

const SIZE_KEY = 'gtm-size'
const MIN_W = 200
const MIN_H = 160

const emit = defineEmits<{
  select: [template: ToolTemplate]
}>()

const globalToolStore = useGlobalToolStore()

const isOpen = ref(false)
const query = ref('')
const sortAsc = ref<'default' | 'az' | 'za'>('default')
const searchInput = ref<HTMLInputElement | null>(null)
const btnRef = ref<HTMLButtonElement | null>(null)
const menuRef = ref<HTMLDivElement | null>(null)
const menuStyle = ref<Record<string, string>>({})

function loadSavedSize(): { w: number; h: number } {
  try {
    const raw = localStorage.getItem(SIZE_KEY)
    if (raw) return JSON.parse(raw)
  } catch { /* */ }
  return { w: 280, h: 360 }
}

function saveSize(w: number, h: number) {
  localStorage.setItem(SIZE_KEY, JSON.stringify({ w, h }))
}

const filteredTemplates = computed(() => {
  const q = query.value.toLowerCase().trim()
  let list = globalToolStore.templateList
  if (q) {
    list = list.filter(t =>
      t.name.toLowerCase().includes(q) ||
      (t.description ?? '').toLowerCase().includes(q)
    )
  }
  const sorted = [...list]
  if (sortAsc.value === 'az') {
    sorted.sort((a, b) => a.name.localeCompare(b.name))
  } else if (sortAsc.value === 'za') {
    sorted.sort((a, b) => b.name.localeCompare(a.name))
  }
  return sorted
})

function cycleSort() {
  const next = sortAsc.value === 'default' ? 'az' : sortAsc.value === 'az' ? 'za' : 'default'
  sortAsc.value = next
}

function toggleMenu() {
  isOpen.value ? closeMenu() : openMenu()
}

function openMenu() {
  isOpen.value = true
  query.value = ''
  nextTick(() => {
    const btn = btnRef.value
    if (btn) {
      const rect = btn.getBoundingClientRect()
      const size = loadSavedSize()
      menuStyle.value = {
        position: 'fixed',
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${size.w}px`,
        height: `${size.h}px`,
      }
    }
    searchInput.value?.focus()
  })
}

function closeMenu() {
  isOpen.value = false
  query.value = ''
}

function handleOverlayDown(e: PointerEvent) {
  if (e.target === e.currentTarget) closeMenu()
}

function handleSelect(t: ToolTemplate) {
  emit('select', t)
  closeMenu()
}

function handleDelete(t: ToolTemplate) {
  if (!confirm(`Delete "${t.name}" from tool library?`)) return
  globalToolStore.deleteTemplate(t.id)
}

function startResize(e: PointerEvent) {
  const menu = menuRef.value
  if (!menu) return
  e.preventDefault()
  const startX = e.clientX
  const startY = e.clientY
  const startW = menu.offsetWidth
  const startH = menu.offsetHeight

  function onMove(ev: PointerEvent) {
    const w = Math.max(MIN_W, startW + ev.clientX - startX)
    const h = Math.max(MIN_H, startH + ev.clientY - startY)
    menu.style.width = `${w}px`
    menu.style.height = `${h}px`
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove)
    document.removeEventListener('pointerup', onUp)
    if (menu) saveSize(menu.offsetWidth, menu.offsetHeight)
  }

  document.addEventListener('pointermove', onMove)
  document.addEventListener('pointerup', onUp)
}

function onDocKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isOpen.value) {
    closeMenu()
    e.stopPropagation()
  }
}

onMounted(() => {
  document.addEventListener('keydown', onDocKeydown, true)
})
onBeforeUnmount(() => {
  document.removeEventListener('keydown', onDocKeydown, true)
})
</script>

<style scoped>
.global-tool-launcher {
  display: flex;
  align-items: center;
}

.launcher-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-subtle);
  border-radius: 4px;
  color: var(--color-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.launcher-btn:hover {
  background: var(--color-bg-hover);
  border-color: var(--color-border-base);
  color: var(--color-text-base);
}
.launcher-btn.active {
  background: var(--color-bg-hover);
  border-color: var(--color-primary);
  color: var(--color-text-base);
}
</style>

<style>
.gtm-overlay {
  position: fixed;
  inset: 0;
  z-index: 9998;
}

.gtm-menu {
  z-index: 9999;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 0;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  position: fixed;
}

.gtm-search-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.5rem 0.6rem;
  border-bottom: 1px solid var(--color-border-subtle);
}
.gtm-search-icon {
  flex-shrink: 0;
  color: var(--color-text-muted);
}
.gtm-search {
  flex: 1;
  border: none;
  outline: none;
  background: none;
  color: var(--color-text-base);
  font-size: 0.8rem;
  font-family: system-ui, sans-serif;
}
.gtm-search::placeholder {
  color: var(--color-text-placeholder);
}

.gtm-sort-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  transition: color 0.1s;
}
.gtm-sort-btn:hover {
  color: var(--color-text-base);
}
.gtm-sort-btn.active {
  color: var(--color-text-base);
  background: var(--color-bg-hover);
}

.gtm-list {
  flex: 1;
  overflow-y: auto;
  padding: 0.25rem;
  scrollbar-width: thin;
}

.gtm-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.45rem 0.5rem;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s;
  font-family: system-ui, sans-serif;
}
.gtm-item:hover {
  background: var(--color-bg-hover);
}
.gtm-item-text {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
}
.gtm-item-name {
  font-size: 0.8rem;
  color: var(--color-text-base);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.gtm-item-desc {
  font-size: 0.7rem;
  color: var(--color-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gtm-item-delete {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  background: none;
  border: none;
  border-radius: 2px;
  color: var(--color-text-muted);
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.1s;
}
.gtm-item:hover .gtm-item-delete {
  opacity: 1;
}
.gtm-item-delete:hover {
  background: var(--color-error-bg, rgba(220, 100, 100, 0.15));
  color: var(--color-error-text, #b33a3a);
}

.gtm-empty {
  padding: 1.5rem 0.5rem;
  text-align: center;
  font-size: 0.8rem;
  color: var(--color-text-muted);
  font-family: system-ui, sans-serif;
}

.gtm-resize-handle {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 14px;
  height: 14px;
  cursor: nwse-resize;
  z-index: 1;
  touch-action: none;
}
.gtm-resize-handle::after {
  content: '';
  position: absolute;
  bottom: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-right: 2px solid var(--color-text-muted);
  border-bottom: 2px solid var(--color-text-muted);
  opacity: 0.5;
}
.gtm-resize-handle:hover::after {
  opacity: 1;
}
</style>
