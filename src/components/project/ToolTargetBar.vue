<template>
  <div class="tool-target" v-if="tools.length > 0" ref="targetRef">
    <button class="tool-target-btn" @click="toggle">
      <span class="tool-indicator" :class="{ active: selectedId }"></span>
      <span class="tool-label">{{ selectedId ? selectedName : 'No tool selected' }}</span>
      <svg class="chevron" :class="{ open }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="6 9 12 15 18 9"></polyline>
      </svg>
    </button>
    <Teleport to="body">
      <div v-if="open" class="tool-dropdown-overlay" @click="open = false">
        <div class="tool-dropdown" ref="dropdownRef" :style="dropdownStyle" @click.stop>
          <button class="dropdown-item" :class="{ active: !selectedId }" @click="select(null)">
            <span class="item-indicator"></span>
            <span class="item-label">No tool (new)</span>
          </button>
          <button
            v-for="tool in tools"
            :key="tool.id"
            class="dropdown-item"
            :class="{ active: tool.id === selectedId }"
            @click="select(tool.id)"
          >
            <span class="item-indicator has-window"></span>
            <span class="item-label">{{ tool.title }}</span>
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import type { ProjectWindow } from '@/types/project'

const props = defineProps<{
  tools: ProjectWindow[]
  selectedId: string | null
}>()

const emit = defineEmits<{
  'update:selectedId': [id: string | null]
}>()

const open = ref(false)
const targetRef = ref<HTMLElement | null>(null)
const dropdownStyle = ref<Record<string, string>>({})

const selectedName = computed(() => {
  if (!props.selectedId) return ''
  return props.tools.find(t => t.id === props.selectedId)?.title ?? ''
})

function toggle() {
  open.value = !open.value
  if (open.value) {
    nextTick(positionDropdown)
  }
}

function positionDropdown() {
  if (!targetRef.value) return
  const rect = targetRef.value.getBoundingClientRect()
  dropdownStyle.value = {
    position: 'fixed',
    bottom: `${window.innerHeight - rect.top + 4}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

function select(id: string | null) {
  emit('update:selectedId', id)
  open.value = false
}

onMounted(() => window.addEventListener('resize', positionDropdown))
onUnmounted(() => window.removeEventListener('resize', positionDropdown))
</script>

<style scoped>
.tool-target {
  position: relative;
}
.tool-target-btn {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  padding: 0.3rem 0.6rem;
  background: none;
  border: none;
  color: var(--color-text-muted);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.75rem;
  border-radius: 4px 4px 0 0;
  transition: all 0.15s;
  width: 100%;
}
.tool-target-btn:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-base);
}
.tool-indicator {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--color-border-base);
  flex-shrink: 0;
  transition: background 0.15s;
}
.tool-indicator.active {
  background: var(--color-primary, #6366f1);
}
.tool-label {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chevron {
  flex-shrink: 0;
  transition: transform 0.15s;
}
.chevron.open {
  transform: rotate(180deg);
}
.tool-dropdown {
  position: absolute;
  bottom: 100%;
  left: 0;
  right: 0;
  background: var(--color-bg-elevated);
  border: 1px solid var(--color-border-base);
  border-radius: 6px;
  box-shadow: 0 -4px 16px rgba(0, 0, 0, 0.12);
  z-index: 50;
  padding: 0.25rem;
  max-height: 200px;
  overflow-y: auto;
}
.dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  width: 100%;
  padding: 0.4rem 0.5rem;
  background: none;
  border: none;
  color: var(--color-text-base);
  cursor: pointer;
  font-family: system-ui, sans-serif;
  font-size: 0.8rem;
  border-radius: 4px;
  text-align: left;
  transition: background 0.1s;
}
.dropdown-item:hover {
  background: var(--color-bg-hover);
}
.dropdown-item.active {
  color: var(--color-primary, #6366f1);
  font-weight: 500;
}
.item-indicator {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  border: 1.5px solid var(--color-border-base);
  flex-shrink: 0;
}
.item-indicator.has-window {
  background: var(--color-primary, #6366f1);
  border-color: var(--color-primary, #6366f1);
}
.item-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
