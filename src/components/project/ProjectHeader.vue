<template>
  <header class="project-header">
    <div class="header-row">
      <button class="back-btn" @click="$router.push({ name: 'projects' })" title="Back to projects">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      <InlineEdit
        class="header-title"
        textClass="title-text"
        inputClass="title-input"
        :modelValue="name"
        @save="(newName: string) => $emit('rename', newName)"
      />
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
          v-for="sub in subprojects"
          :key="sub.id"
          class="subproject"
          :class="{ active: sub.id === activeSubprojectId }"
          @click="$emit('switch-subproject', sub.id)"
          @dblclick="startRename(sub.id)"
        >
          <InlineEdit
            :ref="(el: any) => { if (el) inlineRefs[sub.id] = el }"
            :modelValue="sub.name"
            textClass="subproject-name"
            inputClass="tab-name-input"
            @save="(n: string) => $emit('rename-subproject', sub.id, n)"
          />
          <button
            v-if="subprojects.length > 1 && !isStreaming"
            class="subproject-close"
            @click.stop="$emit('delete-subproject', sub.id)"
            title="Delete subproject"
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

defineProps<{
  name: string
  subprojects: SubProject[]
  activeSubprojectId: string
  isStreaming?: boolean
  hasScratchpad?: boolean
}>()

defineEmits<{
  rename: [name: string]
  'switch-subproject': [subprojectId: string]
  'add-subproject': []
  'delete-subproject': [subprojectId: string]
  'rename-subproject': [subprojectId: string, name: string]
  'open-scratchpad': []
}>()

const inlineRefs = ref<Record<string, ComponentPublicInstance<{ startEditing: () => void }>>>({})

function startRename(subId: string) {
  inlineRefs.value[subId]?.startEditing()
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
.header-title {
  flex: 1;
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
.subproject-close:hover { opacity: 1 !important; background: var(--color-bg-hover); color: var(--color-error, #ef4444); }
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
